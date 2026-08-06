import crypto from "node:crypto";
import nodemailer from "nodemailer";
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

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendEmailOptions = {
  recipients: string[];
  subject: string;
  text: string;
  html: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
};

/**
 * Wasp's `emailSender` supports only { to, subject, text, html } — no
 * attachments / CC / BCC / Reply-To. When those are needed we send through a
 * direct nodemailer transporter built from the same SMTP_* env vars.
 */
async function sendViaSmtp(
  to: string,
  options: Omit<SendEmailOptions, "recipients">,
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  await transporter.sendMail({
    from: '"Form Builder" <noreply@formbuilder.local>',
    to,
    cc: options.cc?.length ? options.cc.join(", ") : undefined,
    bcc: options.bcc?.length ? options.bcc.join(", ") : undefined,
    replyTo: options.replyTo || undefined,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
  });
}

export async function sendEmail(
  recipients: string[],
  subject: string,
  text: string,
  html: string,
  attachments?: EmailAttachment[],
  extras?: { cc?: string[]; bcc?: string[]; replyTo?: string },
): Promise<void>;
export async function sendEmail(options: SendEmailOptions): Promise<void>;
export async function sendEmail(
  recipientsOrOptions: string[] | SendEmailOptions,
  subject?: string,
  text?: string,
  html?: string,
  attachments?: EmailAttachment[],
  extras?: { cc?: string[]; bcc?: string[]; replyTo?: string },
): Promise<void> {
  const options: SendEmailOptions = Array.isArray(recipientsOrOptions)
    ? {
        recipients: recipientsOrOptions,
        subject: subject ?? "",
        text: text ?? "",
        html: html ?? "",
        attachments,
        cc: extras?.cc,
        bcc: extras?.bcc,
        replyTo: extras?.replyTo,
      }
    : recipientsOrOptions;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USERNAME) {
    return;
  }

  const needsSmtpExtras =
    Boolean(options.attachments?.length) ||
    Boolean(options.cc?.length) ||
    Boolean(options.bcc?.length) ||
    Boolean(options.replyTo?.trim());

  for (const to of options.recipients) {
    try {
      if (needsSmtpExtras) {
        await sendViaSmtp(to, options);
      } else {
        await emailSender.send({
          to,
          subject: options.subject,
          text: options.text,
          html: options.html,
        });
      }
    } catch (err) {
      console.error(`Email notification failed for ${to}:`, err);
    }
  }
}
