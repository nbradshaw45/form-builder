import { type FormEvent, useState } from "react";
import { Button } from "../shared/components/Button";
import { FieldControl } from "./FieldControl";
import { isSystemField } from "./builder/elementFactory";
import { gridColumnClasses, gridRowClasses, columnStyle } from "../shared/grid";
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
}

const EDITTABLE_TYPES = new Set([
  "text",
  "number",
  "select",
  "textarea",
  "checkbox",
  "date",
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
}: DynamicFormRendererProps) {
  const [values, setValues] = useState<SubmissionData>(
    () => initialValues ?? {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function setValue(fieldKey: string, value: string | boolean) {
    setValues((prev) => ({ ...prev, [fieldKey]: value }));
    setErrors((prev) => ({ ...prev, [fieldKey]: "" }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    for (const field of fields) {
      if (
        !isSubmittableField(field) ||
        !isFieldVisible(field.visibleWhen, values) ||
        field.hidden
      ) {
        continue;
      }
      if (!field.required) {
        continue;
      }
      const value = values[field.key];
      const isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (field.type === "checkbox" && value === false);
      if (isEmpty) {
        nextErrors[field.key] = "This field is required";
      }
    }
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const data: SubmissionData = {};
    for (const field of fields) {
      if (
        !isSubmittableField(field) ||
        !isFieldVisible(field.visibleWhen, values) ||
        field.hidden
      ) {
        continue;
      }
      const rawValue = values[field.key];
      if (field.type === "number") {
        data[field.key] =
          rawValue === undefined || rawValue === "" || rawValue === null
            ? null
            : Number(rawValue);
      } else if (field.type === "checkbox") {
        data[field.key] = Boolean(rawValue);
      } else {
        data[field.key] = (rawValue as string) ?? "";
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit(data, submitterName);
    } finally {
      setIsSubmitting(false);
    }
  }

  const visibleFields = fields.filter(
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
            />
          </div>
        ))}
      </div>

      {!hideSubmit && !readOnly && (
        <div className="mt-2 flex justify-end">
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
