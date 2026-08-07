import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Form, Submission } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import { Prisma } from "@prisma/client";
import type {
  AddUser,
  CreateForm,
  CreateFormFromTemplate,
  DeleteForm,
  DeleteSubmission,
  DeleteSubmissions,
  DeleteUser,
  DuplicateForm,
  ImportForm,
  RemoveFormAccess,
  RenameFormTemplate,
  SaveFormAsTemplate,
  SetFormAccess,
  SubmitForm,
  UpdateForm,
  UpdateSubmission,
  UpdateSubmissionByToken,
  UpdateUser,
  UploadFile,
} from "wasp/server/operations";
import {
  createProviderId,
  createUser,
  ensurePasswordIsPresent,
  ensureValidPassword,
  ensureValidUsername,
  sanitizeAndSerializeProviderData,
} from "wasp/server/auth";
import type { FormField, FormSettings, SubmissionData } from "./types";
import { DEFAULT_FORM_SETTINGS } from "./types";
import {
  formatSequenceValue,
  stripSequenceCounters,
} from "./shared/sequence";
import {
  assertCanDeleteSubmission,
  assertCanEditSubmission,
  assertIsAdmin,
  assertIsOwnerOrAdmin,
  getFormAccessForUser,
  getRolesFromSettings,
  resolveFieldRestrictions,
} from "./server/access";
import { assertSubmissionDataValid } from "./server/fieldValidation";
import { buildCalcValues } from "./server/calc";
import { mergeSubmissionDataWithFieldRestrictions } from "./shared/formRoles";
import {
  actorFromEmail,
  actorFromUser,
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  diffFormDefinition,
  diffSubmissionData,
  formDiffHasChanges,
  recordAuditEvent,
} from "./server/audit";
import { sendWebhook } from "./server/notifications";
import {
  applyBeforeSubmitActions,
  runAfterSubmitActions,
} from "./server/formActions";
import { getRequestIp, getRequestUserAgent } from "./server/requestContext";
import {
  isTurnstileConfigured,
  verifyTurnstileToken,
} from "./server/turnstile";
import type { SubmissionContext } from "./shared/submissionContext";
import {
  BUILTIN_ROLE_VIEWER,
  defaultFormRoles,
  normalizeFormRoles,
} from "./shared/formRoles";

function serialize(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

type UserContext = {
  id: string;
  name?: string | null;
  role?: string;
  identities?: { username?: { id?: string } | null };
};

function resolveUpdatedBy(
  user: UserContext | undefined,
  field: FormField,
): string {
  const email = user?.identities?.username?.id ?? null;
  if (!user) {
    return "Anonymous";
  }
  if (field.valueSource === "name" && user.name?.trim()) {
    return user.name.trim();
  }
  return email?.trim() || user.name?.trim() || "Anonymous";
}

function buildSystemValues(
  formFields: unknown,
  user: UserContext | undefined,
  previousData?: SubmissionData,
): SubmissionData {
  const systemValues: SubmissionData = {};
  const now = new Date().toISOString();
  const fields = Array.isArray(formFields)
    ? (formFields as FormField[])
    : [];
  for (const field of fields) {
    if (field.readonly === false) {
      continue;
    }
    if (field.type === "created_date") {
      systemValues[field.key] = previousData?.[field.key] ?? now;
    } else if (field.type === "modified_date") {
      systemValues[field.key] = now;
    } else if (field.type === "updated_by_user") {
      systemValues[field.key] = resolveUpdatedBy(user, field);
    } else if (field.type === "sequence" && previousData) {
      // Preserve existing sequence on edit; never accept client-supplied values.
      systemValues[field.key] = previousData[field.key] ?? "";
    }
  }
  return systemValues;
}

/**
 * Atomically allocate the next sequence number(s) for a form and persist the
 * counters on Form.settings.sequenceCounters.
 */
async function allocateSequenceValues(
  formId: string,
  fields: FormField[],
): Promise<SubmissionData> {
  const sequenceFields = fields.filter((field) => field.type === "sequence");
  if (sequenceFields.length === 0) {
    return {};
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ settings: FormSettings | null }>
    >`
      SELECT settings FROM "Form" WHERE id = ${formId} FOR UPDATE
    `;
    const current = rows[0];
    if (!current) {
      throw new HttpError(404, "Form not found");
    }
    const settings: FormSettings = {
      ...DEFAULT_FORM_SETTINGS,
      ...((current.settings as FormSettings | null) ?? {}),
    };
    const counters = { ...(settings.sequenceCounters ?? {}) };
    const values: SubmissionData = {};

    for (const field of sequenceFields) {
      const start = field.sequenceStart ?? 1;
      const next = counters[field.key] ?? start;
      values[field.key] = formatSequenceValue(next, field);
      counters[field.key] = next + 1;
    }

    await tx.form.update({
      where: { id: formId },
      data: {
        settings: serialize({
          ...settings,
          sequenceCounters: counters,
        }),
      },
    });

    return values;
  });
}

function copyFormSettings(
  settings: unknown,
): FormSettings | undefined {
  if (!settings || typeof settings !== "object") {
    return undefined;
  }
  return stripSequenceCounters(settings as FormSettings);
}

type CreateFormArgs = {
  title: string;
  description?: string;
  fields: FormField[];
  settings?: FormSettings;
};

export const createForm: CreateForm<CreateFormArgs, Form> = async (
  { title, description, fields, settings },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  if (context.user.role === "VIEWER") {
    throw new HttpError(403, "Viewers cannot create forms");
  }

  if (!title?.trim()) {
    throw new HttpError(400, "Title is required");
  }

  if (!Array.isArray(fields)) {
    throw new HttpError(400, "fields must be an array of field definitions");
  }

  const mergedSettings: FormSettings = {
    ...DEFAULT_FORM_SETTINGS,
    ...(settings ?? {}),
    roles: normalizeFormRoles(settings?.roles ?? defaultFormRoles()),
  };

  const form = await context.entities.Form.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      fields: serialize(fields),
      settings: serialize(mergedSettings),
      user: {
        connect: {
          id: context.user.id,
        },
      },
    },
  });

  void recordAuditEvent({
    formId: form.id,
    formTitle: form.title,
    actor: actorFromUser(context.user),
    action: AUDIT_ACTIONS.FORM_CREATED,
    entityType: AUDIT_ENTITY_TYPES.FORM,
    entityId: form.id,
    summary: `Created form “${form.title}”`,
  });

  return form;
};

type UpdateFormArgs = {
  formId: string;
  title: string;
  description?: string;
  fields: FormField[];
  settings?: FormSettings;
};

export const updateForm: UpdateForm<UpdateFormArgs, Form> = async (
  { formId, title, description, fields, settings },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  if (!title?.trim()) {
    throw new HttpError(400, "Title is required");
  }

  if (!Array.isArray(fields)) {
    throw new HttpError(400, "fields must be an array of field definitions");
  }

  const access = await getFormAccessForUser(formId, context.user);
  assertIsOwnerOrAdmin(access);

  const existing = await context.entities.Form.findUnique({
    where: { id: formId },
    select: { title: true, fields: true, settings: true },
  });
  if (!existing) {
    throw new HttpError(404, "Form not found");
  }

  const existingSettings =
    (existing.settings as unknown as FormSettings | null) ?? {};
  const mergedSettings = settings
    ? {
        ...DEFAULT_FORM_SETTINGS,
        ...settings,
        roles: normalizeFormRoles(settings.roles),
        // Keep live counters; the builder does not manage them.
        sequenceCounters: existingSettings.sequenceCounters,
      }
    : undefined;

  const updated = await context.entities.Form.update({
    where: { id: formId },
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      fields: serialize(fields),
      settings: mergedSettings ? serialize(mergedSettings) : undefined,
    },
  });

  const prevFields = Array.isArray(existing.fields)
    ? (existing.fields as unknown as FormField[])
    : [];
  const prevSettings =
    (existing.settings as unknown as FormSettings | null) ?? null;
  const nextSettings =
    mergedSettings ??
    ((updated.settings as unknown as FormSettings | null) ?? null);
  const diff = diffFormDefinition(
    {
      title: existing.title,
      fields: prevFields,
      settings: prevSettings,
    },
    {
      title: updated.title,
      fields,
      settings: nextSettings,
    },
  );
  if (formDiffHasChanges(diff)) {
    void recordAuditEvent({
      formId: updated.id,
      formTitle: updated.title,
      actor: actorFromUser(context.user),
      action: AUDIT_ACTIONS.FORM_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.FORM,
      entityId: updated.id,
      summary: `Updated form “${updated.title}”`,
      changes: diff,
    });
  }

  return updated;
};

type DeleteFormArgs = {
  formId: string;
};

export const deleteForm: DeleteForm<DeleteFormArgs, void> = async (
  { formId },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const access = await getFormAccessForUser(formId, context.user);
  assertIsOwnerOrAdmin(access);

  const existing = await context.entities.Form.findUnique({
    where: { id: formId },
    select: { id: true, title: true },
  });
  if (!existing) {
    throw new HttpError(404, "Form not found");
  }

  await context.entities.Form.delete({
    where: { id: formId },
  });

  void recordAuditEvent({
    formId: null,
    formTitle: existing.title,
    actor: actorFromUser(context.user),
    action: AUDIT_ACTIONS.FORM_DELETED,
    entityType: AUDIT_ENTITY_TYPES.FORM,
    entityId: existing.id,
    summary: `Deleted form “${existing.title}”`,
  });
};

type SaveFormAsTemplateArgs = {
  formId: string;
};

export const saveFormAsTemplate: SaveFormAsTemplate<
  SaveFormAsTemplateArgs,
  Form
> = async ({ formId }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const access = await getFormAccessForUser(formId, context.user);
  assertIsOwnerOrAdmin(access);

  const form = await context.entities.Form.findUnique({
    where: { id: formId },
    select: { title: true, fields: true, settings: true },
  });
  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  const template = await context.entities.Form.create({
    data: {
      title: form.title,
      fields: serialize(form.fields),
      settings: (() => {
        const copied = copyFormSettings(form.settings);
        return copied ? serialize(copied) : undefined;
      })(),
      isTemplate: true,
      user: {
        connect: {
          id: context.user.id,
        },
      },
    },
  });

  void recordAuditEvent({
    formId: formId,
    formTitle: form.title,
    actor: actorFromUser(context.user),
    action: AUDIT_ACTIONS.FORM_TEMPLATE_SAVED,
    entityType: AUDIT_ENTITY_TYPES.FORM,
    entityId: template.id,
    summary: `Saved “${form.title}” as a template`,
    changes: { templateId: template.id },
  });

  return template;
};

type RenameFormTemplateArgs = {
  templateId: string;
  title: string;
};

export const renameFormTemplate: RenameFormTemplate<
  RenameFormTemplateArgs,
  Form
> = async ({ templateId, title }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  assertIsAdmin(context.user);

  const trimmed = title.trim();
  if (!trimmed) {
    throw new HttpError(400, "Title is required");
  }

  const template = await context.entities.Form.findUnique({
    where: { id: templateId },
    select: { id: true, title: true, isTemplate: true },
  });
  if (!template?.isTemplate) {
    throw new HttpError(404, "Template not found");
  }

  const updated = await context.entities.Form.update({
    where: { id: templateId },
    data: { title: trimmed },
  });

  if (template.title !== trimmed) {
    void recordAuditEvent({
      formId: null,
      formTitle: trimmed,
      actor: actorFromUser(context.user),
      action: AUDIT_ACTIONS.FORM_TEMPLATE_RENAMED,
      entityType: AUDIT_ENTITY_TYPES.FORM,
      entityId: template.id,
      summary: `Renamed template “${template.title}” to “${trimmed}”`,
      changes: { title: { from: template.title, to: trimmed } },
    });
  }

  return updated;
};

type DuplicateFormArgs = {
  formId: string;
};

export const duplicateForm: DuplicateForm<DuplicateFormArgs, Form> = async (
  { formId },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const access = await getFormAccessForUser(formId, context.user);
  assertIsOwnerOrAdmin(access);

  const form = await context.entities.Form.findUnique({
    where: { id: formId },
    select: { title: true, description: true, fields: true, settings: true },
  });
  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  const copy = await context.entities.Form.create({
    data: {
      title: `${form.title} (copy)`,
      description: form.description,
      fields: serialize(form.fields),
      settings: (() => {
        const copied = copyFormSettings(form.settings);
        return copied ? serialize(copied) : undefined;
      })(),
      user: {
        connect: {
          id: context.user.id,
        },
      },
    },
  });

  void recordAuditEvent({
    formId: copy.id,
    formTitle: copy.title,
    actor: actorFromUser(context.user),
    action: AUDIT_ACTIONS.FORM_CREATED,
    entityType: AUDIT_ENTITY_TYPES.FORM,
    entityId: copy.id,
    summary: `Duplicated form “${form.title}” → “${copy.title}”`,
    changes: { sourceFormId: formId },
  });

  return copy;
};

type CreateFormFromTemplateArgs = {
  templateId: string;
  title?: string;
};

export const createFormFromTemplate: CreateFormFromTemplate<
  CreateFormFromTemplateArgs,
  Form
> = async ({ templateId, title }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  if (context.user.role === "VIEWER") {
    throw new HttpError(403, "Viewers cannot create forms");
  }

  const template = await context.entities.Form.findUnique({
    where: { id: templateId },
    select: { title: true, fields: true, settings: true, isTemplate: true },
  });
  if (!template || !template.isTemplate) {
    throw new HttpError(404, "Template not found");
  }

  const finalTitle = title?.trim() || template.title;

  const created = await context.entities.Form.create({
    data: {
      title: finalTitle,
      fields: serialize(template.fields),
      settings: (() => {
        const copied = copyFormSettings(template.settings);
        return copied ? serialize(copied) : undefined;
      })(),
      user: {
        connect: {
          id: context.user.id,
        },
      },
    },
  });

  void recordAuditEvent({
    formId: created.id,
    formTitle: created.title,
    actor: actorFromUser(context.user),
    action: AUDIT_ACTIONS.FORM_CREATED,
    entityType: AUDIT_ENTITY_TYPES.FORM,
    entityId: created.id,
    summary: `Created form “${created.title}” from template`,
    changes: { templateId },
  });

  return created;
};

type ImportFormArgs = {
  title: string;
  fields: FormField[];
  settings?: FormSettings;
};

export const importForm: ImportForm<ImportFormArgs, Form> = async (
  { title, fields, settings },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  if (context.user.role === "VIEWER") {
    throw new HttpError(403, "Viewers cannot create forms");
  }

  if (!Array.isArray(fields)) {
    throw new HttpError(400, "fields must be an array of field definitions");
  }

  const created = await context.entities.Form.create({
    data: {
      title: title?.trim() || "Untitled (imported)",
      fields: serialize(fields),
      settings:
        settings && typeof settings === "object"
          ? serialize({
              ...stripSequenceCounters(settings),
              roles: normalizeFormRoles(settings.roles),
            })
          : undefined,
      user: {
        connect: {
          id: context.user.id,
        },
      },
    },
  });

  void recordAuditEvent({
    formId: created.id,
    formTitle: created.title,
    actor: actorFromUser(context.user),
    action: AUDIT_ACTIONS.FORM_CREATED,
    entityType: AUDIT_ENTITY_TYPES.FORM,
    entityId: created.id,
    summary: `Imported form “${created.title}”`,
  });

  return created;
};

type SubmitFormArgs = {
  formId: string;
  data: SubmissionData;
  submitterEmail?: string;
  context?: SubmissionContext;
};

export const submitForm: SubmitForm<SubmitFormArgs, Submission> = async (
  { formId, data, submitterEmail, context: clientContext },
  context,
) => {
  const form = await context.entities.Form.findUnique({
    where: { id: formId },
    select: { id: true, title: true, fields: true, settings: true },
  });

  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new HttpError(400, "data must be an object");
  }

  const settings: FormSettings = {
    ...DEFAULT_FORM_SETTINGS,
    ...((form.settings as unknown as FormSettings | null) ?? {}),
  };
  const editToken = settings.allowSelfEdit
    ? randomBytes(24).toString("hex")
    : null;

  const nowMs = new Date().getTime();
  if (settings.openDate && nowMs < new Date(settings.openDate).getTime()) {
    throw new HttpError(400, "This form is not open yet.");
  }
  if (settings.closeDate && nowMs > new Date(settings.closeDate).getTime()) {
    throw new HttpError(400, "This form is now closed.");
  }

  const formLoadedAtRaw = data["_formLoadedAt"];
  delete data["_formLoadedAt"];
  const minSeconds = settings.minSubmitSeconds;
  if (minSeconds && minSeconds > 0) {
    const loadedAt =
      typeof formLoadedAtRaw === "string" || typeof formLoadedAtRaw === "number"
        ? Number(formLoadedAtRaw)
        : NaN;
    if (!Number.isFinite(loadedAt) || nowMs - loadedAt < minSeconds * 1000) {
      throw new HttpError(
        400,
        "Please take a moment to review the form before submitting.",
      );
    }
  }

  const honeypotValue =
    typeof data["_honeypot"] === "string" ? data["_honeypot"] : "";
  delete data["_honeypot"];
  if (settings.honeypot && honeypotValue) {
    const timestamp = new Date();
    return {
      id: "spam-discarded",
      formId,
      data: serialize(data),
      context: null,
      editToken: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as unknown as Submission;
  }

  const fields = Array.isArray(form.fields)
    ? (form.fields as unknown as FormField[])
    : [];
  const captchaFields = fields.filter((field) => field.type === "captcha");
  if (captchaFields.length > 0) {
    if (!isTurnstileConfigured()) {
      throw new HttpError(
        500,
        "Captcha is enabled on this form but TURNSTILE_SECRET_KEY is not configured.",
      );
    }
    const remoteIp = getRequestIp();
    for (const field of captchaFields) {
      const token = data[field.key];
      delete data[field.key];
      const tokenStr = typeof token === "string" ? token : "";
      const ok = await verifyTurnstileToken(tokenStr, remoteIp);
      if (!ok) {
        throw new HttpError(
          400,
          "Captcha verification failed. Please try again.",
        );
      }
    }
  }

  for (const field of fields) {
    if (field.type === "sequence") {
      delete data[field.key];
    }
  }

  await assertSubmissionDataValid({
    fields,
    data,
    formId,
    conditions: settings.conditions,
    recordMode: "new",
  });

  if (settings.rateLimitPerHour) {
    const since = new Date(Date.now() - 3600000);
    const recentCount = await prisma.submission.count({
      where: { formId, createdAt: { gte: since } },
    });
    if (recentCount >= settings.rateLimitPerHour) {
      throw new HttpError(
        429,
        "Too many submissions. Please try again later.",
      );
    }
  }

  const contextUser = (context as unknown as { user?: UserContext }).user;

  let actorUser = contextUser;
  if (!actorUser && submitterEmail?.trim()) {
    const identity = await prisma.authIdentity.findUnique({
      where: {
        providerName_providerUserId: {
          providerName: "username",
          providerUserId: submitterEmail.trim().toLowerCase(),
        },
      },
      include: { auth: { include: { user: true } } },
    });
    if (identity?.auth?.user) {
      actorUser = {
        id: identity.auth.user.id,
        name: identity.auth.user.name,
        role: identity.auth.user.role,
        identities: { username: { id: submitterEmail.trim() } },
      };
    }
  }

  const systemValues = buildSystemValues(form.fields, actorUser);
  const sequenceValues = await allocateSequenceValues(formId, fields);

  const adjustedData = await applyBeforeSubmitActions(form, data);

  // Calc values are authoritative: recomputed server-side, never client-sent.
  const calcValues = await buildCalcValues(fields, {
    ...adjustedData,
    ...systemValues,
    ...sequenceValues,
  });

  const submissionContext: SubmissionContext = {
    ...(clientContext && typeof clientContext === "object"
      ? clientContext
      : {}),
    ip: getRequestIp(),
    userAgent:
      clientContext?.userAgent?.trim() || getRequestUserAgent() || undefined,
  };
  // Drop empty string values so the JSON stays tidy.
  for (const key of Object.keys(submissionContext) as (keyof SubmissionContext)[]) {
    if (!submissionContext[key]) {
      delete submissionContext[key];
    }
  }

  const submission = await context.entities.Submission.create({
    data: {
      form: {
        connect: {
          id: formId,
        },
      },
      data: serialize({
        ...adjustedData,
        ...systemValues,
        ...sequenceValues,
        ...calcValues,
      }),
      context: serialize(submissionContext),
      editToken,
    },
  });

  void sendWebhook(form, submission, "submission.created");
  void runAfterSubmitActions(form, submission, submitterEmail);

  void recordAuditEvent({
    formId: form.id,
    formTitle: form.title,
    actor: actorUser
      ? actorFromUser(actorUser)
      : actorFromEmail(submitterEmail),
    action: AUDIT_ACTIONS.SUBMISSION_CREATED,
    entityType: AUDIT_ENTITY_TYPES.SUBMISSION,
    entityId: submission.id,
    summary: `New submission on “${form.title}”`,
  });

  return submission;
};

type UpdateSubmissionArgs = {
  submissionId: string;
  data: SubmissionData;
};

export const updateSubmission: UpdateSubmission<
  UpdateSubmissionArgs,
  Submission
> = async ({ submissionId, data }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new HttpError(400, "data must be an object");
  }

  const submission = await context.entities.Submission.findUnique({
    where: { id: submissionId },
    select: {
      form: { select: { id: true, title: true, fields: true, settings: true } },
      data: true,
    },
  });
  if (!submission) {
    throw new HttpError(404, "Submission not found");
  }

  const access = await getFormAccessForUser(
    submission.form.id,
    context.user,
  );
  const previousData =
    submission.data && typeof submission.data === "object"
      ? (submission.data as SubmissionData)
      : {};
  assertCanEditSubmission(access, previousData, context.user);
  const fieldRestrictions = resolveFieldRestrictions(access);
  const systemValues = buildSystemValues(
    submission.form.fields,
    context.user as UserContext,
    previousData,
  );
  const fields = Array.isArray(submission.form.fields)
    ? (submission.form.fields as unknown as FormField[])
    : [];
  const mergedData = {
    ...mergeSubmissionDataWithFieldRestrictions(
      previousData,
      data,
      fieldRestrictions,
    ),
    ...systemValues,
  };
  // Calc values are authoritative: recomputed server-side on every save.
  const finalData = {
    ...mergedData,
    ...(await buildCalcValues(fields, mergedData)),
  };

  const updateSettings: FormSettings = {
    ...DEFAULT_FORM_SETTINGS,
    ...((submission.form.settings as unknown as FormSettings | null) ?? {}),
  };

  await assertSubmissionDataValid({
    fields,
    data: finalData,
    formId: submission.form.id,
    excludeSubmissionId: submissionId,
    conditions: updateSettings.conditions,
    recordMode: "update",
  });

  const updated = await context.entities.Submission.update({
    where: { id: submissionId },
    data: {
      data: serialize(finalData),
    },
  });

  void sendWebhook(
    submission.form,
    updated,
    "submission.updated",
  );

  const fieldChanges = diffSubmissionData(previousData, finalData, fields);
  void recordAuditEvent({
    formId: submission.form.id,
    formTitle: submission.form.title,
    actor: actorFromUser(context.user),
    action: AUDIT_ACTIONS.SUBMISSION_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.SUBMISSION,
    entityId: submissionId,
    summary:
      fieldChanges.length > 0
        ? `Updated submission (${fieldChanges.length} field${fieldChanges.length === 1 ? "" : "s"})`
        : "Updated submission",
    changes: { fields: fieldChanges },
  });

  return updated;
};

type UpdateSubmissionByTokenArgs = {
  submissionId: string;
  data: SubmissionData;
  token: string;
};

export const updateSubmissionByToken: UpdateSubmissionByToken<
  UpdateSubmissionByTokenArgs,
  Submission
> = async ({ submissionId, data, token }, context) => {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new HttpError(400, "data must be an object");
  }

  const submission = await context.entities.Submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      editToken: true,
      data: true,
      form: { select: { id: true, title: true, fields: true, settings: true } },
    },
  });
  if (!submission) {
    throw new HttpError(404, "Submission not found");
  }
  if (!submission.editToken || submission.editToken !== token) {
    throw new HttpError(403, "Invalid edit link");
  }

  const previousData =
    submission.data && typeof submission.data === "object"
      ? (submission.data as SubmissionData)
      : {};
  const systemValues = buildSystemValues(
    submission.form.fields,
    undefined,
    previousData,
  );
  const fields = Array.isArray(submission.form.fields)
    ? (submission.form.fields as unknown as FormField[])
    : [];
  const mergedData = {
    ...previousData,
    ...data,
    ...systemValues,
  };
  // Calc values are authoritative: recomputed server-side on every save.
  const finalData = {
    ...mergedData,
    ...(await buildCalcValues(fields, mergedData)),
  };

  const tokenUpdateSettings: FormSettings = {
    ...DEFAULT_FORM_SETTINGS,
    ...((submission.form.settings as unknown as FormSettings | null) ?? {}),
  };

  await assertSubmissionDataValid({
    fields,
    data: finalData,
    formId: submission.form.id,
    excludeSubmissionId: submissionId,
    conditions: tokenUpdateSettings.conditions,
    recordMode: "update",
  });

  const updated = await context.entities.Submission.update({
    where: { id: submissionId },
    data: {
      data: serialize(finalData),
    },
  });

  void sendWebhook(submission.form, updated, "submission.updated");

  const fieldChanges = diffSubmissionData(previousData, finalData, fields);
  void recordAuditEvent({
    formId: submission.form.id,
    formTitle: submission.form.title,
    actor: actorFromEmail(undefined),
    action: AUDIT_ACTIONS.SUBMISSION_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.SUBMISSION,
    entityId: submissionId,
    summary:
      fieldChanges.length > 0
        ? `Updated submission via edit link (${fieldChanges.length} field${fieldChanges.length === 1 ? "" : "s"})`
        : "Updated submission via edit link",
    changes: { fields: fieldChanges, viaToken: true },
  });

  return updated;
};

type DeleteSubmissionArgs = {
  submissionId: string;
};

export const deleteSubmission: DeleteSubmission<
  DeleteSubmissionArgs,
  void
> = async ({ submissionId }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const submission = await context.entities.Submission.findUnique({
    where: { id: submissionId },
    select: {
      form: { select: { id: true, title: true } },
      data: true,
    },
  });
  if (!submission) {
    throw new HttpError(404, "Submission not found");
  }

  const access = await getFormAccessForUser(
    submission.form.id,
    context.user,
  );
  const data =
    submission.data && typeof submission.data === "object"
      ? (submission.data as SubmissionData)
      : {};
  assertCanDeleteSubmission(access, data, context.user);

  await context.entities.Submission.delete({
    where: { id: submissionId },
  });

  void recordAuditEvent({
    formId: submission.form.id,
    formTitle: submission.form.title,
    actor: actorFromUser(context.user),
    action: AUDIT_ACTIONS.SUBMISSION_DELETED,
    entityType: AUDIT_ENTITY_TYPES.SUBMISSION,
    entityId: submissionId,
    summary: `Deleted submission on “${submission.form.title}”`,
  });
};

type DeleteSubmissionsArgs = {
  submissionIds: string[];
};

export const deleteSubmissions: DeleteSubmissions<
  DeleteSubmissionsArgs,
  void
> = async ({ submissionIds }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
    return;
  }

  const submissions = await context.entities.Submission.findMany({
    where: { id: { in: submissionIds } },
    select: {
      id: true,
      form: { select: { id: true, title: true } },
      data: true,
    },
  });
  for (const submission of submissions) {
    const access = await getFormAccessForUser(
      submission.form.id,
      context.user,
    );
    const data =
      submission.data && typeof submission.data === "object"
        ? (submission.data as SubmissionData)
        : {};
    assertCanDeleteSubmission(access, data, context.user);
  }

  await context.entities.Submission.deleteMany({
    where: { id: { in: submissionIds } },
  });

  for (const submission of submissions) {
    void recordAuditEvent({
      formId: submission.form.id,
      formTitle: submission.form.title,
      actor: actorFromUser(context.user),
      action: AUDIT_ACTIONS.SUBMISSION_DELETED,
      entityType: AUDIT_ENTITY_TYPES.SUBMISSION,
      entityId: submission.id,
      summary: `Deleted submission on “${submission.form.title}”`,
      changes: { bulk: true },
    });
  }
};

type UpdateUserArgs = {
  userId: string;
  name?: string;
  role?: string;
};

type UpdateUserResult = {
  id: string;
  name: string | null;
  role: string;
};

export const updateUser: UpdateUser<UpdateUserArgs, UpdateUserResult> = async (
  { userId, name, role },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  assertIsAdmin(context.user);

  const user = await context.entities.User.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  if (role && !["ADMIN", "EDITOR", "VIEWER"].includes(role)) {
    throw new HttpError(400, "Invalid role");
  }
  if (userId === context.user.id && role && role !== "ADMIN") {
    throw new HttpError(400, "You cannot change your own role");
  }

  const updated = await context.entities.User.update({
    where: { id: userId },
    data: {
      name: name === undefined ? user.name : (name.trim() || null),
      role: role === undefined ? user.role : (role as never),
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    role: updated.role,
  };
};

type AddUserArgs = {
  email: string;
  password: string;
  name?: string;
  role?: string;
};

type AddUserResult = {
  id: string;
  name: string | null;
  role: string;
  email: string;
};

export const addUser: AddUser<AddUserArgs, AddUserResult> = async (
  { email, password, name, role },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  assertIsAdmin(context.user);

  if (role && !["ADMIN", "EDITOR", "VIEWER"].includes(role)) {
    throw new HttpError(400, "Invalid role");
  }

  const normalizedEmail = email?.trim().toLowerCase();
  ensureValidUsername({ username: normalizedEmail });
  ensurePasswordIsPresent({ password });
  ensureValidPassword({ password });

  const providerId = createProviderId("username", normalizedEmail);
  const providerData = await sanitizeAndSerializeProviderData<"username">({
    hashedPassword: password,
  });

  let user;
  try {
    user = await createUser(providerId, providerData, {
      name: name?.trim() || null,
      role: (role ?? "EDITOR") as never,
    });
  } catch (e: unknown) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new HttpError(409, "A user with that email already exists");
    }
    throw e;
  }

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    email: normalizedEmail,
  };
};

type DeleteUserArgs = {
  userId: string;
};

export const deleteUser: DeleteUser<DeleteUserArgs, void> = async (
  { userId },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  assertIsAdmin(context.user);

  if (userId === context.user.id) {
    throw new HttpError(400, "You cannot delete your own account");
  }

  const user = await context.entities.User.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  await context.entities.User.delete({ where: { id: userId } });
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type UploadFileArgs = {
  formId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
};

type UploadFileResult = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

export const uploadFile: UploadFile<UploadFileArgs, UploadFileResult> = async (
  { formId, fileName, mimeType, sizeBytes, dataBase64 },
  context,
) => {
  const form = await context.entities.Form.findUnique({
    where: { id: formId },
    select: { id: true },
  });
  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  const cleanName =
    fileName.replace(/[^\w.\- ]+/g, "").trim().slice(0, 120) || "file";
  if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    throw new HttpError(
      400,
      `File must be between 1 byte and ${MAX_UPLOAD_BYTES / 1024 / 1024}MB`,
    );
  }
  if (!dataBase64) {
    throw new HttpError(400, "File data is required");
  }

  const buffer = Buffer.from(dataBase64, "base64");
  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    throw new HttpError(400, "File data is invalid or too large");
  }

  const uploadsDir =
    process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const storedName = `${randomUUID()}${path.extname(cleanName)}`;
  fs.writeFileSync(path.join(uploadsDir, storedName), buffer);

  const file = await context.entities.UploadedFile.create({
    data: {
      formId,
      originalName: cleanName,
      mimeType: mimeType || "application/octet-stream",
      sizeBytes: buffer.length,
      path: storedName,
    },
  });

  return {
    id: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  };
};

type SetFormAccessArgs = {
  formId: string;
  email: string;
  roleId: string;
};

type SetFormAccessResult = {
  id: string;
  roleId: string;
  user: { id: string; name: string | null; role: string };
};

export const setFormAccess: SetFormAccess<
  SetFormAccessArgs,
  SetFormAccessResult
> = async ({ formId, email, roleId }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const access = await getFormAccessForUser(formId, context.user);
  assertIsOwnerOrAdmin(access);

  const form = await context.entities.Form.findUnique({
    where: { id: formId },
    select: { userId: true, settings: true, title: true },
  });
  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  const roles = getRolesFromSettings(form.settings);
  const role = roles.find((r) => r.id === roleId);
  if (!role) {
    throw new HttpError(400, "Invalid form role");
  }

  const identity = await prisma.authIdentity.findUnique({
    where: {
      providerName_providerUserId: {
        providerName: "username",
        providerUserId: email.trim().toLowerCase(),
      },
    },
    include: { auth: { include: { user: true } } },
  });
  const targetUser = identity?.auth?.user;
  if (!targetUser) {
    throw new HttpError(404, "No user found with that email");
  }

  if (form.userId === targetUser.id) {
    throw new HttpError(400, "That user already owns this form");
  }

  const existing = await context.entities.FormAccess.findUnique({
    where: {
      formId_userId: { formId, userId: targetUser.id },
    },
  });

  const entry = await context.entities.FormAccess.upsert({
    where: {
      formId_userId: { formId, userId: targetUser.id },
    },
    create: {
      formId,
      userId: targetUser.id,
      roleId: role.id,
    },
    update: { roleId: role.id },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  void recordAuditEvent({
    formId,
    formTitle: form.title,
    actor: actorFromUser(context.user),
    action: existing
      ? AUDIT_ACTIONS.ACCESS_UPDATED
      : AUDIT_ACTIONS.ACCESS_GRANTED,
    entityType: AUDIT_ENTITY_TYPES.FORM_ACCESS,
    entityId: entry.id,
    summary: existing
      ? `Updated access for ${email.trim().toLowerCase()} → ${role.label}`
      : `Granted ${role.label} to ${email.trim().toLowerCase()}`,
    changes: {
      userId: targetUser.id,
      email: email.trim().toLowerCase(),
      roleId: role.id,
      previousRoleId: existing?.roleId ?? null,
    },
  });

  return {
    id: entry.id,
    roleId: entry.roleId,
    user: entry.user,
  };
};

type RemoveFormAccessArgs = {
  formId: string;
  userId: string;
};

export const removeFormAccess: RemoveFormAccess<
  RemoveFormAccessArgs,
  void
> = async ({ formId, userId }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const access = await getFormAccessForUser(formId, context.user);
  assertIsOwnerOrAdmin(access);

  const form = await context.entities.Form.findUnique({
    where: { id: formId },
    select: { title: true },
  });
  const existing = await context.entities.FormAccess.findUnique({
    where: { formId_userId: { formId, userId } },
  });

  await context.entities.FormAccess.deleteMany({
    where: { formId, userId },
  });

  if (existing) {
    void recordAuditEvent({
      formId,
      formTitle: form?.title ?? null,
      actor: actorFromUser(context.user),
      action: AUDIT_ACTIONS.ACCESS_REVOKED,
      entityType: AUDIT_ENTITY_TYPES.FORM_ACCESS,
      entityId: existing.id,
      summary: `Revoked access for user ${userId}`,
      changes: { userId, previousRoleId: existing.roleId },
    });
  }
};
