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
  | "captcha"
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

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_set"
  | "is_not_set"
  | "gt"
  | "lt"
  | "gte"
  | "lte";

export type ConditionRule = {
  field: string;
  operator: ConditionOperator;
  value?: string;
};

export type ConditionGroup = {
  rules: ConditionRule[];
};

/**
 * Rules within a group are AND-ed together; groups are OR-ed together.
 * A condition with no groups (or only empty groups) is treated as always true.
 */
export type Condition = {
  groups: ConditionGroup[];
};

export type LogicValueSource = "static" | "field" | "formula";

export type LogicAction =
  | { type: "show_field"; field: string }
  | { type: "hide_field"; field: string }
  | {
      type: "set_value";
      field: string;
      valueSource: LogicValueSource;
      value: string;
      sourceField?: string;
      formula?: string;
    }
  | { type: "copy_value"; from: string; to: string }
  | { type: "select_option"; field: string; option: string }
  | { type: "deselect_option"; field: string; option: string }
  | { type: "show_option"; field: string; option: string }
  | { type: "hide_option"; field: string; option: string }
  | { type: "run_js"; code: string };

export type LogicCondition = {
  id: string;
  when: Condition;
  then: LogicAction[];
  else?: LogicAction[];
};

/** Grant for a single record capability (view / edit / delete). */
export type CapabilityGrant =
  | { allowed: false }
  | { allowed: true; when?: Condition };

/** Per-form role controlling submission view/edit/delete. */
export type FormRoleDef = {
  id: string;
  label: string;
  /** Built-in roles cannot be deleted (label/capabilities remain editable). */
  builtIn?: boolean;
  view: CapabilityGrant;
  edit: CapabilityGrant;
  delete: CapabilityGrant;
};

export type RecordCapability = "view" | "edit" | "delete";

export type RecordPermissions = {
  view: boolean;
  edit: boolean;
  delete: boolean;
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
  visibleWhen?: Condition;
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
  /** Field is required only when this condition is satisfied. */
  requiredWhen?: Condition;
  /** Per-option visibility conditions, parallel to `options`. */
  optionRules?: (Condition | undefined)[];
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
  /** Filter condition used on the submissions page (per field type). */
  filterOperator?: string;
  /** Filter input style on the submissions page: dropdown of existing values or free text. */
  filterInput?: "dropdown" | "text";
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
  /**
   * Reject submissions completed in under this many seconds (bot/speed check).
   * Undefined / 0 = disabled.
   */
  minSubmitSeconds?: number;
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
  /** Show text labels ("View", "Edit") on the submissions table row actions. Defaults to false (icons only). */
  showActionLabels?: boolean;
  /**
   * Placement for each submissions table row action. Defaults: View/Edit/
   * Delete inline, PDF hidden. (Edit/Delete also require edit access.)
   * Legacy boolean values are honored: true = default placement, false = hidden.
   */
  submissionRowActions?: {
    view?: SubmissionRowActionPlacement | boolean;
    edit?: SubmissionRowActionPlacement | boolean;
    pdf?: SubmissionRowActionPlacement | boolean;
    delete?: SubmissionRowActionPlacement | boolean;
  };
  /** Custom actions that run before/after a submission is stored. */
  actions?: FormAction[];
  /**
   * Conditional logic. Each condition is evaluated independently, in order:
   * when its rules are met its `then` actions run, otherwise its `else` actions.
   * Later conditions see values produced by earlier ones.
   */
  conditions?: LogicCondition[];
  /** Custom JavaScript executed once when the form page loads. */
  jsOnLoad?: string;
  /**
   * Per-form roles for submission view/edit/delete. Assigned via FormAccess.
   * Defaults to Viewer / Editor / Manager when omitted.
   */
  roles?: FormRoleDef[];
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
      /** Only run when this condition is satisfied. */
      when?: Condition;
    }
  | {
      id: string;
      trigger: "before_submit" | "after_submit";
      type: "http_call";
      method: "GET" | "POST";
      url: string;
      /** For before_submit: form field key written from the response's `value`. */
      responseField?: string;
      /** Only run when this condition is satisfied. */
      when?: Condition;
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
      /** Only run when this condition is satisfied. */
      when?: Condition;
    }
  | {
      id: string;
      trigger: "after_submit";
      type: "create_submission";
      /** Target form id; matching field keys are copied across. */
      formId: string;
      /** Only run when this condition is satisfied. */
      when?: Condition;
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
      /** Comma-separated CC recipients. Supports smart tags. */
      cc?: string;
      /** Comma-separated BCC recipients. Supports smart tags. */
      bcc?: string;
      /** Reply-To address. Supports smart tags. */
      replyTo?: string;
      /** Optional custom subject line. Supports smart tags. */
      subject?: string;
      /**
       * Optional custom HTML body. Supports smart tags and `{if}…{/if}`
       * conditional blocks; empty uses the default summary.
       */
      bodyTemplate?: string;
      /**
       * Attach a PDF of the submission to the email. Sent via a direct
       * nodemailer transporter (Wasp's emailSender has no attachment support).
       */
      attachPdf?: boolean;
      /** Only run when this condition is satisfied. */
      when?: Condition;
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

export type SubmissionRowAction = "view" | "edit" | "delete" | "pdf";

/** Where a submissions table row action is rendered. */
export type SubmissionRowActionPlacement = "inline" | "dropdown" | "hidden";

export const DEFAULT_ROW_ACTION_PLACEMENTS: Record<
  SubmissionRowAction,
  SubmissionRowActionPlacement
> = {
  view: "inline",
  edit: "inline",
  delete: "inline",
  pdf: "hidden",
};

/**
 * Resolves a stored row-action setting to a placement, tolerating legacy
 * booleans (true = default visible placement, false = hidden).
 */
export function rowActionPlacement(
  value: SubmissionRowActionPlacement | boolean | undefined,
  action: SubmissionRowAction,
): SubmissionRowActionPlacement {
  if (value === true) {
    return action === "pdf" ? "dropdown" : "inline";
  }
  if (value === false) {
    return "hidden";
  }
  return value ?? DEFAULT_ROW_ACTION_PLACEMENTS[action];
}
