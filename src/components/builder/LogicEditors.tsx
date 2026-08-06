import { useState } from "react";
import type {
  Condition,
  ConditionOperator,
  ConditionRule,
  FormField,
  LogicAction,
  LogicCondition,
  LogicValueSource,
} from "../../types";
import { inputClasses } from "../../shared/styles";
import {
  conditionOperatorsForType,
  normalizeCondition,
} from "../../shared/logic";
import { generateId } from "./elementFactory";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon } from "./icons";

const labelClasses =
  "text-xs font-semibold tracking-[-0.005em] text-neutral-800";

const LOGIC_ACTION_TYPES: { value: LogicAction["type"]; label: string }[] = [
  { value: "show_field", label: "Show field" },
  { value: "hide_field", label: "Hide field" },
  { value: "set_value", label: "Set value" },
  { value: "copy_value", label: "Copy value from" },
  { value: "select_option", label: "Select option" },
  { value: "deselect_option", label: "Deselect option" },
  { value: "show_option", label: "Show option" },
  { value: "hide_option", label: "Hide option" },
  { value: "run_js", label: "Run custom JS" },
];

const VALUE_SOURCES: { value: LogicValueSource; label: string }[] = [
  { value: "static", label: "Fixed value" },
  { value: "field", label: "From another field" },
  { value: "formula", label: "Formula" },
];

export function defaultCondition(fieldKey?: string): Condition {
  return {
    groups: [{ rules: [{ field: fieldKey ?? "", operator: "equals", value: "" }] }],
  };
}

function RuleValueInput({
  target,
  value,
  onChange,
}: {
  target: FormField | undefined;
  value: string;
  onChange: (value: string) => void;
}) {
  const isDate = ["date", "created_date", "modified_date"].includes(
    target?.type ?? "",
  );
  const isNumeric = ["number", "currency", "rating", "slider", "math"].includes(
    target?.type ?? "",
  );
  if (isDate) {
    return (
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClasses} text-xs`}
      />
    );
  }
  if (isNumeric) {
    return (
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClasses} text-xs`}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Value"
      className={`${inputClasses} text-xs`}
    />
  );
}

export function RuleEditor({
  rule,
  targets,
  onRemove,
  onChange,
}: {
  rule: ConditionRule;
  targets: FormField[];
  onRemove: () => void;
  onChange: (rule: ConditionRule) => void;
}) {
  const target = targets.find((field) => field.key === rule.field);
  const operators = conditionOperatorsForType(target?.type);
  const needsValue =
    operators.find((op) => op.value === rule.operator)?.needsValue ?? false;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-neutral-100 bg-white p-2">
      <div className="flex gap-1.5">
        <select
          value={rule.field}
          onChange={(event) =>
            onChange({ ...rule, field: event.target.value })
          }
          className={`${inputClasses} min-w-0 flex-1 text-xs`}
        >
          <option value="">Select a field</option>
          {targets.map((field) => (
            <option key={field.key} value={field.key}>
              {field.label} ({field.key})
            </option>
          ))}
        </select>
        <select
          value={rule.operator}
          onChange={(event) =>
            onChange({
              ...rule,
              operator: event.target.value as ConditionOperator,
            })
          }
          className={`${inputClasses} w-32 text-xs`}
        >
          {operators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove rule"
          title="Remove rule"
          className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500"
        >
          <TrashIcon />
        </button>
      </div>
      {needsValue && (
        <RuleValueInput
          target={target}
          value={rule.value ?? ""}
          onChange={(value) => onChange({ ...rule, value })}
        />
      )}
    </div>
  );
}

export function ConditionEditor({
  condition,
  targets,
  onChange,
}: {
  condition: Condition | undefined;
  targets: FormField[];
  onChange: (condition: Condition) => void;
}) {
  const norm = normalizeCondition(condition);

  function updateGroup(index: number, group: { rules: ConditionRule[] }) {
    const groups = norm.groups.map((g, i) => (i === index ? group : g));
    onChange({ groups });
  }

  function addRule(groupIndex: number) {
    const group = norm.groups[groupIndex];
    updateGroup(groupIndex, {
      rules: [
        ...group.rules,
        { field: targets[0]?.key ?? "", operator: "equals", value: "" },
      ],
    });
  }

  function addGroup() {
    onChange({
      groups: [
        ...norm.groups,
        {
          rules: [{ field: targets[0]?.key ?? "", operator: "equals", value: "" }],
        },
      ],
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {norm.groups.map((group, groupIndex) => (
        <div key={groupIndex} className="flex flex-col gap-1.5">
          {groupIndex > 0 && (
            <div className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200" />
              Or
              <span className="h-px flex-1 bg-neutral-200" />
            </div>
          )}
          <div className="flex flex-col gap-1.5 rounded-lg border border-neutral-200 bg-muted p-2">
            {group.rules.map((rule, ruleIndex) => (
              <div key={ruleIndex} className="flex flex-col gap-1">
                {ruleIndex > 0 && (
                  <span className="px-1 text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-400">
                    And
                  </span>
                )}
                <RuleEditor
                  rule={rule}
                  targets={targets}
                  onChange={(next) => {
                    const rules = group.rules.map((r, i) =>
                      i === ruleIndex ? next : r,
                    );
                    updateGroup(groupIndex, { rules });
                  }}
                  onRemove={() => {
                    const rules = group.rules.filter(
                      (_, i) => i !== ruleIndex,
                    );
                    updateGroup(groupIndex, { rules });
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => addRule(groupIndex)}
              className="self-start rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-500 transition-colors hover:border-primary-300 hover:text-primary-700"
            >
              + Add rule
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addGroup}
        className="self-start rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-500 transition-colors hover:border-primary-300 hover:text-primary-700"
      >
        + Add group (OR)
      </button>
    </div>
  );
}

function OptionInput({
  field,
  value,
  onChange,
}: {
  field: FormField | undefined;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = field?.options ?? [];
  if (options.length > 0) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClasses} text-xs`}
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Option value"
      className={`${inputClasses} text-xs`}
    />
  );
}

function fieldKeyOf(action: LogicAction): string {
  if (action.type === "copy_value") {
    return action.to;
  }
  if (action.type === "run_js") {
    return "";
  }
  return action.field;
}

function changeField(
  action: LogicAction,
  field: string,
): LogicAction {
  if (action.type === "copy_value") {
    return { ...action, to: field };
  }
  if (action.type === "run_js") {
    return action;
  }
  return { ...action, field };
}

function buildActionPatch(
  action: LogicAction,
  type: LogicAction["type"],
): LogicAction {
  const targetField = fieldKeyOf(action);
  switch (type) {
    case "copy_value":
      return { type, from: "", to: targetField };
    case "set_value":
      return { type, field: targetField, valueSource: "static", value: "" };
    case "select_option":
    case "deselect_option":
    case "show_option":
    case "hide_option":
      return { type, field: targetField, option: "" };
    case "run_js":
      return { type, code: "" };
    default:
      return { type, field: targetField };
  }
}

function LogicActionRow({
  action,
  targets,
  onRemove,
  onChange,
}: {
  action: LogicAction;
  targets: FormField[];
  onRemove: () => void;
  onChange: (action: LogicAction) => void;
}) {
  const field = targets.find((target) => target.key === fieldKeyOf(action));

  const renderContextual = () => {
    switch (action.type) {
      case "set_value": {
        const source = action.valueSource ?? "static";
        return (
          <div className="flex flex-col gap-1.5">
            <select
              value={source}
              onChange={(event) =>
                onChange({
                  ...action,
                  valueSource: event.target.value as LogicValueSource,
                })
              }
              className={`${inputClasses} text-xs`}
            >
              {VALUE_SOURCES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {source === "field" ? (
              <select
                value={action.sourceField ?? ""}
                onChange={(event) =>
                  onChange({ ...action, sourceField: event.target.value })
                }
                className={`${inputClasses} text-xs`}
              >
                <option value="">Select a field</option>
                {targets
                  .filter((target) => target.key !== fieldKeyOf(action))
                  .map((target) => (
                    <option key={target.key} value={target.key}>
                      {target.label}
                    </option>
                  ))}
              </select>
            ) : source === "formula" ? (
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  value={action.formula ?? ""}
                  onChange={(event) =>
                    onChange({ ...action, formula: event.target.value })
                  }
                  placeholder="[quantity] * 2"
                  className={`${inputClasses} font-mono text-xs`}
                />
                <span className="text-[11px] text-neutral-400">
                  Reference fields with brackets, e.g. [quantity] * 2.
                </span>
              </div>
            ) : (
              <input
                type="text"
                value={action.value ?? ""}
                onChange={(event) =>
                  onChange({ ...action, value: event.target.value })
                }
                placeholder="Value"
                className={`${inputClasses} text-xs`}
              />
            )}
          </div>
        );
      }
      case "copy_value":
        return (
          <select
            value={action.from}
            onChange={(event) =>
              onChange({ ...action, from: event.target.value })
            }
            className={`${inputClasses} text-xs`}
          >
            <option value="">Copy from field</option>
            {targets
              .filter((target) => target.key !== fieldKeyOf(action))
              .map((target) => (
                <option key={target.key} value={target.key}>
                  {target.label}
                </option>
              ))}
          </select>
        );
      case "select_option":
      case "deselect_option":
      case "show_option":
      case "hide_option":
        return (
          <OptionInput
            field={field}
            value={action.option}
            onChange={(option) => onChange({ ...action, option })}
          />
        );
      case "run_js":
        return (
          <div className="flex flex-col gap-1">
            <textarea
              value={action.code ?? ""}
              onChange={(event) =>
                onChange({ ...action, code: event.target.value })
              }
              rows={3}
              placeholder="form.setValue('field_key', 'value');"
              className={`${inputClasses} font-mono text-xs`}
            />
            <span className="text-[11px] text-neutral-400">
              Runs when this branch is active. Available: form.getValue(key),
              form.setValue(key, value), form.values(), form.fields.
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-neutral-100 bg-white p-2">
      <div className="flex gap-1.5">
        {action.type !== "run_js" && (
          <select
            value={fieldKeyOf(action)}
            onChange={(event) => onChange(changeField(action, event.target.value))}
            className={`${inputClasses} min-w-0 flex-1 text-xs`}
          >
            <option value="">Select a field</option>
            {targets.map((target) => (
              <option key={target.key} value={target.key}>
                {target.label} ({target.key})
              </option>
            ))}
          </select>
        )}
        <select
          value={action.type}
          onChange={(event) =>
            onChange(buildActionPatch(action, event.target.value as LogicAction["type"]))
          }
          className={`${inputClasses} w-32 text-xs`}
        >
          {LOGIC_ACTION_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove action"
          title="Remove action"
          className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500"
        >
          <TrashIcon />
        </button>
      </div>
      {renderContextual()}
    </div>
  );
}

export function LogicActionsEditor({
  actions,
  targets,
  emptyHint,
  onChange,
}: {
  actions: LogicAction[];
  targets: FormField[];
  emptyHint: string;
  onChange: (actions: LogicAction[]) => void;
}) {
  function addAction() {
    onChange([
      ...actions,
      {
        type: "show_field",
        field: targets[0]?.key ?? "",
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {actions.length === 0 && (
        <p className="rounded border border-dashed border-neutral-200 bg-muted/50 px-2 py-1.5 text-[11px] text-neutral-400">
          {emptyHint}
        </p>
      )}
      {actions.map((action, index) => (
        <LogicActionRow
          key={index}
          action={action}
          targets={targets}
          onChange={(next) => {
            const nextActions = actions.map((a, i) => (i === index ? next : a));
            onChange(nextActions);
          }}
          onRemove={() =>
            onChange(actions.filter((_, i) => i !== index))
          }
        />
      ))}
      <button
        type="button"
        onClick={addAction}
        className="self-start rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-500 transition-colors hover:border-primary-300 hover:text-primary-700"
      >
        + Add action
      </button>
    </div>
  );
}

export function LogicConditionCard({
  condition,
  targets,
  onChange,
  onRemove,
}: {
  condition: LogicCondition;
  targets: FormField[];
  onChange: (condition: LogicCondition) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200">
      <div className="flex items-center justify-between gap-2 bg-muted/60 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px] font-semibold text-neutral-800"
        >
          <span className="truncate">
            Condition {condition.when.groups.length > 0 ? `(${condition.when.groups.flatMap((g) => g.rules).length} rule${condition.when.groups.flatMap((g) => g.rules).length === 1 ? "" : "s"})` : ""}
          </span>
          {open ? (
            <ChevronUpIcon className="size-4 shrink-0 text-neutral-400" />
          ) : (
            <ChevronDownIcon className="size-4 shrink-0 text-neutral-400" />
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove condition"
          title="Remove condition"
          className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500"
        >
          <TrashIcon />
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-3 border-t border-neutral-200 p-3">
          <div className="flex flex-col gap-1.5">
            <span className={labelClasses}>When</span>
            <ConditionEditor
              condition={condition.when}
              targets={targets}
              onChange={(when) => onChange({ ...condition, when })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={labelClasses}>Then do</span>
            <LogicActionsEditor
              actions={condition.then}
              targets={targets}
              emptyHint="No actions when the rules match."
              onChange={(then) => onChange({ ...condition, then })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={labelClasses}>Otherwise (not met)</span>
            <LogicActionsEditor
              actions={condition.else ?? []}
              targets={targets}
              emptyHint="Optional: no actions when the rules don't match."
              onChange={(actions) =>
                onChange({ ...condition, else: actions })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function ConditionalLogicPanel({
  conditions,
  targets,
  onChange,
}: {
  conditions: LogicCondition[];
  targets: FormField[];
  onChange: (conditions: LogicCondition[]) => void;
}) {
  function addCondition() {
    onChange([
      ...conditions,
      {
        id: generateId(),
        when: defaultCondition(targets[0]?.key ?? ""),
        then: [],
        else: [],
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-3">
      {conditions.length === 0 && (
        <p className="text-xs text-neutral-400">
          No conditions yet. Add one to show/hide fields, change values, or run
          custom JavaScript based on other field values.
        </p>
      )}
      {conditions.map((condition) => (
        <LogicConditionCard
          key={condition.id}
          condition={condition}
          targets={targets}
          onChange={(next) =>
            onChange(
              conditions.map((c) => (c.id === condition.id ? next : c)),
            )
          }
          onRemove={() =>
            onChange(conditions.filter((c) => c.id !== condition.id))
          }
        />
      ))}
      <button
        type="button"
        onClick={addCondition}
        className="self-start rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-primary-400 hover:text-primary-700"
      >
        + Add condition
      </button>
      <p className="text-[11px] leading-snug text-neutral-400">
        Conditions are evaluated in order on page load and whenever a value
        changes. Rules within a group are AND, groups are OR. Fields hidden by
        logic are skipped on submit.
      </p>
    </div>
  );
}

export function JsOnLoadEditor({
  code,
  onChange,
}: {
  code: string;
  onChange: (code: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={labelClasses}>Custom JS on page load</span>
      <textarea
        value={code}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder={"form.setValue('hidden_field', 'hello');\n// runs once when the form loads"}
        className={`${inputClasses} font-mono text-xs`}
      />
      <span className="text-[11px] leading-snug text-neutral-400">
        Runs once when the form page loads. Available: form.getValue(key),
        form.setValue(key, value), form.values(), form.fields.
      </span>
    </div>
  );
}
