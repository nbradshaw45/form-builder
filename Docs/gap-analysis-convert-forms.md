# Feature Gap Analysis — Form Builder vs Tassos Convert Forms

Comparison of our form builder against
[Convert Forms](https://www.tassos.gr/joomla-extensions/convert-forms) (the
leading Joomla form-builder extension, v5.2.x). The goal is to find
high-impact gaps worth closing. Legend: ✅ = have, 🟡 = partial, ❌ = missing.

---

## 1. Builder & form authoring

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| Drag-and-drop live builder | ✅ | ✅ | Our builder also has grid-width columns, move buttons, and drag preview with wrap warnings |
| 12-column / responsive layouts | ✅ | ✅ | Column span per element + flex-wrap |
| Pre-built **form templates** | ✅ | ❌ | No template gallery or "save as template" |
| **Duplicate / copy a form** | ✅ | ❌ | Only manual rebuild |
| Multi-step / wizard forms | ✅ | ✅ | Section-header steps + progress bar + step skipping |
| Field-level styling (colors, size, padding) | ✅ | ❌ | No per-field visual customization |
| Per-form **theming / branding** | ✅ | ❌ | No accent color, logo, custom CSS |
| Undo / redo in the builder | ✅ | ❌ | No history stack |
| Keyboard shortcuts | ✅ | ❌ | No shortcuts |

## 2. Field types

| Field | Convert Forms | Us | Notes |
|---|---|---|---|
| Text / textarea / number / select / checkbox / date / time | ✅ | ✅ | |
| Email / URL / phone (formatting + **country detection**) | ✅ | 🟡 | We validate email/URL/phone but have no auto-formatting/input masks |
| Radio & checkbox **images** | ✅ | ❌ | Image-backed options |
| **Confirmation fields** (email/password confirm) | ✅ | ❌ | Would reuse "must match" validation + a field pair |
| **Hidden fields** | ✅ | ❌ | Store tracking/static values not shown to users |
| **Input masks** (phone, currency, card, custom) | ✅ | ❌ | No mask/format-as-you-type |
| File upload | ✅ | ✅ | We support single-file; no multi-file/S3 yet |
| Rating (stars/hearts/thumbs, 1–10) | ✅ | 🟡 | Stars only (3/5/7/10) |
| Signature | ✅ | ✅ | |
| Range slider | ✅ | ✅ | |
| Rich text editor | ✅ | ❌ | Not implemented |
| User dropdown (current users) | ❌ | ✅ | Unique to us |
| Math / calculated fields (with functions, comparisons) | ✅ | ✅ | We support `sum/avg/if/dateDiff`, etc. |

## 3. Logic, prefill & smart behaviour

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| Conditional show/hide of fields | ✅ | ✅ | Visibility rules + per-option "show when" |
| Conditional required | ✅ | ✅ | `requiredWhen` |
| Field **calculations** | ✅ | ✅ | Math fields + live recompute |
| **Auto-populate** fields (defaults, **query string**, pre-selected options, logged-in user) | ✅ | ❌ | We prefill only when editing a record; no `?field=value` prefill for new submissions |
| **Input masking** | ✅ | ❌ | See above |
| Per-action **conditions** (emails, webhooks) | ✅ | ✅ | Each action has "Only run when..." |
| Rule groups (**AND/OR**) | ✅ | ❌ | Single-rule conditions only |

## 4. Submissions & data

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| Submissions management (list/filter/search) | ✅ | ✅ | Table + search + record view/edit/delete |
| CSV export | ✅ | ✅ | |
| **Excel export** | ✅ | ❌ | CSV only |
| **PDF generation** from submissions | ✅ | ❌ | No PDFs (agreements, invoices, consent) |
| Submission **edit history / diffs** | ✅ | ❌ | No change log |
| **Analytics dashboard / charts** | ✅ | 🟡 | Basic stats row only (totals, week, avg/day, fill rate) |
| Bulk actions (bulk delete/export) | ✅ | ❌ | Row-by-row only |
| Conditional formatting / fields in results | ✅ | ❌ | Static columns only |

## 5. Notifications & integrations

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| **Email notifications** (admin + auto-responder) | ✅ | ✅ | SMTP, hard-coded/field/submitter recipients, per-action conditions, custom subject |
| Email **templates (HTML/CSS)**, **file attachments**, **smart tags** | ✅ | ❌ | Plain generated summary only; no attachment/tag support |
| Webhooks (GET/POST, field mapping, headers, conditional) | ✅ | 🟡 | POST/GET JSON + HMAC; no field mapping, headers, or payload templates |
| **CRM / email integrations** (MailChimp, HubSpot, Salesforce, AWeber, Zoho…) | ✅ | ❌ | Generic webhook only; no presets |
| **Google Analytics** tracking | ✅ | ❌ | |
| **PDF attached to email** | ✅ | ❌ | |
| Payment forms (Stripe/PayPal) | ✅ | ❌ | |

## 6. Automation & workflow

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| Custom server-side actions (set field, call API, write to DB) | ❌ | ✅ | Unique — our action engine |
| Create submission in another form | ❌ | ✅ | "Write to DB" hook |
| Register a user from a submission | ✅ | ❌ | We create users via admin only |
| Publish content / create articles | ✅ | ❌ | Joomla-specific; N/A for our platform |

## 7. Distribution, security & platform

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| **Embed anywhere** (iframe/shortcode in pages, modules, popups, footer) | ✅ | ❌ | We only have a standalone URL (+ popup display mode) |
| **QR code** for the form link | ✅ | ❌ | |
| **Spam protection** (reCAPTCHA, hCaptcha, honeypot) | ✅ | ❌ | Nothing yet |
| **Rate limiting** on submissions | ✅ | ❌ | |
| **Availability window** (open/close dates) | ✅ | ❌ | |
| Form **access control / sharing** (view vs edit) | ❌ | ✅ | Unique — per-user form sharing |
| User roles & admin user management | ❌ | ✅ | |
| **Self-edit link** (token) for submitters | ❌ | ✅ | |
| Response **receipts** | ❌ | ✅ | |
| Multi-tenant orgs / folders | ✅ | ❌ | Single-workspace only |
| Localization (10+ languages) | ✅ | ❌ | English only |

---

## Summary of gaps by weight

**High impact, missing entirely:**
1. Pre-built **form templates** + save-as-template/duplicate
2. **PDF generation** from submissions (+ email attachment / download link)
3. **Spam protection & availability** — honeypot, rate limiting, open/close dates, reCAPTCHA
4. **Embed & QR** — iframe embed code + QR code for the form link

**High impact, partial:**
5. **Auto-populate** fields (query-string prefill, defaults, logged-in user info)
6. **Input masks** and confirmation/hidden fields
7. **Email templates** (HTML, attachments, smart tags)
8. **Excel export**, submission **edit history**, deeper **analytics**

**Nice-to-have:**
9. CRM/email provider integrations, Google Analytics, multi-file uploads, image radios, rich text, rule groups (AND/OR), theming, undo/redo.

---

## Recommended: 3 features to implement next

### 1. Form templates & duplication
**Why:** "Form templates" is Convert Forms' headline time-saver, and duplication
is a trivial extension. High perceived value, low risk.
- "Save as template" action on a form (snapshot of `fields` + `settings`).
- Template gallery on `/forms/new`; create a form from a template.
- One-click **Duplicate** on the forms list.
- Effort: small (one new action/query + a picker UI). No schema change.

### 2. PDF generation from submissions
**Why:** Unique differentiator in our stack (Convert Forms pushes it heavily for
agreements, consent, invoices); pairs with our email actions (attach PDF) and
webhooks.
- Server-side PDF from a submission (label/value list + form title).
- Add a "Generate PDF" action type and/or a download link in the submissions
  table and the record view page.
- Optionally attach to the email action.
- Effort: medium (a PDF library such as `pdfkit`/`pdfmake` + a small template).

### 3. Spam protection & availability controls
**Why:** Convert Forms leads with anti-spam (reCAPTCHA/hCaptcha/honeypot) and it
protects real deployments; we currently have zero.
- Honeypot field (invisible, auto-rejects bots) — trivial.
- **Rate limiting** per form on `submitForm` (e.g. N submissions per window).
- **Availability window** per form (open/close dates; show "closed" outside).
- Optional **reCAPTCHA**/hCaptcha integration behind the existing auth-less
  public submit path.
- Effort: low–medium; no schema for honeypot/rate-limit (in-memory/DB counters),
  a settings toggle + date fields for availability.

### Runner-up
- **Auto-populate via query string** (`?field=value`) + field defaults for new
  records — very cheap (client reads URL params) and closes a common gap.
