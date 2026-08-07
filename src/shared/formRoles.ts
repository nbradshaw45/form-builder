import type {
  CapabilityGrant,
  Condition,
  FieldRestrictions,
  FormRoleDef,
  RecordPermissions,
  SubmissionData,
} from "../types";

export type { CapabilityGrant, FormRoleDef, RecordPermissions, FieldRestrictions };

export const BUILTIN_ROLE_VIEWER = "viewer";
export const BUILTIN_ROLE_EDITOR = "editor";
export const BUILTIN_ROLE_MANAGER = "manager";

const ALWAYS: CapabilityGrant = { allowed: true };
const NEVER: CapabilityGrant = { allowed: false };

export const FULL_RECORD_PERMISSIONS: RecordPermissions = {
  view: true,
  edit: true,
  delete: true,
};

export const NO_RECORD_PERMISSIONS: RecordPermissions = {
  view: false,
  edit: false,
  delete: false,
};

export const NO_FIELD_RESTRICTIONS: FieldRestrictions = {
  cannotView: [],
  cannotEdit: [],
};

export function defaultFormRoles(): FormRoleDef[] {
  return [
    {
      id: BUILTIN_ROLE_VIEWER,
      label: "Viewer",
      builtIn: true,
      view: ALWAYS,
      edit: NEVER,
      delete: NEVER,
      viewAudit: ALWAYS,
      cannotViewFields: [],
      cannotEditFields: [],
    },
    {
      id: BUILTIN_ROLE_EDITOR,
      label: "Editor",
      builtIn: true,
      view: ALWAYS,
      edit: ALWAYS,
      delete: NEVER,
      viewAudit: ALWAYS,
      cannotViewFields: [],
      cannotEditFields: [],
    },
    {
      id: BUILTIN_ROLE_MANAGER,
      label: "Manager",
      builtIn: true,
      view: ALWAYS,
      edit: ALWAYS,
      delete: ALWAYS,
      viewAudit: ALWAYS,
      cannotViewFields: [],
      cannotEditFields: [],
    },
  ];
}

/** Ensure built-in roles exist; keep any custom roles and capability overrides. */
export function normalizeFormRoles(
  roles: FormRoleDef[] | undefined | null,
): FormRoleDef[] {
  const defaults = defaultFormRoles();
  if (!Array.isArray(roles) || roles.length === 0) {
    return defaults;
  }
  const byId = new Map<string, FormRoleDef>();
  for (const role of roles) {
    if (role?.id && typeof role.id === "string") {
      byId.set(role.id, normalizeRoleDef(role));
    }
  }
  const result: FormRoleDef[] = [];
  for (const builtIn of defaults) {
    const existing = byId.get(builtIn.id);
    if (existing) {
      result.push({ ...existing, builtIn: true, id: builtIn.id });
      byId.delete(builtIn.id);
    } else {
      result.push(builtIn);
    }
  }
  for (const custom of byId.values()) {
    result.push({ ...custom, builtIn: false });
  }
  return result;
}

function normalizeGrant(
  grant: unknown,
  fallback: CapabilityGrant,
): CapabilityGrant {
  if (!grant || typeof grant !== "object") {
    return fallback;
  }
  const g = grant as { allowed?: boolean; when?: Condition };
  if (g.allowed === false) {
    return { allowed: false };
  }
  if (g.allowed === true) {
    return g.when ? { allowed: true, when: g.when } : { allowed: true };
  }
  return fallback;
}

function normalizeKeyList(keys: unknown): string[] {
  if (!Array.isArray(keys)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of keys) {
    if (typeof key !== "string") {
      continue;
    }
    const trimmed = key.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function normalizeRoleDef(role: FormRoleDef): FormRoleDef {
  const cannotViewFields = normalizeKeyList(role.cannotViewFields);
  const cannotEditFields = normalizeKeyList(role.cannotEditFields).filter(
    (key) => !cannotViewFields.includes(key),
  );
  return {
    id: role.id,
    label: role.label?.trim() || role.id,
    builtIn: role.builtIn === true,
    view: normalizeGrant(role.view, ALWAYS),
    edit: normalizeGrant(role.edit, NEVER),
    delete: normalizeGrant(role.delete, NEVER),
    viewAudit: normalizeGrant(role.viewAudit, ALWAYS),
    cannotViewFields,
    cannotEditFields,
  };
}

/** Map legacy FormAccessLevel to a built-in role id. */
export function legacyLevelToRoleId(level: string): string {
  if (level === "EDIT") {
    return BUILTIN_ROLE_MANAGER;
  }
  return BUILTIN_ROLE_VIEWER;
}

/** Effective field restrictions for a shared role (owner/admin → none). */
export function fieldRestrictionsFromRole(
  role: FormRoleDef | null | undefined,
): FieldRestrictions {
  if (!role) {
    return { cannotView: [], cannotEdit: [] };
  }
  const cannotView = normalizeKeyList(role.cannotViewFields);
  const cannotEdit = [
    ...new Set([
      ...normalizeKeyList(role.cannotEditFields),
      ...cannotView,
    ]),
  ];
  return { cannotView, cannotEdit };
}

export function redactSubmissionData(
  data: SubmissionData,
  cannotView: string[],
): SubmissionData {
  if (cannotView.length === 0) {
    return data;
  }
  const hidden = new Set(cannotView);
  const next: SubmissionData = {};
  for (const [key, value] of Object.entries(data)) {
    if (!hidden.has(key)) {
      next[key] = value;
    }
  }
  return next;
}

/**
 * Merge an update payload into previous data while preserving keys the role
 * cannot view or edit.
 */
export function mergeSubmissionDataWithFieldRestrictions(
  previous: SubmissionData,
  incoming: SubmissionData,
  restrictions: FieldRestrictions,
): SubmissionData {
  const protectedKeys = new Set([
    ...restrictions.cannotView,
    ...restrictions.cannotEdit,
  ]);
  if (protectedKeys.size === 0) {
    return { ...previous, ...incoming };
  }
  const merged: SubmissionData = { ...previous, ...incoming };
  for (const key of protectedKeys) {
    if (Object.prototype.hasOwnProperty.call(previous, key)) {
      merged[key] = previous[key];
    } else {
      delete merged[key];
    }
  }
  return merged;
}
