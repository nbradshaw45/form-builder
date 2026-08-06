import type { FieldType } from "../types";

export type SubmissionFilter = {
  key: string;
  operator: string;
  value?: string;
  value2?: string;
};

export type FilterOperator = {
  value: string;
  label: string;
};

export function filterOperatorsForType(type: FieldType): FilterOperator[] {
  switch (type) {
    case "text":
    case "textarea":
    case "email":
    case "url":
    case "phone":
    case "select":
    case "radio":
    case "user":
    case "multi_select":
      return [
        { value: "equals", label: "Equals" },
        { value: "not_equals", label: "Not equals" },
        { value: "contains", label: "Contains" },
      ];
    case "number":
    case "currency":
    case "rating":
    case "slider":
      return [
        { value: "equals", label: "Equals" },
        { value: "gt", label: "Greater than" },
        { value: "lt", label: "Less than" },
        { value: "between", label: "Between" },
      ];
    case "date":
    case "created_date":
    case "modified_date":
      return [
        { value: "equals", label: "On date" },
        { value: "before", label: "Before" },
        { value: "after", label: "After" },
        { value: "between", label: "Between dates" },
      ];
    case "file_upload":
      return [
        { value: "has_file", label: "Has upload" },
        { value: "no_file", label: "No upload" },
      ];
    case "checkbox":
      return [{ value: "equals", label: "Equals" }];
    default:
      return [{ value: "equals", label: "Equals" }];
  }
}

export function filterStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return Array.isArray(value) ? value.join(", ") : String(value);
}

/** Extracts the YYYY-MM-DD portion of a stored value (timestamps become dates). */
export function filterDateOnly(value: unknown): string {
  const str = filterStringify(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  return str;
}

export function matchesFilter(
  data: Record<string, unknown>,
  filter: SubmissionFilter,
): boolean {
  const value = data[filter.key];
  const str = filterStringify(value);
  const lower = str.toLowerCase();
  const needle = (filter.value ?? "").toLowerCase();

  switch (filter.operator) {
    case "equals":
      return str === (filter.value ?? "");
    case "not_equals":
      return str !== (filter.value ?? "");
    case "contains":
      return lower.includes(needle);
    case "gt":
      return Number(value) > Number(filter.value);
    case "lt":
      return Number(value) < Number(filter.value);
    case "between": {
      const numeric = Number(value);
      const a = Number(filter.value);
      const b = Number(filter.value2);
      if (Number.isFinite(numeric) && Number.isFinite(a) && Number.isFinite(b)) {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        return numeric >= lo && numeric <= hi;
      }
      const day = filterDateOnly(value);
      const day1 = filterDateOnly(filter.value);
      const day2 = filterDateOnly(filter.value2);
      return day !== "" && day >= day1 && day <= day2;
    }
    case "before": {
      const day = filterDateOnly(value);
      return day !== "" && day < filterDateOnly(filter.value);
    }
    case "after": {
      const day = filterDateOnly(value);
      return day !== "" && day > filterDateOnly(filter.value);
    }
    case "has_file":
      return Boolean(value);
    case "no_file":
      return !value;
    default:
      return true;
  }
}
