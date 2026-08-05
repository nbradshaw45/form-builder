# Form Builder — Improvement Proposals

This document proposes five improvements to the form builder, focused on
extendability (more element types and logic), usability, and visual polish.
Each proposal includes the problem it solves, the scope of work, and how it
fits the current architecture.

---

## 1. Expand the element library

**Goal:** Add new field types so forms can capture anything, not just text/number/select/date.

Today the builder supports a fixed set of field types (`text`, `number`, `select`,
`textarea`, `checkbox`, `date`, `math`, `user`, plus layout and system fields).
Adding more element types makes the product cover significantly more use cases
(applications, orders, surveys, onboarding).

This section is the detailed design for the expansion: the full element
catalog, data-model changes, builder/renderer/table changes, a file-upload
deep dive, and a phased rollout plan.

### 1.1 Element catalog

Each new element is specified as: **stored value**, **input rendering**,
**field settings**, and **validation**. Types are grouped by how much plumbing
they need.

#### Tier A — New UI for existing data shapes (no model changes, small effort)

| Element | Stored value | Rendering | Field settings | Validation |
|---|---|---|---|---|
| **Radio group** | `string` (chosen option) | Styled radio pill buttons (stacked or inline) sharing `options` with `select` | `options` (reuse OptionsEditor), layout: inline/stacked | required |
| **Multi-select** | `string[]` (array of chosen options) | Checkbox list sharing `options`; stores an array | `options`, layout | required = at least one selected |
| **Email** | `string` | `<input type="email">` | placeholder, help text | required, built-in email format |
| **URL** | `string` | `<input type="url">` | placeholder, help text | required, built-in URL format |
| **Phone** | `string` | `<input type="tel" inputMode="tel">` with light auto-formatting (strip non-digits on blur is optional) | placeholder | required, lenient pattern (10–15 digits incl. `+`, spaces, dashes) |
| **Time** | `string` (`"HH:MM"`) | `<input type="time">`, pairs with `date` | placeholder | required |
| **Currency / money** | `number` | `<input inputMode="decimal">` with a prefix/suffix (e.g., `$`, `€`) | currency symbol, decimals (0–2) | required, min/max (from Tier B validation) |

> Tier A types store values that already exist in `SubmissionData`
> (`string`, `number`, plus arrays for multi-select). They need no server or
> schema changes — only `FieldControl` render branches and inspector settings.

#### Tier B — Numeric widgets (formula-ready, small effort)

| Element | Stored value | Rendering | Field settings | Validation |
|---|---|---|---|---|
| **Rating** | `number` (1–5) | Star icons (hover to preview, click to set), half-stars optional | star count (3/5/7/10), clearable | required |
| **Slider** | `number` | `<input type="range">` with live value bubble | min, max, step, unit suffix | required (implicit), min/max = range bounds |
| **Number variants** | `number` | Spinner + optional thousand separators on blur | decimals, prefix/suffix | required, min/max |

> Rating and slider are numeric, so they become valid operands for `math`
> formulas immediately. They reuse the existing number storage path end to end.

#### Tier C — Attachments (file storage, large effort)

| Element | Stored value | Rendering | Field settings | Validation |
|---|---|---|---|---|
| **File upload** | `string` (file reference/URL) | Drag-and-drop zone + file picker; shows chosen file name + size with a remove button | accept types, max size (MB), single vs multiple | required, size/type enforcement |
| **Signature** | `string` (data URL or stored image URL) | Canvas draw pad with Clear / Undo; renders as an `<img>` in view mode | required, pen color/width | required (empty canvas = invalid) |

> Both need server-side storage (see §1.6). Signature can ship first as a
> client-side data URL (small, PNG) and graduate to stored files later; file
> upload must have storage from day one.

#### Tier D — Rich content (optional, medium effort)

| Element | Stored value | Rendering | Field settings | Validation |
|---|---|---|---|---|
| **Rich text** | `string` (HTML or Markdown) | Textarea + formatting toolbar (bold, italic, lists, links) or a lightweight WYSIWYG | placeholder, format (markdown/html) | required |
| **Autocomplete (data source)** | `string` | Combobox filtered from a static option list or a `user`-type source | options, source type | required |

> Rich text stores a string, so the model is unaffected. Keep the editor
> dependency tiny (or use `contentEditable`-free markdown) to avoid bundle
> bloat and XSS risk — sanitize any HTML before rendering in submissions.

### 1.2 Data model changes

**`FormField` (`src/types.ts`)** — add per-type settings on the existing field
object so old forms stay valid (all fields optional):

```ts
export type FormField = {
  // ...existing fields...
  // Tier A
  layout?: "inline" | "stacked";        // radio / multi-select
  // Tier B
  min?: number;                          // slider, currency, number
  max?: number;
  step?: number;
  decimals?: number;                     // currency / number
  prefix?: string;                       // currency "$"
  suffix?: string;                       // unit "kg"
  starCount?: 3 | 5 | 7 | 10;            // rating
  // Tier C
  accept?: string;                       // file upload MIME/extension list
  maxFileSizeMb?: number;
  multiple?: boolean;                    // file upload
  // Tier D
  format?: "markdown" | "html";          // rich text
  // shared
  validation?: FieldValidation;          // see improvement #4 (min/max/regex)
};
```

**`SubmissionData`** — widen the value union to include arrays:

```ts
export type SubmissionData =
  Record<string, string | number | boolean | null | string[]>;
```

Arrays only ever come from multi-select, so every other code path can keep
treating values as scalars; the few places that must learn arrays are listed
in §1.5.

**No Prisma/schema changes** for Tier A/B/D. Tier C (file upload) adds a
`File` model (or an S3 key string column); see §1.6.

### 1.3 Builder changes

- **`elementFactory.ts`** — add a `FIELD_DEFINITIONS` entry per type
  (`category: "input"` or a new `"advanced"` group) and a default label. The
  palette and the `createElement` switch pick the types up automatically.
- **`icons.tsx`** — one small icon per type (or reuse existing ones for
  variants like email/URL/phone).
- **`FieldInspector.tsx`** — per-type setting panels gated on `element.type`:
  - `radio` / `multi-select`: existing `OptionsEditor` + layout toggle.
  - `slider`/`currency`/`number`: min/max/step/decimals/prefix/suffix inputs.
  - `rating`: star-count select.
  - `file`: accept types (comma list), max size, multiple toggle.
  - `signature`: pen color/width.
  - `rich text`: format select.
  - Validation settings (required, min/max, regex) land with improvement #4.
- **`CanvasElement.tsx`** — the preview renders through `FieldControl`
  automatically; only the width badge may need to account for wider widgets.
  No structural change.

### 1.4 Renderer changes

**`FieldControl.tsx`** — add render branches:

- `radio`: map `options` to `<label>`-wrapped inputs sharing a name; expose
  via a new `"radio"`-style input group.
- `multi-select`: checkboxes; value handled as `string[]`, toggled on change.
- `email`/`url`/`phone`: same text branch with the correct `type`/`inputMode`
  (text branch is already centralized).
- `time`: mirror the `date` branch with `<input type="time">`.
- `rating`/`slider`: dedicated small components.
- `currency`: text/number input with prefix/suffix adornments.
- `file`: dropzone component (native input hidden behind a styled button).
- `signature`: canvas pad with pointer events; stores data URL.
- `rich text`: toolbar + textarea or markdown editor.

**`DynamicFormRenderer.tsx`:**

- Add the new types to `EDITTABLE_TYPES` and `isSubmittableField`.
- Validation: email/URL/phone format checks, file size/type checks, signature
  "non-empty", multi-select "at least one". Required messaging reuses the
  existing per-field error state.
- `readOnly` (view mode) and edit mode already pass through `FieldControl`:
  ensure `disabled` disables every new widget and that stored values (data
  URLs, file names, arrays) prefill correctly.
- **`FormPage` redirect with `appendData`**: arrays and files serialize as
  comma-joined / URL-encoded params; files append their filename only.

### 1.5 Submissions table & export

- **`FormSubmissionsPage.tsx` `formatCellValue`**:
  - `string[]` → comma-joined chips (`A, B, C`).
  - file → a clickable link (filename) that opens the stored file.
  - signature → a small thumbnail `<img>`.
  - rating → filled-star glyphs or `3/5`.
- **System-field parity**: keep created/modified/updated-by columns; file and
  signature cells get a min width so rows don't blow up.
- **CSV export (improvement #5)** should serialize arrays as `";"`-joined and
  files as their URL, not as objects.

### 1.6 File upload deep dive (Tier C)

Uploads are the only change that touches the server. Two storage options:

**Option A — Local disk (fastest to ship, dev/eval friendly)**
- Add an `UploadedFile` model: `{ id, formId, fieldKey, originalName, mimeType, sizeBytes, path, createdAt, submissionId? }`.
- Wasp action `uploadFile` (multipart or base64 JSON) writes to
  `server/uploads/` under a random name; `deleteFile` cleans up when a
  submission/field is removed.
- `submitForm` receives the file references and links them to the submission.
- **Gotchas**: path traversal (never trust user filenames — generate server
  UUIDs), disk quotas, no replication.

**Option B — S3-compatible object storage (recommended for production)**
- Same model, but `path` is an object key; `uploadFile` streams to S3 with a
  content-type; presigned GET URLs (short TTL) are generated in
  `getSubmission`/`getFormSubmissions` so files aren't served by the app.
- No app-server disk growth, works across instances, easy backups.

**Security requirements (both options):**
- Accept-list enforcement: only MIME types/extensions from the field's
  `accept` setting; reject everything else server-side (never trust client
  checks).
- Hard `maxFileSizeMb` per field with an overall per-submission cap.
- Store files as private by default; only generate access URLs for
  authenticated users with form access, or for a one-time token if anonymous
  viewing is required.
- Reject executable types (`.exe`, `.js`, `.html`, `.svg` unless trusted) and
  serve with `Content-Disposition: attachment`.

### 1.7 Backward compatibility

- Every new field setting is optional, so existing forms load unchanged
  (settings default to current behavior: single value, no uploads, etc.).
- `FieldType` gains new union members only — no renames, no removals.
- Old submissions that predate a field type render with a fallback
  (`—` / "not provided") via `formatValue`.
- Form JSON is versioned implicitly by `settings`/`fields` shape; add a
  defensive normalizer in `getForm` if strict validation is desired later.

### 1.8 Phased rollout

| Phase | Types | New dependencies | Est. effort |
|---|---|---|---|
| 1 | radio, multi-select, email, URL, phone, time | none | 1–2 days |
| 2 | rating, slider, currency | none | 1 day |
| 3 | file upload (local disk first), signature (data URL) | `multer` or S3 SDK | 2–4 days |
| 4 | rich text, autocomplete | optional markdown lib + sanitizer | 1–2 days |
| 5 | validation rules for all new types (improvement #4) | none | 2 days |

Phase 1 is a pure renderer/inspector exercise and can ship immediately after
`wasp compile` verification with zero migration risk.

---

## 2. Multi-step (wizard) forms

**Goal:** Let long forms be split into pages with a progress bar and
conditional navigation.

Forms with many fields are intimidating. Wizards reduce friction and are a
top-requested form feature.

### Delivered

- **Optional toggle**: "Multi-step wizard" in form settings (`multiStep`);
  off by default, so existing forms are unaffected.
- **Sections become steps**: every `section_header` becomes a step boundary;
  the section title is the step name. Fields before the first section header
  form step 1. The builder canvas shows a "Step N" badge on each section
  header (matching the wizard's numbering).
- **Progress indicator**: "Step X of Y" counter with the current step title and
  an animated progress bar.
- **Client-side validation per step**: "Next" validates only the current step's
  visible fields; the final "Submit"/"Save changes" validates everything.
- **Back/Next buttons**; the form-level Reset button appears on the last step.
- **Step visibility**: steps can be skipped via a visibility rule on the
  section header — hidden steps drop out of the step list dynamically (verified:
  a form with 4 steps shows 3 until the triggering field matches).
- View mode still allows navigating through steps (no submit).

### Implementation notes

- The renderer (`DynamicFormRenderer.tsx`) builds steps from `section_header`
  boundaries via `buildSteps()`, filters visible steps via `isStepVisible()`,
  and validates per step with the existing `validateFields()`.
- State: `currentStep` is clamped to the visible-step range so hidden steps
  are skipped safely.
- Stored submissions remain flat — steps do not affect the data shape.

---

## 3. Form theming and brand customization

**Goal:** Let each form look like the product/team it belongs to, not the default
Adminator template.

Visual differentiation is often the deciding factor for whether a shared form
looks professional.

### Proposed scope

- **Per-form theme settings** (stored in the existing `Form.settings` JSON):
  - Accent / primary color (drives buttons, focus rings, links).
  - Background treatment: default canvas, subtle color, or image.
  - Card style: bordered / shadowed / borderless, corner radius.
  - Typography: font size scale and an optional display font.
  - Dark-mode option for the form page.
- **Logo / header image** URL field shown above the form title.
- **Field density**: comfortable / compact spacing toggle.
- **Live preview in the builder** — a "Style" tab in the form settings panel
  shows the theme choices against a mini preview of the form.
- **Custom CSS** textarea (advanced, per form) for power users, applied to the
  public form page only.

### Implementation notes

- The app already uses CSS custom properties from the Adminator token design
  (`--color-primary-600`, `--color-canvas`, etc. in `App.css`). A per-form
  theme can be injected as inline `style` overrides on the form page's root
  element (CSS variables cascade naturally).
- Add theme fields to `FormSettings` with defaults, then a `ThemePanel` in
  `FieldInspector`'s form-settings view.
- Validate the custom CSS field length and keep it scoped to the public form
  page wrapper to avoid styling the builder/admin UI.

---

## 4. Advanced validation, calculations, and conditional logic

> **Status: implemented.** Field-level validation rules, an expanded formula
> engine, dynamic option filtering, and conditional-required are all live in
> the builder and renderer.

**Goal:** Support real-world business rules without code.

Current validation is required/optional only, and `math` supports basic
arithmetic. Extending both makes forms genuinely useful for pricing, quoting,
and data entry.

### Delivered

- **Validation rules** (`FormField.validation`, edited in a "Validation" panel
  in `FieldInspector`):
  - Min/max length (text-ish types) and min/max value (number, slider,
    currency, rating).
  - Regex pattern with a custom error message.
  - Email / URL / phone format validation (from the element library work).
  - "Must match field X" cross-field rule (confirm-password style).
  - Custom expression rule (`[quantity] <= [max_quantity]`) with an error
    message, evaluated via the formula engine.
- **Calculation enhancements** (`formula.ts`): a whitelisted expression parser
  (no `eval`) that now supports functions — `sum`, `avg`, `min`, `max`,
  `round(x, d)`, `abs`, `count`, `if(cond, a, b)`, `dateDiff(a, b)` — plus
  comparison operators (`< > <= >= == !=`) and date substitution (date fields
  evaluate as day numbers so `dateDiff` works). Math fields have a rounding
  (decimals) setting.
- **Dynamic option filtering**: select / radio / multi-select options can each
  carry a "Show when..." rule (reusing the visibility engine) so options
  appear based on another field's value.
- **Conditional required**: a field can be "Required only when..." a rule is
  satisfied (`requiredWhen`).

### Implementation notes

- Validation rules live on `FormField` as an optional `validation` object;
  the renderer's `validateField()` composes built-ins + custom expression.
- Formulas run through a whitelisted expression parser in `formula.ts` — no
  `eval`. Functions are pure and unit-testable.
- Keep error display consistent with the existing `error` state per field.

---

## 5. Submission insights, export, and automation

**Goal:** Make collected data actionable — get it out of the app and into the
teams that need it.

Submissions are currently viewable in a table only. Export and notifications
turn the form builder into a pipeline.

### Proposed scope

- **CSV / Excel export** of submissions (all fields + created/modified/updated
  by), triggered from the submissions page toolbar. Server-side CSV generation
  keeps it fast for large datasets; Excel (xlsx) can be added later.
- **Email notifications**: per-form "notify these emails on submit" setting;
  the email includes the response summary (formatted from the submission data)
  and a link to the record.
- **Webhook on submit**: optional per-form endpoint that receives a POST with
  the submission JSON (HMAC-signed with a per-form secret) — the standard
  integration hook for CRMs, Slack, databases, etc.
- **Response receipts**: optionally show a receipt number (e.g., `RES-000123`)
  on the success panel; add a system field `response_id` to the form.
- **Edit link for anonymous submitters**: after submitting, hand the user a
  tokenized link to edit their own response (respects form-level "allow
  editing own response" setting and a configurable window).
- **Basic analytics**: submission volume over time, per-field completion rates,
  and average time-to-submit, shown as a small stats row on the submissions page.

### Implementation notes

- Export and webhooks belong in `src/actions.ts` / `src/queries.ts` as new
  operations; webhook calls should be fire-and-forget or queued so a slow
  endpoint never blocks the submit response.
- Notifications/automation settings extend `FormSettings` and get their own
  panel in the builder.
- The edit-link feature can reuse the existing record-edit route
  (`/forms/:id/records/:submissionId/edit`) plus a one-time token column on
  the `Submission` model.

---

### Suggested sequencing

1. **Element library** (highest-impact, unlocks surveys/applications).
2. **Validation + calculations** (makes new elements trustworthy).
3. **Theming** (quick win for perception, independent of #1/#2).
4. **Submissions export + notifications** (data becomes actionable).
5. **Multi-step wizard** (best saved until element set is stable).
