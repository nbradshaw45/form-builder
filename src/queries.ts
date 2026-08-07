import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import type { Form, Submission } from "wasp/entities";
import type { FormField, FormSettings, SubmissionData } from "./types";
import { HttpError, prisma } from "wasp/server";
import type {
  ExportForm,
  GetFile,
  GetForm,
  GetFormAccess,
  GetFormSubmissions,
  GetForms,
  GetFormTemplates,
  GetFormUsers,
  GetSubmission,
  GetSubmissionByToken,
  GetSubmissionPdf,
  GetSubmissionsCsv,
  GetSubmissionsExcel,
  GetUsers,
} from "wasp/server/operations";
import {
  assertCanView,
  assertCanViewSubmission,
  assertIsAdmin,
  assertIsOwnerOrAdmin,
  accessKindForClient,
  getFormAccessForUser,
  getRolesFromSettings,
  resolveFieldRestrictions,
  resolveRecordPermissions,
} from "./server/access";
import { buildSubmissionPdf, collectFileUploadIds } from "./server/pdf";
import type { FieldRestrictions, RecordPermissions } from "./types";
import { BUILTIN_ROLE_VIEWER } from "./shared/formRoles";
import { redactSubmissionData } from "./shared/formRoles";

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
  roleId: string;
  roleLabel: string;
  user: { id: string; name: string | null; role: string };
};

export type FormAccessInfo = {
  formId: string;
  owner: { id: string; name: string | null; role: string };
  roles: { id: string; label: string }[];
  entries: FormAccessEntry[];
};

export type SubmissionWithPermissions = Submission & {
  permissions: RecordPermissions;
};

export type SubmissionsResult = {
  access: "owner" | "admin" | "edit" | "view";
  roleId: string | null;
  fieldRestrictions: FieldRestrictions;
  submissions: SubmissionWithPermissions[];
};

export type SubmissionResult = {
  access: "owner" | "admin" | "edit" | "view";
  roleId: string | null;
  permissions: RecordPermissions;
  fieldRestrictions: FieldRestrictions;
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
    where: { userId: user.id, isTemplate: false },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { submissions: true } },
    },
  });

  const sharedAccess = isAdmin
    ? []
    : await context.entities.FormAccess.findMany({
        where: { userId: user.id, form: { isTemplate: false } },
        include: {
          form: {
            include: { _count: { select: { submissions: true } } },
          },
        },
        orderBy: { form: { createdAt: "desc" } },
      });

  const sharedForms: FormWithAccess[] = sharedAccess
    .filter((a) => a.form.userId !== user.id)
    .map((a) => {
      const roles = getRolesFromSettings(a.form.settings);
      const role =
        roles.find((r) => r.id === a.roleId) ??
        roles.find((r) => r.id === BUILTIN_ROLE_VIEWER) ??
        roles[0];
      const canMutate =
        role.edit.allowed === true || role.delete.allowed === true;
      return {
        ...a.form,
        access: (canMutate ? "edit" : "view") as FormAccessLevelValue,
      };
    });

  let adminForms: FormWithAccess[] = [];
  if (isAdmin) {
    const allForms = await context.entities.Form.findMany({
      where: { isTemplate: false },
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

export type FormTemplateSummary = {
  id: string;
  title: string;
  createdAt: Date;
};

export const getFormTemplates: GetFormTemplates<
  void,
  FormTemplateSummary[]
> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  if (context.user.role === "VIEWER") {
    throw new HttpError(403, "Viewers cannot use form templates");
  }

  return context.entities.Form.findMany({
    where: { isTemplate: true },
    select: { id: true, title: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
};

export type ExportFormResult = {
  title: string;
  fields: FormField[];
  settings: FormSettings | null;
  exportedAt: string;
  version: 1;
};

export const exportForm: ExportForm<{ formId: string }, ExportFormResult> =
  async ({ formId }, context) => {
    if (!context.user) {
      throw new HttpError(401);
    }

    const access = await getFormAccessForUser(formId, context.user);
    assertCanView(access);

    const form = await context.entities.Form.findUnique({
      where: { id: formId },
      select: { title: true, fields: true, settings: true },
    });
    if (!form) {
      throw new HttpError(404, "Form not found");
    }

    return {
      title: form.title,
      fields: Array.isArray(form.fields)
        ? (form.fields as unknown as FormField[])
        : [],
      settings: (form.settings as unknown as FormSettings | null) ?? null,
      exportedAt: new Date().toISOString(),
      version: 1,
    };
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

  const withPermissions: SubmissionWithPermissions[] = [];
  const fieldRestrictions = resolveFieldRestrictions(access);
  for (const submission of submissions) {
    const data =
      submission.data && typeof submission.data === "object"
        ? (submission.data as SubmissionData)
        : {};
    const permissions = resolveRecordPermissions(access, data, context.user);
    if (!permissions.view) {
      continue;
    }
    withPermissions.push({
      ...submission,
      data: redactSubmissionData(data, fieldRestrictions.cannotView),
      permissions,
    });
  }

  return {
    access: accessKindForClient(access),
    roleId: access.kind === "shared" ? access.roleId : null,
    fieldRestrictions,
    submissions: withPermissions,
  };
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

  const data =
    submission.data && typeof submission.data === "object"
      ? (submission.data as SubmissionData)
      : {};
  assertCanViewSubmission(access, data, context.user);
  const permissions = resolveRecordPermissions(access, data, context.user);
  const fieldRestrictions = resolveFieldRestrictions(access);

  return {
    access: accessKindForClient(access),
    roleId: access.kind === "shared" ? access.roleId : null,
    permissions,
    fieldRestrictions,
    submission: {
      ...submission,
      data: redactSubmissionData(data, fieldRestrictions.cannotView),
    },
  };
};

export type GetFileResult = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
};

export const getFile: GetFile<{ fileId: string }, GetFileResult> = async (
  { fileId },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const file = await context.entities.UploadedFile.findUnique({
    where: { id: fileId },
  });
  if (!file) {
    throw new HttpError(404, "File not found");
  }

  const access = await getFormAccessForUser(file.formId, context.user);
  assertCanView(access);

  const uploadsDir =
    process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
  const storedPath = path.resolve(uploadsDir, file.path);
  if (!storedPath.startsWith(path.resolve(uploadsDir))) {
    throw new HttpError(400, "Invalid file path");
  }
  if (!fs.existsSync(storedPath)) {
    throw new HttpError(404, "File not found on disk");
  }

  return {
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    dataBase64: fs.readFileSync(storedPath).toString("base64"),
  };
};

export type GetSubmissionByTokenResult = {
  access: "owner" | "admin" | "edit" | "view";
  roleId: string | null;
  permissions: RecordPermissions;
  fieldRestrictions: FieldRestrictions;
  submission: Submission;
};

export const getSubmissionByToken: GetSubmissionByToken<
  { submissionId: string; token: string },
  GetSubmissionByTokenResult
> = async ({ submissionId, token }, context) => {
  const submission = await context.entities.Submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) {
    throw new HttpError(404, "Submission not found");
  }
  if (!submission.editToken || submission.editToken !== token) {
    throw new HttpError(403, "Invalid edit link");
  }
  return {
    access: "edit",
    roleId: null,
    permissions: { view: true, edit: true, delete: false },
    fieldRestrictions: { cannotView: [], cannotEdit: [] },
    submission,
  };
};

export type SubmissionsCsvResult = {
  fileName: string;
  content: string;
};

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = Array.isArray(value) ? value.join(", ") : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const getSubmissionsCsv: GetSubmissionsCsv<
  { formId: string; submissionIds?: string[] },
  SubmissionsCsvResult
> = async ({ formId, submissionIds }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const access = await getFormAccessForUser(formId, context.user);
  assertCanView(access);
  const fieldRestrictions = resolveFieldRestrictions(access);
  const hiddenKeys = new Set(fieldRestrictions.cannotView);

  const form = await context.entities.Form.findUnique({
    where: { id: formId },
    include: { submissions: true },
  });
  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  const fields = Array.isArray(form.fields)
    ? (form.fields as unknown as FormField[])
    : [];
  const keys: string[] = [];
  const keyToLabel = new Map(fields.map((field) => [field.key, field.label]));
  for (const field of fields) {
    if (
      field.type === "section_header" ||
      field.type === "divider" ||
      field.type === "paragraph"
    ) {
      continue;
    }
    if (field.showInTable === false) {
      continue;
    }
    if (hiddenKeys.has(field.key)) {
      continue;
    }
    if (!keys.includes(field.key)) {
      keys.push(field.key);
    }
  }
  for (const submission of form.submissions) {
    const data = submission.data as Record<string, unknown>;
    for (const key of Object.keys(data)) {
      if (hiddenKeys.has(key)) {
        continue;
      }
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }

  const header = [
    ...keys.map((key) => keyToLabel.get(key) ?? key),
    "Submitted at",
    "Updated at",
  ];
  const selectedSet = submissionIds ? new Set(submissionIds) : null;
  const rows = form.submissions
    .filter((submission) => {
      if (selectedSet && !selectedSet.has(submission.id)) {
        return false;
      }
      const data =
        submission.data && typeof submission.data === "object"
          ? (submission.data as SubmissionData)
          : {};
      return resolveRecordPermissions(access, data, context.user).view;
    })
    .map((submission) => {
      const data = submission.data as Record<string, unknown>;
      return [
        ...keys.map((key) => csvEscape(data[key])),
        csvEscape(submission.createdAt.toISOString()),
        csvEscape(submission.updatedAt.toISOString()),
      ];
    });
  const content = [
    header.map(csvEscape).join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  return { fileName: `${form.title}.csv`, content };
};

export type SubmissionsExcelResult = {
  fileName: string;
  dataBase64: string;
};

export const getSubmissionsExcel: GetSubmissionsExcel<
  { formId: string; submissionIds?: string[] },
  SubmissionsExcelResult
> = async ({ formId, submissionIds }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const access = await getFormAccessForUser(formId, context.user);
  assertCanView(access);
  const fieldRestrictions = resolveFieldRestrictions(access);
  const hiddenKeys = new Set(fieldRestrictions.cannotView);

  const form = await context.entities.Form.findUnique({
    where: { id: formId },
    include: { submissions: true },
  });
  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  const fields = Array.isArray(form.fields)
    ? (form.fields as unknown as FormField[])
    : [];
  const keys: string[] = [];
  const keyToLabel = new Map(fields.map((field) => [field.key, field.label]));
  for (const field of fields) {
    if (
      field.type === "section_header" ||
      field.type === "divider" ||
      field.type === "paragraph" ||
      field.type === "hidden"
    ) {
      continue;
    }
    if (field.showInTable === false) {
      continue;
    }
    if (hiddenKeys.has(field.key)) {
      continue;
    }
    if (!keys.includes(field.key)) {
      keys.push(field.key);
    }
  }
  for (const submission of form.submissions) {
    const data = submission.data as Record<string, unknown>;
    for (const key of Object.keys(data)) {
      if (hiddenKeys.has(key)) {
        continue;
      }
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Submissions");
  sheet.columns = [
    ...keys.map((key) => ({
      header: keyToLabel.get(key) ?? key,
      key,
      width: 24,
    })),
    { header: "Submitted at", key: "_submittedAt", width: 24 },
    { header: "Updated at", key: "_updatedAt", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };

  const selectedSet = submissionIds ? new Set(submissionIds) : null;
  for (const submission of form.submissions) {
    if (selectedSet && !selectedSet.has(submission.id)) {
      continue;
    }
    const data = submission.data as Record<string, unknown>;
    if (
      !resolveRecordPermissions(access, data, context.user).view
    ) {
      continue;
    }
    const row: Record<string, unknown> = {
      _submittedAt: submission.createdAt.toISOString(),
      _updatedAt: submission.updatedAt.toISOString(),
    };
    for (const key of keys) {
      const value = data[key];
      row[key] = Array.isArray(value) ? value.join(", ") : value;
    }
    sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    fileName: `${form.title}.xlsx`,
    dataBase64: Buffer.from(buffer).toString("base64"),
  };
};

export type SubmissionPdfResult = {
  filename: string;
  base64: string;
};

export const getSubmissionPdf: GetSubmissionPdf<
  { formId: string; submissionId: string },
  SubmissionPdfResult
> = async ({ formId, submissionId }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const submission = await context.entities.Submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission || submission.formId !== formId) {
    throw new HttpError(404, "Submission not found");
  }

  const access = await getFormAccessForUser(formId, context.user);
  assertCanView(access);

  const form = await context.entities.Form.findUnique({
    where: { id: formId },
  });
  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  const fields = Array.isArray(form.fields)
    ? (form.fields as unknown as FormField[])
    : [];
  const data =
    submission.data && typeof submission.data === "object"
      ? (submission.data as SubmissionData)
      : {};
  assertCanViewSubmission(access, data, context.user);
  const fieldRestrictions = resolveFieldRestrictions(access);
  const visibleData = redactSubmissionData(data, fieldRestrictions.cannotView);
  const visibleFields = fields.filter(
    (field) => !fieldRestrictions.cannotView.includes(field.key),
  );
  const fileIds = collectFileUploadIds(visibleFields, visibleData);
  const fileNames: Record<string, string> = {};
  if (fileIds.length > 0) {
    const files = await context.entities.UploadedFile.findMany({
      where: { id: { in: fileIds } },
    });
    for (const file of files) {
      fileNames[file.id] = file.originalName;
    }
  }

  const buffer = await buildSubmissionPdf(
    { ...form, fields: visibleFields },
    { ...submission, data: visibleData },
    { fileNames },
  );
  return {
    filename: `${form.title}-${submission.id}.pdf`,
    base64: buffer.toString("base64"),
  };
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
      settings: true,
      user: { select: { id: true, name: true, role: true } },
    },
  });
  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  const roles = getRolesFromSettings(form.settings);

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
    roles: roles.map((role) => ({ id: role.id, label: role.label })),
    entries: entries.map((entry) => {
      const role =
        roles.find((r) => r.id === entry.roleId) ??
        roles.find((r) => r.id === BUILTIN_ROLE_VIEWER) ??
        roles[0];
      return {
        id: entry.id,
        roleId: role.id,
        roleLabel: role.label,
        user: entry.user,
      };
    }),
  };
};
