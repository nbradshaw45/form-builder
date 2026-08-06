import { type FormEvent, useMemo, useState } from "react";
import { Button } from "../shared/components/Button";
import { FieldControl } from "./FieldControl";
import { isSystemField } from "./builder/elementFactory";
import { gridColumnClasses, gridRowClasses, columnStyle } from "../shared/grid";
import { getFormUsers, useQuery } from "wasp/client/operations";
import { evaluateFormula } from "./builder/formula";
import type {
  FormField,
  SubmissionData,
  VisibilityRule,
} from "../types";

interface DynamicFormRendererProps {
  fields: FormField[];
  onSubmit: (
    data: SubmissionData,
    submitterEmail?: string,
  ) => Promise<void> | void;
  submitLabel?: string;
  hideSubmit?: boolean;
  submitterName?: string;
  initialValues?: SubmissionData;
  readOnly?: boolean;
  showReset?: boolean;
  formId?: string;
  multiStep?: boolean;
  honeypot?: boolean;
}

const EDITTABLE_TYPES = new Set([
  "text",
  "number",
  "select",
  "textarea",
  "checkbox",
  "date",
  "time",
  "email",
  "url",
  "phone",
  "radio",
  "multi_select",
  "rating",
  "slider",
  "currency",
  "signature",
  "file_upload",
  "user",
]);

const LAYOUT_TYPES = new Set(["section_header", "divider", "paragraph"]);

export function isFieldVisible(
  rule: VisibilityRule | undefined,
  values: SubmissionData,
): boolean {
  if (!rule) {
    return true;
  }
  const target = values[rule.field];
  switch (rule.operator) {
    case "equals":
      return String(target ?? "") === rule.value;
    case "not_equals":
      return String(target ?? "") !== rule.value;
    case "is_set":
      return target !== undefined && target !== null && target !== "";
    case "is_not_set":
      return target === undefined || target === null || target === "";
  }
}

function isSubmittableField(field: FormField): boolean {
  if (EDITTABLE_TYPES.has(field.type)) {
    return true;
  }
  return isSystemField(field.type) && field.readonly === false;
}

function applyOptionRules(
  field: FormField,
  values: SubmissionData,
): FormField {
  const rules = field.optionRules;
  if (!rules || rules.length === 0) {
    return field;
  }
  const options = field.options ?? [];
  const labels = field.optionLabels;
  const kept: string[] = [];
  const keptLabels: string[] = [];
  options.forEach((option, index) => {
    const rule = rules[index];
    if (rule && !isFieldVisible(rule, values)) {
      return;
    }
    kept.push(option);
    if (labels) {
      keptLabels.push(labels[index] ?? option);
    }
  });
  return {
    ...field,
    options: kept,
    optionLabels: keptLabels.length > 0 ? keptLabels : undefined,
  };
}

function buildSteps(fields: FormField[]): FormField[][] {
  const steps: FormField[][] = [];
  let current: FormField[] = [];
  for (const field of fields) {
    if (field.type === "section_header") {
      if (current.length > 0) {
        steps.push(current);
      }
      current = [field];
    } else {
      current.push(field);
    }
  }
  if (current.length > 0) {
    steps.push(current);
  }
  return steps;
}

function isStepVisible(
  step: FormField[],
  values: SubmissionData,
): boolean {
  const header = step[0];
  if (!header || header.type !== "section_header") {
    return true;
  }
  return isFieldVisible(header.visibleWhen, values);
}

export function DynamicFormRenderer({
  fields,
  onSubmit,
  submitLabel = "Submit",
  hideSubmit = false,
  submitterName,
  initialValues,
  readOnly = false,
  showReset = false,
  formId,
  multiStep = false,
  honeypot = false,
}: DynamicFormRendererProps) {
  const [values, setValues] = useState<SubmissionData>(
    () => initialValues ?? {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [honeypotValue, setHoneypotValue] = useState("");

  const { data: userOptions } = useQuery(getFormUsers);

  const effectiveFields = useMemo<FormField[]>(() => {
    if (!userOptions || userOptions.length === 0) {
      return fields;
    }
    return fields.map((field) => {
      if (field.type !== "user") {
        return field;
      }
      return {
        ...field,
        options: userOptions.map((user) => user.email),
        optionLabels: userOptions.map((user) => user.name ?? user.email),
      };
    });
  }, [fields, userOptions]);

  const steps = useMemo(
    () => (multiStep ? buildSteps(effectiveFields) : [effectiveFields]),
    [multiStep, effectiveFields],
  );
  const visibleSteps = useMemo(
    () =>
      multiStep
        ? steps.filter((step) => isStepVisible(step, values))
        : steps,
    [steps, values, multiStep],
  );
  const activeStepIndex = Math.min(
    currentStep,
    Math.max(0, visibleSteps.length - 1),
  );
  const activeStep = visibleSteps[activeStepIndex] ?? [];
  const isLastStep = activeStepIndex >= visibleSteps.length - 1;

  function setValue(
    fieldKey: string,
    value: string | number | boolean | string[] | null,
  ) {
    setValues((prev) => ({ ...prev, [fieldKey]: value }));
    setErrors((prev) => ({ ...prev, [fieldKey]: "" }));
  }

  function isEmptyValue(field: FormField, value: unknown): boolean {
    if (value === undefined || value === null) {
      return true;
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    if (typeof value === "string") {
      return value.trim() === "";
    }
    if (field.type === "rating" && typeof value === "number") {
      return value < 1;
    }
    return false;
  }

  function validateFieldFormat(
    field: FormField,
    value: unknown,
  ): string | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const str = String(value);
    switch (field.type) {
      case "email":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)
          ? null
          : "Enter a valid email address";
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

  function validateField(
    field: FormField,
    value: unknown,
    values: SubmissionData,
    fields: FormField[],
  ): string | null {
    const required =
      field.required ||
      (field.requiredWhen ? isFieldVisible(field.requiredWhen, values) : false);
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

    const validation = field.validation;
    if (!validation) {
      return null;
    }
    if (typeof value === "string") {
      if (
        validation.minLength !== undefined &&
        value.length < validation.minLength
      ) {
        return `Must be at least ${validation.minLength} characters`;
      }
      if (
        validation.maxLength !== undefined &&
        value.length > validation.maxLength
      ) {
        return `Must be at most ${validation.maxLength} characters`;
      }
      if (validation.pattern) {
        try {
          const pattern = new RegExp(validation.pattern);
          if (!pattern.test(value)) {
            return (
              validation.patternMessage ||
              "Value does not match the required pattern"
            );
          }
        } catch {
          // Ignore invalid regex so it doesn't block submissions.
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
    }
    if (validation.mustMatch) {
      const otherValue = values[validation.mustMatch];
      const otherLabel =
        fields.find((field) => field.key === validation.mustMatch)?.label ??
        validation.mustMatch;
      if (String(value) !== String(otherValue ?? "")) {
        return `Does not match ${otherLabel}`;
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

  function validateFields(fieldsToCheck: FormField[]): Record<string, string> {
    const nextErrors: Record<string, string> = {};
    for (const field of fieldsToCheck) {
      if (
        !isSubmittableField(field) ||
        !isFieldVisible(field.visibleWhen, values) ||
        field.hidden
      ) {
        continue;
      }
      const fieldError = validateField(
        field,
        values[field.key],
        values,
        effectiveFields,
      );
      if (fieldError) {
        nextErrors[field.key] = fieldError;
      }
    }
    return nextErrors;
  }

  const allVisibleFields = visibleSteps.flatMap((step) => step);

  async function submitForm() {
    const nextErrors = validateFields(allVisibleFields);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const data: SubmissionData = {};
    for (const field of allVisibleFields) {
      if (
        !isSubmittableField(field) ||
        !isFieldVisible(field.visibleWhen, values) ||
        field.hidden
      ) {
        continue;
      }
      const rawValue = values[field.key];
      switch (field.type) {
        case "number":
        case "currency":
          data[field.key] =
            rawValue === undefined || rawValue === "" || rawValue === null
              ? null
              : Number(rawValue);
          break;
        case "rating":
        case "slider":
          data[field.key] =
            rawValue === undefined || rawValue === null
              ? null
              : Number(rawValue);
          break;
        case "checkbox":
          data[field.key] = Boolean(rawValue);
          break;
        case "multi_select":
          data[field.key] = Array.isArray(rawValue) ? rawValue : [];
          break;
        default:
          data[field.key] = (rawValue as string | undefined) ?? "";
      }
    }
    if (honeypot) {
      data["_honeypot"] = honeypotValue;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(data, submitterName);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    void submitForm();
  }

  function handleWizardSubmit(event: FormEvent) {
    event.preventDefault();
    if (isLastStep) {
      void submitForm();
    } else {
      goNext();
    }
  }

  function goNext() {
    const nextErrors = validateFields(activeStep);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, visibleSteps.length - 1));
  }

  function goBackStep() {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    setErrors({});
  }

  function handleReset() {
    setValues(initialValues ?? {});
    setErrors({});
  }

  const anyVisible = effectiveFields.some(
    (field) => !field.hidden && isFieldVisible(field.visibleWhen, values),
  );
  if (!anyVisible || visibleSteps.length === 0) {
    return <p className="text-neutral-500">This form has no visible fields.</p>;
  }

  const visibleFields = activeStep.filter(
    (field) => !field.hidden && isFieldVisible(field.visibleWhen, values),
  );

  const renderField = (field: FormField) => (
    <div
      key={field.id}
      className={gridColumnClasses()}
      style={columnStyle(field.width)}
    >
      <FieldControl
        field={applyOptionRules(field, values)}
        value={values[field.key] ?? null}
        onChange={(value) => setValue(field.key, value)}
        allValues={values}
        error={errors[field.key]}
        disabled={readOnly}
        formId={formId}
        allFields={effectiveFields}
      />
    </div>
  );

  if (multiStep) {
    if (readOnly) {
      // Viewing a record: show the full record across all steps at once.
      return (
        <form className="flex flex-col gap-6" noValidate>
          {visibleSteps.map((step, stepIndex) => {
            const header = step[0];
            const hasHeader = header?.type === "section_header";
            const title = hasHeader ? header.label : undefined;
            const subtext = hasHeader ? header.description : undefined;
            const visible = step.filter(
              (field) =>
                !field.hidden && isFieldVisible(field.visibleWhen, values),
            );

            return (
              <section key={stepIndex} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary-700">
                      Step {stepIndex + 1}
                    </span>
                    {title && (
                      <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-neutral-800">
                        {title}
                      </h2>
                    )}
                  </div>
                  {subtext && (
                    <p className="text-[13px] text-neutral-500">{subtext}</p>
                  )}
                </div>
                <div className={gridRowClasses}>
                  {visible.map((field) =>
                    field.type === "section_header" ? null : renderField(field),
                  )}
                </div>
              </section>
            );
          })}
        </form>
      );
    }

    const stepHeader = activeStep[0];
    const stepTitle =
      stepHeader?.type === "section_header" ? stepHeader.label : undefined;

      return (
        <form
          onSubmit={handleWizardSubmit}
          className="flex flex-col gap-5"
          noValidate
        >
          {honeypot && (
            <input
              type="text"
              name="website"
              aria-hidden="true"
              tabIndex={-1}
              autoComplete="off"
              value={honeypotValue}
              onChange={(event) => setHoneypotValue(event.target.value)}
              className="absolute -left-[9999px] h-px w-px"
            />
          )}
          <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-mono font-semibold text-neutral-500">
              Step {activeStepIndex + 1} of {visibleSteps.length}
            </span>
            {stepTitle && (
              <span className="truncate text-neutral-400">{stepTitle}</span>
            )}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-primary-600 transition-all duration-300"
              style={{
                width: `${
                  ((activeStepIndex + 1) / visibleSteps.length) * 100
                }%`,
              }}
            />
          </div>
        </div>

        <div className={gridRowClasses}>
          {visibleFields.map((field) => renderField(field))}
        </div>

        {(activeStepIndex > 0 || (!hideSubmit && !readOnly)) && (
          <div className="mt-1 flex flex-col gap-2">
            {submitError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {submitError}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <div>
                {activeStepIndex > 0 && (
                  <Button type="button" variant="ghost" onClick={goBackStep}>
                    ← Back
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!hideSubmit && !readOnly && isLastStep && showReset && (
                  <Button type="button" variant="ghost" onClick={handleReset}>
                    Reset
                  </Button>
                )}
                {!hideSubmit && !readOnly && (
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() =>
                      isLastStep ? void submitForm() : goNext()
                    }
                  >
                    {isSubmitting ? "Saving..." : isLastStep ? submitLabel : "Next →"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col gap-4" noValidate>
      {honeypot && (
        <input
          type="text"
          name="website"
          aria-hidden="true"
          tabIndex={-1}
          autoComplete="off"
          value={honeypotValue}
          onChange={(event) => setHoneypotValue(event.target.value)}
          className="absolute -left-[9999px] h-px w-px"
        />
      )}
      <div className={gridRowClasses}>
        {visibleFields.map((field) => renderField(field))}
      </div>

      {submitError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {submitError}
        </p>
      )}

      {!hideSubmit && !readOnly && (
        <div className="mt-2 flex items-center justify-end gap-2">
          {showReset && (
            <Button type="button" variant="ghost" onClick={handleReset}>
              Reset
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

export function isLayoutField(type: FormField["type"]): boolean {
  return LAYOUT_TYPES.has(type);
}
