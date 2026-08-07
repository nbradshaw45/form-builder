import type { Form, Submission } from "wasp/entities";
import { prisma, config } from "wasp/server";
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
import {
  renderSmartTags,
  stripHtmlTags,
  type SmartTagContext,
} from "../shared/smartTags";
import {
  buildEmailSummary,
  sendEmail,
  type EmailAttachment,
} from "./notifications";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  actorFromEmail,
  recordAuditEvent,
} from "./audit";
import { buildSubmissionPdf, collectFileUploadIds } from "./pdf";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function auditActionRan(
  form: Pick<Form, "id" | "title">,
  submissionId: string | null,
  action: FormAction,
  detail?: Record<string, unknown>,
) {
  void recordAuditEvent({
    formId: form.id,
    formTitle: form.title,
    actor: actorFromEmail(undefined),
    action: AUDIT_ACTIONS.ACTION_RAN,
    entityType: AUDIT_ENTITY_TYPES.FORM_ACTION,
    entityId: action.id,
    summary: `Ran ${action.type} action (${action.trigger})`,
    changes: {
      actionId: action.id,
      actionType: action.type,
      trigger: action.trigger,
      submissionId,
      ...detail,
    },
  });
}

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

function collectEmailList(
  raw: string | undefined,
  tagContext: SmartTagContext,
): string[] {
  if (!raw?.trim()) {
    return [];
  }
  const rendered = renderSmartTags(raw, tagContext);
  const emails: string[] = [];
  for (const part of rendered.split(",")) {
    const trimmed = part.trim().toLowerCase();
    if (trimmed && EMAIL_RE.test(trimmed)) {
      emails.push(trimmed);
    }
  }
  return emails;
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
  form: Pick<Form, "id" | "title" | "settings" | "fields">,
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
      auditActionRan(form, null, action, { field: action.field });
    } else if (action.type === "http_call") {
      const value = await callHttp(action, { data: result });
      if (action.responseField && value !== undefined) {
        result[action.responseField] =
          typeof value === "string" ? value : String(value);
      }
      auditActionRan(form, null, action, {
        responseField: action.responseField ?? null,
      });
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
      auditActionRan(form, submission.id, action);
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
      auditActionRan(form, submission.id, action, { field: action.field });
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
      auditActionRan(form, submission.id, action, {
        targetFormId: target.id,
      });
    } else if (action.type === "email") {
      const recipients = collectEmailRecipients(action, sourceData, submitterEmail);
      if (recipients.length === 0) {
        continue;
      }
      let attachments: EmailAttachment[] | undefined;
      if (action.attachPdf === true) {
        try {
          const fileIds = collectFileUploadIds(fields, sourceData);
          const fileNames: Record<string, string> = {};
          if (fileIds.length > 0) {
            const files = await prisma.uploadedFile.findMany({
              where: { id: { in: fileIds } },
            });
            for (const file of files) {
              fileNames[file.id] = file.originalName;
            }
          }
          const pdf = await buildSubmissionPdf(form, submission, { fileNames });
          attachments = [
            {
              filename: `${form.title}-${submission.id}.pdf`,
              content: pdf,
              contentType: "application/pdf",
            },
          ];
        } catch (err) {
          console.error(
            `Failed to build PDF attachment for email action "${action.id}"; sending without it:`,
            err,
          );
        }
      }
      const submissionContext =
        submission.context && typeof submission.context === "object"
          ? (submission.context as SmartTagContext["context"])
          : undefined;
      const tagContext: SmartTagContext = {
        form: { id: form.id, title: form.title },
        fields,
        data: sourceData,
        submissionId: submission.id,
        recordUrl: `${config.frontendUrl}/forms/${form.id}/records/${submission.id}`,
        context: submissionContext,
      };
      const cc = collectEmailList(action.cc, tagContext);
      const bcc = collectEmailList(action.bcc, tagContext);
      const replyToRaw = action.replyTo?.trim()
        ? renderSmartTags(action.replyTo, tagContext).trim()
        : "";
      const replyTo =
        replyToRaw && EMAIL_RE.test(replyToRaw.toLowerCase())
          ? replyToRaw.toLowerCase()
          : undefined;
      const customSubject = action.subject?.trim();
      const bodyTemplate = action.bodyTemplate?.trim();
      if (bodyTemplate) {
        const html = renderSmartTags(bodyTemplate, tagContext);
        const subject = renderSmartTags(
          customSubject || `New response for "${form.title}"`,
          tagContext,
        );
        await sendEmail({
          recipients,
          subject,
          text: stripHtmlTags(html),
          html,
          attachments,
          cc,
          bcc,
          replyTo,
        });
      } else {
        const { subject, text, html } = buildEmailSummary(
          form,
          submission,
          "submission.created",
        );
        await sendEmail({
          recipients,
          subject: customSubject
            ? renderSmartTags(customSubject, tagContext)
            : subject,
          text,
          html,
          attachments,
          cc,
          bcc,
          replyTo,
        });
      }
      auditActionRan(form, submission.id, action, {
        recipientCount: recipients.length,
      });
    }
  }
}
