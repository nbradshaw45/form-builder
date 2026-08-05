import type { FormField, SubmissionData } from "../types";
import { formatFormulaValue } from "./builder/formula";
import {
  errorTextClasses,
  fieldClasses,
  helpTextClasses,
  inputClasses,
  labelClasses,
  selectClasses,
  textareaClasses,
} from "../shared/styles";

interface FieldControlProps {
  field: FormField;
  value: string | boolean | number | null;
  onChange: (value: string | boolean) => void;
  allValues: SubmissionData;
  disabled?: boolean;
  error?: string | null;
}

export function FieldControl({
  field,
  value,
  onChange,
  allValues,
  disabled = false,
  error = null,
}: FieldControlProps) {
  const { type, label, required, helpText, placeholder } = field;

  if (type === "section_header") {
    return (
      <div className="flex flex-col gap-1 pt-2">
        <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-neutral-800">
          {label}
        </h2>
        {field.description && (
          <p className="text-[13px] text-neutral-500">{field.description}</p>
        )}
      </div>
    );
  }

  if (type === "divider") {
    return <hr className="border-neutral-100" />;
  }

  if (type === "paragraph") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm text-neutral-600">{label}</p>
        {field.description && (
          <p className="text-xs text-neutral-400">{field.description}</p>
        )}
      </div>
    );
  }

  if (type === "math") {
    const computed = field.formula
      ? formatFormulaValue(field.formula, allValues)
      : "";
    return (
      <div className={fieldClasses}>
        <div className="flex items-center gap-2">
          <label htmlFor={field.key} className={labelClasses}>
            {label}
          </label>
          <span className="rounded-full bg-primary-50 px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-primary-600">
            calculated
          </span>
        </div>
        <input
          id={field.key}
          value={computed}
          readOnly
          disabled={disabled}
          placeholder={field.formula || "Enter a formula"}
          className={`${inputClasses} font-mono`}
        />
        {helpText && (
          <span className={helpTextClasses}>{helpText}</span>
        )}
      </div>
    );
  }

  const isSystemDate = type === "created_date" || type === "modified_date";
  const isSystemUser = type === "updated_by_user";
  if ((isSystemDate || isSystemUser) && field.readonly !== false) {
    const systemValue =
      value === null || value === undefined || value === ""
        ? ""
        : String(value);
    return (
      <div className={fieldClasses}>
        <div className="flex items-center gap-2">
          <label htmlFor={field.key} className={labelClasses}>
            {label}
          </label>
          <span className="rounded-full bg-info-soft px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-info">
            system
          </span>
        </div>
        <input
          id={field.key}
          value={systemValue}
          readOnly
          disabled={disabled}
          placeholder={systemValue ? undefined : "Auto-filled on submit"}
          className={`${inputClasses} font-mono`}
        />
        {helpText && (
          <span className={helpTextClasses}>{helpText}</span>
        )}
      </div>
    );
  }

  if (type === "checkbox") {
    return (
      <div className={fieldClasses}>
        <label
          className={`group inline-flex cursor-pointer select-none items-center gap-2.5 text-[13px] font-medium text-neutral-800 ${
            disabled ? "cursor-not-allowed opacity-60" : ""
          }`}
        >
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            disabled={disabled}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="grid size-4 shrink-0 place-items-center rounded-[5px] border-[1.5px] border-neutral-400 bg-white transition-all duration-150 peer-checked:border-primary-600 peer-checked:bg-primary-600 group-hover:border-primary-600 peer-checked:after:rotate-45 after:block after:size-[4px] after:border-b-2 after:border-r-2 after:border-white after:opacity-0 after:transition-opacity peer-checked:after:opacity-100"
          />
          {label}
          {required && <span className="text-danger">*</span>}
        </label>
        {helpText && <span className={helpTextClasses}>{helpText}</span>}
        {error && <span className={errorTextClasses}>{error}</span>}
      </div>
    );
  }

  const renderControl = () => {
    if (type === "select" || type === "user") {
      return (
        <select
          id={field.key}
          value={(value as string) ?? ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={selectClasses}
        >
          <option value="">
            {type === "user" ? "Select a user..." : "Select..."}
          </option>
          {(field.options ?? []).map((option, index) => (
            <option key={option} value={option}>
              {field.optionLabels?.[index] ?? option}
            </option>
          ))}
        </select>
      );
    }

    if (type === "textarea") {
      return (
        <textarea
          id={field.key}
          value={(value as string) ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          disabled={disabled}
          className={textareaClasses}
        />
      );
    }

    const htmlType =
      type === "created_date" || type === "modified_date"
        ? "date"
        : type === "updated_by_user"
          ? "text"
          : type;

    return (
      <input
        id={field.key}
        type={htmlType}
        value={(value as string) ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClasses}
      />
    );
  };

  return (
    <div className={fieldClasses}>
      <label htmlFor={field.key} className={labelClasses}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {renderControl()}
      {helpText && <span className={helpTextClasses}>{helpText}</span>}
      {error && <span className={errorTextClasses}>{error}</span>}
    </div>
  );
}
