import type { Form, Submission } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import type {
  CreateForm,
  DeleteForm,
  DeleteSubmission,
  RemoveFormAccess,
  SetFormAccess,
  SubmitForm,
  UpdateForm,
  UpdateSubmission,
  UpdateUser,
} from "wasp/server/operations";
import type { FormField, SubmissionData } from "./types";
import {
  assertCanEdit,
  assertIsAdmin,
  assertIsOwnerOrAdmin,
  getFormAccessForUser,
} from "./server/access";

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
};

export const createForm: CreateForm<CreateFormArgs, Form> = async (
  { title, description, fields },
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
};

export const updateForm: UpdateForm<UpdateFormArgs, Form> = async (
  { formId, title, description, fields },
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
    select: { id: true, fields: true },
  });

  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new HttpError(400, "data must be an object");
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

  return context.entities.Submission.create({
    data: {
      form: {
        connect: {
          id: formId,
        },
      },
      data: serialize({ ...data, ...systemValues }),
    },
  });
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
      form: { select: { id: true, fields: true } },
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
    context.user,
    previousData,
  );

  return context.entities.Submission.update({
    where: { id: submissionId },
    data: {
      data: serialize({
        ...previousData,
        ...data,
        ...systemValues,
      }),
    },
  });
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
