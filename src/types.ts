export type FieldType =
  | "text"
  | "number"
  | "select"
  | "textarea"
  | "checkbox"
  | "date"
  | "math"
  | "section_header"
  | "divider"
  | "paragraph"
  | "created_date"
  | "modified_date"
  | "updated_by_user";

export type VisibilityOperator =
  | "equals"
  | "not_equals"
  | "is_set"
  | "is_not_set";

export type VisibilityRule = {
  field: string;
  operator: VisibilityOperator;
  value: string;
};

export type FormField = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  formula?: string;
  description?: string;
  visibleWhen?: VisibilityRule;
  hidden?: boolean;
  readonly?: boolean;
  showInTable?: boolean;
  valueSource?: "email" | "name";
};

export type SubmissionData = Record<string, string | number | boolean | null>;
