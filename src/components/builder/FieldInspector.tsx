import { type ReactNode, useState } from "react";
import { rowActionPlacement } from "../../types";
import type {
  Condition,
  FieldValidation,
  FormAction,
  FormField,
  FormSettings,
  LogicAction,
  LogicCondition,
  SubmissionRowAction,
  SubmissionRowActionPlacement,
} from "../../types";
import type { FieldType } from "../../types";
import { inputClasses } from "../../shared/styles";
import { isSystemField } from "./elementFactory";
import { MASK_PRESETS } from "../../shared/mask";
import {
  filterInputForField,
  filterOperatorsForType,
  supportsFilterInputChoice,
} from "../../shared/filters";
import {
  ConditionEditor,
  ConditionalLogicPanel,
  JsOnLoadEditor,
  defaultCondition,
} from "./LogicEditors";
import {
  RECORD_MODE_KEY,
  recordModeField,
} from "../../shared/logic";
import { getForms, getFormUsers, useQuery } from "wasp/client/operations";
import { HelpBubble } from "../../shared/components/HelpBubble";
import { FormRolesEditor } from "./FormRolesEditor";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MaximizeIcon,
  MinimizeIcon,
} from "./icons";

interface FieldInspectorProps {
  element: FormField | null;
  allElements: FormField[];
  settings: FormSettings;
  onLabelChange: (element: FormField, label: string) => void;
  onKeyChange: (element: FormField, key: string) => void;
  onPatch: (id: string, patch: Partial<FormField>) => void;
  onDeselect: () => void;
  onSettingsChange: (patch: Partial<FormSettings>) => void;
}

const labelClasses = "text-xs font-semibold tracking-[-0.005em] text-neutral-800";

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
  captcha: "Captcha",
  confirm: "Confirmation",
  hidden: "Hidden field",
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
  onDeselect,
  onSettingsChange,
}: FieldInspectorProps) {
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  if (!element) {
    const fieldOptions = allElements
      .filter((field) => !isSystemField(field.type))
      .map((field) => ({ key: field.key, label: field.label }));
    return (
      <>
        <FormSettingsPanel
          settings={settings}
          fieldOptions={fieldOptions}
          fields={allElements}
          onChange={onSettingsChange}
          onExpand={() => setSettingsExpanded(true)}
        />
        {settingsExpanded && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:p-8"
            onClick={() => setSettingsExpanded(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Form settings"
              className="w-full max-w-6xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <FormSettingsPanel
                settings={settings}
                fieldOptions={fieldOptions}
                fields={allElements}
                onChange={onSettingsChange}
                expanded
                onExpand={() => setSettingsExpanded(false)}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  const isLayout =
    element.type === "section_header" ||
    element.type === "divider" ||
    element.type === "paragraph";
  const isMath = element.type === "math";
  const isCaptcha = element.type === "captcha";
  const isSystem = isSystemField(element.type);

  const ruleTargets = allElements.filter(
    (candidate) =>
      candidate.id !== element.id &&
      !["section_header", "divider", "paragraph", "math", "captcha"].includes(
        candidate.type,
      ),
  );

  const conditionTargets = [recordModeField(), ...ruleTargets];

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
    <aside
      className="card flex flex-col gap-4 p-4"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-sm font-bold tracking-[-0.02em] text-neutral-800">
            Settings
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
            {TYPE_NAMES[element.type]}
          </span>
        </div>
        <button
          type="button"
          onClick={onDeselect}
          aria-label="Back to form settings"
          title="Back to form settings"
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs font-semibold text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700"
        >
          <ArrowLeftIcon className="size-3.5" />
          Form settings
        </button>
      </div>

      <SettingsAccordion
        key={`${element.id}-general`}
        label="General"
        defaultOpen
      >
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

        {isCaptcha && (
          <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-snug text-neutral-500">
            Renders a Cloudflare Turnstile widget. Tokens are verified
            server-side on submit and never stored. Configure{" "}
            <code className="font-mono">REACT_APP_TURNSTILE_SITE_KEY</code> and{" "}
            <code className="font-mono">TURNSTILE_SECRET_KEY</code>.{" "}
            <HelpBubble article="captcha" className="ml-1 align-middle" />
          </p>
        )}

        {!isLayout &&
          !isCaptcha &&
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

        {!isLayout && !isMath && !isCaptcha && !isSystemField(element.type) && (
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="inspector-default" help="default-values">
              Default value
            </FieldLabel>
            <input
              id="inspector-default"
              value={element.defaultValue ?? ""}
              onChange={(event) =>
                onPatch(element.id, { defaultValue: event.target.value })
              }
              placeholder="Prefilled on new submissions (or ?key=value)"
              className={inputClasses}
            />
            <span className="text-xs text-neutral-400">
              Prefills this field on new records. URL params like{" "}
              <code className="font-mono">?key=value</code> override it.
            </span>
          </div>
        )}

        {["text", "phone"].includes(element.type) && (
          <MaskEditor element={element} onPatch={onPatch} />
        )}

        {element.type === "confirm" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-confirm-field" className={labelClasses}>
              Confirm field
            </label>
            <select
              id="inspector-confirm-field"
              value={element.confirmField ?? ""}
              onChange={(event) =>
                onPatch(element.id, { confirmField: event.target.value })
              }
              className={inputClasses}
            >
              <option value="">Select a field</option>
              {ruleTargets.map((target) => (
                <option key={target.id} value={target.key}>
                  {target.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-neutral-400">
              The value must match this field (e.g. email or password confirm).
            </span>
          </div>
        )}

        {element.type === "hidden" && (
          <p className="rounded-lg border border-neutral-100 bg-muted px-3 py-2 text-xs leading-relaxed text-neutral-500">
            Not shown to users. Set a value via the Default value field or a URL
            param like <code className="font-mono">?key=value</code>; it is
            stored with the submission.
          </p>
        )}

        {element.type === "user" && (
          <p className="rounded-lg border border-neutral-100 bg-muted px-3 py-2 text-xs leading-relaxed text-neutral-500">
            Options are populated from the current users list. The selected
            user&apos;s email is stored in submissions.
          </p>
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
      </SettingsAccordion>

      {["select", "radio", "multi_select"].includes(element.type) && (
        <SettingsAccordion key={`${element.id}-options`} label="Options">
          <OptionsEditor
            element={element}
            ruleTargets={conditionTargets}
            onPatch={onPatch}
          />
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
        </SettingsAccordion>
      )}

      {["slider", "currency", "rating", "file_upload", "signature"].includes(
        element.type,
      ) && (
        <SettingsAccordion key={`${element.id}-format`} label="Formatting">
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
        </SettingsAccordion>
      )}

      {isMath && (
        <SettingsAccordion key={`${element.id}-formula`} label="Formula">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="inspector-formula" help="formula">
                Formula
              </FieldLabel>
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
        </SettingsAccordion>
      )}

      {!isLayout && !isMath && !isCaptcha && (
        <SettingsAccordion
          key={`${element.id}-validation`}
          label="Required & validation"
        >
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
          <ValidationEditor
            element={element}
            ruleTargets={ruleTargets}
            onPatch={onPatch}
          />
          <RequiredWhenEditor
            element={element}
            ruleTargets={conditionTargets}
            onPatch={onPatch}
          />
        </SettingsAccordion>
      )}

      <SettingsAccordion key={`${element.id}-data`} label="Data table & filters">
        {!isCaptcha && (
          <>
        <ToggleRow
          label="Show in data table"
          checked={element.showInTable !== false}
          onChange={(checked) =>
            onPatch(element.id, { showInTable: checked })
          }
        />
        <ToggleRow
          label="Show in filters"
          checked={element.filterable !== false}
          onChange={(checked) =>
            onPatch(element.id, { filterable: checked })
          }
        />
          </>
        )}
        {isCaptcha && (
          <p className="text-xs text-neutral-400">
            Captcha tokens are not stored with submissions.
          </p>
        )}
        {element.filterable !== false &&
          !isCaptcha &&
          element.type !== "file_upload" &&
          filterOperatorsForType(element.type).length > 1 && (
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="inspector-filter-operator" help="filters">
                Filter condition
              </FieldLabel>
              <select
                id="inspector-filter-operator"
                value={
                  element.filterOperator ??
                  filterOperatorsForType(element.type)[0]?.value ??
                  "equals"
                }
                onChange={(event) =>
                  onPatch(element.id, {
                    filterOperator: event.target.value,
                  })
                }
                className={inputClasses}
              >
                {filterOperatorsForType(element.type).map((operator) => (
                  <option key={operator.value} value={operator.value}>
                    {operator.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-neutral-400">
                The submissions page filter will use this condition; only the
                value input is shown there.
              </span>
            </div>
          )}
        {element.filterable !== false &&
          !isCaptcha &&
          supportsFilterInputChoice(element.type) && (
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="inspector-filter-input" help="filters">
                Filter input
              </FieldLabel>
              <select
                id="inspector-filter-input"
                value={filterInputForField(element)}
                onChange={(event) =>
                  onPatch(element.id, {
                    filterInput: event.target.value as "dropdown" | "text",
                  })
                }
                className={inputClasses}
              >
                <option value="dropdown">Dropdown</option>
                <option value="text">Text field</option>
              </select>
              <span className="text-xs text-neutral-400">
                Dropdown shows the existing values from submissions; a text
                field lets you type any value.
              </span>
            </div>
          )}
      </SettingsAccordion>

      {isSystem && (
        <SettingsAccordion key={`${element.id}-system`} label="System field">
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
              <FieldLabel htmlFor="inspector-value-source" help="system-fields">
                Value to record
              </FieldLabel>
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
        </SettingsAccordion>
      )}

      <SettingsAccordion key={`${element.id}-visibility`} label="Visibility">
        <RulesEditor
          element={element}
          ruleTargets={conditionTargets}
          onPatch={onPatch}
        />
      </SettingsAccordion>
    </aside>
  );
}

function toDatetimeLocal(value?: string): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function FormSettingsPanel({
  settings,
  fieldOptions,
  fields,
  onChange,
  expanded = false,
  onExpand,
}: {
  settings: FormSettings;
  fieldOptions: { key: string; label: string }[];
  fields: FormField[];
  onChange: (patch: Partial<FormSettings>) => void;
  expanded?: boolean;
  onExpand?: () => void;
}) {
  const isModal = settings.displayMode === "modal";
  const wantsRedirect =
    settings.successMode === "redirect" || settings.successMode === "both";
  const wantsMessage =
    settings.successMode === "message" || settings.successMode === "both";
  const [activeTab, setActiveTab] = useState("display");

  const { data: logicUsers } = useQuery(getFormUsers);

  const logicTargets = [
    recordModeField(),
    ...fields
      .filter(
        (field) =>
          !["section_header", "divider", "paragraph", "math", "captcha"].includes(
            field.type,
          ),
      )
      .map((field) => {
        if (field.type !== "user" || !logicUsers || logicUsers.length === 0) {
          return field;
        }
        return {
          ...field,
          options: logicUsers.map((user) => user.email),
          optionLabels: logicUsers.map((user) => user.name ?? user.email),
        };
      }),
  ];

  const sections: { id: string; label: string; node: ReactNode }[] = [
    {
      id: "display",
      label: "Display",
      node: (
        <>
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
                The form URL opens a centered popup with these window
                dimensions.
              </p>
            </div>
          )}
        </>
      ),
    },
    {
      id: "steps",
      label: "Steps",
      node: (
        <>
          <ToggleRow
            label="Multi-step wizard"
            checked={settings.multiStep === true}
            onChange={(checked) => onChange({ multiStep: checked })}
            help="steps"
          />
          <p className="text-xs leading-snug text-neutral-400">
            Split the form into steps at each Section header. Add Section
            header elements to create steps; the section title becomes the
            step name.
          </p>
        </>
      ),
    },
    {
      id: "after-submit",
      label: "After submit",
      node: (
        <>
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
              <FieldLabel
                htmlFor="settings-success-message"
                help="after-submit"
              >
                Success message
              </FieldLabel>
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
                Leave blank to use the default message. Supports smart tags
                like {"{field.email}"}, {"{record_url}"} and {"{receipt}"}.
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
                  <FieldLabel htmlFor="settings-redirect-url" help="after-submit">
                    URL
                  </FieldLabel>
                  <input
                    id="settings-redirect-url"
                    value={settings.redirectUrl ?? ""}
                    onChange={(event) =>
                      onChange({ redirectUrl: event.target.value })
                    }
                    placeholder="https://example.com/thanks"
                    className={`${inputClasses} font-mono`}
                  />
                  <span className="text-xs text-neutral-400">
                    Supports smart tags like {"{field.email}"} and{" "}
                    {"{receipt}"}.
                  </span>
                </div>
              )}
              <ToggleRow
                label="Append response data to URL"
                checked={settings.appendData === true}
                onChange={(checked) => onChange({ appendData: checked })}
                help="after-submit"
              />
            </div>
          )}
        </>
      ),
    },
    {
      id: "buttons",
      label: "Buttons",
      node: (
        <>
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
        </>
      ),
    },
    {
      id: "spam",
      label: "Spam & availability",
      node: (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs leading-snug text-neutral-400">
              Block bots and control when this form accepts responses. Pair with
              a Captcha element for public forms.
            </p>
            <HelpBubble article="spam" align="right" />
          </div>
          <ToggleRow
            label="Honeypot"
            checked={settings.honeypot === true}
            onChange={(checked) => onChange({ honeypot: checked })}
          />
          <p className="text-xs leading-snug text-neutral-400">
            Adds an invisible field that bots tend to fill; those submissions
            are silently discarded.
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="settings-min-submit" className="label">
              Minimum time to submit (seconds)
            </label>
            <input
              id="settings-min-submit"
              type="number"
              min={0}
              value={settings.minSubmitSeconds ?? ""}
              onChange={(event) =>
                onChange({
                  minSubmitSeconds:
                    event.target.value === ""
                      ? undefined
                      : Number(event.target.value),
                })
              }
              placeholder="Off"
              className={inputClasses}
            />
            <span className="text-xs text-neutral-400">
              Rejects submissions completed faster than this (typical bots).
              Leave blank to disable.
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="settings-rate-limit" className="label">
              Rate limit (per hour)
            </label>
            <input
              id="settings-rate-limit"
              type="number"
              min={1}
              value={settings.rateLimitPerHour ?? ""}
              onChange={(event) =>
                onChange({
                  rateLimitPerHour:
                    event.target.value === ""
                      ? undefined
                      : Number(event.target.value),
                })
              }
              placeholder="No limit"
              className={inputClasses}
            />
            <span className="text-xs text-neutral-400">
              Rejects submissions after the limit is reached in a rolling hour.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="settings-open-date" className="label">
                Open from
              </label>
              <input
                id="settings-open-date"
                type="datetime-local"
                value={toDatetimeLocal(settings.openDate)}
                onChange={(event) =>
                  onChange({
                    openDate: event.target.value
                      ? new Date(event.target.value).toISOString()
                      : undefined,
                  })
                }
                className={inputClasses}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="settings-close-date" className="label">
                Open until
              </label>
              <input
                id="settings-close-date"
                type="datetime-local"
                value={toDatetimeLocal(settings.closeDate)}
                onChange={(event) =>
                  onChange({
                    closeDate: event.target.value
                      ? new Date(event.target.value).toISOString()
                      : undefined,
                  })
                }
                className={inputClasses}
              />
            </div>
          </div>
          <p className="text-xs text-neutral-400">
            Submissions outside the window are rejected (the form page shows a
            &ldquo;closed&rdquo; notice).
          </p>
        </>
      ),
    },
    {
      id: "filters",
      label: "Submissions table",
      node: (
        <>
          <ToggleRow
            label="Show action labels"
            checked={settings.showActionLabels === true}
            onChange={(checked) => onChange({ showActionLabels: checked })}
            help="submissions-table"
          />
          <span className="-mt-1 text-xs text-neutral-400">
            When off, the row action buttons show icons only (with tooltips),
            saving table width.
          </span>
          <div className="flex flex-col gap-1.5 border-t border-neutral-100 pt-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
              Row action buttons
              <HelpBubble article="submissions-table" />
            </span>
            {(
              [
                ["view", "View"],
                ["edit", "Edit"],
                ["delete", "Delete"],
                ["pdf", "Download PDF"],
              ] as [SubmissionRowAction, string][]
            ).map(([action, label]) => (
              <div
                key={action}
                className="flex items-center justify-between gap-3"
              >
                <label
                  htmlFor={`settings-row-action-${action}`}
                  className="text-[13px] font-medium text-neutral-800"
                >
                  {label}
                </label>
                <select
                  id={`settings-row-action-${action}`}
                  value={rowActionPlacement(
                    settings.submissionRowActions?.[action],
                    action,
                  )}
                  onChange={(event) =>
                    onChange({
                      submissionRowActions: {
                        ...settings.submissionRowActions,
                        [action]: event.target
                          .value as SubmissionRowActionPlacement,
                      },
                    })
                  }
                  className={`${inputClasses} w-auto py-1 text-xs`}
                >
                  <option value="inline">Inline button</option>
                  <option value="dropdown">In ⋯ dropdown</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            ))}
            <span className="text-xs text-neutral-400">
              Inline buttons render in the Actions column; dropdown items go in
              the row's ⋯ menu. Edit and Delete also require edit access to
              the form.
            </span>
          </div>
          <div className="flex flex-col gap-1.5 border-t border-neutral-100 pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
              Filtering
            </span>
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="settings-filter-placement" help="submissions-table">
                Filter placement
              </FieldLabel>
              <select
                id="settings-filter-placement"
                value={settings.filterPlacement ?? "top"}
                onChange={(event) =>
                  onChange({
                    filterPlacement: event.target.value as "top" | "header",
                  })
                }
                className={inputClasses}
              >
                <option value="top">On top of the table</option>
                <option value="header">Under column headers</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="settings-filter-columns" help="submissions-table">
                Filter columns (top placement)
              </FieldLabel>
              <select
                id="settings-filter-columns"
                value={settings.filterColumns ?? 3}
                onChange={(event) =>
                  onChange({ filterColumns: Number(event.target.value) })
                }
                className={inputClasses}
              >
                {[1, 2, 3, 4, 6].map((count) => (
                  <option key={count} value={count}>
                    {count} {count === 1 ? "column" : "columns"}
                  </option>
                ))}
              </select>
              <span className="text-xs text-neutral-400">
                Fewer filters per row means the table stays higher on the page.
              </span>
            </div>
          </div>
        </>
      ),
    },
    {
      id: "automation",
      label: "Automation",
      node: (
        <>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="settings-webhook-url" help="automation">
              Webhook URL
            </FieldLabel>
            <input
              id="settings-webhook-url"
              value={settings.webhookUrl ?? ""}
              onChange={(event) =>
                onChange({ webhookUrl: event.target.value })
              }
              placeholder="https://example.com/hooks/form-builder"
              className={`${inputClasses} font-mono`}
            />
            <span className="text-xs text-neutral-400">
              Called on every submission create/update with the response data
              and an HMAC signature.
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="settings-webhook-secret" help="automation">
              Webhook secret
            </FieldLabel>
            <div className="flex gap-1.5">
              <input
                id="settings-webhook-secret"
                value={settings.webhookSecret ?? ""}
                readOnly
                placeholder="Not set"
                className={`${inputClasses} flex-1 font-mono`}
              />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    webhookSecret:
                      Math.random().toString(36).slice(2) +
                      Math.random().toString(36).slice(2),
                  })
                }
                className="shrink-0 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:border-primary-400 hover:text-primary-700"
              >
                Generate
              </button>
            </div>
            <span className="text-xs text-neutral-400">
              Sent as{" "}
              <code className="font-mono">
                X-Form-Signature: sha256=&lt;hmac&gt;
              </code>
              .
            </span>
          </div>
          <ToggleRow
            label="Show a receipt number"
            checked={settings.enableReceipt === true}
            onChange={(checked) => onChange({ enableReceipt: checked })}
            help="automation"
          />
          <ToggleRow
            label="Let submitters edit their response"
            checked={settings.allowSelfEdit === true}
            onChange={(checked) => onChange({ allowSelfEdit: checked })}
            help="automation"
          />
        </>
      ),
    },
    {
      id: "roles",
      label: "Record roles",
      node: (
        <FormRolesEditor
          settings={settings}
          fields={fields}
          onChange={onChange}
        />
      ),
    },
    {
      id: "actions",
      label: "Actions",
      node: (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs leading-snug text-neutral-400">
              Custom steps that run before or after a submission is stored. Set a
              field value, call an API, update the submission, copy it into
              another form, or send email (with CC/BCC/Reply-To and{" "}
              {"{if}"} templates).
            </p>
            <HelpBubble article="actions" align="right" />
          </div>
          <FormActionsEditor
            settings={settings}
            fieldOptions={fieldOptions}
            onChange={onChange}
          />
        </>
      ),
    },
    {
      id: "conditional",
      label: "Conditional logic",
      node: (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs leading-snug text-neutral-400">
              Show or hide fields, change values, and run custom JavaScript based
              on the value of other fields. Conditions are evaluated on page load
              and whenever a value changes.
            </p>
            <HelpBubble article="conditions" align="right" />
          </div>
          <ConditionalLogicPanel
            conditions={settings.conditions ?? []}
            targets={logicTargets}
            onChange={(conditions) => onChange({ conditions })}
          />
          <JsOnLoadEditor
            code={settings.jsOnLoad ?? ""}
            onChange={(jsOnLoad) => onChange({ jsOnLoad })}
          />
        </>
      ),
    },
  ];

  const header = (
    <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-sm font-bold tracking-[-0.02em] text-neutral-800">
          Form settings
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
          Display &amp; after submit
        </span>
      </div>
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          aria-label={expanded ? "Close pop out" : "Pop out settings"}
          title={expanded ? "Close" : "Pop out"}
          className="rounded-md border border-neutral-200 bg-white p-1.5 text-neutral-400 transition-colors hover:border-neutral-300 hover:text-neutral-700"
        >
          {expanded ? (
            <MinimizeIcon className="size-4" />
          ) : (
            <MaximizeIcon className="size-4" />
          )}
        </button>
      )}
    </div>
  );

  if (expanded) {
    const activeSection =
      sections.find((section) => section.id === activeTab) ?? sections[0];
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div className="flex flex-wrap gap-1 border-b border-neutral-100 pb-2">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveTab(section.id)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                activeTab === section.id
                  ? "bg-primary-50 text-primary-700"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">{activeSection.node}</div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-2 p-4">
      {header}
      {sections.map((section) => (
        <SettingsAccordion
          key={section.id}
          label={section.label}
          defaultOpen={section.id === "display"}
        >
          {section.node}
        </SettingsAccordion>
      ))}
    </div>
  );
}

function SettingsAccordion({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-100">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-left transition-colors hover:bg-muted"
      >
        <span className="text-[13px] font-semibold text-neutral-800">
          {label}
        </span>
        {open ? (
          <ChevronUpIcon className="size-4 text-neutral-400" />
        ) : (
          <ChevronDownIcon className="size-4 text-neutral-400" />
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-neutral-100 p-3">
          {children}
        </div>
      )}
    </div>
  );
}

function FormActionsEditor({
  settings,
  fieldOptions,
  onChange,
}: {
  settings: FormSettings;
  fieldOptions: { key: string; label: string }[];
  onChange: (patch: Partial<FormSettings>) => void;
}) {
  const { data: forms } = useQuery(getForms);
  const actions = settings.actions ?? [];

  function updateAction(id: string, patch: Partial<FormAction>) {
    const next = actions.map((action) =>
      action.id === id ? ({ ...action, ...patch } as FormAction) : action,
    );
    onChange({ actions: next });
  }

  function removeAction(id: string) {
    onChange({ actions: actions.filter((action) => action.id !== id) });
  }

  function addAction() {
    const id = `a_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    onChange({
      actions: [
        ...actions,
        {
          id,
          trigger: "before_submit",
          type: "set_field",
          field: fieldOptions[0]?.key ?? "",
          valueSource: "static",
          staticValue: "",
        },
      ],
    });
  }

  const selectCls = `${inputClasses} text-xs`;
  const valueSelectCls = `${inputClasses} text-xs`;

  return (
    <div className="flex flex-col gap-2">
      {actions.length === 0 && (
        <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-400">
          No actions configured.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {actions.map((action) => (
          <li
            key={action.id}
            className="flex flex-col gap-2 rounded-lg border border-neutral-100 bg-muted/60 p-2.5"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={action.trigger}
                onChange={(event) =>
                  updateAction(action.id, {
                    trigger: event.target.value as
                      | "before_submit"
                      | "after_submit",
                  })
                }
                disabled={action.type === "email"}
                className={selectCls}
              >
                <option value="before_submit">Before submit</option>
                <option value="after_submit">After submit</option>
              </select>
              <select
                value={action.type}
                onChange={(event) => {
                  const type = event.target.value as FormAction["type"];
                  if (type === "http_call") {
                    updateAction(action.id, {
                      type,
                      method: "POST",
                      url: "",
                      responseField: "",
                    });
                  } else if (type === "create_submission") {
                    updateAction(action.id, {
                      type,
                      formId: "",
                    });
                  } else if (type === "email") {
                    updateAction(action.id, {
                      type,
                      trigger: "after_submit",
                      recipients: "",
                      recipientField: "",
                      includeSubmitter: false,
                      subject: "",
                    });
                  } else {
                    updateAction(action.id, {
                      type,
                      field: fieldOptions[0]?.key ?? "",
                      valueSource: "static",
                      staticValue: "",
                    });
                  }
                }}
                className={selectCls}
              >
                <option value="set_field">Set field value</option>
                <option value="http_call">Call API</option>
                <option value="update_submission">Update this submission</option>
                <option value="create_submission">
                  Create submission in another form
                </option>
                <option value="email">Send email</option>
              </select>
              <button
                type="button"
                onClick={() => removeAction(action.id)}
                className="ml-auto rounded px-1.5 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
              >
                Remove
              </button>
            </div>

            {(action.type === "set_field" ||
              action.type === "update_submission") && (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={action.field}
                    onChange={(event) =>
                      updateAction(action.id, { field: event.target.value })
                    }
                    className={selectCls}
                    aria-label="Target field"
                  >
                    {fieldOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={action.valueSource}
                    onChange={(event) =>
                      updateAction(action.id, {
                        valueSource: event.target.value as
                          | "static"
                          | "field"
                          | "formula",
                      })
                    }
                    className={valueSelectCls}
                  >
                    <option value="static">Set to value</option>
                    <option value="field">Copy from field</option>
                    <option value="formula">Formula</option>
                  </select>
                </div>
                {action.valueSource === "static" && (
                  <input
                    value={action.staticValue ?? ""}
                    onChange={(event) =>
                      updateAction(action.id, {
                        staticValue: event.target.value,
                      })
                    }
                    placeholder="Value"
                    className={`${inputClasses} text-xs`}
                  />
                )}
                {action.valueSource === "field" && (
                  <select
                    value={action.sourceField ?? ""}
                    onChange={(event) =>
                      updateAction(action.id, {
                        sourceField: event.target.value,
                      })
                    }
                    className={selectCls}
                    aria-label="Source field"
                  >
                    {fieldOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
                {action.valueSource === "formula" && (
                  <input
                    value={action.formula ?? ""}
                    onChange={(event) =>
                      updateAction(action.id, {
                        formula: event.target.value,
                      })
                    }
                    placeholder="[quantity] * [price]"
                    className={`${inputClasses} font-mono text-xs`}
                  />
                )}
              </div>
            )}

            {action.type === "http_call" && (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={action.method}
                    onChange={(event) =>
                      updateAction(action.id, {
                        method: event.target.value as "GET" | "POST",
                      })
                    }
                    className={selectCls}
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                  </select>
                  <input
                    value={action.url}
                    onChange={(event) =>
                      updateAction(action.id, { url: event.target.value })
                    }
                    placeholder="https://api.example.com/hook"
                    className={`${inputClasses} min-w-0 flex-1 font-mono text-xs`}
                  />
                </div>
                {action.trigger === "before_submit" && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-500">
                      Write API response into field
                    </label>
                    <select
                      value={action.responseField ?? ""}
                      onChange={(event) =>
                        updateAction(action.id, {
                          responseField: event.target.value,
                        })
                      }
                      className={selectCls}
                    >
                      <option value="">None</option>
                      {fieldOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-neutral-400">
                      The API should return JSON with a{" "}
                      <code className="font-mono">value</code> field.
                    </span>
                  </div>
                )}
              </div>
            )}

            {action.type === "create_submission" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500">
                  Target form
                </label>
                <select
                  value={action.formId}
                  onChange={(event) =>
                    updateAction(action.id, { formId: event.target.value })
                  }
                  className={selectCls}
                >
                  <option value="">Select a form</option>
                  {(forms ?? []).map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.title}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-neutral-400">
                  Fields with matching keys are copied into a new submission of
                  the target form.
                </span>
              </div>
            )}

            {action.type === "email" && (
              <div className="flex flex-col gap-1.5">
                <input
                  value={action.recipients ?? ""}
                  onChange={(event) =>
                    updateAction(action.id, {
                      recipients: event.target.value,
                    })
                  }
                  placeholder="owner@example.com, team@example.com"
                  aria-label="Recipients"
                  className={`${inputClasses} font-mono text-xs`}
                />
                <select
                  value={action.recipientField ?? ""}
                  onChange={(event) =>
                    updateAction(action.id, {
                      recipientField: event.target.value || undefined,
                    })
                  }
                  className={selectCls}
                  aria-label="Email from field"
                >
                  <option value="">No field recipient</option>
                  {fieldOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label} ({option.key})
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
                  <input
                    type="checkbox"
                    checked={action.includeSubmitter === true}
                    onChange={(event) =>
                      updateAction(action.id, {
                        includeSubmitter: event.target.checked,
                      })
                    }
                    className="size-3.5 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                  />
                  Also email the submitter
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
                  <input
                    type="checkbox"
                    checked={action.attachPdf === true}
                    onChange={(event) =>
                      updateAction(action.id, {
                        attachPdf: event.target.checked,
                      })
                    }
                    className="size-3.5 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                  />
                  Attach a PDF of the submission
                </label>
                <input
                  value={action.cc ?? ""}
                  onChange={(event) =>
                    updateAction(action.id, {
                      cc: event.target.value || undefined,
                    })
                  }
                  placeholder="CC (optional, comma-separated)"
                  aria-label="CC"
                  className={`${inputClasses} font-mono text-xs`}
                />
                <input
                  value={action.bcc ?? ""}
                  onChange={(event) =>
                    updateAction(action.id, {
                      bcc: event.target.value || undefined,
                    })
                  }
                  placeholder="BCC (optional, comma-separated)"
                  aria-label="BCC"
                  className={`${inputClasses} font-mono text-xs`}
                />
                <input
                  value={action.replyTo ?? ""}
                  onChange={(event) =>
                    updateAction(action.id, {
                      replyTo: event.target.value || undefined,
                    })
                  }
                  placeholder="Reply-To (optional)"
                  aria-label="Reply-To"
                  className={`${inputClasses} font-mono text-xs`}
                />
                <input
                  value={action.subject ?? ""}
                  onChange={(event) =>
                    updateAction(action.id, { subject: event.target.value })
                  }
                  placeholder="Subject (optional)"
                  className={`${inputClasses} text-xs`}
                />
                <textarea
                  value={action.bodyTemplate ?? ""}
                  onChange={(event) =>
                    updateAction(action.id, {
                      bodyTemplate: event.target.value || undefined,
                    })
                  }
                  placeholder="Body template (optional, HTML + smart tags)"
                  rows={4}
                  aria-label="Body template"
                  className={`${inputClasses} font-mono text-xs`}
                />
                <span className="flex items-start gap-1.5 text-[11px] text-neutral-400">
                  <span>
                    Smart tags: {"{field.email}"}, {"{form.title}"},{" "}
                    {"{all_fields}"}, {"{record_url}"}, {"{receipt}"},{" "}
                    {"{submission.context.utmSource}"}, {"{date}"}.
                    Conditionals: {"{if field.status == approved}…{/if}"}.
                    CC/BCC/Reply-To also accept smart tags. Leave the body blank
                    for the default summary. Requires SMTP.
                  </span>
                  <HelpBubble article="smart-tags" align="right" />
                </span>
              </div>
            )}

            <ActionWhenEditor
              action={action}
              fieldOptions={fieldOptions}
              onWhenChange={(when) => updateAction(action.id, { when })}
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={addAction}
        className="self-start rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:border-primary-400 hover:text-primary-700"
      >
        + Add action
      </button>
    </div>
  );
}

function ActionWhenEditor({
  action,
  fieldOptions,
  onWhenChange,
}: {
  action: FormAction;
  fieldOptions: { key: string; label: string }[];
  onWhenChange: (when: Condition | undefined) => void;
}) {
  const condition = action.when;
  const enabled = Boolean(condition);

  return (
    <div className="flex flex-col gap-1.5 border-t border-neutral-100 pt-2">
      <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) =>
            onWhenChange(event.target.checked ? defaultCondition() : undefined)
          }
          disabled={fieldOptions.length === 0}
          className="size-3.5 rounded border-neutral-300 text-primary-500 focus:ring-primary-500 disabled:cursor-not-allowed"
        />
        Only run when...
      </label>

      {enabled && (
        <ConditionEditor
          condition={condition}
          targets={fieldOptions.map((option) => ({
            id: option.key,
            key: option.key,
            label: option.label,
            type: "text" as const,
          }))}
          onChange={onWhenChange}
        />
      )}

      {fieldOptions.length === 0 && (
        <p className="text-[11px] text-neutral-400">
          Add input fields to add a condition.
        </p>
      )}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  help,
  children,
}: {
  htmlFor?: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={htmlFor} className={labelClasses}>
        {children}
      </label>
      {help && <HelpBubble article={help} />}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="flex cursor-pointer items-center gap-3 text-[13px] font-medium text-neutral-800">
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
      {help && <HelpBubble article={help} align="right" />}
    </div>
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
  const optionRules: (Condition | undefined)[] = element.optionRules ?? [];

  function setOption(index: number, value: string) {
    const next = [...options];
    next[index] = value;
    onPatch(element.id, { options: next });
  }

  function removeOption(index: number) {
    const nextRules = [...optionRules];
    nextRules.splice(index, 1);
    const cleanRules = nextRules.filter(
      (rule): rule is Condition => Boolean(rule),
    );
    onPatch(element.id, {
      options: options.filter((_, i) => i !== index),
      optionRules: cleanRules.length > 0 ? cleanRules : undefined,
    });
  }

  function setOptionRule(index: number, rule: Condition | undefined) {
    const nextRules = [...optionRules];
    if (rule) {
      nextRules[index] = rule;
    } else {
      nextRules[index] = undefined;
    }
    const cleanRules = nextRules.filter(
      (item): item is Condition => Boolean(item),
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
      <div className="flex items-center gap-1.5">
        <span className={labelClasses}>Options</span>
        <HelpBubble article="options" />
      </div>
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
                          ? defaultCondition(ruleTargets[0].key)
                          : undefined,
                      )
                    }
                    className="size-3.5 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                  />
                  Show when...
                </label>
              )}
              {rule && (
                <ConditionEditor
                  condition={rule}
                  targets={ruleTargets}
                  onChange={(next) => setOptionRule(index, next)}
                />
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
      <div className="flex items-center gap-1.5">
        <span className={labelClasses}>Validation</span>
        <HelpBubble article="validation" />
      </div>

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
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-neutral-500">Pattern (regex)</label>
          <HelpBubble article="regex" />
        </div>
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
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-neutral-500">Custom rule</label>
          <HelpBubble article="formulas" />
        </div>
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

function MaskEditor({
  element,
  onPatch,
}: {
  element: FormField;
  onPatch: (id: string, patch: Partial<FormField>) => void;
}) {
  const mask = element.mask ?? "";
  const presetMatch = MASK_PRESETS.find((preset) => preset.mask === mask);
  const selectValue = presetMatch ? presetMatch.mask : mask ? "custom" : "";

  function handleSelect(value: string) {
    if (value === "") {
      onPatch(element.id, { mask: undefined });
    } else if (value === "custom") {
      onPatch(element.id, { mask: presetMatch ? "" : mask });
    } else {
      onPatch(element.id, { mask: value });
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className={labelClasses}>Input mask</span>
        <HelpBubble article="mask" />
      </div>
      <select
        value={selectValue}
        onChange={(event) => handleSelect(event.target.value)}
        className={inputClasses}
      >
        <option value="">None</option>
        {MASK_PRESETS.map((preset) => (
          <option key={preset.mask} value={preset.mask}>
            {preset.label}
          </option>
        ))}
        <option value="custom">Custom...</option>
      </select>
      {selectValue === "custom" && (
        <input
          value={mask}
          onChange={(event) =>
            onPatch(element.id, { mask: event.target.value })
          }
          placeholder="(###) ###-####"
          className={`${inputClasses} font-mono`}
        />
      )}
      <span className="text-xs text-neutral-400">
        Format as users type.{" "}
        <code className="font-mono">#</code> digit,{" "}
        <code className="font-mono">A</code> letter,{" "}
        <code className="font-mono">*</code> any; other characters are
        auto-inserted.
      </span>
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
  const condition = element.requiredWhen;
  const enabled = Boolean(condition);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-100 bg-muted p-3">
      <div className="flex items-center gap-1.5">
        <span className={labelClasses}>Conditional required</span>
        <HelpBubble article="validation" />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) =>
            onPatch(
              element.id,
              event.target.checked
                ? { requiredWhen: defaultCondition(ruleTargets[0]?.key) }
                : { requiredWhen: undefined },
            )
          }
          disabled={ruleTargets.length === 0}
          className="size-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500 disabled:cursor-not-allowed"
        />
        Required only when...
      </label>

      {enabled && (
        <ConditionEditor
          condition={condition}
          targets={ruleTargets}
          onChange={(requiredWhen) => onPatch(element.id, { requiredWhen })}
        />
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
  const condition = element.visibleWhen;
  const enabled = Boolean(condition);

  function setEnabled(next: boolean) {
    if (next) {
      onPatch(element.id, {
        visibleWhen: defaultCondition(ruleTargets[0]?.key),
      });
    } else {
      onPatch(element.id, { visibleWhen: undefined });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
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
        <HelpBubble article="visibility" align="right" />
      </div>

      {enabled && (
        <ConditionEditor
          condition={condition}
          targets={ruleTargets}
          onChange={(visibleWhen) => onPatch(element.id, { visibleWhen })}
        />
      )}

      {ruleTargets.length === 0 && (
        <p className="text-xs text-neutral-400">
          Add input fields before this one to use conditional visibility.
        </p>
      )}
    </div>
  );
}
