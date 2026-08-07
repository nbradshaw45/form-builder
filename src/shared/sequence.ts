import type { FormField, FormSettings } from "../types";

/** Format a sequence counter into the stored display value. */
export function formatSequenceValue(n: number, field: FormField): string {
  const digits = field.sequenceDigits ?? 0;
  const body = digits > 0 ? String(n).padStart(digits, "0") : String(n);
  return `${field.sequencePrefix ?? ""}${body}${field.sequenceSuffix ?? ""}`;
}

/** Drop per-form sequence counters so copies/templates start fresh. */
export function stripSequenceCounters(
  settings: FormSettings | null | undefined,
): FormSettings | undefined {
  if (!settings) {
    return undefined;
  }
  if (!settings.sequenceCounters) {
    return settings;
  }
  const { sequenceCounters: _counters, ...rest } = settings;
  return rest;
}

/** Parse a Yes/No default or URL prefill into a boolean (or null if unset). */
export function parseYesNoValue(raw: unknown): boolean | null {
  if (raw === true || raw === false) {
    return raw;
  }
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  const normalized = String(raw).trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(normalized)) {
    return true;
  }
  if (["no", "n", "false", "0"].includes(normalized)) {
    return false;
  }
  return null;
}

export function yesNoLabel(field: FormField, value: boolean): string {
  return value
    ? (field.yesLabel?.trim() || "Yes")
    : (field.noLabel?.trim() || "No");
}
