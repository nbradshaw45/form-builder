import type { FieldType, FormField } from "../../types";

export type PaletteCategory = "input" | "layout" | "system";

export type FieldDefinition = {
  type: FieldType;
  name: string;
  description: string;
  category: PaletteCategory;
};

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  { type: "text", name: "Text", description: "Single line text input", category: "input" },
  { type: "number", name: "Number", description: "Numeric input", category: "input" },
  { type: "select", name: "Select", description: "Dropdown with options", category: "input" },
  { type: "textarea", name: "Textarea", description: "Multi line text", category: "input" },
  { type: "checkbox", name: "Checkbox", description: "Boolean toggle", category: "input" },
  { type: "date", name: "Date", description: "Date picker", category: "input" },
  { type: "math", name: "Math", description: "Calculated field", category: "input" },
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
  date: "Date",
  math: "Calculated field",
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
  };

  switch (type) {
    case "select":
      return { ...base, options: ["Option 1", "Option 2"] };
    case "math":
      return { ...base, formula: "[text_field] * 1" };
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
