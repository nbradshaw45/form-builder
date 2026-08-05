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
  /** Column span on the 12-column grid (1-12, default 12). */
  width?: number;
};

export type SubmissionData = Record<string, string | number | boolean | null>;

export type FormDisplayMode = "page" | "modal";

export type FormSuccessMode = "message" | "redirect" | "both";

export type FormSettings = {
  /** How the form is shown: full page or a popup/modal. Defaults to "page". */
  displayMode?: FormDisplayMode;
  /** Popup width in px. Defaults to 560. */
  modalWidth?: number;
  /** Popup height in px; null means auto. Defaults to null. */
  modalHeight?: number | null;
  /** What happens after a successful submit. Defaults to "message". */
  successMode?: FormSuccessMode;
  /** Custom success message; empty string uses the default. */
  successMessage?: string;
  /** Redirect destination. Defaults to "submissions". */
  redirectTarget?: "submissions" | "custom";
  /** Custom redirect URL, used when redirectTarget is "custom". */
  redirectUrl?: string;
  /** Append submission data to the redirect URL as query params. */
  appendData?: boolean;
};

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  displayMode: "page",
  modalWidth: 560,
  modalHeight: null,
  successMode: "message",
  successMessage: "",
  redirectTarget: "submissions",
  redirectUrl: "",
  appendData: false,
};
