import type { FormField, SubmissionData } from "../types";
import { formatFormulaValue } from "../components/builder/formula";

/**
 * Read-only form API handed to calc scripts (math fields in "script" mode).
 * Deliberately has no `setValue` — scripts can only return a value.
 */
export type CalcFormApi = {
  /** Raw value of a field, "" when unset. */
  getValue(key: string): unknown;
  /** Number(value) || 0 — empty or non-numeric values become 0. */
  getNumber(key: string): number;
  /** Multi-select / checkbox-group values as an array, [] when unset. */
  getArray(key: string): unknown[];
  /** Parsed date field, null when unset or unparseable. */
  getDate(key: string): Date | null;
  /** All raw values as an object. */
  values(): Record<string, unknown>;
  /** Field definitions (key, label, type, options…). */
  fields: FormField[];
};

export function buildCalcFormApi(
  values: SubmissionData,
  fields: FormField[],
): CalcFormApi {
  return {
    getValue: (key) => values[key] ?? "",
    getNumber: (key) => Number(values[key]) || 0,
    getArray: (key) => {
      const value = values[key];
      return Array.isArray(value) ? value : [];
    },
    getDate: (key) => {
      const raw = values[key];
      if (typeof raw !== "string" || raw === "") {
        return null;
      }
      const timestamp = Date.parse(raw);
      return Number.isNaN(timestamp) ? null : new Date(timestamp);
    },
    values: () => ({ ...values }),
    fields,
  };
}

function isDateLike(value: unknown): value is Date {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Date).getTime === "function"
  );
}

/**
 * Coerce a script's return value into something storable/displayable.
 * Duck-typed date check so values from a node:vm realm are handled too.
 */
export function normalizeCalcValue(result: unknown): string | number {
  if (result === null || result === undefined) {
    return "";
  }
  if (typeof result === "number") {
    return Number.isFinite(result) ? result : "";
  }
  if (typeof result === "string") {
    return result;
  }
  if (typeof result === "boolean") {
    return result ? "true" : "false";
  }
  if (isDateLike(result)) {
    const time = result.getTime();
    return Number.isNaN(time) ? "" : new Date(time).toISOString().slice(0, 10);
  }
  if (Array.isArray(result)) {
    return result.join(", ");
  }
  return String(result);
}

/**
 * Client-side runner (same sandbox pattern as custom JS). Errors are caught,
 * logged, and produce null — they never block the form.
 */
export function runCalcScript(
  script: string,
  values: SubmissionData,
  fields: FormField[],
): unknown {
  try {
    const runner = new Function("form", script) as (form: CalcFormApi) => unknown;
    return runner(buildCalcFormApi(values, fields));
  } catch (err) {
    console.error("Calc script error:", err);
    return null;
  }
}

/** Live value of a math field for display / submit, per its calc mode. */
export function computeCalcValue(
  field: FormField,
  values: SubmissionData,
  fields: FormField[],
): string | number {
  if (field.calcMode === "query") {
    // Query mode runs server-side only; the client shows the stored value
    // (or the value returned by the recalc endpoint).
    const stored = values[field.key];
    return typeof stored === "string" || typeof stored === "number"
      ? stored
      : "";
  }
  if (field.calcMode === "script") {
    const script = field.calcScript ?? "";
    if (!script.trim()) {
      return "";
    }
    return normalizeCalcValue(runCalcScript(script, values, fields));
  }
  return field.formula
    ? formatFormulaValue(field.formula, values, fields, field.mathDecimals)
    : "";
}
