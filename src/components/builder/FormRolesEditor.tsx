import type {
  CapabilityGrant,
  Condition,
  FormField,
  FormRoleDef,
  FormSettings,
  RecordCapability,
} from "../../types";
import {
  BUILTIN_ROLE_EDITOR,
  BUILTIN_ROLE_MANAGER,
  BUILTIN_ROLE_VIEWER,
  normalizeFormRoles,
} from "../../shared/formRoles";
import { permissionConditionFields } from "../../shared/logic";
import { slugify, uniqueKey } from "./elementFactory";
import { ConditionEditor, defaultCondition } from "./LogicEditors";
import { HelpBubble } from "../../shared/components/HelpBubble";
import { inputClasses } from "../../shared/styles";
import { TrashIcon } from "./icons";

const CAPABILITIES: { key: RecordCapability; label: string }[] = [
  { key: "view", label: "View" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
];

const NON_RESTRICTABLE = new Set([
  "section_header",
  "divider",
  "paragraph",
  "page_break",
  "captcha",
]);

function grantAllowed(grant: CapabilityGrant): boolean {
  return grant.allowed === true;
}

function grantWhen(grant: CapabilityGrant): Condition | undefined {
  return grant.allowed === true ? grant.when : undefined;
}

function restrictableFields(fields: FormField[]): FormField[] {
  return fields.filter(
    (field) => field.key && !NON_RESTRICTABLE.has(field.type),
  );
}

function FieldDenyPicker({
  label,
  help,
  fields,
  selected,
  onChange,
}: {
  label: string;
  help: string;
  fields: FormField[];
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  if (fields.length === 0) {
    return null;
  }
  const selectedSet = new Set(selected);

  function toggle(key: string, checked: boolean) {
    if (checked) {
      onChange([...selectedSet, key].filter((value, index, all) => all.indexOf(value) === index));
    } else {
      onChange(selected.filter((value) => value !== key));
    }
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-neutral-100 pt-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-neutral-700">{label}</span>
        <span className="text-[11px] leading-snug text-neutral-400">{help}</span>
      </div>
      <ul className="max-h-36 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50/80 p-2">
        {fields.map((field) => (
          <li key={field.id}>
            <label className="flex items-center gap-2 rounded px-1 py-0.5 text-[11px] text-neutral-700 hover:bg-white">
              <input
                type="checkbox"
                checked={selectedSet.has(field.key)}
                onChange={(event) => toggle(field.key, event.target.checked)}
                className="size-3.5 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
              />
              <span className="min-w-0 truncate">
                {field.label || field.key}
                <span className="ml-1 font-mono text-[10px] text-neutral-400">
                  {field.key}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormRolesEditor({
  settings,
  fields,
  onChange,
}: {
  settings: FormSettings;
  fields: FormField[];
  onChange: (patch: Partial<FormSettings>) => void;
}) {
  const roles = normalizeFormRoles(settings.roles);
  const ruleTargets = permissionConditionFields(fields);
  const fieldOptions = restrictableFields(fields);

  function updateRoles(next: FormRoleDef[]) {
    onChange({ roles: normalizeFormRoles(next) });
  }

  function patchRole(roleId: string, patch: Partial<FormRoleDef>) {
    updateRoles(
      roles.map((role) => (role.id === roleId ? { ...role, ...patch } : role)),
    );
  }

  function setCapability(
    roleId: string,
    capability: RecordCapability,
    allowed: boolean,
  ) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) {
      return;
    }
    const previous = role[capability];
    const nextGrant: CapabilityGrant = allowed
      ? { allowed: true, when: grantWhen(previous) }
      : { allowed: false };
    patchRole(roleId, { [capability]: nextGrant });
  }

  function setCapabilityWhen(
    roleId: string,
    capability: RecordCapability,
    when: Condition | undefined,
  ) {
    const role = roles.find((r) => r.id === roleId);
    if (!role || !grantAllowed(role[capability])) {
      return;
    }
    patchRole(roleId, {
      [capability]: when ? { allowed: true, when } : { allowed: true },
    });
  }

  function addCustomRole() {
    const id = uniqueKey(
      slugify("custom_role") || "custom_role",
      roles.map((role) => role.id),
    );
    updateRoles([
      ...roles,
      {
        id,
        label: "Custom role",
        builtIn: false,
        view: { allowed: true },
        edit: { allowed: false },
        delete: { allowed: false },
        cannotViewFields: [],
        cannotEditFields: [],
      },
    ]);
  }

  function removeRole(roleId: string) {
    const role = roles.find((r) => r.id === roleId);
    if (!role || role.builtIn) {
      return;
    }
    updateRoles(roles.filter((r) => r.id !== roleId));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs leading-snug text-neutral-400">
          Define who can view, edit, or delete submissions when this form is
          shared. Optionally hide or lock individual fields per role. Assign
          roles on the Access page.
        </p>
        <HelpBubble article="record-roles" align="right" />
      </div>

      <ul className="flex flex-col gap-3">
        {roles.map((role) => (
          <li
            key={role.id}
            className="flex flex-col gap-2.5 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <input
                value={role.label}
                onChange={(event) =>
                  patchRole(role.id, { label: event.target.value })
                }
                aria-label="Role label"
                className={`${inputClasses} flex-1 text-sm font-semibold`}
              />
              {role.builtIn ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                  built-in
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => removeRole(role.id)}
                  aria-label="Remove role"
                  className="rounded-md p-1.5 text-neutral-400 hover:bg-danger-soft hover:text-danger"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              )}
            </div>
            <p className="font-mono text-[10px] text-neutral-400">
              id: {role.id}
              {(role.id === BUILTIN_ROLE_VIEWER ||
                role.id === BUILTIN_ROLE_EDITOR ||
                role.id === BUILTIN_ROLE_MANAGER) &&
                " · default"}
            </p>

            {CAPABILITIES.map(({ key, label }) => {
              const allowed = grantAllowed(role[key]);
              const when = grantWhen(role[key]);
              const whenEnabled = Boolean(when);
              return (
                <div
                  key={key}
                  className="flex flex-col gap-1.5 border-t border-neutral-100 pt-2"
                >
                  <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
                    <input
                      type="checkbox"
                      checked={allowed}
                      onChange={(event) =>
                        setCapability(role.id, key, event.target.checked)
                      }
                      className="size-3.5 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                    />
                    Can {label.toLowerCase()} submissions
                  </label>
                  {allowed && (
                    <>
                      <label className="flex items-center gap-2 text-[11px] font-medium text-neutral-600">
                        <input
                          type="checkbox"
                          checked={whenEnabled}
                          onChange={(event) =>
                            setCapabilityWhen(
                              role.id,
                              key,
                              event.target.checked
                                ? (when ?? defaultCondition())
                                : undefined,
                            )
                          }
                          className="size-3.5 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                        />
                        Only when…
                      </label>
                      {whenEnabled && (
                        <ConditionEditor
                          condition={when ?? defaultCondition()}
                          targets={ruleTargets}
                          onChange={(next) =>
                            setCapabilityWhen(role.id, key, next)
                          }
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}

            <FieldDenyPicker
              label="Cannot view fields"
              help="Hidden on records, table, exports, and PDFs for this role."
              fields={fieldOptions}
              selected={role.cannotViewFields ?? []}
              onChange={(cannotViewFields) =>
                patchRole(role.id, {
                  cannotViewFields,
                  cannotEditFields: (role.cannotEditFields ?? []).filter(
                    (key) => !cannotViewFields.includes(key),
                  ),
                })
              }
            />
            <FieldDenyPicker
              label="Cannot edit fields"
              help="Visible but read-only; values are preserved on save."
              fields={fieldOptions.filter(
                (field) => !(role.cannotViewFields ?? []).includes(field.key),
              )}
              selected={role.cannotEditFields ?? []}
              onChange={(cannotEditFields) =>
                patchRole(role.id, { cannotEditFields })
              }
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addCustomRole}
        className="self-start rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:border-primary-400 hover:text-primary-700"
      >
        + Add custom role
      </button>
    </div>
  );
}
