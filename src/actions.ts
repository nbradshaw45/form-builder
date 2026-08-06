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
  assertCanEdit,
  assertIsAdmin,
  assertIsOwnerOrAdmin,
  getFormAccessForUser,
} from "./server/access";
import { sendWebhook } from "./server/notifications";
import {
  applyBeforeSubmitActions,
  runAfterSubmitActions,
} from "./server/formActions";

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
    }
  }
  return systemValues;
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

  return context.entities.Form.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      fields: serialize(fields),
      settings: settings ? serialize(settings) : undefined,
      user: {
        connect: {
          id: context.user.id,
        },
      },
    },
  });
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

  return context.entities.Form.update({
    where: { id: formId },
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      fields: serialize(fields),
      settings: settings ? serialize(settings) : undefined,
    },
  });
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

  await context.entities.Form.delete({
    where: { id: formId },
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

  return context.entities.Form.create({
    data: {
      title: form.title,
      fields: serialize(form.fields),
      settings: form.settings ? serialize(form.settings) : undefined,
      isTemplate: true,
      user: {
        connect: {
          id: context.user.id,
        },
      },
    },
  });
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

  return context.entities.Form.create({
    data: {
      title: `${form.title} (copy)`,
      description: form.description,
      fields: serialize(form.fields),
      settings: form.settings ? serialize(form.settings) : undefined,
      user: {
        connect: {
          id: context.user.id,
        },
      },
    },
  });
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

  return context.entities.Form.create({
    data: {
      title: finalTitle,
      fields: serialize(template.fields),
      settings: template.settings ? serialize(template.settings) : undefined,
      user: {
        connect: {
          id: context.user.id,
        },
      },
    },
  });
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

  return context.entities.Form.create({
    data: {
      title: title?.trim() || "Untitled (imported)",
      fields: serialize(fields),
      settings:
        settings && typeof settings === "object"
          ? serialize(settings)
          : undefined,
      user: {
        connect: {
          id: context.user.id,
        },
      },
    },
  });
};

type SubmitFormArgs = {
  formId: string;
  data: SubmissionData;
  submitterEmail?: string;
};

export const submitForm: SubmitForm<SubmitFormArgs, Submission> = async (
  { formId, data, submitterEmail },
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

  const honeypotValue =
    typeof data["_honeypot"] === "string" ? data["_honeypot"] : "";
  delete data["_honeypot"];
  if (settings.honeypot && honeypotValue) {
    const timestamp = new Date();
    return {
      id: "spam-discarded",
      formId,
      data: serialize(data),
      editToken: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as unknown as Submission;
  }

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

  const adjustedData = await applyBeforeSubmitActions(form, data);

  const submission = await context.entities.Submission.create({
    data: {
      form: {
        connect: {
          id: formId,
        },
      },
      data: serialize({ ...adjustedData, ...systemValues }),
      editToken,
    },
  });

  void sendWebhook(form, submission, "submission.created");
  void runAfterSubmitActions(form, submission, submitterEmail);

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
  assertCanEdit(access);

  const previousData =
    submission.data && typeof submission.data === "object"
      ? (submission.data as SubmissionData)
      : {};
  const systemValues = buildSystemValues(
    submission.form.fields,
    undefined,
    previousData,
  );

  const updated = await context.entities.Submission.update({
    where: { id: submissionId },
    data: {
      data: serialize({
        ...previousData,
        ...data,
        ...systemValues,
      }),
    },
  });

  void sendWebhook(
    submission.form,
    updated,
    "submission.updated",
  );

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

  const updated = await context.entities.Submission.update({
    where: { id: submissionId },
    data: {
      data: serialize({
        ...previousData,
        ...data,
        ...systemValues,
      }),
    },
  });

  void sendWebhook(submission.form, updated, "submission.updated");

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
    select: { form: { select: { id: true } } },
  });
  if (!submission) {
    throw new HttpError(404, "Submission not found");
  }

  const access = await getFormAccessForUser(
    submission.form.id,
    context.user,
  );
  assertCanEdit(access);

  await context.entities.Submission.delete({
    where: { id: submissionId },
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
    select: { form: { select: { id: true } } },
  });
  for (const submission of submissions) {
    const access = await getFormAccessForUser(
      submission.form.id,
      context.user,
    );
    assertCanEdit(access);
  }

  await context.entities.Submission.deleteMany({
    where: { id: { in: submissionIds } },
  });
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
  level: "VIEW" | "EDIT";
};

type SetFormAccessResult = {
  id: string;
  level: "VIEW" | "EDIT";
  user: { id: string; name: string | null; role: string };
};

export const setFormAccess: SetFormAccess<
  SetFormAccessArgs,
  SetFormAccessResult
> = async ({ formId, email, level }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  if (level !== "VIEW" && level !== "EDIT") {
    throw new HttpError(400, "Invalid access level");
  }

  const access = await getFormAccessForUser(formId, context.user);
  assertIsOwnerOrAdmin(access);

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

  const form = await context.entities.Form.findUnique({
    where: { id: formId },
    select: { userId: true },
  });
  if (form?.userId === targetUser.id) {
    throw new HttpError(400, "That user already owns this form");
  }

  const entry = await context.entities.FormAccess.upsert({
    where: {
      formId_userId: { formId, userId: targetUser.id },
    },
    create: {
      formId,
      userId: targetUser.id,
      level,
    },
    update: { level },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  return {
    id: entry.id,
    level: entry.level,
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

  await context.entities.FormAccess.deleteMany({
    where: { formId, userId },
  });
};
