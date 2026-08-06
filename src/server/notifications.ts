import crypto from "node:crypto";
import type { Form, Submission } from "wasp/entities";
import { config } from "wasp/server";
import { emailSender } from "wasp/server/email";
import type { FormSettings, SubmissionData } from "../types";
import { DEFAULT_FORM_SETTINGS } from "../types";

type NotificationEvent = "submission.created" | "submission.updated";

function getSettings(form: Pick<Form, "settings">): FormSettings {
  return {
    ...DEFAULT_FORM_SETTINGS,
    ...((form.settings as unknown as FormSettings | null) ?? {}),
  };
}

function buildPayload(
  form: Pick<Form, "id" | "title">,
  submission: Submission,
  event: NotificationEvent,
) {
  return {
    event,
    form: { id: form.id, title: form.title },
    submission: {
      id: submission.id,
      data: submission.data,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    },
  };
}

export async function sendWebhook(
  form: Pick<Form, "id" | "title" | "settings">,
  submission: Submission,
  event: NotificationEvent,
): Promise<void> {
  const settings = getSettings(form);
  const url = settings.webhookUrl?.trim();
  if (!url) {
    return;
  }
  const body = JSON.stringify(buildPayload(form, submission, event));
  const signature = crypto
    .createHmac("sha256", settings.webhookSecret ?? "")
    .update(body)
    .digest("hex");
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Form-Event": event,
        "X-Form-Signature": `sha256=${signature}`,
      },
      body,
    });
  } catch (err) {
    console.error("Webhook delivery failed:", err);
  }
}

export function buildEmailSummary(
  form: Pick<Form, "id" | "title">,
  submission: Submission,
  event: NotificationEvent,
) {
  const data = submission.data as SubmissionData;
  const lines = Object.entries(data)
    .filter(([, value]) => {
      if (value === null || value === undefined || value === "") {
        return false;
      }
      return !(Array.isArray(value) && value.length === 0);
    })
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`);
  const recordUrl = `${config.frontendUrl}/forms/${form.id}/records/${submission.id}`;
  const action = event === "submission.created" ? "New response" : "Response updated";

  return {
    subject: `${action} for "${form.title}"`,
    text: `${action} for "${form.title}"\n\n${lines.join("\n")}\n\nView record: ${recordUrl}`,
    html: `<p><strong>${action}</strong> for "${form.title}"</p><ul>${lines
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("")}</ul><p><a href="${recordUrl}">View record</a></p>`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendEmail(
  recipients: string[],
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USERNAME) {
    return;
  }
  for (const to of recipients) {
    try {
      await emailSender.send({ to, subject, text, html });
    } catch (err) {
      console.error(`Email notification failed for ${to}:`, err);
    }
  }
}
