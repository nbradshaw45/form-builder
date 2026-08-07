import type {
  Condition,
  ConditionGroup,
  ConditionOperator,
  ConditionRule,
  FieldType,
  FormField,
  LogicAction,
  LogicCondition,
  SubmissionData,
} from "../types";
import { evaluateFormula } from "../components/builder/formula";

export type ConditionOperatorDef = {
  value: ConditionOperator;
  label: string;
  needsValue: boolean;
};

export const USER_EMAIL_KEY = "_user_email";
export const USER_ID_KEY = "_user_id";
export const RECORD_MODE_KEY = "_record_mode";
export const RECORD_MODE_NEW = "new";
export const RECORD_MODE_UPDATE = "update";

export function recordModeField(): FormField {
  return {
    id: RECORD_MODE_KEY,
    key: RECORD_MODE_KEY,
    type: "text",
    label: "Record state",
    options: [RECORD_MODE_NEW, RECORD_MODE_UPDATE],
    optionLabels: ["New record", "Update (already saved)"],
  };
}

export function currentUserEmailField(): FormField {
  return {
    id: USER_EMAIL_KEY,
    key: USER_EMAIL_KEY,
    type: "text",
    label: "Current user email",
  };
}

export function currentUserIdField(): FormField {
  return {
    id: USER_ID_KEY,
    key: USER_ID_KEY,
    type: "text",
    label: "Current user id",
  };
}

/** Pseudo-fields available when authoring record-permission conditions. */
export function permissionConditionFields(
  formFields: FormField[],
): FormField[] {
  return [
    currentUserEmailField(),
    currentUserIdField(),
    recordModeField(),
    ...formFields.filter(
      (field) =>
        !["section_header", "divider", "paragraph", "math", "captcha", "sequence"].includes(
          field.type,
        ),
      ),
  ];
}

export const CONDITION_OPERATORS: ConditionOperatorDef[] = [
  { value: "equals", label: "equals", needsValue: true },
  { value: "not_equals", label: "not equals", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "not_contains", label: "does not contain", needsValue: true },
  { value: "starts_with", label: "starts with", needsValue: true },
  { value: "ends_with", label: "ends with", needsValue: true },
  { value: "is_set", label: "is set", needsValue: false },
  { value: "is_not_set", label: "is not set", needsValue: false },
  { value: "gt", label: "greater than", needsValue: true },
  { value: "lt", label: "less than", needsValue: true },
  { value: "gte", label: "greater or equal", needsValue: true },
  { value: "lte", label: "less or equal", needsValue: true },
];

const NUMERIC_TYPES = new Set<FieldType>([
  "number",
  "currency",
  "rating",
  "slider",
  "math",
  "sequence",
]);

const DATE_TYPES = new Set<FieldType>([
  "date",
  "created_date",
  "modified_date",
]);

/** Operators offered for a field type. The user can still override manually. */
export function conditionOperatorsForType(type: FieldType | undefined): ConditionOperatorDef[] {
  const all = CONDITION_OPERATORS;
  if (NUMERIC_TYPES.has(type ?? "text")) {
    return all;
  }
  if (DATE_TYPES.has(type ?? "text")) {
    return all;
  }
  return all.filter(
    (op) => op.value !== "gt" && op.value !== "lt" && op.value !== "gte" && op.value !== "lte",
  );
}

export function conditionOperatorLabel(value: ConditionOperator): string {
  return (
    CONDITION_OPERATORS.find((op) => op.value === value)?.label ?? value
  );
}

function asString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.join(",");
  }
  return String(value);
}

function compareValues(target: unknown, expected: string): number {
  const left = Number(target);
  const right = Number(expected);
  if (Number.isFinite(left) && Number.isFinite(right)) {
    return left - right;
  }
  return asString(target).localeCompare(expected);
}

export function evaluateRule(
  rule: ConditionRule | undefined,
  values: SubmissionData,
): boolean {
  if (!rule) {
    return true;
  }
  const target = values[rule.field];
  const value = rule.value ?? "";
  switch (rule.operator) {
    case "equals":
      return asString(target) === value;
    case "not_equals":
      return asString(target) !== value;
    case "contains":
      return asString(target).toLowerCase().includes(value.toLowerCase());
    case "not_contains":
      return !asString(target).toLowerCase().includes(value.toLowerCase());
    case "starts_with":
      return asString(target).toLowerCase().startsWith(value.toLowerCase());
    case "ends_with":
      return asString(target).toLowerCase().endsWith(value.toLowerCase());
    case "is_set":
      return asString(target) !== "";
    case "is_not_set":
      return asString(target) === "";
    case "gt":
      return compareValues(target, value) > 0;
    case "lt":
      return compareValues(target, value) < 0;
    case "gte":
      return compareValues(target, value) >= 0;
    case "lte":
      return compareValues(target, value) <= 0;
  }
}

/**
 * Evaluates a condition. Supports the new `{ groups }` shape and, for
 * backward compatibility, the legacy single-rule shape `{ field, operator, value }`.
 * An undefined/empty condition is always true.
 */
export function evaluateCondition(
  condition: Condition | undefined,
  values: SubmissionData,
): boolean {
  if (!condition) {
    return true;
  }
  const groups = (condition as { groups?: ConditionGroup[] }).groups;
  if (Array.isArray(groups)) {
    if (groups.length === 0) {
      return true;
    }
    return groups.some((group) => {
      const rules = group.rules ?? [];
      return rules.length > 0 && rules.every((rule) => evaluateRule(rule, values));
    });
  }
  return evaluateRule(condition as unknown as ConditionRule, values);
}

export function normalizeCondition(condition: Condition | undefined): Condition {
  if (!condition) {
    return { groups: [{ rules: [{ field: "", operator: "equals", value: "" }] }] };
  }
  const groups = (condition as { groups?: ConditionGroup[] }).groups;
  if (Array.isArray(groups)) {
    return {
      groups: groups.map((group) => ({
        rules: (group.rules ?? []).map((rule) => ({
          field: rule.field,
          operator: rule.operator,
          value: rule.value ?? "",
        })),
      })),
    };
  }
  const legacy = condition as unknown as ConditionRule;
  return {
    groups: [
      {
        rules: [
          {
            field: legacy.field,
            operator: legacy.operator,
            value: legacy.value ?? "",
          },
        ],
      },
    ],
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

export type LogicResult = {
  /** Running values, including set_value / copy_value overrides. */
  values: SubmissionData;
  /** Per-field visibility forced by conditions (default true when absent). */
  visible: Record<string, boolean>;
  /** Options hidden by conditions, keyed by field key. */
  hiddenOptions: Record<string, Set<string>>;
  /** Options selected/deselected by conditions, keyed by field key. */
  selectedOptions: Record<string, string[]>;
  /** run_js snippets that should execute for the current evaluation. */
  js: string[];
};

function resolveLogicValue(
  action: Extract<LogicAction, { type: "set_value" }>,
  running: SubmissionData,
  fields: FormField[],
): string | number | boolean | string[] | null {
  switch (action.valueSource) {
    case "field":
      return running[action.sourceField ?? ""] ?? "";
    case "formula": {
      const result = evaluateFormula(action.formula ?? "", running, fields);
      return result === null ? "" : result;
    }
    default:
      return action.value ?? "";
  }
}

export function applyLogic(
  conditions: LogicCondition[],
  values: SubmissionData,
  fields: FormField[],
): LogicResult {
  const running: SubmissionData = { ...values };
  const visible: Record<string, boolean> = {};
  const hiddenOptions: Record<string, Set<string>> = {};
  const selectedOptions: Record<string, string[]> = {};
  const js: string[] = [];

  for (const condition of conditions) {
    const met = evaluateCondition(condition.when, running);
    const actions = met ? condition.then : (condition.else ?? []);
    for (const action of actions) {
      switch (action.type) {
        case "show_field":
          visible[action.field] = true;
          break;
        case "hide_field":
          visible[action.field] = false;
          break;
        case "set_value":
          running[action.field] = resolveLogicValue(action, running, fields);
          break;
        case "copy_value":
          running[action.to] = running[action.from] ?? "";
          break;
        case "select_option": {
          const current = running[action.field];
          const options = selectedOptions[action.field] ?? [];
          selectedOptions[action.field] = unique([...options, action.option]);
          if (Array.isArray(current)) {
            running[action.field] = unique([...current, action.option]);
          } else {
            running[action.field] = action.option;
          }
          break;
        }
        case "deselect_option": {
          const options = selectedOptions[action.field] ?? [];
          selectedOptions[action.field] = options.filter(
            (option) => option !== action.option,
          );
          const current = running[action.field];
          if (Array.isArray(current)) {
            running[action.field] = current.filter(
              (option) => option !== action.option,
            );
          } else if (asString(current) === action.option) {
            running[action.field] = "";
          }
          break;
        }
        case "show_option": {
          const set = hiddenOptions[action.field] ?? new Set<string>();
          set.delete(action.option);
          hiddenOptions[action.field] = set;
          break;
        }
        case "hide_option": {
          const set = hiddenOptions[action.field] ?? new Set<string>();
          set.add(action.option);
          hiddenOptions[action.field] = set;
          break;
        }
        case "run_js":
          if (action.code?.trim()) {
            js.push(action.code);
          }
          break;
      }
    }
  }

  return { values: running, visible, hiddenOptions, selectedOptions, js };
}
