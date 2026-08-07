import type {
  CapabilityGrant,
  Condition,
  FormRoleDef,
  RecordPermissions,
} from "../types";

export type { CapabilityGrant, FormRoleDef, RecordPermissions };

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

export function defaultFormRoles(): FormRoleDef[] {
  return [
    {
      id: BUILTIN_ROLE_VIEWER,
      label: "Viewer",
      builtIn: true,
      view: ALWAYS,
      edit: NEVER,
      delete: NEVER,
    },
    {
      id: BUILTIN_ROLE_EDITOR,
      label: "Editor",
      builtIn: true,
      view: ALWAYS,
      edit: ALWAYS,
      delete: NEVER,
    },
    {
      id: BUILTIN_ROLE_MANAGER,
      label: "Manager",
      builtIn: true,
      view: ALWAYS,
      edit: ALWAYS,
      delete: ALWAYS,
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

function normalizeRoleDef(role: FormRoleDef): FormRoleDef {
  return {
    id: role.id,
    label: role.label?.trim() || role.id,
    builtIn: role.builtIn === true,
    view: normalizeGrant(role.view, ALWAYS),
    edit: normalizeGrant(role.edit, NEVER),
    delete: normalizeGrant(role.delete, NEVER),
  };
}

/** Map legacy FormAccessLevel to a built-in role id. */
export function legacyLevelToRoleId(level: string): string {
  if (level === "EDIT") {
    return BUILTIN_ROLE_MANAGER;
  }
  return BUILTIN_ROLE_VIEWER;
}
