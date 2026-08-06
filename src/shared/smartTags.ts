import type { FormField, SubmissionData } from "../types";

/**
 * Context available to smart tags. Works on both client and server —
 * callers supply `recordUrl` (built from `config.frontendUrl` on the
 * server or `window.location.origin` on the client).
 */
export type SmartTagContext = {
  form: { id: string; title: string };
  fields: FormField[];
  data: SubmissionData;
  submissionId?: string;
  recordUrl?: string;
  receipt?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Crude plain-text fallback for an HTML body: strip tags, collapse whitespace runs. */
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|ul|ol|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatFieldValue(
  field: FormField | undefined,
  value: SubmissionData[string],
): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (field?.type === "signature") {
    return "[signature]";
  }
  if (field?.type === "file_upload") {
    return "[file]";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  return String(value);
}

function fieldEntries(ctx: SmartTagContext): { label: string; value: string }[] {
  return ctx.fields
    .map((field) => ({
      label: field.label,
      value: formatFieldValue(field, ctx.data[field.key]),
    }))
    .filter((entry) => entry.value !== "");
}

function resolveTag(tag: string, ctx: SmartTagContext): string {
  if (tag.startsWith("field.")) {
    const rest = tag.slice("field.".length);
    if (rest.endsWith(".label")) {
      const key = rest.slice(0, -".label".length);
      return ctx.fields.find((field) => field.key === key)?.label ?? "";
    }
    const field = ctx.fields.find((f) => f.key === rest);
    return formatFieldValue(field, ctx.data[rest]);
  }
  switch (tag) {
    case "form.title":
      return ctx.form.title;
    case "form.id":
      return ctx.form.id;
    case "submission.id":
      return ctx.submissionId ?? "";
    case "record_url":
      return ctx.recordUrl ?? "";
    case "receipt":
      return ctx.receipt ?? "";
    case "date":
      return new Date().toLocaleString();
    case "all_fields":
      return fieldEntries(ctx)
        .map((entry) => `${entry.label}: ${entry.value}`)
        .join("\n");
    case "all_fields_html":
      return `<ul>${fieldEntries(ctx)
        .map(
          (entry) =>
            `<li><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.value)}</li>`,
        )
        .join("")}</ul>`;
    default:
      return "";
  }
}

/**
 * Replace `{...}` smart tags in a template. Unknown tags render as an
 * empty string. Supported tags:
 * `{field.KEY}`, `{field.KEY.label}`, `{form.title}`, `{form.id}`,
 * `{submission.id}`, `{record_url}`, `{receipt}`, `{date}`,
 * `{all_fields}`, `{all_fields_html}`.
 */
export function renderSmartTags(template: string, ctx: SmartTagContext): string {
  return template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_match, tag: string) =>
    resolveTag(tag, ctx),
  );
}
