import { HttpError, prisma } from "wasp/server";
import type { Form, FormAccess } from "wasp/entities";
import type {
  CapabilityGrant,
  FormRoleDef,
  FormSettings,
  RecordPermissions,
  SubmissionData,
} from "../types";
import { DEFAULT_FORM_SETTINGS } from "../types";
import {
  BUILTIN_ROLE_VIEWER,
  FULL_RECORD_PERMISSIONS,
  fieldRestrictionsFromRole,
  normalizeFormRoles,
  type FieldRestrictions,
  NO_FIELD_RESTRICTIONS,
} from "../shared/formRoles";
import {
  evaluateCondition,
  USER_EMAIL_KEY,
  USER_ID_KEY,
} from "../shared/logic";

export type UserLike = {
  id: string;
  role?: string;
  name?: string | null;
  identities?: { username?: { id?: string } | null } | null;
};

export type FormAccessKind =
  | { kind: "owner" }
  | { kind: "admin" }
  | { kind: "shared"; roleId: string; role: FormRoleDef };

/** @deprecated Prefer FormAccessKind — kept for existing imports. */
export type FormAccessInfo = FormAccessKind;

export async function getFormAccessForUser(
  formId: string,
  user: UserLike,
): Promise<FormAccessKind> {
  if (user.role === "ADMIN") {
    return { kind: "admin" };
  }

  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { userId: true, settings: true },
  });
  if (!form) {
    throw new HttpError(404, "Form not found");
  }
  if (form.userId === user.id) {
    return { kind: "owner" };
  }

  const access = await prisma.formAccess.findUnique({
    where: { formId_userId: { formId, userId: user.id } },
  });
  if (!access) {
    throw new HttpError(403, "You don't have access to this form");
  }

  const roles = getRolesFromSettings(form.settings);
  const role =
    roles.find((r) => r.id === access.roleId) ??
    roles.find((r) => r.id === BUILTIN_ROLE_VIEWER) ??
    roles[0];

  return { kind: "shared", roleId: role.id, role };
}

export function getRolesFromSettings(settings: unknown): FormRoleDef[] {
  const parsed =
    settings && typeof settings === "object"
      ? (settings as FormSettings)
      : {};
  return normalizeFormRoles(parsed.roles);
}

export function getFormSettings(form: Pick<Form, "settings">): FormSettings {
  return {
    ...DEFAULT_FORM_SETTINGS,
    ...((form.settings as unknown as FormSettings | null) ?? {}),
    roles: getRolesFromSettings(form.settings),
  };
}

export function assertCanView(access: FormAccessKind) {
  if (
    access.kind === "owner" ||
    access.kind === "admin" ||
    access.kind === "shared"
  ) {
    return;
  }
  throw new HttpError(403, "You don't have access to this form");
}

export function assertCanEdit(access: FormAccessKind) {
  if (access.kind === "owner" || access.kind === "admin") {
    return;
  }
  if (access.kind === "shared") {
    const canMutate =
      access.role.edit.allowed === true || access.role.delete.allowed === true;
    if (canMutate) {
      return;
    }
  }
  throw new HttpError(403, "You only have view access to this form");
}

export function assertIsOwnerOrAdmin(access: FormAccessKind) {
  if (access.kind !== "owner" && access.kind !== "admin") {
    throw new HttpError(403, "Only the form owner or an admin can do this");
  }
}

export function assertIsAdmin(user: UserLike) {
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "Admin privileges required");
  }
}

export function userEmail(user: UserLike | undefined): string {
  return user?.identities?.username?.id?.trim().toLowerCase() ?? "";
}

export function buildPermissionValues(
  data: SubmissionData | Record<string, unknown> | null | undefined,
  user: UserLike | undefined,
): SubmissionData {
  const base =
    data && typeof data === "object" && !Array.isArray(data)
      ? ({ ...data } as SubmissionData)
      : ({} as SubmissionData);
  base[USER_EMAIL_KEY] = userEmail(user);
  base[USER_ID_KEY] = user?.id ?? "";
  return base;
}

function grantAllows(grant: CapabilityGrant, values: SubmissionData): boolean {
  if (!grant.allowed) {
    return false;
  }
  if (!grant.when) {
    return true;
  }
  return evaluateCondition(grant.when, values);
}

export function resolveRecordPermissions(
  access: FormAccessKind,
  data: SubmissionData | Record<string, unknown> | null | undefined,
  user: UserLike | undefined,
): RecordPermissions {
  if (access.kind === "owner" || access.kind === "admin") {
    return { ...FULL_RECORD_PERMISSIONS };
  }
  const values = buildPermissionValues(data, user);
  return {
    view: grantAllows(access.role.view, values),
    edit: grantAllows(access.role.edit, values),
    delete: grantAllows(access.role.delete, values),
  };
}

export function resolveFieldRestrictions(
  access: FormAccessKind,
): FieldRestrictions {
  if (access.kind === "owner" || access.kind === "admin") {
    return { ...NO_FIELD_RESTRICTIONS };
  }
  return fieldRestrictionsFromRole(access.role);
}

/** Audit page access: owner/admin always; shared uses viewAudit with user pseudo-fields only. */
export function canViewAudit(
  access: FormAccessKind,
  user: UserLike | undefined,
): boolean {
  if (access.kind === "owner" || access.kind === "admin") {
    return true;
  }
  const values = buildPermissionValues({}, user);
  return grantAllows(access.role.viewAudit, values);
}

export function assertCanViewAudit(
  access: FormAccessKind,
  user: UserLike | undefined,
) {
  if (!canViewAudit(access, user)) {
    throw new HttpError(403, "You cannot view the audit log for this form");
  }
}

export function assertCanViewSubmission(
  access: FormAccessKind,
  data: SubmissionData | Record<string, unknown> | null | undefined,
  user: UserLike | undefined,
) {
  if (!resolveRecordPermissions(access, data, user).view) {
    throw new HttpError(403, "You cannot view this submission");
  }
}

export function assertCanEditSubmission(
  access: FormAccessKind,
  data: SubmissionData | Record<string, unknown> | null | undefined,
  user: UserLike | undefined,
) {
  if (!resolveRecordPermissions(access, data, user).edit) {
    throw new HttpError(403, "You cannot edit this submission");
  }
}

export function assertCanDeleteSubmission(
  access: FormAccessKind,
  data: SubmissionData | Record<string, unknown> | null | undefined,
  user: UserLike | undefined,
) {
  if (!resolveRecordPermissions(access, data, user).delete) {
    throw new HttpError(403, "You cannot delete this submission");
  }
}

export function accessKindForClient(
  access: FormAccessKind,
): "owner" | "admin" | "edit" | "view" {
  if (access.kind === "owner") {
    return "owner";
  }
  if (access.kind === "admin") {
    return "admin";
  }
  const canMutate =
    access.role.edit.allowed === true || access.role.delete.allowed === true;
  return canMutate ? "edit" : "view";
}

export function formAccessRoleId(
  access: FormAccess | { roleId: string },
): string {
  return access.roleId || BUILTIN_ROLE_VIEWER;
}
