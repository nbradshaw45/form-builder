import type { FormField, SubmissionData } from "../types";
import type { SubmissionContext } from "./submissionContext";

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
  /** Optional submission context (IP, UTM, etc.). */
  context?: SubmissionContext | null;
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

function isTruthyValue(value: SubmissionData[string]): boolean {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Evaluate a simple `{if …}` condition.
 * Supported forms:
 * - `field.KEY` — truthy field value
 * - `field.KEY == value` / `field.KEY != value`
 * - `field.KEY contains value`
 */
export function evaluateIfCondition(
  expression: string,
  ctx: SmartTagContext,
): boolean {
  const expr = expression.trim();
  if (!expr) {
    return false;
  }

  const comparison = expr.match(
    /^(field\.[a-zA-Z0-9_]+)\s*(==|!=|contains)\s*(.+)$/i,
  );
  if (comparison) {
    const [, left, op, rawRight] = comparison;
    const key = left.slice("field.".length);
    const leftValue = formatFieldValue(
      ctx.fields.find((field) => field.key === key),
      ctx.data[key],
    );
    const rightValue = unquote(rawRight);
    switch (op.toLowerCase()) {
      case "==":
        return leftValue === rightValue;
      case "!=":
        return leftValue !== rightValue;
      case "contains":
        return leftValue.toLowerCase().includes(rightValue.toLowerCase());
      default:
        return false;
    }
  }

  if (expr.startsWith("field.")) {
    const key = expr.slice("field.".length);
    return isTruthyValue(ctx.data[key]);
  }

  return false;
}

/** Expand `{if …}…{/if}` blocks (non-nested). Unmatched conditions remove the block. */
export function renderIfBlocks(template: string, ctx: SmartTagContext): string {
  return template.replace(
    /\{if\s+([^}]+)\}([\s\S]*?)\{\/if\}/gi,
    (_match, expression: string, body: string) =>
      evaluateIfCondition(expression, ctx) ? body : "",
  );
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
  if (tag.startsWith("submission.context.")) {
    const key = tag.slice("submission.context.".length) as keyof SubmissionContext;
    const value = ctx.context?.[key];
    return value == null ? "" : String(value);
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
 * empty string. Supports `{if field.x == y}…{/if}` conditional blocks.
 *
 * Tags: `{field.KEY}`, `{field.KEY.label}`, `{form.title}`, `{form.id}`,
 * `{submission.id}`, `{submission.context.*}`, `{record_url}`, `{receipt}`,
 * `{date}`, `{all_fields}`, `{all_fields_html}`.
 */
export function renderSmartTags(template: string, ctx: SmartTagContext): string {
  const withConditionals = renderIfBlocks(template, ctx);
  return withConditionals.replace(
    /\{([a-zA-Z0-9_.]+)\}/g,
    (_match, tag: string) => resolveTag(tag, ctx),
  );
}
