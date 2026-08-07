import type { FieldType, FormField } from "../../types";

export type PaletteCategory = "input" | "advanced" | "layout" | "system";

export type FieldDefinition = {
  type: FieldType;
  name: string;
  description: string;
  category: PaletteCategory;
};

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  { type: "text", name: "Text", description: "Single line text input", category: "input" },
  { type: "textarea", name: "Textarea", description: "Multi line text", category: "input" },
  { type: "number", name: "Number", description: "Numeric input", category: "input" },
  { type: "select", name: "Select", description: "Dropdown with options", category: "input" },
  { type: "radio", name: "Radio group", description: "Single choice buttons", category: "input" },
  { type: "multi_select", name: "Multi-select", description: "Pick several options", category: "input" },
  { type: "checkbox", name: "Checkbox", description: "Boolean toggle", category: "input" },
  { type: "yes_no", name: "Yes / No", description: "Explicit Yes or No choice", category: "input" },
  { type: "email", name: "Email", description: "Email with validation", category: "input" },
  { type: "url", name: "URL", description: "Web link with validation", category: "input" },
  { type: "phone", name: "Phone", description: "Phone number input", category: "input" },
  { type: "date", name: "Date", description: "Date picker", category: "input" },
  { type: "time", name: "Time", description: "Time picker", category: "input" },
  { type: "user", name: "User", description: "Dropdown of users", category: "input" },
  { type: "confirm", name: "Confirmation", description: "Re-type another field", category: "input" },
  { type: "hidden", name: "Hidden field", description: "Stores a value not shown", category: "input" },
  { type: "math", name: "Math", description: "Calculated value — formula or custom script", category: "input" },
  { type: "rating", name: "Rating", description: "Star rating scale", category: "advanced" },
  { type: "slider", name: "Slider", description: "Numeric range", category: "advanced" },
  { type: "currency", name: "Currency", description: "Money amount", category: "advanced" },
  { type: "signature", name: "Signature", description: "Draw a signature", category: "advanced" },
  { type: "file_upload", name: "File upload", description: "Attach a file", category: "advanced" },
  { type: "captcha", name: "Captcha", description: "Cloudflare Turnstile spam check", category: "advanced" },
  { type: "sequence", name: "Sequence", description: "Auto-increment number per form", category: "advanced" },
  { type: "section_header", name: "Section Header", description: "Title and subtext", category: "layout" },
  { type: "divider", name: "Divider", description: "Horizontal rule", category: "layout" },
  { type: "paragraph", name: "Paragraph", description: "Rich help text", category: "layout" },
  { type: "created_date", name: "Created date", description: "When the response was created", category: "system" },
  { type: "modified_date", name: "Modified date", description: "When the response was last updated", category: "system" },
  { type: "updated_by_user", name: "Updated by user", description: "Who last updated the response", category: "system" },
];

export const SYSTEM_FIELD_TYPES: FieldType[] = [
  "created_date",
  "modified_date",
  "updated_by_user",
];

const DEFAULT_LABELS: Record<FieldType, string> = {
  text: "Text field",
  number: "Number",
  select: "Select",
  textarea: "Textarea",
  checkbox: "Checkbox",
  yes_no: "Yes / No",
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
  math: "Calculated field",
  sequence: "Sequence",
  section_header: "Section header",
  divider: "Divider",
  paragraph: "Paragraph",
  created_date: "Created date",
  modified_date: "Modified date",
  updated_by_user: "Updated by user",
};

export function isSystemField(type: FieldType): boolean {
  return SYSTEM_FIELD_TYPES.includes(type);
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function uniqueKey(baseKey: string, existingKeys: string[]): string {
  const used = new Set(existingKeys);
  if (!baseKey) {
    baseKey = "field";
  }
  if (!used.has(baseKey)) {
    return baseKey;
  }
  let candidate = baseKey;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${baseKey}_${counter}`;
    counter++;
  }
  return candidate;
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createElement(
  type: FieldType,
  existingKeys: string[],
): FormField {
  const id = generateId();
  const label = DEFAULT_LABELS[type];
  const key = uniqueKey(slugify(label), existingKeys);

  const base: FormField = {
    id,
    key,
    label,
    type,
    width: 12,
  };

  switch (type) {
    case "select":
      return { ...base, options: ["Option 1", "Option 2"] };
    case "radio":
      return { ...base, options: ["Option 1", "Option 2"], layout: "stacked" };
    case "multi_select":
      return { ...base, options: ["Option 1", "Option 2"], layout: "stacked" };
    case "slider":
      return { ...base, min: 0, max: 100, step: 1 };
    case "currency":
      return { ...base, prefix: "$", decimals: 2 };
    case "rating":
      return { ...base, starCount: 5 };
    case "signature":
      return { ...base, penColor: "#1e293b", penWidth: 2 };
    case "file_upload":
      return { ...base, maxFileSizeMb: 5, accept: "" };
    case "captcha":
      return {
        ...base,
        required: true,
        showInTable: false,
        filterable: false,
        label: "Verification",
      };
    case "sequence":
      return {
        ...base,
        readonly: true,
        showInTable: true,
        sequenceStart: 1,
        sequenceDigits: 0,
        sequencePrefix: "",
        sequenceSuffix: "",
      };
    case "yes_no":
      return { ...base, yesLabel: "Yes", noLabel: "No" };
    case "confirm":
      return { ...base, confirmField: "" };
    case "hidden":
      return { ...base, defaultValue: "" };
    case "math":
      return { ...base, formula: "[text_field] * 1", calcMode: "formula" };
    case "section_header":
      return { ...base, description: "Subtext for this section" };
    case "paragraph":
      return { ...base, description: "" };
    case "created_date":
    case "modified_date":
      return { ...base, readonly: true, showInTable: true, hidden: false };
    case "updated_by_user":
      return {
        ...base,
        readonly: true,
        showInTable: true,
        hidden: false,
        valueSource: "email",
      };
    default:
      return base;
  }
}

export function createDefaultSystemFields(existingKeys: string[]): FormField[] {
  return SYSTEM_FIELD_TYPES.map((type) => createElement(type, existingKeys));
}
