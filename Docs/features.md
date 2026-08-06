# Form Builder — Feature Reference

A summary of every feature available in the form builder app. The app is built
with Wasp (v0.25) + React + Prisma (PostgreSQL).

---

## 1. Form builder

### Element library

The palette (with a search box) is grouped into **Input fields**, **Advanced**,
**Layout elements**, and **System fields**. Click an element to append it to the
canvas, or drag it onto the canvas at a specific position.

**Input fields**

| Element | Stores | Notes |
|---|---|---|
| Text | `string` | Single-line text |
| Textarea | `string` | Multi-line text |
| Number | `number \| null` | Numeric input |
| Select | `string` | Dropdown with editable options |
| Radio group | `string` | Single-choice buttons, stacked or inline |
| Multi-select | `string[]` | Checkbox list, stores an array |
| Checkbox | `boolean` | Toggle |
| Email | `string` | `type=email`, format-validated |
| URL | `string` | `type=url`, format-validated |
| Phone | `string` | `type=tel`, lenient phone validation |
| Date | `string` | Date picker |
| Time | `string` | Time picker |
| User | `string` (email) | Dropdown of the current users (name label, email stored) |
| Confirmation | `string` | Re-type another field (e.g. email/password confirm); must match its "Confirm field" |
| Hidden field | `string` | Not shown to users; value set via Default value or `?key=value`, stored with the submission |
| Math | computed | Formula-driven calculated field |

**Advanced elements**

| Element | Stores | Notes |
|---|---|---|
| Rating | `number` | Star scale (3/5/7/10), hover preview |
| Slider | `number` | Range input with min/max/step |
| Currency | `number \| null` | Number input with prefix/suffix and decimals |
| Signature | PNG data URL | Canvas draw pad with pen color/width |
| File upload | file id | Uploads to server storage (max size/type configurable) |

**Layout elements**: Section header, Divider, Paragraph.

**System fields**: Created date, Modified date, Updated by user — auto-filled
server-side (`updated_by_user` records the acting user's email or name).

### Field settings (inspector)

Each element has settings in the right-hand inspector, grouped into
**collapsible accordions** (General, Options, Formatting, Formula, Required &
validation, Data table & filters, System field, Visibility):

- **Label**, **Field key** (stored JSON key), **Column width**
- **Placeholder**, **Help text**, **Required**, **Show in data table**
- **Visibility rule** — show the field only when a condition on another field
  is met. Conditions support multiple rules (AND within a group, OR between
  groups) and type-aware operators: equals, not equals, contains, starts/ends
  with, is set, is not set, greater/less than.
- **Validation** (per-field):
  - Min/max length (text-ish types) and min/max value (number/slider/currency/rating)
  - Regex pattern with a custom error message
  - Must-match-another-field (confirm-password style)
  - Custom expression rule (e.g. `[quantity] <= [max_quantity]`) with a custom message
- **Conditional required** — required only when a condition is satisfied
- **Per-option "show when" rules** — options on select/radio/multi-select can
  appear conditionally based on another field's value (dependent dropdowns)
- **Default value** — prefills the field on new submissions; URL params
  (`?field=value`) override it for that visit.
- **Input mask** (text & phone fields) — formats as the user types, with
  presets (Phone `(###) ###-####`, US phone `+1 (###) ###-####`, Credit card,
  Date, Zip, SSN) or a custom pattern (`#` digit, `A`/`a` letter, `*` any,
  other characters auto-inserted). Masked values are stored as displayed.

### Math / calculations

- Reference fields by `[field_key]`; results recompute live as inputs change.
- Operators: `+ - * / % ^`, unary `-`, parentheses.
- Comparisons: `< > <= >= == !=` (return 1/0).
- Functions: `sum(...)`, `avg(...)`, `min(...)`, `max(...)`, `round(x, d)`,
  `abs(x)`, `count(...)`, `if(cond, a, b)`, `dateDiff(a, b)`.
- Date fields evaluate as day numbers, so `dateDiff` works on them.
- Math fields have a rounding (decimals) setting.

### Canvas / reordering

- **Move up / Move down** buttons on every element (precise reordering).
- **Drag & drop** with a floating overlay; the drop target is previewed by
  shifting the grid, and insertion is before/after based on where you release
  (top/left half = before, bottom/right half = after).
- If a drop would make the element wrap to the next row instead of sitting next
  to the target, the overlay shows a red warning: *"Won't sit next to this
  field — it will wrap to the next row."*
- Elements span a **12-column grid**; set each element's column width
  (e.g. 12 = 100%, 6 = 50%, 4 = 33%, 3 = 25%). Elements wrap automatically
  when a row fills up.
- Duplicate / delete actions per element.
- Clicking empty canvas deselects and returns to form settings; the element
  settings panel also has a **Form settings** button, and clicking anywhere
  outside the element or its settings (e.g. the palette) deselects too.

### Form settings

Configured in the inspector when no element is selected. Settings are grouped
into sections — in the sidebar they are **collapsible accordions**; the pop-out
(near-fullscreen) view shows them as **tabs across the top**.

**Display**
- How the form opens: **New page** or **Popup / modal** (with width and height
  presets).

**After submit**
- Show a success message (custom or default) and/or redirect:
  - **Show a success message** (custom text, default "Thank you! Your response
    has been submitted."). Supports **smart tags** (see below).
  - **Redirect** to the form's submissions page or a custom URL (smart tags
    supported in the URL)
  - **Show message, then redirect** (Continue button + auto-redirect)
  - Optionally **append the response data to the URL** as query params.

**Buttons**
- **Back button** (default on) — returns to the submissions page on view/edit,
  or the forms list on a new record.
- **Reset button** (optional) — clears the form / restores saved values.

**Multi-step wizard** (optional)
- Split the form into steps at every Section header; step title = section title.
- Progress bar + "Step X of Y" counter, per-step validation on "Next", Back/Next
  navigation, Reset on the last step.
- Steps can be skipped with a visibility rule on the section header.
- The canvas shows "Step N" badges on section headers.
- Viewing a record shows the **full record across all steps** at once.

**Spam & availability**
- **Honeypot** — an invisible field bots tend to fill; those submissions are
  silently discarded (the submitter still sees success).
- **Rate limit (per hour)** — rejects submissions after the limit is reached in
  a rolling hour (429 with a friendly message).
- **Open from / Open until** — submissions outside the window are rejected
  server-side and the form page shows a "closed" notice.

**Auto-populate**
- Field **default values** prefill new submissions.
- URL params (`/forms/:id?field_key=value`) prefill fields and override
  defaults (handy for tracking/campaign links).

**Automation**
- **Webhook URL** — POSTed on every submission create/update with
  `{ event, form, submission }`, signed with an HMAC-SHA256
  `X-Form-Signature` header (per-form secret with a Generate button).
- **Show a receipt number** — the success panel shows `RES-XXXXXXXX`.
- **Let submitters edit their response** — the success panel shows an
  "Edit this response" link backed by a one-time token.
- **Actions** — ordered steps that run before or after a submission is stored.
  Actions run in order; each action can have its own **"Only run when..."**
  condition (a rule against the submission data). Multiple actions are
  supported:
  - **Set field value** (before submit) — overwrite a field with a static
    value, another field's value, or a formula result before storing.
  - **Call API** (before or after submit) — `GET`/`POST` JSON to a URL.
    Before submit: the response's `value` can be written into a form field.
    After submit: fire-and-forget with `{ event, form, submission }`.
  - **Update this submission** (after submit) — set a field on the just-saved
    submission (static / field / formula).
  - **Create submission in another form** (after submit) — copy fields with
    matching keys into a new submission of a chosen target form.
  - **Send email** (after submit) — emails the response summary + record link
    via SMTP (requires `SMTP_*` env vars). Recipients combine a hard-coded
    comma-separated list, a chosen field's value (e.g. a User or Email field)
    if it looks like an email, and optionally the submitter's email. The
    subject supports smart tags, an optional custom **HTML body template**
    (smart tags; falls back to the default summary when blank), and an
    optional **PDF attachment** of the submission.
  - API calls are restricted to `http(s)` URLs and time out after 10s.

**Smart tags**

One interpolation engine (`src/shared/smartTags.ts`) reused in email
subjects/bodies, the success message, and redirect URLs:

- `{field.KEY}` (formatted value), `{field.KEY.label}` (field label)
- `{form.title}`, `{form.id}`, `{submission.id}`, `{record_url}`, `{receipt}`,
  `{date}`
- `{all_fields}` (plain-text "Label: value" lines) and `{all_fields_html}`
  (HTML list)

Unknown tags render as empty; empty values are skipped in `{all_fields}`.

**Conditional logic**
- Add any number of **conditions**; each one has:
  - **When** — a set of rules (rules within a group are AND, groups are OR)
    with type-aware operators (equals, not equals, contains, starts/ends with,
    is set, is not set, greater/less than). The field list includes a special
    **Record state** field (`_record_mode`) that is `new` for a fresh
    submission and `update` when editing a record that has already been saved.
  - **Then do** — actions run when the rules match.
  - **Otherwise (not met)** — optional actions run when they don't (great for
    a default state on page load).
- Conditions are evaluated **in order** on page load and whenever a value
  changes; later conditions see values produced by earlier ones.
- Rule value inputs are type-aware: date fields get date pickers, numbers get
  number fields, and fields with options (dropdowns, radios, user lists)
  show a dropdown of their existing values.
- **Show field / Hide field** actions combine with a field's own
  **Visibility rule** (its "show conditionally" setting): the field is visible
  only when **both** its own rule is satisfied **and** no condition action
  hides it. For anything beyond a simple local rule, prefer the form-level
  conditions below.
- Actions:
  - **Show field / Hide field** — fields hidden by logic are skipped on
    submit.
  - **Set value** — fixed value, copy another field, or a formula result.
  - **Copy value from** — copy one field into another.
  - **Select option / Deselect option** — select or clear an option on
    dropdown/checkbox/radio fields.
  - **Show option / Hide option** — reveal or hide a specific option.
  - **Run custom JS** — executes whenever that branch is active with a `form`
    API: `form.getValue(key)`, `form.setValue(key, value)`, `form.values()`,
    `form.fields`.
- **Custom JS on page load** — a script that runs once when the form loads,
  using the same `form` API (e.g. prefill or compute values before the user
  interacts).

---

## 2. Form pages

Public form routes:

- `/forms/:id` — **new record** (public, anonymous-friendly)
- `/forms/:id/records/:submissionId` — **view a record**
- `/forms/:id/records/:submissionId/edit` — **edit a record**
  (also works for anonymous submitters when the URL carries `?token=...`)

Record access follows the form's sharing model: view requires view access,
edit requires owner/admin/edit access (or a valid self-edit token).

All three modes honor the form's **display mode** (page vs popup with configured
window size) and the after-submit settings.

The record view page also has a **Download PDF** button (authenticated viewers
with form access) that generates a PDF of the submission server-side.

### PDF generation

- `getSubmissionPdf` (`src/queries.ts`) builds an A4 PDF server-side
  (`src/server/pdf.ts`, pdfkit): form title header, submission id + timestamps,
  label/value rows in field order (section headers become section titles,
  signatures embedded as images, file uploads listed by filename).
- Available from the record view page and per-row on the submissions table.
- The email action can **attach the PDF** to notification emails.

---

## 2a. Templates, duplication & import/export

- **Save as template** — snapshot any form (title + fields + settings) into a
  template (`Form.isTemplate`). Templates are hidden from the main forms list.
- **Templates section** on the forms list — "Use template" creates a form and
  opens it in the builder; templates can be deleted.
- **Template picker** on `/forms/new` — start from a template or a blank form;
  the form row is only created on Save.
- **Duplicate** — one-click copy of a form (`"<title> (copy)"`); fields and
  settings only, no submissions or sharing rows.
- **Export** — downloads `<title>.form.json` (`{ title, fields, settings,
  exportedAt, version }`).
- **Import form** — uploads a `.form.json`, validates it, and creates the form
  (ids/ownership/template flags in the file are ignored).

---

## 3. Submissions

The submissions table (`/forms/:id/submissions`):

- **Analytics row** — total responses, this week, avg/day, top field fill rate.
- **Searchable, sortable table** with one column per visible field plus
  Submitted at.
- **Smart field filters** — every field with "Show in filters" enabled renders
  its own filter control automatically (no manual selection):
  - Each field's **condition** (Equals / Not equals / Contains; Greater / Less /
    Between; On date / Before / After / Between dates; Has upload / No upload)
    is chosen in the **element settings** of the edit form page — the options
    are aware of the field type (dates get date conditions, numbers get numeric
    ones, etc.).
  - For text and dropdown-like fields you also pick the **filter input** style:
    a dropdown of the field's existing values or a free text field. Dates use
    date picker(s), numbers use number fields, file uploads use a Has / No
    upload dropdown.
  - Placement (on top vs under column headers) and the number of columns for
    the top filter grid are form settings.
- **Bulk actions** — checkboxes on each row (plus select-all); a bulk bar
  offers **Export CSV / Export Excel** and **Delete** for the selected rows.
- **Row actions**: View, Edit and Delete (confirm) render inline by default —
  icon-only, with tooltips; **Download PDF** is hidden by default. Each
  action can independently be set to **inline**, **in the row's ⋯ dropdown**,
  or **hidden** via form settings ("Submissions table" → "Row action
  buttons", `FormSettings.submissionRowActions`); a **Show action labels**
  toggle (default off) adds text labels to the inline buttons. Edit and
  Delete also require edit access to the form.
- Arrays render comma-joined; signatures show a label; file uploads show a
  **Download** button (fetches the stored file, auth-gated).
- **Export CSV** and **Export Excel (.xlsx)** — download all rows (or the
  selected rows) as a file (server-generated).

---

## 4. Admin

- **User management** (`/admin/users`, admin-only):
  - Add users (email, password, name, role), delete users (cascades their
    forms/submissions/access), edit name/role.
  - Self-demotion / self-deletion are blocked.
- **Form sharing** (`/forms/:id/access`): share a form with users at
  **View** (see submissions) or **Edit** (also edit/delete submissions) level.
  Form structure edits require the owner or an admin.

---

## 5. Server & operations notes

- **File uploads**: stored on local disk under `uploads/` (override with
  `UPLOADS_DIR`); the request body limit was raised to 20MB
  (`src/serverSetup.ts`) to accommodate base64 payloads.
- **Webhooks/email**: dispatched fire-and-forget from `submitForm` and
  `updateSubmission` via `src/server/notifications.ts`.
- **PDF email attachments**: Wasp's `emailSender` has no attachment support,
  so emails with attachments are sent through a direct nodemailer transporter
  built from the same `SMTP_*` env vars (`sendEmail` in
  `src/server/notifications.ts`).
- **Self-edit tokens**: `Submission.editToken` column; validated by
  `getSubmissionByToken` / `updateSubmissionByToken` (public operations).
