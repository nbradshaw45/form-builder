export type FieldType =
  | "text"
  | "number"
  | "select"
  | "textarea"
  | "checkbox"
  | "date"
  | "time"
  | "email"
  | "url"
  | "phone"
  | "radio"
  | "multi_select"
  | "rating"
  | "slider"
  | "currency"
  | "signature"
  | "file_upload"
  | "confirm"
  | "hidden"
  | "math"
  | "user"
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
  value?: string;
};

export type FieldValidation = {
  /** Text length minimum (text, textarea, email, url, phone). */
  minLength?: number;
  /** Text length maximum (text, textarea, email, url, phone). */
  maxLength?: number;
  /** Numeric minimum (number, slider, currency, rating). */
  min?: number;
  /** Numeric maximum (number, slider, currency, rating). */
  max?: number;
  /** Regex pattern the value must match. */
  pattern?: string;
  /** Custom message shown when the pattern fails. */
  patternMessage?: string;
  /** Key of another field the value must equal. */
  mustMatch?: string;
  /** Custom expression (with [key] references) that must evaluate truthy. */
  rule?: string;
  /** Custom message shown when the expression fails. */
  ruleMessage?: string;
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
  /** Display labels parallel to options (used for live user options). */
  optionLabels?: string[];
  /** Column span on the 12-column grid (1-12, default 12). */
  width?: number;
  /** Radio / multi-select layout. Defaults to "stacked". */
  layout?: "inline" | "stacked";
  /** Numeric bounds and formatting (slider, currency, number). */
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Rating element: number of stars. */
  starCount?: 3 | 5 | 7 | 10;
  /** File upload: accepted MIME types / extensions. */
  accept?: string;
  /** File upload: max size in MB. */
  maxFileSizeMb?: number;
  /** File upload: allow more than one file. */
  multiple?: boolean;
  /** Signature: pen color (CSS color). */
  penColor?: string;
  /** Signature: pen width in px. */
  penWidth?: number;
  /** Advanced validation rules. */
  validation?: FieldValidation;
  /** Field is required only when this rule is satisfied. */
  requiredWhen?: VisibilityRule;
  /** Per-option visibility rules, parallel to `options`. */
  optionRules?: VisibilityRule[];
  /** Math field display rounding (number of decimals). */
  mathDecimals?: number;
  /** Prefill value for new submissions (also overridable via ?key=value URL). */
  defaultValue?: string;
  /** Input mask pattern (# digit, A/a letter, * alphanumeric, literals auto-inserted). */
  mask?: string;
  /** For confirm fields: key of the field this value must match. */
  confirmField?: string;
  /** Whether this field appears in the submissions filter UI. Defaults to true. */
  filterable?: boolean;
};

export type SubmissionData = Record<
  string,
  string | number | boolean | string[] | null
>;

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
  /** Show a Back button in the form. Defaults to true. */
  showBackButton?: boolean;
  /** Show a Reset button that clears/restores the form. Defaults to false. */
  showResetButton?: boolean;
  /** Split the form into steps at each Section header. Defaults to false. */
  multiStep?: boolean;
  /** Webhook URL called on submission create/update. */
  webhookUrl?: string;
  /** HMAC secret used to sign webhook payloads. */
  webhookSecret?: string;
  /** Show a receipt number on the success panel. Defaults to false. */
  enableReceipt?: boolean;
  /** Let submitters edit their own response via a tokenized link. Defaults to false. */
  allowSelfEdit?: boolean;
  /** Add an invisible honeypot field; bots that fill it are silently rejected. */
  honeypot?: boolean;
  /** Max submissions per rolling hour. Undefined = unlimited. */
  rateLimitPerHour?: number;
  /** ISO datetime before which submissions are rejected. */
  openDate?: string;
  /** ISO datetime after which submissions are rejected. */
  closeDate?: string;
  /** Where the submissions filters are shown: on top or under column headers. */
  filterPlacement?: "top" | "header";
  /** Number of columns for the "top" filter grid (1-6). Defaults to 3. */
  filterColumns?: number;
  /** Custom actions that run before/after a submission is stored. */
  actions?: FormAction[];
};

export type FormActionValueSource = "static" | "field" | "formula";

export type FormAction =
  | {
      id: string;
      trigger: "before_submit" | "after_submit";
      type: "set_field";
      field: string;
      valueSource: FormActionValueSource;
      staticValue?: string;
      sourceField?: string;
      formula?: string;
      /** Only run when this rule is satisfied. */
      when?: VisibilityRule;
    }
  | {
      id: string;
      trigger: "before_submit" | "after_submit";
      type: "http_call";
      method: "GET" | "POST";
      url: string;
      /** For before_submit: form field key written from the response's `value`. */
      responseField?: string;
      /** Only run when this rule is satisfied. */
      when?: VisibilityRule;
    }
  | {
      id: string;
      trigger: "after_submit";
      type: "update_submission";
      field: string;
      valueSource: FormActionValueSource;
      staticValue?: string;
      sourceField?: string;
      formula?: string;
      /** Only run when this rule is satisfied. */
      when?: VisibilityRule;
    }
  | {
      id: string;
      trigger: "after_submit";
      type: "create_submission";
      /** Target form id; matching field keys are copied across. */
      formId: string;
      /** Only run when this rule is satisfied. */
      when?: VisibilityRule;
    }
  | {
      id: string;
      trigger: "after_submit";
      type: "email";
      /** Comma-separated hard-coded recipients. */
      recipients?: string;
      /** Field key whose value is a recipient email. */
      recipientField?: string;
      /** Also email the person who submitted. */
      includeSubmitter?: boolean;
      /** Optional custom subject line. */
      subject?: string;
      /** Only run when this rule is satisfied. */
      when?: VisibilityRule;
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
  showBackButton: true,
  showResetButton: false,
  multiStep: false,
};
