import vm from "node:vm";
import { evaluateFormula } from "../components/builder/formula";
import {
  buildCalcFormApi,
  normalizeCalcValue,
} from "../shared/calcScript";
import type { CalcDbApi } from "./calcDb";
import type { FormField, SubmissionData } from "../types";

const SCRIPT_TIMEOUT_MS = 100;
const QUERY_TIMEOUT_MS = 5000;

/**
 * Server-side script execution in a node:vm sandbox. The context contains only
 * the frozen read-only form API — no require, process, or fetch. Errors and
 * timeouts produce null (stored as "").
 */
function runScriptSafely(
  script: string,
  values: SubmissionData,
  fields: FormField[],
): unknown {
  try {
    const api = Object.freeze(buildCalcFormApi(values, fields));
    return vm.runInNewContext(
      `(function (form) {\n${script}\n})(form)`,
      vm.createContext({ form: api }),
      { timeout: SCRIPT_TIMEOUT_MS },
    );
  } catch (err) {
    console.error("[calc] script error:", err);
    return null;
  }
}

/**
 * Query-mode scripts are async and also receive the read-only db API. The vm
 * timeout only covers synchronous execution, so the returned promise is raced
 * against an external timeout. Errors and timeouts produce null (stored as "").
 */
async function runQueryScriptSafely(
  script: string,
  values: SubmissionData,
  fields: FormField[],
  db: CalcDbApi,
): Promise<unknown> {
  try {
    const api = Object.freeze(buildCalcFormApi(values, fields));
    const result = vm.runInNewContext(
      `(async function (form, db) {\n${script}\n})(form, db)`,
      vm.createContext({ form: api, db: Object.freeze(db) }),
      { timeout: SCRIPT_TIMEOUT_MS },
    );
    return await Promise.race([
      Promise.resolve(result),
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Query script timed out")),
          QUERY_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (err) {
    console.error("[calc] query script error:", err);
    return null;
  }
}

async function computeOne(
  field: FormField,
  baseData: SubmissionData,
  fields: FormField[],
  db?: CalcDbApi,
): Promise<string | number> {
  if (field.calcMode === "script") {
    const script = field.calcScript ?? "";
    return script.trim()
      ? normalizeCalcValue(runScriptSafely(script, baseData, fields))
      : "";
  }
  if (field.calcMode === "query") {
    const script = field.calcScript ?? "";
    if (!script.trim() || !db) {
      return "";
    }
    return normalizeCalcValue(
      await runQueryScriptSafely(script, baseData, fields, db),
    );
  }
  const formula = field.formula ?? "";
  const result = formula.trim()
    ? evaluateFormula(formula, baseData, fields)
    : null;
  return result === null ? "" : result;
}

/** Data calc fields are evaluated against: raw values, other calcs removed. */
function calcBaseData(data: SubmissionData, fields: FormField[]): SubmissionData {
  const baseData = { ...data };
  for (const field of fields) {
    if (field.type === "math") {
      delete baseData[field.key];
    }
  }
  return baseData;
}

/**
 * Recompute every math (calc) field from the submitted data. The result is
 * authoritative and overwrites whatever the client sent. Calc fields are
 * evaluated against raw values only — they cannot reference other calc fields.
 * Query-mode fields need the read-only db API (owner-scoped); without it they
 * store "".
 */
export async function buildCalcValues(
  fields: FormField[],
  data: SubmissionData,
  db?: CalcDbApi,
): Promise<SubmissionData> {
  const calcFields = fields.filter((field) => field.type === "math");
  const calcValues: SubmissionData = {};
  if (calcFields.length === 0) {
    return calcValues;
  }

  const baseData = calcBaseData(data, fields);
  for (const field of calcFields) {
    calcValues[field.key] = await computeOne(field, baseData, fields, db);
  }
  return calcValues;
}

/**
 * Recompute a single calc field (AJAX recalc endpoint). Runs only the field's
 * stored formula/script — never client-supplied code.
 */
export async function computeCalcFieldValue(
  field: FormField,
  data: SubmissionData,
  fields: FormField[],
  db?: CalcDbApi,
): Promise<string | number> {
  return computeOne(field, calcBaseData(data, fields), fields, db);
}
