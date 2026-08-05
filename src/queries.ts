import type { Form, Submission } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import type {
  GetForm,
  GetFormAccess,
  GetFormSubmissions,
  GetForms,
  GetFormUsers,
  GetSubmission,
  GetUsers,
} from "wasp/server/operations";
import {
  assertCanView,
  assertIsAdmin,
  assertIsOwnerOrAdmin,
  getFormAccessForUser,
} from "./server/access";

export type FormWithSubmissionsCount = Form & {
  _count: { submissions: number };
};

export type FormAccessLevelValue = "owner" | "edit" | "view";

export type FormWithAccess = FormWithSubmissionsCount & {
  access: FormAccessLevelValue;
};

export type AdminUser = {
  id: string;
  name: string | null;
  role: string;
  email: string | null;
  createdAt: Date;
};

export type UserOption = {
  id: string;
  name: string | null;
  email: string;
};

export type FormAccessEntry = {
  id: string;
  level: "VIEW" | "EDIT";
  user: { id: string; name: string | null; role: string };
};

export type FormAccessInfo = {
  formId: string;
  owner: { id: string; name: string | null; role: string };
  entries: FormAccessEntry[];
};

export type SubmissionsResult = {
  access: "owner" | "admin" | "edit" | "view";
  submissions: Submission[];
};

export type SubmissionResult = {
  access: "owner" | "admin" | "edit" | "view";
  submission: Submission;
};

export const getForms: GetForms<void, FormWithAccess[]> = async (
  _args,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const user = context.user;

  const isAdmin = user.role === "ADMIN";

  const ownedForms = await context.entities.Form.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { submissions: true } },
    },
  });

  const sharedAccess = isAdmin
    ? []
    : await context.entities.FormAccess.findMany({
        where: { userId: user.id },
        include: {
          form: {
            include: { _count: { select: { submissions: true } } },
          },
        },
        orderBy: { form: { createdAt: "desc" } },
      });

  const sharedForms: FormWithAccess[] = sharedAccess
    .filter((a) => a.form.userId !== user.id)
    .map((a) => ({
      ...a.form,
      access: a.level === "EDIT" ? "edit" : "view",
    }));

  let adminForms: FormWithAccess[] = [];
  if (isAdmin) {
    const allForms = await context.entities.Form.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { submissions: true } } },
    });
    adminForms = allForms.map((form) => ({
      ...form,
      access: form.userId === user.id ? "owner" : "edit",
    }));
  }

  const owned: FormWithAccess[] = ownedForms.map((form) => ({
    ...form,
    access: "owner",
  }));

  const seen = new Set<string>();
  const combined = [...adminForms, ...owned, ...sharedForms].filter((form) => {
    if (seen.has(form.id)) {
      return false;
    }
    seen.add(form.id);
    return true;
  });

  return combined.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
};

export const getForm: GetForm<{ id: string }, Form | null> = (
  { id },
  context,
) => {
  return context.entities.Form.findUnique({
    where: { id },
  });
};

export const getFormSubmissions: GetFormSubmissions<
  { formId: string },
  SubmissionsResult
> = async ({ formId }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const access = await getFormAccessForUser(formId, context.user);
  assertCanView(access);

  const submissions = await context.entities.Submission.findMany({
    where: { formId },
    orderBy: { createdAt: "desc" },
  });

  const kind: SubmissionsResult["access"] =
    access.kind === "admin"
      ? "admin"
      : access.kind === "owner"
        ? "owner"
        : access.level === "EDIT"
          ? "edit"
          : "view";

  return { access: kind, submissions };
};

export const getSubmission: GetSubmission<
  { submissionId: string },
  SubmissionResult
> = async ({ submissionId }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const submission = await context.entities.Submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) {
    throw new HttpError(404, "Submission not found");
  }

  const access = await getFormAccessForUser(submission.formId, context.user);
  assertCanView(access);

  const kind: SubmissionResult["access"] =
    access.kind === "admin"
      ? "admin"
      : access.kind === "owner"
        ? "owner"
        : access.level === "EDIT"
          ? "edit"
          : "view";

  return { access: kind, submission };
};

export const getUsers: GetUsers<void, AdminUser[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  assertIsAdmin(context.user);

  const users = await prisma.user.findMany({
    include: { auth: { include: { identities: true } } },
    orderBy: { createdAt: "asc" },
  });

  return users.map((user) => {
    const usernameIdentity = user.auth?.identities.find(
      (identity) => identity.providerName === "username",
    );
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      email: usernameIdentity?.providerUserId ?? null,
      createdAt: user.createdAt,
    };
  });
};

export const getFormUsers: GetFormUsers<void, UserOption[]> = async (
  _args,
  context,
) => {
  const users = await context.entities.User.findMany({
    include: { auth: { include: { identities: true } } },
    orderBy: { name: { sort: "asc", nulls: "last" } },
  });

  return users.map((user) => {
    const usernameIdentity = user.auth?.identities.find(
      (identity) => identity.providerName === "username",
    );
    return {
      id: user.id,
      name: user.name,
      email: usernameIdentity?.providerUserId ?? "",
    };
  });
};

export const getFormAccess: GetFormAccess<
  { formId: string },
  FormAccessInfo
> = async ({ formId }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const access = await getFormAccessForUser(formId, context.user);
  assertIsOwnerOrAdmin(access);

  const form = await context.entities.Form.findUnique({
    where: { id: formId },
    select: {
      id: true,
      userId: true,
      user: { select: { id: true, name: true, role: true } },
    },
  });
  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  const entries = await context.entities.FormAccess.findMany({
    where: { formId },
    include: {
      user: {
        select: { id: true, name: true, role: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    formId: form.id,
    owner: form.user,
    entries: entries.map((entry) => ({
      id: entry.id,
      level: entry.level,
      user: entry.user,
    })),
  };
};
