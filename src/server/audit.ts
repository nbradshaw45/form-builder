import { prisma } from "wasp/server";
import type { FormField, FormSettings, SubmissionData } from "../types";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
  type AuditEntityType,
  type FormDefinitionDiff,
  type SubmissionFieldChange,
} from "../shared/audit";
import type { UserLike } from "./access";
import { userEmail } from "./access";

export type AuditActor = {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
};

export function actorFromUser(user: UserLike | undefined | null): AuditActor {
  if (!user) {
    return {};
  }
  return {
    userId: user.id,
    email: userEmail(user) || null,
    name: user.name ?? null,
  };
}

export function actorFromEmail(
  email: string | null | undefined,
  name?: string | null,
): AuditActor {
  const trimmed = email?.trim().toLowerCase() || null;
  return { email: trimmed, name: name ?? null };
}

type RecordAuditArgs = {
  formId?: string | null;
  formTitle?: string | null;
  actor?: AuditActor;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  summary: string;
  changes?: unknown;
};

export async function recordAuditEvent(args: RecordAuditArgs): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        formId: args.formId ?? null,
        formTitle: args.formTitle ?? null,
        actorUserId: args.actor?.userId ?? null,
        actorEmail: args.actor?.email ?? null,
        actorName: args.actor?.name ?? null,
        action: args.action,
        entityType: args.entityType,
        entityId: args.entityId ?? null,
        summary: args.summary,
        changes:
          args.changes === undefined
            ? undefined
            : args.changes === null
              ? undefined
              : (JSON.parse(JSON.stringify(args.changes)) as object),
      },
    });
  } catch (err) {
    console.error("[audit] failed to record event", args.action, err);
  }
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (a === null || a === undefined || a === "") {
    return b === null || b === undefined || b === "";
  }
  if (b === null || b === undefined || b === "") {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return String(a) === String(b);
}

const SKIP_DIFF_TYPES = new Set([
  "section_header",
  "divider",
  "paragraph",
  "page_break",
  "captcha",
]);

export function diffSubmissionData(
  previous: SubmissionData,
  next: SubmissionData,
  fields: FormField[],
): SubmissionFieldChange[] {
  const labelByKey = new Map(
    fields
      .filter((field) => field.key && !SKIP_DIFF_TYPES.has(field.type))
      .map((field) => [field.key, field.label || field.key]),
  );
  const keys = new Set([
    ...Object.keys(previous ?? {}),
    ...Object.keys(next ?? {}),
    ...labelByKey.keys(),
  ]);
  const changes: SubmissionFieldChange[] = [];
  for (const key of keys) {
    if (key.startsWith("_")) {
      continue;
    }
    const from = previous?.[key];
    const to = next?.[key];
    if (valuesEqual(from, to)) {
      continue;
    }
    changes.push({
      key,
      label: labelByKey.get(key) ?? key,
      from: from ?? null,
      to: to ?? null,
    });
  }
  return changes;
}

export function redactSubmissionFieldChanges(
  changes: SubmissionFieldChange[] | undefined,
  cannotView: string[],
): SubmissionFieldChange[] | undefined {
  if (!changes) {
    return changes;
  }
  if (cannotView.length === 0) {
    return changes;
  }
  const hidden = new Set(cannotView);
  return changes.filter((change) => !hidden.has(change.key));
}

function fieldFingerprint(field: FormField): string {
  const { id: _id, ...rest } = field;
  return JSON.stringify(rest);
}

export function diffFormDefinition(
  previous: {
    title: string;
    fields: FormField[];
    settings: FormSettings | null | undefined;
  },
  next: {
    title: string;
    fields: FormField[];
    settings: FormSettings | null | undefined;
  },
): FormDefinitionDiff {
  const prevByKey = new Map(
    previous.fields.filter((f) => f.key).map((f) => [f.key, f]),
  );
  const nextByKey = new Map(
    next.fields.filter((f) => f.key).map((f) => [f.key, f]),
  );
  const fieldsAdded: string[] = [];
  const fieldsRemoved: string[] = [];
  const fieldsModified: string[] = [];
  for (const [key, field] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) {
      fieldsAdded.push(key);
    } else if (fieldFingerprint(prev) !== fieldFingerprint(field)) {
      fieldsModified.push(key);
    }
  }
  for (const key of prevByKey.keys()) {
    if (!nextByKey.has(key)) {
      fieldsRemoved.push(key);
    }
  }

  const prevSettings = { ...(previous.settings ?? {}) } as Record<
    string,
    unknown
  >;
  const nextSettings = { ...(next.settings ?? {}) } as Record<string, unknown>;
  const settingsChanged: string[] = [];
  const settingKeys = new Set([
    ...Object.keys(prevSettings),
    ...Object.keys(nextSettings),
  ]);
  for (const key of settingKeys) {
    if (
      JSON.stringify(prevSettings[key] ?? null) !==
      JSON.stringify(nextSettings[key] ?? null)
    ) {
      settingsChanged.push(key);
    }
  }

  const diff: FormDefinitionDiff = {
    fieldsAdded,
    fieldsRemoved,
    fieldsModified,
    settingsChanged,
  };
  if (previous.title !== next.title) {
    diff.title = { from: previous.title, to: next.title };
  }
  return diff;
}

export function formDiffHasChanges(diff: FormDefinitionDiff): boolean {
  return Boolean(
    diff.title ||
      diff.fieldsAdded.length ||
      diff.fieldsRemoved.length ||
      diff.fieldsModified.length ||
      diff.settingsChanged.length,
  );
}

export { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES };
