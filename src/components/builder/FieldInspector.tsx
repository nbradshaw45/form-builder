import type { FormField, VisibilityOperator } from "../../types";
import type { FieldType } from "../../types";
import { inputClasses } from "../../shared/styles";
import { isSystemField } from "./elementFactory";

interface FieldInspectorProps {
  element: FormField | null;
  allElements: FormField[];
  onLabelChange: (element: FormField, label: string) => void;
  onKeyChange: (element: FormField, key: string) => void;
  onPatch: (id: string, patch: Partial<FormField>) => void;
}

const labelClasses = "text-xs font-semibold tracking-[-0.005em] text-neutral-800";

const OPERATORS: { value: VisibilityOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "is_set", label: "is set" },
  { value: "is_not_set", label: "is not set" },
];

const TYPE_NAMES: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  textarea: "Textarea",
  checkbox: "Checkbox",
  date: "Date",
  math: "Math / Calculated",
  section_header: "Section header",
  divider: "Divider",
  paragraph: "Paragraph",
  created_date: "Created date",
  modified_date: "Modified date",
  updated_by_user: "Updated by user",
};

export function FieldInspector({
  element,
  allElements,
  onLabelChange,
  onKeyChange,
  onPatch,
}: FieldInspectorProps) {
  if (!element) {
    return (
      <aside className="card p-4">
        <p className="text-[13px] text-neutral-500">
          Select an element on the canvas to edit its settings.
        </p>
      </aside>
    );
  }

  const isLayout =
    element.type === "section_header" ||
    element.type === "divider" ||
    element.type === "paragraph";
  const isMath = element.type === "math";
  const isSystem = isSystemField(element.type);

  const ruleTargets = allElements.filter(
    (candidate) =>
      candidate.id !== element.id &&
      !["section_header", "divider", "paragraph", "math"].includes(
        candidate.type,
      ),
  );

  function insertFormulaKey(key: string) {
    if (!element) {
      return;
    }
    const token = `[${key}]`;
    const formula = element.formula ?? "";
    onPatch(element.id, {
      formula: formula ? `${formula} + ${token}` : token,
    });
  }

  return (
    <aside className="card flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-0.5 border-b border-neutral-100 pb-3">
        <h2 className="font-display text-sm font-bold tracking-[-0.02em] text-neutral-800">
          Settings
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
          {TYPE_NAMES[element.type]}
        </span>
      </div>

      {!isMath && (
        <div className="flex flex-col gap-1">
          <label htmlFor="inspector-label" className={labelClasses}>
            Label
          </label>
          <input
            id="inspector-label"
            value={element.label}
            onChange={(event) => onLabelChange(element, event.target.value)}
            className={inputClasses}
          />
        </div>
      )}

      {!isMath && (
        <div className="flex flex-col gap-1">
          <label htmlFor="inspector-key" className={labelClasses}>
            Field key
          </label>
          <input
            id="inspector-key"
            value={element.key}
            onChange={(event) => onKeyChange(element, event.target.value)}
            className={`${inputClasses} font-mono`}
          />
          <span className="text-xs text-neutral-400">
            Stored as the JSON key in submissions.
          </span>
        </div>
      )}

      {!isLayout && element.type !== "checkbox" && element.type !== "date" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="inspector-placeholder" className={labelClasses}>
            Placeholder
          </label>
          <input
            id="inspector-placeholder"
            value={element.placeholder ?? ""}
            onChange={(event) =>
              onPatch(element.id, { placeholder: event.target.value })
            }
            className={inputClasses}
          />
        </div>
      )}

      {element.type === "select" && (
        <OptionsEditor element={element} onPatch={onPatch} />
      )}

      {isMath && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-formula" className={labelClasses}>
              Formula
            </label>
            <textarea
              id="inspector-formula"
              value={element.formula ?? ""}
              onChange={(event) =>
                onPatch(element.id, { formula: event.target.value })
              }
              rows={3}
              className={`${inputClasses} font-mono`}
              placeholder="[quantity] * [unit_price]"
            />
            <span className="text-xs text-neutral-400">
              Reference other fields with square brackets, e.g.{" "}
              <code className="font-mono">[quantity] * [unit_price]</code>.
            </span>
          </div>
          {ruleTargets.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {ruleTargets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => insertFormulaKey(target.key)}
                  className="rounded border border-neutral-300 bg-white px-2 py-1 font-mono text-xs text-neutral-600 hover:border-primary-400 hover:text-primary-700"
                >
                  [{target.key}]
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!isLayout && (
        <div className="flex flex-col gap-1">
          <label htmlFor="inspector-help" className={labelClasses}>
            Help text
          </label>
          <input
            id="inspector-help"
            value={element.helpText ?? ""}
            onChange={(event) =>
              onPatch(element.id, { helpText: event.target.value })
            }
            className={inputClasses}
          />
        </div>
      )}

      {(element.type === "section_header" || element.type === "paragraph") && (
        <div className="flex flex-col gap-1">
          <label htmlFor="inspector-description" className={labelClasses}>
            {element.type === "section_header" ? "Subtext" : "Secondary text"}
          </label>
          <textarea
            id="inspector-description"
            value={element.description ?? ""}
            onChange={(event) =>
              onPatch(element.id, { description: event.target.value })
            }
            rows={3}
            className={inputClasses}
          />
        </div>
      )}

      {!isLayout && !isMath && (
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
          <input
            type="checkbox"
            checked={Boolean(element.required)}
            onChange={(event) =>
              onPatch(element.id, { required: event.target.checked })
            }
            className="size-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
          />
          Required
        </label>
      )}

      <div className="flex flex-col gap-2.5 border-t border-neutral-100 pt-3">
        <span className={labelClasses}>Data table</span>
        <ToggleRow
          label="Show in data table"
          checked={element.showInTable !== false}
          onChange={(checked) =>
            onPatch(element.id, { showInTable: checked })
          }
        />
      </div>

      {isSystem && (
        <div className="flex flex-col gap-2.5 border-t border-neutral-100 pt-3">
          <span className={labelClasses}>System field</span>
          <ToggleRow
            label="Show on form"
            checked={element.hidden !== true}
            onChange={(checked) => onPatch(element.id, { hidden: !checked })}
          />
          <ToggleRow
            label="Read-only"
            checked={element.readonly !== false}
            onChange={(checked) => onPatch(element.id, { readonly: checked })}
          />
          {element.type === "updated_by_user" && (
            <div className="flex flex-col gap-1">
              <label className={labelClasses} htmlFor="inspector-value-source">
                Value to record
              </label>
              <select
                id="inspector-value-source"
                value={element.valueSource ?? "email"}
                onChange={(event) =>
                  onPatch(element.id, {
                    valueSource: event.target.value as "email" | "name",
                  })
                }
                className={inputClasses}
              >
                <option value="email">Email address</option>
                <option value="name">Display name</option>
              </select>
              <p className="text-xs leading-snug text-neutral-400">
                Email uses the account email; display name uses the name set in
                user management. Falls back to email if no name is set.
              </p>
            </div>
          )}
          <p className="text-xs leading-snug text-neutral-400">
            Values are filled automatically when a response is submitted or
            updated.
          </p>
        </div>
      )}

      <RulesEditor
        element={element}
        ruleTargets={ruleTargets}
        onPatch={onPatch}
      />
    </aside>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px] font-medium text-neutral-800">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
          checked ? "bg-primary-600" : "bg-neutral-300"
        }`}
      >
        <span
          className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
  );
}

function OptionsEditor({
  element,
  onPatch,
}: {
  element: FormField;
  onPatch: (id: string, patch: Partial<FormField>) => void;
}) {
  const options = element.options ?? [];

  function setOption(index: number, value: string) {
    const next = [...options];
    next[index] = value;
    onPatch(element.id, { options: next });
  }

  function removeOption(index: number) {
    onPatch(element.id, {
      options: options.filter((_, i) => i !== index),
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={labelClasses}>Options</span>
      <ul className="flex flex-col gap-1.5">
        {options.map((option, index) => (
          <li key={index} className="flex items-center gap-1.5">
            <input
              value={option}
              onChange={(event) => setOption(index, event.target.value)}
              className={`${inputClasses} flex-1`}
              aria-label={`Option ${index + 1}`}
            />
            <button
              type="button"
              onClick={() => removeOption(index)}
              className="rounded px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onPatch(element.id, { options: [...options, ""] })}
        className="self-start rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:border-primary-400 hover:text-primary-700"
      >
        + Add option
      </button>
    </div>
  );
}

function RulesEditor({
  element,
  ruleTargets,
  onPatch,
}: {
  element: FormField;
  ruleTargets: FormField[];
  onPatch: (id: string, patch: Partial<FormField>) => void;
}) {
  const rule = element.visibleWhen;
  const enabled = Boolean(rule);

  function setEnabled(next: boolean) {
    if (next) {
      onPatch(element.id, {
        visibleWhen: {
          field: ruleTargets[0]?.key ?? "",
          operator: "equals",
          value: "",
        },
      });
    } else {
      onPatch(element.id, { visibleWhen: undefined });
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
      <span className={labelClasses}>Visibility rule</span>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          disabled={ruleTargets.length === 0}
          className="size-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500 disabled:cursor-not-allowed"
        />
        Show conditionally
      </label>

      {enabled && rule && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-neutral-100 bg-muted p-3">
          <div className="flex flex-col gap-1">
            <label className={labelClasses}>Field</label>
            <select
              value={rule.field}
              onChange={(event) =>
                onPatch(element.id, {
                  visibleWhen: { ...rule, field: event.target.value },
                })
              }
              className={inputClasses}
            >
              {ruleTargets.length === 0 && <option value="">No fields</option>}
              {ruleTargets.map((target) => (
                <option key={target.id} value={target.key}>
                  {target.label} ({target.key})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClasses}>Condition</label>
            <select
              value={rule.operator}
              onChange={(event) =>
                onPatch(element.id, {
                  visibleWhen: {
                    ...rule,
                    operator: event.target.value as VisibilityOperator,
                  },
                })
              }
              className={inputClasses}
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>
          {(rule.operator === "equals" ||
            rule.operator === "not_equals") && (
            <div className="flex flex-col gap-1">
              <label className={labelClasses}>Value</label>
              <input
                value={rule.value}
                onChange={(event) =>
                  onPatch(element.id, {
                    visibleWhen: { ...rule, value: event.target.value },
                  })
                }
                className={inputClasses}
              />
            </div>
          )}
        </div>
      )}

      {ruleTargets.length === 0 && (
        <p className="text-xs text-neutral-400">
          Add input fields before this one to use conditional visibility.
        </p>
      )}
    </div>
  );
}
