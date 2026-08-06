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

> **Status: implemented.** CSV export, webhooks, email notifications, response
> receipts, tokenized self-edit links, and analytics are all live.

**Goal:** Make collected data actionable — get it out of the app and into the
teams that need it.

Submissions are currently viewable in a table only. Export and notifications
turn the form builder into a pipeline.

### Delivered

- **CSV export** (`getSubmissionsCsv` query): an "Export CSV" button on the
  submissions page downloads a CSV of all rows (field columns + Submitted
  at/Updated at), generated server-side with proper escaping.
- **Webhook on submit** (`src/server/notifications.ts`): an optional per-form
  `webhookUrl` receives a POST with `{ event, form, submission }` on every
  create/update, signed with an HMAC-SHA256 `X-Form-Signature` header using a
  per-form secret (generated in the settings panel). Fire-and-forget so a slow
  endpoint never blocks the submit.
- **Email notifications**: on create/update an email with the response summary
  and a record link is sent via Wasp's SMTP sender. Recipients are combined
  from a hard-coded **notify emails** list, an **email-from-a-field** recipient
  (e.g. a User or Email field), and the **submitter's email**; a
  **conditional** rule ("Only send when...") can gate all notification emails.
  Requires `SMTP_*` env vars; without a reachable server sends are skipped.
- **Response receipts**: the success panel can show a receipt number
  (`RES-XXXXXXXX`, derived from the submission id) when "Show a receipt
  number" is enabled.
- **Edit link for submitters**: "Let submitters edit their response" generates
  a one-time `editToken` on submit and shows an "Edit this response" link on
  the success panel. The record routes are now public and accept `?token=...`;
  `getSubmissionByToken` / `updateSubmissionByToken` validate the token, so
  anonymous submitters can edit their own response.
- **Basic analytics**: a stats row on the submissions page shows total
  responses, this week, avg/day, and the top field fill rate (computed
  client-side).

### Implementation notes

- Automation settings extend `FormSettings` (`webhookUrl`, `webhookSecret`,
  `notifyEmails`, `notifyField`, `notifySubmitter`, `notifyCondition`,
  `enableReceipt`, `allowSelfEdit`) and live in an "Automation" section of the
  builder's form-settings panel.
- Webhook + email dispatch lives in `src/server/notifications.ts`
  (`fireNotifications` / `sendSubmissionEmails`) and is called fire-and-forget
  from `submitForm` and `updateSubmission` (passing the submitter email).
- The self-edit token is a new nullable `Submission.editToken` column
  (migration `add_submission_edit_token`), returned to the client from
  `submitForm`.

---

### Suggested sequencing

The original five improvements are all implemented (element library, advanced
validation/calculations, multi-step wizard, submission export/automation).
One item from the original plan — **form theming** — is still open and is the
first item in the next round below.

---

## 6. Next round: proposed enhancements

### A. Theming & branding (carried over from the original plan)

1. **Per-form theming** — accent/primary color, background treatment (solid /
   subtle color / image), card style (border/shadow/radius), typography scale,
   logo/header image, and optional scoped custom CSS. The app already uses
   Adminator CSS custom properties, so themes can be applied by overriding
   variables on the form page root. *(quick visual win)*

### B. Builder & element experience

2. ~~**Form templates & duplication**~~ — **implemented**: `isTemplate` flag on
   `Form`, "Save as template" / "Duplicate" row actions, a Templates section
   with "Use template", and a template picker on `/forms/new`.
3. **Undo / redo + keyboard shortcuts** in the builder — history stack for
   element add/move/delete/settings changes; shortcuts (⌘Z, Delete, arrow
   reorder).
4. **Repeating sections** — add/remove rows of grouped fields (e.g. line items,
   family members). Store rows as arrays in submission data; needs the
   submissions table to render nested rows.
5. **File upload v2** — multiple files, drag-and-drop zone, image previews,
   and S3-compatible storage (the current implementation is single-file on
   local disk).
6. **Rich text / autocomplete elements** — markdown toolbar with sanitized HTML
   output, and a combobox that can source options from a data list or the user
   element.

### C. Logic & data

7. ~~**Richer visibility rules**~~ — **implemented**: rule groups (AND within /
   OR between), contains, starts/ends with, greater/less than, is set/not set.
8. ~~**Submission filtering & bulk actions**~~ — **implemented**: per-field
   smart filters, bulk select with bulk delete and CSV/Excel export.
9. **Excel (xlsx) export** alongside CSV.
10. **Submission edit history** — a change log per submission (who/when/what
    changed, with diffs), shown in a record view.
11. **Data import & duplicate detection** — CSV import to seed submissions, and
    configurable duplicate checks (e.g. same email in the last N hours).

### D. Sharing & integrations

12. **Embed & QR** — iframe embed code for a form and a QR code image for the
    form link (reachable from the submissions page / form settings).
13. **Channel presets** — Slack / Discord / Teams webhook templates on top of
    the generic webhook.
14. **Spam controls beyond honeypot** — CAPTCHA element (Cloudflare Turnstile
    or reCAPTCHA), minimum time-to-submit, email/domain blocklist, and
    unique-value enforcement. (Open/close dates, honeypot, and rate limiting
    are already live.)
15. **Public form API** — token-authenticated endpoint for submitting responses
    from other systems (external tools, scripts).
16. **Payments** — Stripe checkout on submit for paid forms (gate submission
    creation on payment success).
17. ~~**Smart tags + HTML email templates**~~ — **implemented**:
    `renderSmartTags` in `src/shared/smartTags.ts` (`{field.x}`, `{all_fields}`,
    `{record_url}`, `{receipt}`, …) used in email subjects/bodies, the success
    message, and redirect URLs; email action has a custom HTML body template.
    Not done: CC/BCC/Reply-To, conditional content blocks (`{if}`).
18. ~~**PDF generation from submissions**~~ — **implemented**:
    `buildSubmissionPdf` (`src/server/pdf.ts`, pdfkit), `getSubmissionPdf`
    query, Download PDF on the record page + per-row on the submissions table,
    and an "Attach a PDF" option on the email action (sent via a direct
    nodemailer transporter since Wasp's emailSender has no attachment support).
19. **Context tracking** — capture IP, country, device/browser, referrer,
    source page, and UTM params per submission; expose as system fields and
    filters.
20. **Submission status & internal notes** — status selector (new/reviewed/
    archived) + notes on submissions; filter by status.
21. **Storage controls** — per-form "don't store submissions" toggle and
    auto-delete of submissions older than N days.
22. ~~**Form export/import**~~ — **implemented**: `exportForm` query downloads
    `<title>.form.json`; "Import form" on the forms list validates and creates
    via `importForm` (id/ownerId/isTemplate in the file are ignored).

### F. Form JS actions (implemented)

Configurable, server-side action steps that run before or after a submission is
stored — no arbitrary client-side code. **Delivered**:

- **Set field value** (before submit) — static / field copy / formula.
- **Call API** (before or after submit) — `GET`/`POST` JSON; before-submit
  calls can write the response's `value` into a form field (http/https only,
  10s timeout).
- **Update this submission** (after submit) — set a field on the saved record.
- **Create submission in another form** (after submit) — copy matching field
  keys into a new submission (the app's "write to DB" hook).
- **Send email** (after submit) — emails the response summary + record link
  via SMTP. Recipients combine a hard-coded list, a chosen field's value
  (User/Email field), and optionally the submitter's email; a custom subject
  is supported.
- **Conditions**: every action has an optional "Only run when..." rule, so
  actions (including emails) fire only when the submission satisfies the
  condition. Multiple actions are supported and run in order.

Implemented in `src/server/formActions.ts` (engine + per-action condition
evaluation, email action reusing the SMTP helper in `src/server/notifications.ts`),
invoked from `submitForm`, with an editor in the form-settings "Actions"
section. Run order is sequential by trigger; `create_submission` intentionally
does not cascade the target form's own actions (avoids loops).

### E. Workspace & analytics

23. **Organizations / folders** — workspaces with multiple members and folders
    for organizing forms (extends the current user/role + sharing model).
24. **Deeper analytics** — submission volume over time (chart), per-option
    breakdowns, and average time-to-complete.
25. **Scheduled email reports** — deliver a CSV summary on a cadence (daily /
    weekly) to configured emails.

### Recommended next (shortlist)

Refreshed after shipping smart tags/email templates (D17), PDF generation
(D18), and form templates/duplication/export-import (B2 + D22) — see
`Docs/gap-analysis-convert-forms.md` for the full comparison.

1. **Spam controls** (D14) — Turnstile element + min-time-to-submit; small
   effort, protects every public form.
2. **Context tracking** (D19) — IP/geo/referrer/UTM per submission; small
   schema addition, big analytics value.
3. **Email polish** — CC/BCC/Reply-To on the email action, conditional content
   blocks (`{if}`) in templates, resend.
4. **Submission status & internal notes** (D20) — makes review workflows
   manageable.
5. **Integration presets** (D13) — Slack/Discord/Teams webhook templates.
