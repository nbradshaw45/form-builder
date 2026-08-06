# Feature Gap Analysis — Form Builder vs Tassos Convert Forms

Comparison of our form builder against
[Convert Forms](https://www.tassos.gr/docs/convert-forms) (the leading Joomla
form-builder extension, v5.2.4, docs verified August 2026 against ~20
documentation articles + the full docs sitemap). Legend: ✅ = have, 🟡 =
partial, ❌ = missing, ? = not documented/verified.

This revision corrects several stale entries from the previous version
(multi-page forms, payments, QR, rate limiting, AND/OR rule groups) and adds
advanced & developer-feature coverage.

---

## 1. Builder & form authoring

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| Drag-and-drop live builder | ✅ | ✅ | Our builder also has move buttons and drag preview with wrap warnings |
| Multi-column / responsive layouts | ✅ | ✅ | They use CSS width classes (`cf:w-1/3`, responsive breakpoints); we use a 12-col span per element |
| Pre-built **form templates** | ✅ | ✅ | **Shipped**: save-as-template, Templates section, picker on `/forms/new` |
| **Duplicate / copy a form** | ✅ | ✅ | **Shipped**: one-click Duplicate on the forms list |
| Multi-page / wizard forms | ❌ | ✅ | **We lead** — their FAQ says multi-page is unsupported (data-passing workaround only); we have section steps + progress bar + step skipping |
| Field-level styling (colors, size, padding) | ✅ | ❌ | They have a Design panel per element/box/text/image |
| Per-form **theming / branding** (fonts, custom CSS, Google Fonts) | ✅ | ❌ | No accent color, logo, custom CSS |
| **Custom CSS / JS per form** | ✅ | 🟡 | We have custom JS (page load + condition actions) but no custom CSS |
| Undo / redo in the builder | ? | ❌ | Not documented for them either |
| AJAX submit + after-submit redirect/message | ✅ | ✅ | Both support success message, redirect, data passthrough |
| **Form export/import** (file format) | ✅ | ✅ | **Shipped**: `.form.json` export/import |

## 2. Field types

| Field | Convert Forms | Us | Notes |
|---|---|---|---|
| Text / textarea / number / select / checkbox / date / time | ✅ | ✅ | |
| Email / URL / phone | ✅ | ✅ | Their phone field adds country detection/auto-formatting; we have input masks instead |
| **Password** (with mask/unmask toggle) | ✅ | ❌ | |
| Radio & checkbox **images** | ✅ | ❌ | Image-backed options |
| **Confirmation fields** | ✅ | ✅ | |
| **Hidden fields** | ✅ | ✅ | |
| **Input masks** (optional segments, alternators, repeats) | ✅ | 🟡 | Their mask syntax is richer (`[...]`, `(aaa|999)`, `{n,m}`); ours covers presets + simple custom patterns |
| File upload | ✅ | ✅ | Both single-file; neither does S3 |
| Rating | ✅ | 🟡 | Stars only for us (3/5/7/10) |
| Signature | ✅ | ✅ | |
| Range slider | ✅ | ✅ | |
| **Country** dropdown, **Color picker**, **Terms of Service** checkbox | ✅ | ❌ | |
| **Rich Text Editor** field | ✅ | ❌ | |
| **HTML field** (rich content w/ inline calculations) | ✅ | 🟡 | We have paragraph/section/divider layout elements but no arbitrary HTML element |
| **Captcha fields** (reCAPTCHA, hCaptcha, Turnstile, Math, Altcha) | ✅ | 🟡 | We ship Cloudflare Turnstile as a first-class element |
| User dropdown (current users) | ❌ | ✅ | Unique to us |
| Math / calculated fields | ✅ | ✅ | Both have expression parsers; theirs adds trig/log, ours adds `dateDiff` and date arithmetic (**they explicitly lack date calculations**) |
| Per-option **calculation values** (options carry numeric weights) | ✅ | ❌ | Enables pricing/quiz scoring |

## 3. Logic, prefill & smart behaviour

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| Conditional show/hide of fields | ✅ | ✅ | Both have central condition builders with show/hide, set/copy value, select/show/hide options |
| Rule groups (**AND/OR**) + else-actions | ✅ | ✅ | **Corrected**: both support AND within groups, OR between groups, and "otherwise" actions |
| Conditional required | 🟡 | ✅ | They auto-unrequire hidden fields; we have explicit `requiredWhen` |
| Field **calculations** | ✅ | ✅ | They verify server-side on submit; we compute client-side |
| Quiz scoring | ✅ | ❌ | Via their per-option calc values |
| **Auto-populate** (defaults, query string, user data) | ✅ | 🟡 | Field defaults + `?key=value` prefill done; no logged-in-user prefill / smart-tag defaults |
| Per-action **conditions** (emails, webhooks, tasks) | ✅ | ✅ | Both gate actions on submission data |
| **Conditional content** in messages/emails (`{if}` blocks) | ✅ | ✅ | `{if field.x == y}…{/if}` (also `!=`, `contains`, truthy) |
| Run custom JS from conditions / on load | 🟡 | ✅ | We have `form.getValue/setValue` API in condition actions + on-load scripts; they have a JS events API instead (§8) |

## 4. Submissions & data

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| Submissions management (list/filter/search) | ✅ | ✅ | We have per-field smart filters + bulk actions; they add status selector, internal notes, customizable columns |
| Submission **status / internal notes** | ✅ | ❌ | |
| **Context tracking** (IP, geo-country, device, referrer, UTM, source page) | ✅ | 🟡 | We capture IP/UA/referrer/source/UTM/screen; no geo-country lookup yet |
| CSV export | ✅ | ✅ | They also export JSON |
| **Excel export** | ❌ | ✅ | `.xlsx` via exceljs — **we lead** |
| **PDF generation** from submissions | ✅ | ✅ | **Shipped**: server-side PDF (pdfkit), download from record page + submissions rows, email attachment. No smart-tag PDF templates yet |
| Frontend record **view & edit** pages | 🟡 | ✅ | **We lead** — they display submissions on the frontend but editing is only "planned"; we have full view/edit record routes incl. token-based anonymous edit |
| Submission **edit history / diffs** | ❌ | ❌ | Neither (they track dateModified only) |
| **Analytics dashboard / charts** | ❌ | 🟡 | Neither has charts; we have a basic stats row, they rely on external GA/GTM tracking |
| Bulk actions | ✅ | ✅ | |
| Sequential submission numbering / unique IDs | ✅ | 🟡 | We have receipt numbers (`RES-XXXXXXXX`) |
| **Storage controls** (disable storage, auto-delete old submissions) | ✅ | ❌ | |
| Import submissions | 🟡 | ❌ | They support DB-level import only; no UI import on either side |

## 5. Notifications & integrations

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| **Email notifications** (admin + auto-responder) | ✅ | ✅ | We have SMTP email actions with field/submitter recipients and per-action conditions |
| Multiple independent **email tasks** (CC/BCC, Reply-To, resend, tracking) | ✅ | 🟡 | We support multiple email actions with CC/BCC/Reply-To; no resend/tracking |
| **Email routing by field value** | ✅ | 🟡 | Our field-based recipient covers the common case |
| Email **templates (HTML/CSS)**, **attachments**, **smart tags** | ✅ | 🟡 | Custom HTML body + smart tags + `{if}` + PDF attachment. Still missing: uploaded-file attachments, resend/tracking |
| Webhooks | ✅ | 🟡 | Ours: POST/GET JSON + HMAC signing. Theirs: GET/POST/PUT/PATCH/DELETE, custom headers, JSON or form payloads |
| **Tasks engine** (multi-step app automations, data passing between tasks) | ✅ | 🟡 | Our ordered action engine is conceptually similar (set field / call API / cross-form write / email) but has no task-to-task data passing or reusable named connections |
| **CRM / email integrations** (MailChimp, HubSpot, Salesforce, Brevo, ActiveCampaign, GetResponse, MailerLite, Zoho…) | ✅ | ❌ | ~20 preset integrations; we have generic webhook/API-call only |
| **Zapier** | ✅ | ❌ | Reachable via our webhook in practice |
| **Analytics tracking** (GA, GTM, Meta Pixel, Google Ads) | ✅ | ❌ | |

## 6. Spam, security & restrictions

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| Honeypot | ✅ | ✅ | Theirs is on by default (v2) |
| **reCAPTCHA v2/v3, hCaptcha, Turnstile, Math captcha, Altcha** | ✅ | 🟡 | Turnstile element shipped; other providers not |
| **Minimum time to submit** | ✅ | ✅ | Per-form seconds setting |
| **Rate limiting** | ❌ | ✅ | **We lead** — per-form rolling-hour limit; they only have min-time + IP restriction |
| **Availability window** (open/close dates) | ✅ | ✅ | |
| **Block emails/domains**, **profanity filter**, **IP restriction**, **unique-value enforcement**, **double opt-in** | ✅ | ❌ | Restriction rule set we don't have |
| Submission limits (max N submissions) | 🟡 | ❌ | Only via their PHP script recipes |
| GDPR/consent tooling (cookie consent, iubenda) | ✅ | ❌ | |

## 7. Payments

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| Native payment gateway (Stripe/PayPal) | ❌ | ❌ | **Corrected**: roadmap only for them — Stripe/PayPal achievable via custom PHP/JS recipes, same as our Call API action |

## 8. Distribution, platform & access

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| **Embed** (iframe / shortcode / module) | ✅ | ❌ | They document iframe embedding on external sites; we only have a standalone URL |
| **Popup** display | 🟡 | ✅ | **We lead** — native popup/modal display mode; they need a separate extension (EngageBox) |
| **QR code** for the form link | ❌ | ❌ | **Corrected**: not documented for them either |
| Form **access control / sharing** (view vs edit) | ❌ | ✅ | **We lead** — per-user sharing, roles, admin user management; they have no form-level ACL |
| **Self-edit link** (token) for submitters | ❌ | ✅ | |
| Response **receipts** | ❌ | ✅ | |
| Localization | ✅ | ❌ | 10+ UI translations, multilingual forms |
| Multi-tenant orgs / folders | ❌ | ❌ | Neither (Joomla is single-site; we're single-workspace) |

## 9. Advanced & developer features

| Capability | Convert Forms | Us | Notes |
|---|---|---|---|
| **Server-side code hooks** | ✅ PHP scripts (4 hooks: form prepare, form display, form process/validate, after submission) | 🟡 | Our action engine covers "after submission" no-code style (set field, call API, cross-form write, email) but there is no escape hatch for arbitrary server logic or custom server-side validation |
| **Client-side JS API** | ✅ Events: `impression`, `beforeSubmit` (can veto), `success`, `error`, `afterTask`, programmatic `submit()` | 🟡 | We have `form.getValue/setValue/values/fields` in on-load + condition scripts, but no submit lifecycle events or veto |
| **Plugin/extension events** (12 documented Joomla events, incl. cron endpoint) | ✅ | ❌ | N/A architecturally, but shows their extensibility surface |
| **JSON API** (read forms/leads w/ API key) | ✅ | ❌ | No public/token-authenticated API on our side (read or submit) |
| **Form export/import** | ✅ | ✅ | **Shipped**: `.form.json` (their format is `.CNVF`) |
| **Template/layout overrides** | ✅ | ❌ | Joomla template overrides; N/A for us |
| **PHP API class** (`Api::getFormSubmissionsTotal()` etc.) | ✅ | ❌ | |
| **Custom field type SDK** | ❌ | ❌ | Neither documents registering new field types |
| Custom validation scripts | ✅ (PHP form-process hook, throw Exception) | 🟡 | We have per-field regex/expression validation but no server-side custom validator beyond that |

---

## Where we lead (verified)

- **Multi-step wizard forms** — they don't support multi-page at all.
- **Frontend record editing** (incl. anonymous token edit) — theirs is "planned".
- **Per-form sharing / roles / admin** — no form-level ACL on their side.
- **Rate limiting**, **response receipts**, **Excel export**, **native popup mode**,
  **date arithmetic in calculations**, explicit **conditional required**.

## Summary of gaps by weight

**Shipped since the last revision:**
- **Spam controls** — Turnstile captcha element + minimum time to submit
- **Context tracking** — IP/UA/referrer/UTM/source page per submission
- **Email polish** — CC/BCC/Reply-To + `{if}` conditional content blocks
- Smart tags + HTML email templates, PDF generation, form templates/duplication/export-import

**High impact, missing entirely:**
1. **Integration presets** — Slack/Discord/Teams + a few CRM presets on top of
   the existing webhook/API action.
2. **Submission status / internal notes**
3. **Embed code** (iframe snippet), **theming/branding**.

**High impact, partial:**
4. **Email** — resend/tracking, uploaded-file attachments still open.
5. **Storage controls** (auto-delete, disable storage).
6. Captcha/spam: Turnstile + min-time done; email/domain blocklist and
   unique-value enforcement still open.

## Recommended: 3 features to implement next

The previous top-3 (spam controls, context tracking, email polish) are
**shipped**. The next three:

### 1. Submission status & internal notes
**Why:** Review workflows need a first-class status (new/reviewed/archived)
and notes on submissions; Convert Forms has this and our submissions UI is
otherwise mature.
- Effort: small–medium.

### 2. Integration presets (Slack / Discord / Teams)
**Why:** We have generic webhooks; presets remove the JSON-crafting step for
the most common destinations.
- Effort: small.

### 3. Per-form theming / branding
**Why:** Still the only original improvement left open; the main visual gap
vs Convert Forms for public forms.
- Effort: medium.

### Runner-ups
- **Embed & QR** — iframe snippet + QR for the form link.
- **Deeper analytics** — volume charts and per-option breakdowns.
