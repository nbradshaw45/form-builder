import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../shared/components/Button";
import { FieldControl } from "./FieldControl";
import { isSystemField } from "./builder/elementFactory";
import { gridColumnClasses, gridRowClasses, columnStyle } from "../shared/grid";
import {
  checkFieldValueUnique,
  checkUserExists,
  getFormUsers,
  useQuery,
} from "wasp/client/operations";
import {
  applyLogic,
  evaluateCondition,
  RECORD_MODE_KEY,
  RECORD_MODE_NEW,
  RECORD_MODE_UPDATE,
} from "../shared/logic";
import {
  isEmptyValue,
  validateFieldSync,
} from "../shared/fieldValidation";
import type {
  FormField,
  FormSettings,
  SubmissionData,
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
  /** Field keys that stay read-only even when the form is editable. */
  readonlyFieldKeys?: string[];
  showReset?: boolean;
  formId?: string;
  /** When editing, exclude this submission from unique-value checks. */
  excludeSubmissionId?: string;
  multiStep?: boolean;
  honeypot?: boolean;
  settings?: FormSettings;
  /** Whether the form is being filled for a brand-new record or an existing one. */
  recordMode?: "new" | "update";
}

const EDITTABLE_TYPES = new Set([
  "text",
  "number",
  "select",
  "textarea",
  "checkbox",
  "yes_no",
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
  "confirm",
  "captcha",
]);

const LAYOUT_TYPES = new Set(["section_header", "divider", "paragraph"]);

function isSubmittableField(field: FormField): boolean {
  if (field.type === "hidden") {
    return true;
  }
  if (EDITTABLE_TYPES.has(field.type)) {
    return true;
  }
  return isSystemField(field.type) && field.readonly === false;
}

function applyOptionRules(
  field: FormField,
  values: SubmissionData,
  hiddenOptions?: Set<string>,
): FormField {
  const rules = field.optionRules;
  const options = field.options ?? [];
  const labels = field.optionLabels;
  const kept: string[] = [];
  const keptLabels: string[] = [];
  options.forEach((option, index) => {
    const rule = rules?.[index];
    if (rule && !evaluateCondition(rule, values)) {
      return;
    }
    if (hiddenOptions?.has(option)) {
      return;
    }
    kept.push(option);
    if (labels) {
      keptLabels.push(labels[index] ?? option);
    }
  });
  if (kept.length === options.length && keptLabels.length === 0) {
    return field;
  }
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
  visibleOverride?: Record<string, boolean>,
): boolean {
  const header = step[0];
  if (!header || header.type !== "section_header") {
    return true;
  }
  return (
    evaluateCondition(header.visibleWhen, values) &&
    (visibleOverride?.[header.key] ?? true)
  );
}

export function DynamicFormRenderer({
  fields,
  onSubmit,
  submitLabel = "Submit",
  hideSubmit = false,
  submitterName,
  initialValues,
  readOnly = false,
  readonlyFieldKeys,
  showReset = false,
  formId,
  excludeSubmissionId,
  multiStep = false,
  honeypot = false,
  settings,
  recordMode = "new",
}: DynamicFormRendererProps) {
  const [values, setValues] = useState<SubmissionData>(
    () => initialValues ?? {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [honeypotValue, setHoneypotValue] = useState("");
  const formLoadedAtRef = useRef(Date.now());

  const readonlyKeySet = useMemo(
    () => new Set(readonlyFieldKeys ?? []),
    [readonlyFieldKeys],
  );

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

  const isUpdate = recordMode === "update";
  const logicValues = useMemo(
    () => ({
      ...values,
      [RECORD_MODE_KEY]: isUpdate ? RECORD_MODE_UPDATE : RECORD_MODE_NEW,
    }),
    [values, isUpdate],
  );
  const logic = useMemo(
    () => applyLogic(settings?.conditions ?? [], logicValues, effectiveFields),
    [settings?.conditions, logicValues, effectiveFields],
  );
  const effectiveValues = logic.values;

  const valuesRef = useRef(effectiveValues);
  valuesRef.current = effectiveValues;
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;
  const effectiveFieldsRef = useRef(effectiveFields);
  effectiveFieldsRef.current = effectiveFields;

  function runFormJs(code: string) {
    try {
      const api = {
        getValue: (key: string) => valuesRef.current[key] ?? "",
        setValue: (key: string, value: unknown) =>
          setValueRef.current(key, value as never),
        values: () => ({ ...valuesRef.current }),
        fields: effectiveFieldsRef.current,
      };
      const runner = new Function("form", `with (window) { ${code} }`);
      runner(api);
    } catch (err) {
      console.error("Conditional logic JS error:", err);
    }
  }

  useEffect(() => {
    if (settings?.jsOnLoad?.trim()) {
      runFormJs(settings.jsOnLoad);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jsKey = logic.js.join("\n/*--*/\n");
  useEffect(() => {
    if (jsKey) {
      runFormJs(jsKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsKey]);

  function isFieldVisible(field: FormField): boolean {
    return (
      !field.hidden &&
      evaluateCondition(field.visibleWhen, effectiveValues) &&
      (logic.visible[field.key] ?? true)
    );
  }

  const steps = useMemo(
    () => (multiStep ? buildSteps(effectiveFields) : [effectiveFields]),
    [multiStep, effectiveFields],
  );
  const visibleSteps = useMemo(
    () =>
      multiStep
        ? steps.filter((step) =>
            isStepVisible(step, effectiveValues, logic.visible),
          )
        : steps,
    [steps, effectiveValues, logic.visible, multiStep],
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

  function validateField(
    field: FormField,
    value: unknown,
    values: SubmissionData,
    fields: FormField[],
  ): string | null {
    return validateFieldSync(field, value, values, fields);
  }

  function validateFields(fieldsToCheck: FormField[]): Record<string, string> {
    const nextErrors: Record<string, string> = {};
    for (const field of fieldsToCheck) {
      if (!isSubmittableField(field) || !isFieldVisible(field)) {
        continue;
      }
      const fieldError = validateField(
        field,
        effectiveValues[field.key],
        effectiveValues,
        effectiveFields,
      );
      if (fieldError) {
        nextErrors[field.key] = fieldError;
      }
    }
    return nextErrors;
  }

  async function validateAsyncRules(
    fieldsToCheck: FormField[],
  ): Promise<Record<string, string>> {
    const nextErrors: Record<string, string> = {};
    if (!formId) {
      return nextErrors;
    }
    for (const field of fieldsToCheck) {
      if (!isSubmittableField(field) || !isFieldVisible(field)) {
        continue;
      }
      const value = effectiveValues[field.key];
      if (isEmptyValue(field, value)) {
        continue;
      }
      const validation = field.validation;
      if (!validation) {
        continue;
      }
      if (validation.unique) {
        try {
          const result = await checkFieldValueUnique({
            formId,
            fieldKey: field.key,
            value: String(value),
            excludeSubmissionId,
          });
          if (!result.unique) {
            nextErrors[field.key] =
              validation.uniqueMessage ||
              "This value has already been submitted";
          }
        } catch (err) {
          nextErrors[field.key] =
            err instanceof Error ? err.message : String(err);
        }
      }
      if (
        (validation.userExists || validation.emailExists) &&
        !nextErrors[field.key]
      ) {
        try {
          const result = await checkUserExists({ email: String(value) });
          if (!result.exists) {
            nextErrors[field.key] = validation.emailExists
              ? validation.emailExistsMessage ||
                "No account with that email exists"
              : validation.userExistsMessage ||
                "No user with that email exists";
          }
        } catch (err) {
          nextErrors[field.key] =
            err instanceof Error ? err.message : String(err);
        }
      }
    }
    return nextErrors;
  }

  const allVisibleFields = visibleSteps.flatMap((step) => step);

  async function submitForm() {
    const nextErrors = validateFields(allVisibleFields);
    const asyncErrors = await validateAsyncRules(allVisibleFields);
    const mergedErrors = { ...nextErrors, ...asyncErrors };
    setErrors(mergedErrors);
    if (Object.keys(mergedErrors).length > 0) {
      return;
    }

    const data: SubmissionData = {};
    for (const field of allVisibleFields) {
      if (!isSubmittableField(field) || !isFieldVisible(field)) {
        continue;
      }
      const rawValue = effectiveValues[field.key];
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
        case "yes_no":
          data[field.key] =
            rawValue === true || rawValue === false ? rawValue : null;
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
    if (settings?.minSubmitSeconds && settings.minSubmitSeconds > 0) {
      data["_formLoadedAt"] = String(formLoadedAtRef.current);
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
      void goNext();
    }
  }

  async function goNext() {
    const nextErrors = validateFields(activeStep);
    const asyncErrors = await validateAsyncRules(activeStep);
    const mergedErrors = { ...nextErrors, ...asyncErrors };
    setErrors(mergedErrors);
    if (Object.keys(mergedErrors).length > 0) {
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

  const anyVisible = effectiveFields.some((field) => isFieldVisible(field));
  if (!anyVisible || visibleSteps.length === 0) {
    return <p className="text-neutral-500">This form has no visible fields.</p>;
  }

  const visibleFields = activeStep.filter((field) => isFieldVisible(field));

  const renderField = (field: FormField) => (
    <div
      key={field.id}
      className={gridColumnClasses()}
      style={columnStyle(field.width)}
    >
      <FieldControl
        field={applyOptionRules(
          field,
          effectiveValues,
          logic.hiddenOptions[field.key],
        )}
        value={effectiveValues[field.key] ?? null}
        onChange={(value) => setValue(field.key, value)}
        allValues={effectiveValues}
        error={errors[field.key]}
        disabled={readOnly || readonlyKeySet.has(field.key)}
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
          field.type !== "hidden" && isFieldVisible(field),
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
          {visibleFields
            .filter((field) => field.type !== "hidden")
            .map((field) => renderField(field))}
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
        {visibleFields
          .filter((field) => field.type !== "hidden")
          .map((field) => renderField(field))}
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
