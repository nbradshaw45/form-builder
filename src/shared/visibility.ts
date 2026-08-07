import { evaluateCondition } from "./logic";
import type { FormField, SubmissionData } from "../types";

/**
 * Nearest preceding section_header for a field. Returns null when the field
 * is itself a section header, or when it appears before any section.
 */
export function findSectionHeader(
  fields: FormField[],
  fieldKey: string,
): FormField | null {
  let current: FormField | null = null;
  for (const field of fields) {
    if (field.type === "section_header") {
      if (field.key === fieldKey) {
        return null;
      }
      current = field;
      continue;
    }
    if (field.key === fieldKey) {
      return current;
    }
  }
  return null;
}

/** Fields that belong to a section (header + content until the next header). */
export function getSectionFields(
  fields: FormField[],
  sectionHeader: FormField,
): FormField[] {
  const start = fields.findIndex((field) => field.id === sectionHeader.id);
  if (start < 0) {
    return [];
  }
  const result: FormField[] = [fields[start]];
  for (let i = start + 1; i < fields.length; i++) {
    if (fields[i].type === "section_header") {
      break;
    }
    result.push(fields[i]);
  }
  return result;
}

/** Visibility from the field's own rules (ignores parent section). */
export function isOwnVisible(
  field: FormField,
  values: SubmissionData,
  logicVisible: Record<string, boolean> = {},
): boolean {
  return (
    !field.hidden &&
    evaluateCondition(field.visibleWhen, values) &&
    (logicVisible[field.key] ?? true)
  );
}

/**
 * Field is shown only when its own rules pass and (if any) its enclosing
 * section header is also shown.
 */
export function isEffectivelyVisible(
  field: FormField,
  values: SubmissionData,
  fields: FormField[],
  logicVisible: Record<string, boolean> = {},
): boolean {
  if (!isOwnVisible(field, values, logicVisible)) {
    return false;
  }
  if (field.type === "section_header") {
    return true;
  }
  const section = findSectionHeader(fields, field.key);
  if (!section) {
    return true;
  }
  return isOwnVisible(section, values, logicVisible);
}

/**
 * Required only when effectively visible. Combines field.required,
 * requiredWhen, and an enclosing section's required flag.
 */
export function isEffectivelyRequired(
  field: FormField,
  values: SubmissionData,
  fields: FormField[],
  logicVisible: Record<string, boolean> = {},
): boolean {
  if (!isEffectivelyVisible(field, values, fields, logicVisible)) {
    return false;
  }
  if (field.required) {
    return true;
  }
  if (field.requiredWhen && evaluateCondition(field.requiredWhen, values)) {
    return true;
  }
  const section = findSectionHeader(fields, field.key);
  return Boolean(section?.required);
}
