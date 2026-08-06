import type { Form, Submission } from "wasp/entities";
import { prisma } from "wasp/server";
import type {
  FormAction,
  FormSettings,
  FormField,
  SubmissionData,
  Condition,
} from "../types";
import { DEFAULT_FORM_SETTINGS } from "../types";
import { evaluateFormula } from "../components/builder/formula";
import { evaluateCondition } from "../shared/logic";
import { buildEmailSummary, sendEmail } from "./notifications";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSettings(form: Pick<Form, "settings">): FormSettings {
  return {
    ...DEFAULT_FORM_SETTINGS,
    ...((form.settings as unknown as FormSettings | null) ?? {}),
  };
}

function getFields(form: Pick<Form, "fields">): FormField[] {
  return Array.isArray(form.fields) ? (form.fields as unknown as FormField[]) : [];
}

export function isRuleSatisfied(
  condition: Condition | undefined,
  data: unknown,
): boolean {
  return evaluateCondition(condition, (data ?? {}) as SubmissionData);
}

function resolveValue(
  action: Extract<FormAction, { type: "set_field" | "update_submission" }>,
  data: SubmissionData,
  fields: FormField[],
): string | number | boolean | string[] | null {
  switch (action.valueSource) {
    case "static":
      return action.staticValue ?? "";
    case "field":
      return data[action.sourceField ?? ""] ?? "";
    case "formula": {
      const result = evaluateFormula(action.formula ?? "", data, fields);
      return result === null ? "" : result;
    }
    default:
      return action.staticValue ?? "";
  }
}

async function callHttp(
  action: Extract<FormAction, { type: "http_call" }>,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const url = action.url?.trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return undefined;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      method: action.method,
      headers: {
        "Content-Type": "application/json",
        "X-Form-Event": action.trigger,
      },
      body: action.method === "POST" ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      return undefined;
    }
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return json?.value;
    } catch {
      return text;
    }
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

function collectEmailRecipients(
  action: Extract<FormAction, { type: "email" }>,
  data: SubmissionData,
  submitterEmail?: string,
): string[] {
  const recipients = new Set<string>();

  for (const email of (action.recipients ?? "").split(",")) {
    const trimmed = email.trim().toLowerCase();
    if (trimmed) {
      recipients.add(trimmed);
    }
  }

  if (action.recipientField) {
    const value = data[action.recipientField];
    if (typeof value === "string") {
      const email = value.trim().toLowerCase();
      if (EMAIL_RE.test(email)) {
        recipients.add(email);
      }
    }
  }

  if (action.includeSubmitter && submitterEmail?.trim()) {
    recipients.add(submitterEmail.trim().toLowerCase());
  }

  return [...recipients];
}

export async function applyBeforeSubmitActions(
  form: Pick<Form, "settings" | "fields">,
  data: SubmissionData,
): Promise<SubmissionData> {
  const settings = getSettings(form);
  const fields = getFields(form);
  const result: SubmissionData = { ...data };

  for (const action of settings.actions ?? []) {
    if (action.trigger !== "before_submit") {
      continue;
    }
    if (action.when && !isRuleSatisfied(action.when, result)) {
      continue;
    }
    if (action.type === "set_field") {
      result[action.field] = resolveValue(action, result, fields);
    } else if (action.type === "http_call") {
      const value = await callHttp(action, { data: result });
      if (action.responseField && value !== undefined) {
        result[action.responseField] =
          typeof value === "string" ? value : String(value);
      }
    }
  }

  return result;
}

export async function runAfterSubmitActions(
  form: Pick<Form, "id" | "title" | "settings" | "fields">,
  submission: Submission,
  submitterEmail?: string,
): Promise<void> {
  const settings = getSettings(form);
  const fields = getFields(form);
  const sourceData =
    submission.data && typeof submission.data === "object"
      ? (submission.data as SubmissionData)
      : {};

  for (const action of settings.actions ?? []) {
    if (action.trigger !== "after_submit") {
      continue;
    }
    if (action.when && !isRuleSatisfied(action.when, sourceData)) {
      continue;
    }
    if (action.type === "http_call") {
      void callHttp(action, {
        event: "submission.created",
        form: { id: form.id, title: form.title },
        submission: {
          id: submission.id,
          data: submission.data,
        },
      });
    } else if (action.type === "update_submission") {
      const value = resolveValue(action, sourceData, fields);
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          data: JSON.parse(
            JSON.stringify({ ...sourceData, [action.field]: value }),
          ),
        },
      });
    } else if (action.type === "create_submission") {
      const target = await prisma.form.findUnique({
        where: { id: action.formId },
      });
      if (!target) {
        continue;
      }
      const targetFields = getFields(target);
      const mapped: SubmissionData = {};
      for (const field of targetFields) {
        if (sourceData[field.key] !== undefined) {
          mapped[field.key] = sourceData[field.key];
        }
      }
      await prisma.submission.create({
        data: {
          formId: target.id,
          data: JSON.parse(JSON.stringify(mapped)),
        },
      });
    } else if (action.type === "email") {
      const recipients = collectEmailRecipients(action, sourceData, submitterEmail);
      if (recipients.length === 0) {
        continue;
      }
      const { subject, text, html } = buildEmailSummary(
        form,
        submission,
        "submission.created",
      );
      await sendEmail(
        recipients,
        action.subject?.trim() || subject,
        text,
        html,
      );
    }
  }
}
