import { evaluateFormula } from "../components/builder/formula";
import { evaluateCondition } from "./logic";
import type {
  FieldCharSet,
  FieldCompareOp,
  FieldValidation,
  FormField,
  SubmissionData,
} from "../types";

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CHAR_SET_PATTERNS: Record<FieldCharSet, RegExp> = {
  alpha: /^[A-Za-z]+$/,
  alphanumeric: /^[A-Za-z0-9]+$/,
  alphanumeric_space: /^[A-Za-z0-9 ]+$/,
};

const CHAR_SET_MESSAGES: Record<FieldCharSet, string> = {
  alpha: "Only letters are allowed",
  alphanumeric: "Only letters and numbers are allowed",
  alphanumeric_space: "Only letters, numbers, and spaces are allowed",
};

const COMPARE_LABELS: Record<FieldCompareOp, string> = {
  gt: "greater than",
  gte: "greater than or equal to",
  lt: "less than",
  lte: "less than or equal to",
};

export function isEmptyValue(field: FormField, value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (field.type === "yes_no") {
    return typeof value !== "boolean";
  }
  if (field.type === "rating" && typeof value === "number") {
    return value < 1;
  }
  return false;
}

export function isValidEmailString(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function validateFieldFormat(
  field: FormField,
  value: unknown,
): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const str = String(value);
  switch (field.type) {
    case "email":
      return isValidEmailString(str) ? null : "Enter a valid email address";
    case "url":
      try {
        new URL(str);
        return null;
      } catch {
        return "Enter a valid URL";
      }
    case "phone":
      return /^\+?[\d\s().-]{7,20}$/.test(str)
        ? null
        : "Enter a valid phone number";
    case "multi_select":
      return Array.isArray(value) && value.length > 0
        ? null
        : "Select at least one option";
    case "rating": {
      const num = Number(value);
      const count = field.starCount ?? 5;
      return num >= 1 && num <= count
        ? null
        : `Choose a rating between 1 and ${count}`;
    }
    case "signature":
      return value ? null : "Please add your signature";
    case "file_upload":
      return value ? null : "Please upload a file";
    default:
      return null;
  }
}

function validateCharSet(value: string, charSet: FieldCharSet): string | null {
  if (CHAR_SET_PATTERNS[charSet].test(value)) {
    return null;
  }
  return CHAR_SET_MESSAGES[charSet];
}

function compareNumeric(
  left: number,
  right: number,
  op: FieldCompareOp,
): boolean {
  switch (op) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
  }
}

/**
 * Sync field validation. Does not check unique / userExists / emailExists —
 * those need DB lookups.
 */
export function validateFieldSync(
  field: FormField,
  value: unknown,
  values: SubmissionData,
  fields: FormField[],
): string | null {
  if (field.type === "hidden") {
    return null;
  }
  if (field.type === "captcha") {
    if (isEmptyValue(field, value)) {
      return "Please complete the captcha";
    }
    return null;
  }
  if (field.type === "sequence") {
    return null;
  }
  if (field.type === "confirm") {
    const targetValue = field.confirmField
      ? values[field.confirmField]
      : undefined;
    if (
      targetValue !== undefined &&
      targetValue !== null &&
      targetValue !== ""
    ) {
      if (String(value ?? "") !== String(targetValue)) {
        const targetLabel =
          fields.find((f) => f.key === field.confirmField)?.label ??
          field.confirmField;
        return `Does not match ${targetLabel}`;
      }
    }
    return null;
  }

  const required =
    field.required ||
    (field.requiredWhen
      ? evaluateCondition(field.requiredWhen, values)
      : false);
  const empty = isEmptyValue(field, value);
  if (required && empty) {
    return "This field is required";
  }
  if (empty) {
    return null;
  }

  const formatError = validateFieldFormat(field, value);
  if (formatError) {
    return formatError;
  }

  const validation: FieldValidation | undefined = field.validation;
  if (!validation) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    const str = String(value);
    if (
      validation.minLength !== undefined &&
      str.length < validation.minLength
    ) {
      return `Must be at least ${validation.minLength} characters`;
    }
    if (
      validation.maxLength !== undefined &&
      str.length > validation.maxLength
    ) {
      return `Must be at most ${validation.maxLength} characters`;
    }
    if (validation.pattern) {
      try {
        const pattern = new RegExp(validation.pattern);
        if (!pattern.test(str)) {
          return (
            validation.patternMessage ||
            "Value does not match the required pattern"
          );
        }
      } catch {
        // Ignore invalid regex so it doesn't block submissions.
      }
    }
    if (validation.isNot !== undefined && validation.isNot !== "") {
      if (str.trim() === validation.isNot.trim()) {
        return validation.isNotMessage || "This value is not allowed";
      }
    }
    if (validation.isNumeric) {
      if (!NUMERIC_RE.test(str.trim())) {
        return "Must be a number";
      }
    }
    if (validation.isEmail || validation.emailExists) {
      if (!isValidEmailString(str)) {
        return "Enter a valid email address";
      }
    }
    if (validation.isAlphanumeric) {
      const alphaError = validateCharSet(str, "alphanumeric");
      if (alphaError) {
        return alphaError;
      }
    }
    if (validation.charSet) {
      const charError = validateCharSet(str, validation.charSet);
      if (charError) {
        return charError;
      }
    }
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (validation.min !== undefined && numeric < validation.min) {
      return `Must be at least ${validation.min}`;
    }
    if (validation.max !== undefined && numeric > validation.max) {
      return `Must be at most ${validation.max}`;
    }
    if (validation.compareOp) {
      let right: number | null = null;
      let rightLabel = "";
      if (validation.compareField) {
        const other = values[validation.compareField];
        const otherNum = Number(other);
        if (!Number.isFinite(otherNum)) {
          return (
            validation.compareMessage ||
            "Cannot compare: the other field is not a number"
          );
        }
        right = otherNum;
        rightLabel =
          fields.find((f) => f.key === validation.compareField)?.label ??
          validation.compareField;
      } else if (validation.compareValue !== undefined) {
        right = validation.compareValue;
        rightLabel = String(validation.compareValue);
      }
      if (
        right !== null &&
        !compareNumeric(numeric, right, validation.compareOp)
      ) {
        return (
          validation.compareMessage ||
          `Must be ${COMPARE_LABELS[validation.compareOp]} ${rightLabel}`
        );
      }
    }
  } else if (validation.compareOp) {
    return validation.compareMessage || "Must be a number to compare";
  }

  if (validation.mustMatch) {
    const otherValue = values[validation.mustMatch];
    const otherLabel =
      fields.find((f) => f.key === validation.mustMatch)?.label ??
      validation.mustMatch;
    if (String(value) !== String(otherValue ?? "")) {
      return `Does not match ${otherLabel}`;
    }
  }

  if (validation.uniqueAmong && validation.uniqueAmong.length > 0) {
    const keys = [field.key, ...validation.uniqueAmong];
    const seen = new Map<string, string>();
    for (const key of keys) {
      const v = values[key];
      if (v === undefined || v === null || String(v).trim() === "") {
        continue;
      }
      const normalized = String(v).trim();
      if (seen.has(normalized)) {
        const otherKey = seen.get(normalized)!;
        const otherLabel =
          fields.find((f) => f.key === otherKey)?.label ?? otherKey;
        return (
          validation.uniqueAmongMessage ||
          `Must be unique among related fields (matches ${otherLabel})`
        );
      }
      seen.set(normalized, key);
    }
  }

  if (validation.rule) {
    const ruleResult = evaluateFormula(validation.rule, values, fields);
    if (ruleResult === null || ruleResult === 0) {
      return validation.ruleMessage || "Value does not satisfy the rule";
    }
  }
  return null;
}

export type FieldValidationIssue = {
  fieldKey: string;
  message: string;
};

export function validateSubmissionDataSync(
  fields: FormField[],
  data: SubmissionData,
  options?: {
    isFieldVisible?: (field: FormField) => boolean;
    isSubmittableField?: (field: FormField) => boolean;
  },
): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];
  for (const field of fields) {
    if (options?.isSubmittableField && !options.isSubmittableField(field)) {
      continue;
    }
    if (options?.isFieldVisible && !options.isFieldVisible(field)) {
      continue;
    }
    const message = validateFieldSync(field, data[field.key], data, fields);
    if (message) {
      issues.push({ fieldKey: field.key, message });
    }
  }
  return issues;
}

export function submissionValueEquals(
  left: unknown,
  right: unknown,
): boolean {
  if (left === right) {
    return true;
  }
  if (left == null || right == null) {
    return false;
  }
  return String(left).trim() === String(right).trim();
}
