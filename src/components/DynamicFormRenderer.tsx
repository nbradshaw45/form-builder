import { type FormEvent, useMemo, useState } from "react";
import { Button } from "../shared/components/Button";
import { FieldControl } from "./FieldControl";
import { isSystemField } from "./builder/elementFactory";
import { gridColumnClasses, gridRowClasses, columnStyle } from "../shared/grid";
import { getFormUsers, useQuery } from "wasp/client/operations";
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
}: DynamicFormRendererProps) {
  const [values, setValues] = useState<SubmissionData>(
    () => initialValues ?? {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    for (const field of effectiveFields) {
      if (
        !isSubmittableField(field) ||
        !isFieldVisible(field.visibleWhen, values) ||
        field.hidden
      ) {
        continue;
      }
      const value = values[field.key];
      if (field.required && isEmptyValue(field, value)) {
        nextErrors[field.key] = "This field is required";
        continue;
      }
      const formatError = validateFieldFormat(field, value);
      if (formatError) {
        nextErrors[field.key] = formatError;
      }
    }
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const data: SubmissionData = {};
    for (const field of effectiveFields) {
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

    setIsSubmitting(true);
    try {
      await onSubmit(data, submitterName);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setValues(initialValues ?? {});
    setErrors({});
  }

  const visibleFields = effectiveFields.filter(
    (field) => !field.hidden && isFieldVisible(field.visibleWhen, values),
  );

  if (visibleFields.length === 0) {
    return (
      <p className="text-neutral-500">This form has no visible fields.</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className={gridRowClasses}>
        {visibleFields.map((field) => (
          <div
            key={field.id}
            className={gridColumnClasses()}
            style={columnStyle(field.width)}
          >
            <FieldControl
              field={field}
              value={values[field.key] ?? null}
              onChange={(value) => setValue(field.key, value)}
              allValues={values}
              error={errors[field.key]}
              disabled={readOnly}
              formId={formId}
            />
          </div>
        ))}
      </div>

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
