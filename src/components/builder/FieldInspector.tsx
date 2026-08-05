import type {
  FieldValidation,
  FormField,
  FormSettings,
  VisibilityOperator,
  VisibilityRule,
} from "../../types";
import type { FieldType } from "../../types";
import { inputClasses } from "../../shared/styles";
import { isSystemField } from "./elementFactory";

interface FieldInspectorProps {
  element: FormField | null;
  allElements: FormField[];
  settings: FormSettings;
  onLabelChange: (element: FormField, label: string) => void;
  onKeyChange: (element: FormField, key: string) => void;
  onPatch: (id: string, patch: Partial<FormField>) => void;
  onSettingsChange: (patch: Partial<FormSettings>) => void;
}

const labelClasses = "text-xs font-semibold tracking-[-0.005em] text-neutral-800";

const OPERATORS: { value: VisibilityOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "is_set", label: "is set" },
  { value: "is_not_set", label: "is not set" },
];

const WIDTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const columns = index + 1;
  const percent = Math.round((columns / 12) * 100);
  return { value: columns, label: `${columns} — ${percent}%` };
}).reverse();

const MODAL_WIDTHS = [440, 520, 560, 640, 720, 840, 960];

const MODAL_HEIGHTS: { value: number | null; label: string }[] = [
  { value: null, label: "Auto — fit content" },
  { value: 480, label: "480px" },
  { value: 600, label: "600px" },
  { value: 720, label: "720px" },
  { value: 900, label: "900px" },
];

const TYPE_NAMES: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  textarea: "Textarea",
  checkbox: "Checkbox",
  date: "Date",
  time: "Time",
  email: "Email",
  url: "URL",
  phone: "Phone",
  radio: "Radio group",
  multi_select: "Multi-select",
  rating: "Rating",
  slider: "Slider",
  currency: "Currency",
  signature: "Signature",
  file_upload: "File upload",
  user: "User",
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
  settings,
  onLabelChange,
  onKeyChange,
  onPatch,
  onSettingsChange,
}: FieldInspectorProps) {
  if (!element) {
    return <FormSettingsPanel settings={settings} onChange={onSettingsChange} />;
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

      <div className="flex flex-col gap-1">
        <label htmlFor="inspector-width" className={labelClasses}>
          Column width
        </label>
        <select
          id="inspector-width"
          value={element.width ?? 12}
          onChange={(event) =>
            onPatch(element.id, { width: Number(event.target.value) })
          }
          className={inputClasses}
        >
          {WIDTH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-400">
          Spans a 12-column grid; elements wrap to the next row when the row
          is full.
        </span>
      </div>

      {!isLayout &&
        !["checkbox", "date", "time", "user", "radio", "multi_select", "rating", "slider", "signature", "file_upload"].includes(
          element.type,
        ) && (
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

      {["select", "radio", "multi_select"].includes(element.type) && (
        <OptionsEditor
          element={element}
          ruleTargets={ruleTargets}
          onPatch={onPatch}
        />
      )}

      {["radio", "multi_select"].includes(element.type) && (
        <div className="flex flex-col gap-1">
          <span className={labelClasses}>Layout</span>
          <select
            value={element.layout ?? "stacked"}
            onChange={(event) =>
              onPatch(element.id, {
                layout: event.target.value as "inline" | "stacked",
              })
            }
            className={inputClasses}
          >
            <option value="stacked">Stacked</option>
            <option value="inline">Inline</option>
          </select>
        </div>
      )}

      {element.type === "slider" && (
        <div className="flex flex-col gap-2">
          <span className={labelClasses}>Range</span>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="inspector-min" className="text-xs text-neutral-500">
                Min
              </label>
              <input
                id="inspector-min"
                type="number"
                value={element.min ?? 0}
                onChange={(event) =>
                  onPatch(element.id, { min: Number(event.target.value) })
                }
                className={inputClasses}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="inspector-max" className="text-xs text-neutral-500">
                Max
              </label>
              <input
                id="inspector-max"
                type="number"
                value={element.max ?? 100}
                onChange={(event) =>
                  onPatch(element.id, { max: Number(event.target.value) })
                }
                className={inputClasses}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="inspector-step" className="text-xs text-neutral-500">
                Step
              </label>
              <input
                id="inspector-step"
                type="number"
                value={element.step ?? 1}
                onChange={(event) =>
                  onPatch(element.id, { step: Number(event.target.value) })
                }
                className={inputClasses}
              />
            </div>
          </div>
        </div>
      )}

      {element.type === "currency" && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="inspector-prefix" className="text-xs text-neutral-500">
                Prefix
              </label>
              <input
                id="inspector-prefix"
                value={element.prefix ?? ""}
                onChange={(event) =>
                  onPatch(element.id, { prefix: event.target.value })
                }
                placeholder="$"
                className={inputClasses}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="inspector-suffix" className="text-xs text-neutral-500">
                Suffix
              </label>
              <input
                id="inspector-suffix"
                value={element.suffix ?? ""}
                onChange={(event) =>
                  onPatch(element.id, { suffix: event.target.value })
                }
                placeholder="USD"
                className={inputClasses}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-decimals" className="text-xs text-neutral-500">
              Decimals
            </label>
            <select
              id="inspector-decimals"
              value={element.decimals ?? 2}
              onChange={(event) =>
                onPatch(element.id, { decimals: Number(event.target.value) })
              }
              className={inputClasses}
            >
              <option value={0}>0</option>
              <option value={2}>2</option>
            </select>
          </div>
        </div>
      )}

      {element.type === "rating" && (
        <div className="flex flex-col gap-1">
          <span className={labelClasses}>Stars</span>
          <select
            value={element.starCount ?? 5}
            onChange={(event) =>
              onPatch(element.id, {
                starCount: Number(event.target.value) as 3 | 5 | 7 | 10,
              })
            }
            className={inputClasses}
          >
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={7}>7</option>
            <option value={10}>10</option>
          </select>
        </div>
      )}

      {element.type === "file_upload" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-accept" className="text-xs text-neutral-500">
              Allowed file types
            </label>
            <input
              id="inspector-accept"
              value={element.accept ?? ""}
              onChange={(event) =>
                onPatch(element.id, { accept: event.target.value })
              }
              placeholder=".pdf,.png,image/jpeg"
              className={`${inputClasses} font-mono`}
            />
            <span className="text-xs text-neutral-400">
              Comma-separated MIME types or extensions. Leave blank to allow
              anything.
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-maxsize" className="text-xs text-neutral-500">
              Max size (MB)
            </label>
            <input
              id="inspector-maxsize"
              type="number"
              min={1}
              max={10}
              value={element.maxFileSizeMb ?? 5}
              onChange={(event) =>
                onPatch(element.id, {
                  maxFileSizeMb: Number(event.target.value),
                })
              }
              className={inputClasses}
            />
          </div>
        </div>
      )}

      {element.type === "signature" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-pen-color" className="text-xs text-neutral-500">
              Pen color
            </label>
            <input
              id="inspector-pen-color"
              type="color"
              value={element.penColor ?? "#1e293b"}
              onChange={(event) =>
                onPatch(element.id, { penColor: event.target.value })
              }
              className="h-9 w-full cursor-pointer rounded-lg border border-neutral-300 bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-pen-width" className="text-xs text-neutral-500">
              Pen width
            </label>
            <input
              id="inspector-pen-width"
              type="number"
              min={1}
              max={10}
              value={element.penWidth ?? 2}
              onChange={(event) =>
                onPatch(element.id, { penWidth: Number(event.target.value) })
              }
              className={inputClasses}
            />
          </div>
        </div>
      )}

      {element.type === "user" && (
        <p className="rounded-lg border border-neutral-100 bg-muted px-3 py-2 text-xs leading-relaxed text-neutral-500">
          Options are populated from the current users list. The selected
          user&apos;s email is stored in submissions.
        </p>
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
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-math-decimals" className={labelClasses}>
              Rounding
            </label>
            <select
              id="inspector-math-decimals"
              value={element.mathDecimals ?? 2}
              onChange={(event) =>
                onPatch(element.id, {
                  mathDecimals: Number(event.target.value),
                })
              }
              className={inputClasses}
            >
              <option value={0}>0 decimals</option>
              <option value={1}>1 decimal</option>
              <option value={2}>2 decimals</option>
              <option value={3}>3 decimals</option>
              <option value={4}>4 decimals</option>
            </select>
            <span className="text-xs text-neutral-400">
              Functions:{" "}
              <code className="font-mono">
                sum(..) avg(..) min(..) max(..) round(x,d) abs(x) count(..)
                if(cond,a,b) dateDiff(a,b)
              </code>
            </span>
          </div>
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

      {!isLayout && !isMath && (
        <ValidationEditor
          element={element}
          ruleTargets={ruleTargets}
          onPatch={onPatch}
        />
      )}

      {!isLayout && !isMath && (
        <RequiredWhenEditor
          element={element}
          ruleTargets={ruleTargets}
          onPatch={onPatch}
        />
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

function FormSettingsPanel({
  settings,
  onChange,
}: {
  settings: FormSettings;
  onChange: (patch: Partial<FormSettings>) => void;
}) {
  const isModal = settings.displayMode === "modal";
  const wantsRedirect =
    settings.successMode === "redirect" || settings.successMode === "both";
  const wantsMessage =
    settings.successMode === "message" || settings.successMode === "both";

  return (
    <aside className="card flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-0.5 border-b border-neutral-100 pb-3">
        <h2 className="font-display text-sm font-bold tracking-[-0.02em] text-neutral-800">
          Form settings
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
          Display &amp; after submit
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="settings-display" className={labelClasses}>
          How the form opens
        </label>
        <select
          id="settings-display"
          value={settings.displayMode ?? "page"}
          onChange={(event) =>
            onChange({
              displayMode: event.target.value as FormSettings["displayMode"],
            })
          }
          className={inputClasses}
        >
          <option value="page">New page</option>
          <option value="modal">Popup / modal</option>
        </select>
      </div>

      {isModal && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-neutral-100 bg-muted p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="settings-modal-width" className={labelClasses}>
              Popup width
            </label>
            <select
              id="settings-modal-width"
              value={settings.modalWidth ?? 560}
              onChange={(event) =>
                onChange({ modalWidth: Number(event.target.value) })
              }
              className={inputClasses}
            >
              {MODAL_WIDTHS.map((width) => (
                <option key={width} value={width}>
                  {width}px
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="settings-modal-height" className={labelClasses}>
              Popup height
            </label>
            <select
              id="settings-modal-height"
              value={settings.modalHeight ?? ""}
              onChange={(event) =>
                onChange({
                  modalHeight:
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                })
              }
              className={inputClasses}
            >
              {MODAL_HEIGHTS.map((option) => (
                <option
                  key={String(option.value)}
                  value={option.value ?? ""}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs leading-snug text-neutral-400">
            The form URL opens a centered popup with these window dimensions.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5 border-t border-neutral-100 pt-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="settings-success" className={labelClasses}>
            After submit
          </label>
          <select
            id="settings-success"
            value={settings.successMode ?? "message"}
            onChange={(event) =>
              onChange({
                successMode: event.target.value as FormSettings["successMode"],
              })
            }
            className={inputClasses}
          >
            <option value="message">Show a success message</option>
            <option value="redirect">Redirect</option>
            <option value="both">Show message, then redirect</option>
          </select>
        </div>

        {wantsMessage && (
          <div className="flex flex-col gap-1">
            <label htmlFor="settings-success-message" className={labelClasses}>
              Success message
            </label>
            <textarea
              id="settings-success-message"
              value={settings.successMessage ?? ""}
              onChange={(event) =>
                onChange({ successMessage: event.target.value })
              }
              rows={2}
              placeholder="Thank you! Your response has been submitted."
              className={inputClasses}
            />
            <span className="text-xs text-neutral-400">
              Leave blank to use the default message.
            </span>
          </div>
        )}

        {wantsRedirect && (
          <div className="flex flex-col gap-2.5 rounded-lg border border-neutral-100 bg-muted p-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="settings-redirect-target"
                className={labelClasses}
              >
                Redirect to
              </label>
              <select
                id="settings-redirect-target"
                value={settings.redirectTarget ?? "submissions"}
                onChange={(event) =>
                  onChange({
                    redirectTarget: event.target
                      .value as FormSettings["redirectTarget"],
                  })
                }
                className={inputClasses}
              >
                <option value="submissions">
                  This form&apos;s submissions page
                </option>
                <option value="custom">A custom URL</option>
              </select>
            </div>
            {settings.redirectTarget === "custom" && (
              <div className="flex flex-col gap-1">
                <label htmlFor="settings-redirect-url" className={labelClasses}>
                  URL
                </label>
                <input
                  id="settings-redirect-url"
                  value={settings.redirectUrl ?? ""}
                  onChange={(event) =>
                    onChange({ redirectUrl: event.target.value })
                  }
                  placeholder="https://example.com/thanks"
                  className={`${inputClasses} font-mono`}
                />
              </div>
            )}
            <ToggleRow
              label="Append response data to URL"
              checked={settings.appendData === true}
              onChange={(checked) => onChange({ appendData: checked })}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-neutral-100 pt-3">
        <span className={labelClasses}>Buttons</span>
        <ToggleRow
          label="Back button"
          checked={settings.showBackButton !== false}
          onChange={(checked) => onChange({ showBackButton: checked })}
        />
        <ToggleRow
          label="Reset button"
          checked={settings.showResetButton === true}
          onChange={(checked) => onChange({ showResetButton: checked })}
        />
        <p className="text-xs leading-snug text-neutral-400">
          Back returns to the submissions page; Reset clears the form or
          restores the record&apos;s saved values.
        </p>
      </div>
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
  ruleTargets,
  onPatch,
}: {
  element: FormField;
  ruleTargets: FormField[];
  onPatch: (id: string, patch: Partial<FormField>) => void;
}) {
  const options = element.options ?? [];
  const optionRules: (VisibilityRule | undefined)[] =
    element.optionRules ?? [];

  function setOption(index: number, value: string) {
    const next = [...options];
    next[index] = value;
    onPatch(element.id, { options: next });
  }

  function removeOption(index: number) {
    const nextRules = [...optionRules];
    nextRules.splice(index, 1);
    const cleanRules = nextRules.filter(
      (rule): rule is VisibilityRule => Boolean(rule),
    );
    onPatch(element.id, {
      options: options.filter((_, i) => i !== index),
      optionRules: cleanRules.length > 0 ? cleanRules : undefined,
    });
  }

  function setOptionRule(index: number, rule: VisibilityRule | undefined) {
    const nextRules = [...optionRules];
    if (rule) {
      nextRules[index] = rule;
    } else {
      nextRules[index] = undefined;
    }
    const cleanRules = nextRules.filter(
      (item): item is VisibilityRule => Boolean(item),
    );
    onPatch(element.id, {
      optionRules: cleanRules.length > 0 ? cleanRules : undefined,
    });
  }

  function addOption() {
    onPatch(element.id, { options: [...options, ""] });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={labelClasses}>Options</span>
      <ul className="flex flex-col gap-2">
        {options.map((option, index) => {
          const rule = optionRules[index];
          return (
            <li
              key={index}
              className="flex flex-col gap-1.5 rounded-lg border border-neutral-100 bg-muted/60 p-2"
            >
              <div className="flex items-center gap-1.5">
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
              </div>
              {ruleTargets.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    checked={Boolean(rule)}
                    onChange={(event) =>
                      setOptionRule(
                        index,
                        event.target.checked
                          ? {
                              field: ruleTargets[0].key,
                              operator: "equals",
                              value: "",
                            }
                          : undefined,
                      )
                    }
                    className="size-3.5 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                  />
                  Show when...
                </label>
              )}
              {rule && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-1.5">
                    <select
                      value={rule.field}
                      onChange={(event) =>
                        setOptionRule(index, {
                          ...rule,
                          field: event.target.value,
                        })
                      }
                      className={`${inputClasses} flex-1`}
                    >
                      {ruleTargets.map((target) => (
                        <option key={target.id} value={target.key}>
                          {target.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={rule.operator}
                      onChange={(event) =>
                        setOptionRule(index, {
                          ...rule,
                          operator: event.target
                            .value as VisibilityOperator,
                        })
                      }
                      className={`${inputClasses} w-32`}
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
                    <input
                      value={rule.value ?? ""}
                      onChange={(event) =>
                        setOptionRule(index, {
                          ...rule,
                          value: event.target.value,
                        })
                      }
                      placeholder="Value"
                      className={inputClasses}
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={addOption}
        className="self-start rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:border-primary-400 hover:text-primary-700"
      >
        + Add option
      </button>
    </div>
  );
}

function ValidationEditor({
  element,
  ruleTargets,
  onPatch,
}: {
  element: FormField;
  ruleTargets: FormField[];
  onPatch: (id: string, patch: Partial<FormField>) => void;
}) {
  const validation = element.validation ?? {};
  const isTextual = ["text", "textarea", "email", "url", "phone"].includes(
    element.type,
  );
  const isNumeric = ["number", "slider", "currency", "rating"].includes(
    element.type,
  );

  function setValidation(patch: Partial<FieldValidation>) {
    onPatch(element.id, { validation: { ...validation, ...patch } });
  }

  function clearValidation(key: keyof FieldValidation) {
    const next = { ...validation };
    delete next[key];
    onPatch(element.id, {
      validation: Object.keys(next).length > 0 ? next : undefined,
    });
  }

  function numberPatch(
    key: "minLength" | "maxLength" | "min" | "max",
    value: string,
  ) {
    if (value === "") {
      clearValidation(key);
    } else {
      setValidation({ [key]: Number(value) });
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-neutral-100 bg-muted p-3">
      <span className={labelClasses}>Validation</span>

      {isTextual && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Min length</label>
            <input
              type="number"
              min={0}
              value={validation.minLength ?? ""}
              onChange={(event) =>
                numberPatch("minLength", event.target.value)
              }
              className={inputClasses}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Max length</label>
            <input
              type="number"
              min={0}
              value={validation.maxLength ?? ""}
              onChange={(event) =>
                numberPatch("maxLength", event.target.value)
              }
              className={inputClasses}
            />
          </div>
        </div>
      )}

      {isNumeric && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Min value</label>
            <input
              type="number"
              value={validation.min ?? ""}
              onChange={(event) => numberPatch("min", event.target.value)}
              className={inputClasses}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Max value</label>
            <input
              type="number"
              value={validation.max ?? ""}
              onChange={(event) => numberPatch("max", event.target.value)}
              className={inputClasses}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Pattern (regex)</label>
        <input
          value={validation.pattern ?? ""}
          onChange={(event) =>
            event.target.value === ""
              ? clearValidation("pattern")
              : setValidation({ pattern: event.target.value })
          }
          placeholder="/^[A-Z]{3}\\d{3}$/"
          className={`${inputClasses} font-mono`}
        />
      </div>
      {validation.pattern && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">
            Pattern error message
          </label>
          <input
            value={validation.patternMessage ?? ""}
            onChange={(event) =>
              setValidation({ patternMessage: event.target.value })
            }
            placeholder="Must match the expected format"
            className={inputClasses}
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Must match field</label>
        <select
          value={validation.mustMatch ?? ""}
          onChange={(event) =>
            event.target.value === ""
              ? clearValidation("mustMatch")
              : setValidation({ mustMatch: event.target.value })
          }
          className={inputClasses}
        >
          <option value="">None</option>
          {ruleTargets.map((target) => (
            <option key={target.id} value={target.key}>
              {target.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Custom rule</label>
        <input
          value={validation.rule ?? ""}
          onChange={(event) =>
            event.target.value === ""
              ? clearValidation("rule")
              : setValidation({ rule: event.target.value })
          }
          placeholder="[quantity] <= [max_quantity]"
          className={`${inputClasses} font-mono`}
        />
      </div>
      {validation.rule && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Rule error message</label>
          <input
            value={validation.ruleMessage ?? ""}
            onChange={(event) =>
              setValidation({ ruleMessage: event.target.value })
            }
            placeholder="Value does not satisfy the rule"
            className={inputClasses}
          />
        </div>
      )}
    </div>
  );
}

function RequiredWhenEditor({
  element,
  ruleTargets,
  onPatch,
}: {
  element: FormField;
  ruleTargets: FormField[];
  onPatch: (id: string, patch: Partial<FormField>) => void;
}) {
  const rule = element.requiredWhen;
  const enabled = Boolean(rule);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-100 bg-muted p-3">
      <span className={labelClasses}>Conditional required</span>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) =>
            onPatch(
              element.id,
              event.target.checked
                ? {
                    requiredWhen: {
                      field: ruleTargets[0]?.key ?? "",
                      operator: "equals",
                      value: "",
                    },
                  }
                : { requiredWhen: undefined },
            )
          }
          disabled={ruleTargets.length === 0}
          className="size-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500 disabled:cursor-not-allowed"
        />
        Required only when...
      </label>

      {enabled && rule && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <select
              value={rule.field}
              onChange={(event) =>
                onPatch(element.id, {
                  requiredWhen: { ...rule, field: event.target.value },
                })
              }
              className={`${inputClasses} flex-1`}
            >
              {ruleTargets.length === 0 && <option value="">No fields</option>}
              {ruleTargets.map((target) => (
                <option key={target.id} value={target.key}>
                  {target.label}
                </option>
              ))}
            </select>
            <select
              value={rule.operator}
              onChange={(event) =>
                onPatch(element.id, {
                  requiredWhen: {
                    ...rule,
                    operator: event.target.value as VisibilityOperator,
                  },
                })
              }
              className={`${inputClasses} w-32`}
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
            <input
              value={rule.value ?? ""}
              onChange={(event) =>
                onPatch(element.id, {
                  requiredWhen: { ...rule, value: event.target.value },
                })
              }
              placeholder="Value"
              className={inputClasses}
            />
          )}
        </div>
      )}

      {ruleTargets.length === 0 && (
        <p className="text-xs text-neutral-400">
          Add input fields before this one to use conditional required.
        </p>
      )}
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
