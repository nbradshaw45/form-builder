import vm from "node:vm";
import { evaluateFormula } from "../components/builder/formula";
import {
  buildCalcFormApi,
  normalizeCalcValue,
} from "../shared/calcScript";
import type { FormField, SubmissionData } from "../types";

const SCRIPT_TIMEOUT_MS = 100;

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
 * Recompute every math (calc) field from the submitted data. The result is
 * authoritative and overwrites whatever the client sent. Calc fields are
 * evaluated against raw values only — they cannot reference other calc fields.
 */
export async function buildCalcValues(
  fields: FormField[],
  data: SubmissionData,
): Promise<SubmissionData> {
  const calcFields = fields.filter((field) => field.type === "math");
  const calcValues: SubmissionData = {};
  if (calcFields.length === 0) {
    return calcValues;
  }

  const baseData = { ...data };
  for (const field of calcFields) {
    delete baseData[field.key];
  }

  for (const field of calcFields) {
    if (field.calcMode === "script") {
      const script = field.calcScript ?? "";
      calcValues[field.key] = script.trim()
        ? normalizeCalcValue(runScriptSafely(script, baseData, fields))
        : "";
    } else {
      const formula = field.formula ?? "";
      const result = formula.trim()
        ? evaluateFormula(formula, baseData, fields)
        : null;
      calcValues[field.key] = result === null ? "" : result;
    }
  }
  return calcValues;
}
