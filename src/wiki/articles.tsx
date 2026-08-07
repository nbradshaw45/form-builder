import { type ReactNode } from "react";
import { Link } from "wasp/client/router";
import {
  Code,
  CodeBlock,
  H2,
  H3,
  Li,
  Note,
  Ol,
  P,
  Setting,
  Table,
  Tag,
  Tip,
  Ul,
  Warn,
} from "./components";

export type WikiCategory = {
  id: string;
  label: string;
};

export const WIKI_CATEGORIES: WikiCategory[] = [
  { id: "start", label: "Getting started" },
  { id: "form-settings", label: "Form settings" },
  { id: "element-settings", label: "Element settings" },
  { id: "advanced", label: "Advanced guides" },
  { id: "submissions", label: "Submissions" },
  { id: "admin", label: "Sharing & admin" },
];

export type WikiArticle = {
  id: string;
  title: string;
  category: string;
  /** Short 1–2 sentence description used in search results and help bubbles. */
  summary: string;
  content: ReactNode;
};

function ArtLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to="/docs"
      search={{ article: to }}
      className="font-semibold text-primary-600 underline decoration-primary-300 decoration-1 underline-offset-2 hover:text-primary-700"
    >
      {children}
    </Link>
  );
}

export const WIKI_ARTICLES: WikiArticle[] = [
  /* ------------------------------------------------------------------ */
  /* Getting started                                                     */
  /* ------------------------------------------------------------------ */
  {
    id: "overview",
    title: "Welcome to the Form Builder",
    category: "start",
    summary:
      "How the app fits together: building forms, collecting submissions, and managing access.",
    content: (
      <>
        <P>
          The Form Builder lets you design forms with a visual builder, publish
          them on a public link, collect submissions, and review the data in a
          searchable, filterable table. Everything is organized around a few
          core areas:
        </P>
        <Ul>
          <Li>
            <strong>Forms</strong> — each form has a title, description, a list
            of fields (elements), and a set of <em>form settings</em> that
            control how it looks, behaves, and automates. The{" "}
            <strong>builder</strong> is where you design it.
          </Li>
          <Li>
            <strong>Elements</strong> — every field (Text, Select, Rating, Math,
            Signature, Captcha, and more) is configurable in the right-hand{" "}
            <em>inspector</em> with its own settings.
          </Li>
          <Li>
            <strong>Submissions</strong> — the responses to a form live in a
            table where you can search, filter, export to CSV/Excel, download
            PDFs, and edit or delete rows. Each record also stores visitor{" "}
            <em>context</em> (IP, referrer, UTM…).
          </Li>
          <Li>
            <strong>Sharing &amp; roles</strong> — forms can be shared with
            per-form roles (Viewer, Editor, Manager, or custom) that control
            submission view/edit/delete. Every account also has a global role
            (admin, editor, or viewer).
          </Li>
        </Ul>
        <P>
          This wiki documents every setting you will find in the app. Settings
          that are advanced (custom JavaScript, formulas, regex, smart tags,
          URL prefill, …) show a <Tag>?</Tag> help bubble next to them in the
          builder — click it for a quick summary and a link to the full guide.
        </P>
      </>
    ),
  },

  {
    id: "builder",
    title: "The builder workspace",
    category: "start",
    summary:
      "The canvas, element palette, and inspector — where you design a form.",
    content: (
      <>
        <P>
          Open <strong>New form</strong> (or edit an existing form) to enter the
          builder. It has three parts:
        </P>
        <Ul>
          <Li>
            <strong>Canvas</strong> — the middle area showing the form as it
            will look. Click a field to select it, or click empty space to
            return to the form settings.
          </Li>
          <Li>
            <strong>Palette</strong> — the left panel with every element type,
            grouped into <em>Input fields</em>, <em>Advanced</em>,{" "}
            <em>Layout</em>, and <em>System</em>. Click an element to append it,
            or drag it onto the canvas at a specific position. A search box
            filters the palette.
          </Li>
          <Li>
            <strong>Inspector</strong> — the right panel. When nothing is
            selected it shows the <em>form settings</em>; when a field is
            selected it shows that field&apos;s settings. Use{" "}
            <strong>Form settings</strong> (or the back arrow) to switch back.
            The pop-out button opens the form settings in a large tabbed view.
          </Li>
        </Ul>
        <H3 id="arranging">Arranging fields</H3>
        <Ul>
          <Li>
            Use <strong>Move up</strong> / <strong>Move down</strong> on an
            element, or <strong>drag &amp; drop</strong> to reposition.
          </Li>
          <Li>
            Every element spans a 12-column grid. Set its <strong>column
            width</strong> (12 = full row, 6 = half, 4 = third, 3 = quarter).
            Elements wrap to the next row when a row fills up.
          </Li>
          <Li>
            <strong>Duplicate</strong> and <strong>Delete</strong> buttons are
            available on each element.
          </Li>
        </Ul>
        <H3 id="saving">Saving</H3>
        <P>
          Set the form <strong>title</strong> (and optionally a description) at
          the top, then use <strong>Save form</strong>. When you create a new
          form you can start from a <em>blank form</em> or from one of your{" "}
          <em>templates</em> (see{" "}
          <ArtLink to="templates">Templates &amp; import/export</ArtLink>).
        </P>
      </>
    ),
  },

  {
    id: "templates",
    title: "Templates, duplication & import/export",
    category: "start",
    summary:
      "Reusable templates, one-click duplication, and JSON export/import of forms.",
    content: (
      <>
        <P>
          Forms can be reused and moved between workspaces in a few ways:
        </P>
        <Ul>
          <Li>
            <strong>Save as template</strong> — snapshots the form&apos;s title,
            fields, and settings as a reusable template. Templates are hidden
            from the main form list and shown in the <em>Templates</em> section
            on the forms page.
          </Li>
          <Li>
            <strong>Use template</strong> — creates a new form from a template
            and opens it in the builder. The template picker on{" "}
            <em>New form</em> does the same thing before the form is saved.
          </Li>
          <Li>
            <strong>Duplicate</strong> — copies a form instantly as{" "}
            <em>“&lt;title&gt; (copy)”</em>.
          </Li>
          <Li>
            <strong>Export</strong> — downloads{" "}
            <Code>&lt;title&gt;.form.json</Code> containing the title, fields,
            and settings.
          </Li>
          <Li>
            <strong>Import form</strong> — uploads a <Code>.form.json</Code>{" "}
            file and creates a new form from it.
          </Li>
        </Ul>
        <Note>
          Templates, duplicates, and imports copy the structure only — they
          never copy submissions or sharing rows. IDs and ownership in an
          imported file are ignored.
        </Note>
      </>
    ),
  },

  /* ------------------------------------------------------------------ */
  /* Form settings                                                       */
  /* ------------------------------------------------------------------ */
  {
    id: "display",
    title: "Display: page or popup",
    category: "form-settings",
    summary:
      "How the form opens for submitters — a full page or a centered popup with a custom window size.",
    content: (
      <>
        <P>
          The <strong>Display</strong> section controls how the form is
          presented to people who open its link.
        </P>
        <Setting name={<>How the form opens</>}>
          Choose <strong>New page</strong> (the form fills the browser tab, the
          default) or <strong>Popup / modal</strong> (the form opens as a
          centered popup over the referring page).
        </Setting>
        <Setting name={<>Popup width &amp; Popup height</>}>
          Shown when <em>Popup / modal</em> is selected. Width presets range
          from 440px to 960px (default 560px). Height can be{" "}
          <em>Auto — fit content</em> or a fixed value (480, 600, 720, or 900px);
          with auto height the popup grows up to 88% of the viewport.
        </Setting>
        <Note>
          The same form link serves both modes — viewers just see the popup
          instead of a page. Record view/edit and the success screen also honor
          the chosen dimensions.
        </Note>
      </>
    ),
  },

  {
    id: "steps",
    title: "Multi-step wizard",
    category: "form-settings",
    summary:
      "Split a long form into steps at each Section header, with a progress bar and per-step validation.",
    content: (
      <>
        <P>
          Turning on <strong>Multi-step wizard</strong> splits the form into
          steps. Each step is created by a <strong>Section header</strong>{" "}
          element: the header&apos;s title becomes the step name, and everything
          after it starts the next step. Fields before the first section header
          form the first step.
        </P>
        <Ul>
          <Li>
            A progress bar and a <em>“Step X of Y”</em> counter appear at the
            top.
          </Li>
          <Li>
            <strong>Next</strong> validates only the current step before moving
            on; <strong>Back</strong> returns to the previous step.
          </Li>
          <Li>
            The <strong>Reset</strong> button appears on the last step if it is
            enabled.
          </Li>
          <Li>
            A step can be skipped entirely by adding a{" "}
            <em>show conditionally</em> rule to its Section header — when the
            rule fails the step is hidden.
          </Li>
          <Li>
            When viewing a saved record, all steps are shown at once (the full
            record is visible in a single scroll).
          </Li>
        </Ul>
        <Tip>
          Step titles are just Section header labels — rename the header to
          rename the step, and use its <em>Subtext</em> for a short description
          under the step title.
        </Tip>
      </>
    ),
  },

  {
    id: "after-submit",
    title: "After submit: message & redirect",
    category: "form-settings",
    summary:
      "What happens after a successful submission — a thank-you message, a redirect, or both.",
    content: (
      <>
        <P>
          The <strong>After submit</strong> section decides what a submitter
          sees once their response is saved.
        </P>
        <Setting name={<>After submit</>}>
          <Ul>
            <Li>
              <strong>Show a success message</strong> (default) — a thank-you
              panel with the text you provide.
            </Li>
            <Li>
              <strong>Redirect</strong> — sends the submitter to the form&apos;s
              submissions page or a custom URL immediately.
            </Li>
            <Li>
              <strong>Show message, then redirect</strong> — shows the success
              panel with a <em>Continue</em> button and auto-redirects after 4
              seconds.
            </Li>
          </Ul>
        </Setting>
        <Setting name={<>Success message</>}>
          Custom text shown on the success panel. Leave blank to use the default
          <em> “Thank you! Your response has been submitted.”</em> Supports{" "}
          <ArtLink to="smart-tags">smart tags</ArtLink>, e.g.{" "}
          <Code>{"{field.email}"}</Code>, <Code>{"{record_url}"}</Code>,{" "}
          <Code>{"{receipt}"}</Code>.
        </Setting>
        <Setting name={<>Redirect to</>}>
          <strong>This form&apos;s submissions page</strong> (default) or a{" "}
          <strong>custom URL</strong>. The custom URL supports smart tags too —
          useful for dynamic destinations like{" "}
          <Code>https://example.com/thanks?email={"{field.email}"}</Code>.
        </Setting>
        <Setting name={<>Append response data to URL</>}>
          When on, every submitted field is appended to the redirect URL as
          query parameters (arrays are joined with commas; empty values are
          skipped).
        </Setting>
        <CodeBlock title="Success message with smart tags">
          {`Thank you, {field.first_name}!

Your reference is {receipt}.
{record_url}
{all_fields}`}
        </CodeBlock>
      </>
    ),
  },

  {
    id: "buttons",
    title: "Back & Reset buttons",
    category: "form-settings",
    summary:
      "Show a Back button that leaves the form, and a Reset button that clears or restores it.",
    content: (
      <>
        <P>Two optional buttons on the public form:</P>
        <Setting name={<>Back button</>}>
          On by default. On a new record it links to the forms list; on a record
          view/edit page it returns to the submissions table.
        </Setting>
        <Setting name={<>Reset button</>}>
          Off by default. When enabled, a <em>Reset</em> button clears the form
          back to its initial state — empty for new records, or the saved values
          when editing.
        </Setting>
      </>
    ),
  },

  {
    id: "spam",
    title: "Spam & availability",
    category: "form-settings",
    summary:
      "Honeypot, minimum submit time, per-hour rate limits, and open/close dates to keep a form clean and available.",
    content: (
      <>
        <P>
          The <strong>Spam &amp; availability</strong> section protects your
          form from bots and controls when it accepts responses.
        </P>
        <Setting name={<>Honeypot</>}>
          Adds an invisible field that human visitors never see but automated
          bots tend to fill. If the hidden field contains a value, the
          submission is silently discarded (the bot still sees success).
        </Setting>
        <Setting name={<>Minimum time to submit (seconds)</>}>
          Rejects submissions completed faster than this number of seconds —
          typical of bots. Leave blank to disable.
        </Setting>
        <Setting name={<>Rate limit (per hour)</>}>
          Rejects submissions once the limit is reached within a rolling hour.
          Leave blank for no limit.
        </Setting>
        <Setting name={<>Open from / Open until</>}>
          A date-time window during which the form accepts submissions.
          Outside the window the server rejects submissions and the form page
          shows a “closed” notice.
        </Setting>
        <H3 id="captcha">Captcha (Turnstile)</H3>
        <P>
          For stronger bot protection, drop a{" "}
          <ArtLink to="captcha">Captcha</ArtLink> element from the Advanced
          palette onto the form. It renders a Cloudflare Turnstile widget;
          the token is verified on the server and never stored with the
          submission.
        </P>
        <Tip>
          Combine honeypot + minimum time + rate limit + Captcha for public
          forms that receive a lot of traffic.
        </Tip>
      </>
    ),
  },

  {
    id: "captcha",
    title: "Captcha (Cloudflare Turnstile)",
    category: "element-settings",
    summary:
      "Add a Turnstile widget to block bots. Tokens are verified server-side and never stored.",
    content: (
      <>
        <P>
          The <strong>Captcha</strong> element (Advanced palette) embeds a{" "}
          <em>Cloudflare Turnstile</em> widget on the form. Submitters must
          pass the check before the response is accepted.
        </P>
        <Ul>
          <Li>
            Tokens are verified against Cloudflare&apos;s Siteverify API on
            submit, then discarded — they never appear in the submissions table
            or exports.
          </Li>
          <Li>
            The field is always required when visible. It has no table/filter
            settings.
          </Li>
          <Li>
            You can place more than one captcha, but one per form is enough.
          </Li>
        </Ul>
        <H3 id="env">Environment setup</H3>
        <P>
          Create a Turnstile widget in the Cloudflare dashboard, then set:
        </P>
        <Table
          head={["File", "Variable", "Value"]}
          rows={[
            [
              <Code key="c">.env.client</Code>,
              <Code key="sk">REACT_APP_TURNSTILE_SITE_KEY</Code>,
              "Public site key (shown in the widget).",
            ],
            [
              <Code key="s">.env.server</Code>,
              <Code key="sec">TURNSTILE_SECRET_KEY</Code>,
              "Secret key (server-only; used for Siteverify).",
            ],
          ]}
        />
        <CodeBlock title="Local development (always-pass test keys)">
          {`# .env.client
REACT_APP_TURNSTILE_SITE_KEY=1x00000000000000000000AA

# .env.server
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`}
        </CodeBlock>
        <Warn>
          If a form contains a Captcha element but{" "}
          <Code>TURNSTILE_SECRET_KEY</Code> is missing, submit fails with a
          server configuration error. Restart the app after changing env vars.
        </Warn>
        <Tip>
          Pair Captcha with{" "}
          <ArtLink to="spam">minimum time to submit</ArtLink> and a honeypot for
          layered spam protection.
        </Tip>
      </>
    ),
  },

  {
    id: "submissions-table",
    title: "Submissions table settings",
    category: "form-settings",
    summary:
      "Row action buttons (view/edit/delete/PDF), action labels, and how the filter bar is laid out.",
    content: (
      <>
        <P>
          Settings in this section shape the submissions table on{" "}
          <Code>/forms/:id/submissions</Code>.
        </P>
        <Setting name={<>Show action labels</>}>
          When on, the inline row action buttons show text labels (View, Edit,
          Delete, PDF) in addition to icons. Off by default to save table width.
        </Setting>
        <Setting name={<>Row action buttons</>}>
          Each action — <strong>View</strong>, <strong>Edit</strong>,{" "}
          <strong>Delete</strong>, <strong>Download PDF</strong> — can be placed
          as an <strong>inline button</strong>, in the row&apos;s{" "}
          <strong>⋯ dropdown</strong>, or <strong>hidden</strong>. Defaults:
          View/Edit/Delete inline, PDF hidden. Edit and Delete additionally
          require edit access to the form.
        </Setting>
        <Setting name={<>Filter placement</>}>
          Filters can sit <strong>on top of the table</strong> (a grid of
          filter cards) or <strong>under the column headers</strong> (one input
          per column).
        </Setting>
        <Setting name={<>Filter columns (top placement)</>}>
          How many columns the top filter grid uses (1, 2, 3, 4, or 6). Fewer
          columns keeps the table higher on the page.
        </Setting>
        <P>
          Which fields appear in the filters, and how each one is matched, is
          configured per element under{" "}
          <ArtLink to="filters">Data table &amp; filters</ArtLink>.
        </P>
      </>
    ),
  },

  {
    id: "automation",
    title: "Webhooks, receipts & self-edit",
    category: "form-settings",
    summary:
      "POST submissions to a signed webhook, show a receipt number, and let submitters edit their own response.",
    content: (
      <>
        <P>
          The <strong>Automation</strong> section covers webhook delivery,
          receipts, and self-service editing.
        </P>
        <Setting name={<>Webhook URL</>}>
          Called on every submission <strong>create</strong> and{" "}
          <strong>update</strong> with a JSON body of{" "}
          <Code>{"{ event, form, submission }"}</Code>. Webhooks are
          fire-and-forget (the form doesn&apos;t wait for a response).
        </Setting>
        <Setting name={<>Webhook secret</>}>
          A per-form secret used to sign every webhook payload with HMAC-SHA256.
          Receivers verify the <Code>X-Form-Signature</Code> header, which
          contains <Code>sha256=&lt;hmac&gt;</Code>. Use the{" "}
          <strong>Generate</strong> button to create one.
        </Setting>
        <Setting name={<>Show a receipt number</>}>
          When on, the success panel shows a receipt such as{" "}
          <Code>RES-1A2B3C4D</Code>, which is also available to smart tags as{" "}
          <Code>{"{receipt}"}</Code>.
        </Setting>
        <Setting name={<>Let submitters edit their response</>}>
          When on, the success panel shows an <em>Edit this response</em> link.
          The link contains a one-time token so the submitter can update their
          submission without an account. Revoking access for that person, or
          deleting the submission, invalidates it.
        </Setting>
        <CodeBlock title="Example webhook payload">
          {`{
  "event": "submission.created",
  "form": { "id": "…", "title": "Contact us" },
  "submission": {
    "id": "…",
    "data": { "name": "Ada", "email": "ada@example.com" }
  }
}`}
        </CodeBlock>
      </>
    ),
  },

  {
    id: "actions",
    title: "Automation actions",
    category: "form-settings",
    summary:
      "Ordered steps that run before or after a submission is saved: set fields, call APIs, copy to another form, send email.",
    content: (
      <>
        <P>
          <strong>Actions</strong> run in order as part of the submit flow. Each
          action can be limited with an <em>Only run when…</em> condition, and
          later actions see values produced by earlier ones. Choose a trigger:
        </P>
        <Ul>
          <Li>
            <strong>Before submit</strong> — runs before the response is stored;
            changes are saved with the submission.
          </Li>
          <Li>
            <strong>After submit</strong> — runs after the response is stored.
          </Li>
        </Ul>
        <H3 id="types">Action types</H3>
        <Setting name={<>Set field value</>}>
          Overwrites a field before storing. The value can be a{" "}
          <strong>fixed value</strong>, copied <strong>from another field</strong>,
          or a <strong>formula</strong> result (e.g.{" "}
          <Code>[quantity] * [unit_price]</Code>).
        </Setting>
        <Setting name={<>Call API</>}>
          Sends <Code>GET</Code> or <Code>POST</Code> JSON to an HTTP(S) URL
          (timeout 10s). <em>Before submit</em>: the response&apos;s{" "}
          <Code>value</Code> field can be written into a form field.{" "}
          <em>After submit</em>: fire-and-forget with a{" "}
          <Code>{"{ event, form, submission }"}</Code> payload.
        </Setting>
        <Setting name={<>Update this submission</>}>
          Sets a field on the just-saved submission (fixed / from field /
          formula) — handy for enrichment, e.g. an ID from another system.
        </Setting>
        <Setting name={<>Create submission in another form</>}>
          Copies every field with a matching <em>field key</em> into a new
          submission of a chosen target form.
        </Setting>
        <Setting name={<>Send email</>}>
          Emails the response summary (requires SMTP configuration). Options:
          <Ul>
            <Li>
              <strong>Recipients</strong> — comma-separated addresses, plus a{" "}
              <strong>recipient field</strong> (a field whose value is an email)
              and <strong>Also email the submitter</strong>.
            </Li>
            <Li>
              <strong>CC / BCC / Reply-To</strong> — comma-separated (CC/BCC) or
              a single address (Reply-To). All three support{" "}
              <ArtLink to="smart-tags">smart tags</ArtLink> (e.g.{" "}
              <Code>{"{field.manager_email}"}</Code>).
            </Li>
            <Li>
              <strong>Subject</strong> — optional; supports smart tags and{" "}
              <Code>{"{if …}"}</Code> blocks.
            </Li>
            <Li>
              <strong>Body template</strong> — optional HTML body with smart
              tags and conditional <Code>{"{if …}…{/if}"}</Code> blocks; leave
              blank for the default summary.
            </Li>
            <Li>
              <strong>Attach a PDF</strong> — includes a PDF of the submission.
            </Li>
          </Ul>
        </Setting>
        <CodeBlock title="Email body template">
          {`<p>Hi {field.contact_name},</p>
<p>Thanks for your order.</p>

{all_fields_html}

<p>View it online: <a href="{record_url}">{record_url}</a></p>
{if field.subscribed == "yes"}<p>You'll get our newsletter.</p>{/if}
{if field.plan == "pro"}<p>Your Pro extras are unlocked.</p>{/if}`}
        </CodeBlock>
        <P>
          See <ArtLink to="smart-tags">Smart tags</ArtLink> for the full tag
          and <Code>{"{if}"}</Code> reference, including submission context
          tags like <Code>{"{submission.context.utmSource}"}</Code>.
        </P>
        <Warn>
          Emails are only sent if SMTP is configured in the server environment
          (<Code>SMTP_HOST</Code>, <Code>SMTP_PORT</Code>,{" "}
          <Code>SMTP_USERNAME</Code>, <Code>SMTP_PASSWORD</Code>). Missing
          configuration fails silently. CC, BCC, Reply-To, and PDF attachments
          are sent through the same SMTP transporter.
        </Warn>
      </>
    ),
  },

  {
    id: "conditions",
    title: "Conditional logic",
    category: "form-settings",
    summary:
      "Show/hide fields, set values, and run JavaScript when rules about other fields are met.",
    content: (
      <>
        <P>
          <strong>Conditions</strong> let a form react to what the user types.
          Each condition has a <em>When</em> (a set of rules), a <em>Then do</em>{" "}
          (actions when the rules match), and an optional{" "}
          <em>Otherwise (not met)</em> (actions when they don&apos;t).
        </P>
        <H3 id="rules">Rules</H3>
        <Ul>
          <Li>
            Rules within a group are combined with <strong>AND</strong>;
            multiple groups are combined with <strong>OR</strong>.
          </Li>
          <Li>
            Operators adapt to the field type: equals, not equals, contains,
            starts/ends with, is set, is not set — plus greater/less (or equal)
            for numeric and date fields.
          </Li>
          <Li>
            A special pseudo-field, <strong>Record state</strong> ({" "}
            <Code>_record_mode</Code>), is <Code>new</Code> for a fresh
            submission and <Code>update</Code> when editing a saved record — use
            it to change behavior on edit.
          </Li>
        </Ul>
        <H3 id="actions">Actions</H3>
        <Table
          head={["Action", "What it does"]}
          rows={[
            [
              "Show field / Hide field",
              "Shows or hides a field. Hidden fields are skipped on submit.",
            ],
            [
              "Set value",
              "Sets a field to a fixed value, another field's value, or a formula result.",
            ],
            [
              "Copy value from",
              "Copies one field's value into another.",
            ],
            [
              "Select option / Deselect option",
              "Selects or clears an option on dropdown, checkbox, or radio fields.",
            ],
            [
              "Show option / Hide option",
              "Reveals or hides a specific option on choice fields.",
            ],
            [
              "Run custom JS",
              "Runs JavaScript whenever that branch is active (same API as page-load JS).",
            ],
          ]}
        />
        <P>
          Conditions are evaluated <strong>in order</strong> when the page loads
          and whenever any value changes; later conditions see values produced
          by earlier ones.
        </P>
        <CodeBlock title="Typical pattern">
          {`When  [country] equals "US"
Then  Show field [state]
Otherwise  Hide field [state]`}
        </CodeBlock>
        <Note>
          A field&apos;s own <em>show conditionally</em> rule (in its element
          settings) works together with these conditions: the field is visible
          only when <strong>both</strong> its own rule is satisfied and no
          condition hides it. Use form-level conditions for anything beyond a
          simple local rule.
        </Note>
      </>
    ),
  },

  {
    id: "js-on-load",
    title: "Custom JS on page load",
    category: "form-settings",
    summary:
      "Run a JavaScript snippet once when the form loads, with helpers to read and set field values.",
    content: (
      <>
        <P>
          The <strong>Custom JS on page load</strong> box runs a script once,
          right after the form is rendered. It is the place to prefill hidden
          values, seed fields from the URL, or initialize anything before the
          user interacts.
        </P>
        <P>Your code receives a <Code>form</Code> object with these helpers:</P>
        <Table
          head={["Helper", "Description"]}
          rows={[
            [
              <Code key="a">form.getValue(key)</Code>,
              "Returns the current value of a field (empty string when unset).",
            ],
            [
              <Code key="b">form.setValue(key, value)</Code>,
              "Sets a field's value (string, number, boolean, or array).",
            ],
            [
              <Code key="c">form.values()</Code>,
              "Returns an object of all current values.",
            ],
            [
              <Code key="d">form.fields</Code>,
              "The form's field definitions (key, label, type, options…).",
            ],
          ]}
        />
        <CodeBlock title="Prefill a hidden field with a URL param">
          {`// Seed a hidden "campaign" field from the URL, falling back to "organic"
const params = new URLSearchParams(window.location.search);
const campaign = params.get("campaign") || "organic";
form.setValue("campaign", campaign);`}
        </CodeBlock>
        <CodeBlock title="Compute a value on load">
          {`// Calculate a default due date (today + 14 days)
const due = new Date();
due.setDate(due.getDate() + 14);
form.setValue("due_date", due.toISOString().slice(0, 10));`}
        </CodeBlock>
        <Warn>
          Run-on-load JS executes <em>once</em> when the form mounts. To react
          to changes, use a{" "}
          <ArtLink to="conditions">condition with Run custom JS</ArtLink> —
          that branch re-runs whenever its rules change. Errors are caught and
          logged to the browser console without blocking the form.
        </Warn>
        <P>
          See the full reference with more examples under{" "}
          <ArtLink to="custom-js">Custom JavaScript</ArtLink>.
        </P>
      </>
    ),
  },

  /* ------------------------------------------------------------------ */
  /* Element settings                                                    */
  /* ------------------------------------------------------------------ */
  {
    id: "field-basics",
    title: "General field settings",
    category: "element-settings",
    summary:
      "Label, field key, column width, placeholder, and help text — the settings common to most elements.",
    content: (
      <>
        <P>
          Every element has a <em>General</em> section in the inspector with
          the following basics:
        </P>
        <Setting name={<>Label</>}>
          The visible question text above the input. Keep it short and
          unambiguous.
        </Setting>
        <Setting name={<>Field key</>}>
          The internal identifier stored as the JSON key in submissions, in{" "}
          <Code>form.field_key</Code>. Keys are used everywhere else too:
          formulas (<Code>[key]</Code>), smart tags (<Code>{"{field.key}"}</Code>),
          URL prefill (<Code>?key=value</Code>), and copy actions. Use lowercase
          letters, numbers, and underscores; change it carefully once you have
          collected submissions.
        </Setting>
        <Setting name={<>Column width</>}>
          How much of the 12-column grid the field occupies — 12 (100%), 6
          (50%), 4 (33%), 3 (25%), etc. Elements wrap to the next row when a row
          fills up.
        </Setting>
        <Setting name={<>Placeholder</>}>
          Ghost text shown inside the input before typing (e.g.{" "}
          <em>“john@company.com”</em>). Shown on most input types; simple hint
          text, not a substitute for a label.
        </Setting>
        <Setting name={<>Help text</>}>
          A short paragraph shown under the field on the public form to guide
          the submitter (e.g. <em>“Enter the 9-digit ZIP, e.g. 12345-6789”</em>).
        </Setting>
        <Tip>
          Prefer <strong>help text</strong> for permanent guidance and{" "}
          <strong>placeholder</strong> for a single format example.
        </Tip>
      </>
    ),
  },

  {
    id: "default-values",
    title: "Default values & prefill",
    category: "element-settings",
    summary:
      "Prefill a field for every new submission, and let URL query strings override the default per visit.",
    content: (
      <>
        <P>
          The <strong>Default value</strong> setting (on input fields, and the
          primary way to set <em>hidden fields</em>) prefills a field on every
          new submission.
        </P>
        <Ul>
          <Li>
            It applies to new records; when editing an existing record the
            saved value wins.
          </Li>
          <Li>
            URL query strings override it for that visit: a link like{" "}
            <Code>/forms/abc?referrer=newsletter</Code> fills the field whose
            key is <Code>referrer</Code> with <Code>newsletter</Code>.
          </Li>
          <Li>
            The reserved <Code>token</Code> parameter is never treated as a
            field value (it is used for{" "}
            <ArtLink to="records">self-edit links</ArtLink>).
          </Li>
        </Ul>
        <CodeBlock title="Building a prefilled share link">
          {`https://forms.example.com/forms/abc?product=Premium&utm_source=newsletter

# "product" prefill → a select/radio/hidden field with key "product"
# "utm_source" is captured into submission context as context.utmSource
#   (smart tag: {submission.context.utmSource})`}
        </CodeBlock>
        <P>
          See <ArtLink to="query-strings">URL query strings &amp; tracking</ArtLink>{" "}
          for the full story, including UTM capture.
        </P>
      </>
    ),
  },

  {
    id: "visibility",
    title: "Show conditionally",
    category: "element-settings",
    summary:
      "Show a field only when a rule about another field is satisfied — simple dependent fields.",
    content: (
      <>
        <P>
          The <strong>Visibility</strong> section lets you show a field only
          when a condition about another field is met — for example a “State”
          field that only appears when “Country” is <em>United States</em>.
        </P>
        <Ul>
          <Li>
            Turn on <strong>Show conditionally</strong> and build a rule: pick a
            field, an operator (equals, not equals, contains, starts/ends with,
            is set, is not set…), and a value.
          </Li>
          <Li>
            Multiple rules in the same group are <strong>AND</strong>; add{" "}
            <em>groups</em> for <strong>OR</strong> logic.
          </Li>
          <Li>
            The rule field list includes only fields that appear{" "}
            <em>before</em> the current one, plus the{" "}
            <strong>Record state</strong> pseudo-field.
          </Li>
        </Ul>
        <Note>
          This is the per-field, simple version of conditional behavior. For
          anything bigger — hiding several fields, setting values, running JS —
          use the form-level{" "}
          <ArtLink to="conditions">Conditional logic</ArtLink>, which combines
          with this rule.
        </Note>
      </>
    ),
  },

  {
    id: "validation",
    title: "Required & validation",
    category: "element-settings",
    summary:
      "Required, conditional required, length/value bounds, regex patterns, must-match, and custom expression rules.",
    content: (
      <>
        <P>
          The <strong>Required &amp; validation</strong> section controls what
          counts as a valid answer. The <strong>Required</strong> checkbox makes
          the field mandatory; <strong>Conditional required</strong> makes it
          mandatory only while a rule is satisfied (e.g. only when a previous
          field is set).
        </P>
        <P>
          The validation options depend on the field type:
        </P>
        <Table
          head={["Setting", "Applies to", "Example"]}
          rows={[
            [
              <strong key="a">Min / Max length</strong>,
              "Text, Textarea, Email, URL, Phone",
              "Max 10 characters for a discount code.",
            ],
            [
              <strong key="b">Min / Max value</strong>,
              "Number, Slider, Currency, Rating",
              "At least 1, at most 100.",
            ],
            [
              <strong key="c">Pattern (regex)</strong>,
              "Text-like fields",
              <span key="x">
                <Code>{"/^\\d{5}(-\\d{4})?$/"}</Code> for a US ZIP code.
              </span>,
            ],
            [
              <strong key="d">Must match field</strong>,
              "Any field",
              "A “confirm email” field matching the email field.",
            ],
            [
              <strong key="e">Custom rule</strong>,
              "Any field",
              <span key="y">
                <Code>[quantity] &lt;= [max_quantity]</Code>.
              </span>,
            ],
          ]}
        />
        <Ul>
          <Li>
            <strong>Pattern (regex)</strong> is a JavaScript regular expression
            the value must match (use <Code>^…$</Code> to match the whole
            value). You can write a custom error message, otherwise a default is
            shown. Invalid regexes are ignored rather than blocking the form.
          </Li>
          <Li>
            <strong>Custom rule</strong> is an expression using{" "}
            <Code>[field_key]</Code> references; it must evaluate to a non-zero
            value. A custom message can accompany it.
          </Li>
          <Li>
            Format checks are built in: email/URL/phone formats, rating range,
            signature/file presence.
          </Li>
        </Ul>
        <P>
          See <ArtLink to="regex">Regex patterns</ArtLink> for a pattern cheat
          sheet with examples.
        </P>
      </>
    ),
  },

  {
    id: "options",
    title: "Options, dependent dropdowns & layout",
    category: "element-settings",
    summary:
      "Edit the choices for Select, Radio, and Multi-select fields; hide options conditionally; choose stacked or inline layout.",
    content: (
      <>
        <P>
          The <strong>Options</strong> section appears for{" "}
          <strong>Select</strong>, <strong>Radio group</strong>, and{" "}
          <strong>Multi-select</strong> fields.
        </P>
        <Setting name={<>Options</>}>
          The list of choices. Add, edit, or remove them freely. The stored
          value is the option text itself.
        </Setting>
        <Setting name={<>Show when…</>}>
          Each option can have its own condition: the option only appears while
          the rule is satisfied. This is how you build dependent dropdowns —
          e.g. a <em>“City”</em> select whose cities depend on the chosen{" "}
          <em>“Country”</em>.
        </Setting>
        <Setting name={<>Layout</>}>
          For <strong>Radio group</strong> and <strong>Multi-select</strong>:
          <strong>Stacked</strong> (one choice per row, default) or{" "}
          <strong>Inline</strong> (choices in a horizontal row).
        </Setting>
        <CodeBlock title="Dependent dropdown pattern">
          {`Country:   [United States] [Canada]
City (select field):
  "New York"  → Show when [country] equals "United States"
  "Los Angeles" → Show when [country] equals "United States"
  "Toronto"   → Show when [country] equals "Canada"`}
        </CodeBlock>
        <Note>
          The <strong>User</strong> field is a dropdown too, but its options
          come from the current users list — you cannot edit them. The selected
          user&apos;s email is what gets stored.
        </Note>
      </>
    ),
  },

  {
    id: "formula",
    title: "Math / formula fields",
    category: "element-settings",
    summary:
      "Calculated fields that reference other fields with [brackets] and recompute live as the user types.",
    content: (
      <>
        <P>
          A <strong>Math / Calculated</strong> field computes a value from other
          fields. Reference fields with square brackets, for example{" "}
          <Code>[quantity] * [unit_price]</Code>, and the result recalculates
          live while the user types.
        </P>
        <H3 id="operators">Operators</H3>
        <Ul>
          <Li>
            Arithmetic: <Code>+ - * / % ^</Code> (power), unary minus, and
            parentheses for grouping.
          </Li>
          <Li>
            Comparisons return <Code>1</Code> (true) or <Code>0</Code> (false):{" "}
            <Code>&lt; &gt; &lt;= &gt;= == !=</Code>.
          </Li>
        </Ul>
        <H3 id="functions">Functions</H3>
        <Table
          head={["Function", "Description"]}
          rows={[
            [<Code key="a">sum(a, b, …)</Code>, "Adds all arguments."],
            [<Code key="b">avg(a, b, …)</Code>, "Average of the arguments."],
            [<Code key="c">min(a, b, …)</Code>, "Smallest argument."],
            [<Code key="d">max(a, b, …)</Code>, "Largest argument."],
            [<Code key="e">round(x, d)</Code>, "Rounds x to d decimals."],
            [<Code key="f">abs(x)</Code>, "Absolute value."],
            [
              <Code key="g">count(a, b, …)</Code>,
              "Counts the non-zero arguments.",
            ],
            [
              <Code key="h">if(cond, a, b)</Code>,
              "a when cond is non-zero, otherwise b.",
            ],
            [
              <Code key="i">dateDiff(a, b)</Code>,
              "a − b; date fields are treated as day numbers.",
            ],
          ]}
        />
        <Setting name={<>Rounding</>}>
          The number of decimals the result is displayed with (0–4, default 2).
        </Setting>
        <CodeBlock title="Examples">
          {`[quantity] * [unit_price]            // line total
sum([a], [b], [c])                 // running total
[subtotal] * 0.2                   // 20% VAT
if([country] == "US", 0, [shipping])   // free shipping for the US
round([total] / 3, 2)              // exact split`}
        </CodeBlock>
        <Note>
          Unset or non-numeric fields evaluate as <Code>0</Code>, and an
          invalid formula renders as an empty value. See the full reference
          under <ArtLink to="formulas">Formula reference</ArtLink>.
        </Note>
      </>
    ),
  },

  {
    id: "mask",
    title: "Input masks",
    category: "element-settings",
    summary:
      "Format text and phone input as the user types, with presets or a custom mask pattern.",
    content: (
      <>
        <P>
          The <strong>Input mask</strong> setting (on <strong>Text</strong> and{" "}
          <strong>Phone</strong> fields) formats input as the user types. Pick a
          preset or choose <em>Custom…</em> to type your own pattern.
        </P>
        <H3 id="tokens">Mask tokens</H3>
        <Table
          head={["Token", "Matches"]}
          rows={[
            [<Code key="a">#</Code>, "Any digit (0–9)"],
            [<Code key="b">A</Code>, "Any letter, upper-cased"],
            [<Code key="c">a</Code>, "Any letter, lower-cased"],
            [<Code key="d">*</Code>, "Any letter or digit"],
            [
              <Code key="e">any other character</Code>,
              "Inserted literally as the user types (e.g. ( ) - space)",
            ],
          ]}
        />
        <H3 id="presets">Presets</H3>
        <Ul>
          <Li>
            Phone: <Code>(###) ###-####</Code>
          </Li>
          <Li>
            US phone: <Code>+1 (###) ###-####</Code>
          </Li>
          <Li>
            Credit card: <Code>#### #### #### ####</Code>
          </Li>
          <Li>
            Date: <Code>##/##/####</Code>
          </Li>
          <Li>
            ZIP code: <Code>#####-####</Code>
          </Li>
          <Li>SSN: <Code>###-##-####</Code></Li>
        </Ul>
        <CodeBlock title="Custom mask example">
          {`Pattern: (##) ####-####   # → digits

Typing "11234567890" becomes "(11) 2345-6789"`}
        </CodeBlock>
        <Note>
          The masked (formatted) value is what gets stored in the submission,
          exactly as displayed.
        </Note>
      </>
    ),
  },

  {
    id: "filters",
    title: "Data table & filter settings",
    category: "element-settings",
    summary:
      "Whether a field shows in the submissions table and filters, which condition it filters by, and dropdown vs text input.",
    content: (
      <>
        <P>
          The <strong>Data table &amp; filters</strong> section controls how a
          field behaves on the submissions page.
        </P>
        <Setting name={<>Show in data table</>}>
          When on (default), the field appears as a column in the submissions
          table and in CSV/Excel exports. Turn it off for scratch or internal
          fields.
        </Setting>
        <Setting name={<>Show in filters</>}>
          When on (default), the submissions page renders a filter control for
          this field automatically.
        </Setting>
        <Setting name={<>Filter condition</>}>
          The operator the filter uses — <em>Equals / Not equals / Contains</em>{" "}
          for text, <em>Equals / Greater than / Less than / Between</em> for
          numbers, <em>On date / Before / After / Between dates</em> for date
          fields, and <em>Has upload / No upload</em> for file uploads. The
          submissions filter only asks for the value.
        </Setting>
        <Setting name={<>Filter input</>}>
          For text-like and dropdown-like fields: a <strong>Dropdown</strong> of
          the existing values from submissions (great for pick-lists), or a{" "}
          <strong>Text field</strong> to type any value. Date fields always use
          date pickers and numbers always use number inputs.
        </Setting>
        <Note>
          Captcha tokens are never stored, so captcha fields have no table or
          filter settings — see{" "}
          <ArtLink to="captcha">Captcha</ArtLink>. The overall layout of the
          filter bar is configured under{" "}
          <ArtLink to="submissions-table">Submissions table settings</ArtLink>.
        </Note>
      </>
    ),
  },

  {
    id: "system-fields",
    title: "System fields",
    category: "element-settings",
    summary:
      "Created date, Modified date, and Updated by user — auto-filled fields that track each response.",
    content: (
      <>
        <P>
          The <strong>system fields</strong> are filled automatically when a
          response is submitted or updated:
        </P>
        <Table
          head={["Element", "Stores"]}
          rows={[
            [
              "Created date",
              "When the response was first submitted.",
            ],
            [
              "Modified date",
              "When the response was last updated.",
            ],
            [
              "Updated by user",
              "Who last updated it — the acting user's email (default) or display name.",
            ],
          ]}
        />
        <Setting name={<>Show on form</>}>
          System fields are read-only on the public form. Turn this off to keep
          them out of the submitter&apos;s view entirely.
        </Setting>
        <Setting name={<>Read-only</>}>
          System fields are read-only by default (that is their point); keep
          this on.
        </Setting>
        <Setting name={<>Value to record</>}>
          Only for <em>Updated by user</em>: store the <strong>email
          address</strong> or the <strong>display name</strong>. Falls back to
          the email when a name isn&apos;t set.
        </Setting>
        <Note>
          Created date is preserved on edits; modified date and updated-by-user
          are recomputed. These fields participate in the submissions table,
          filters, exports, and formulas like any other field.
        </Note>
      </>
    ),
  },

  {
    id: "field-types",
    title: "Element type reference",
    category: "element-settings",
    summary:
      "Every element in the palette, what it stores, and the settings unique to it.",
    content: (
      <>
        <P>
          The palette is grouped into <em>Input fields</em>, <em>Advanced</em>,{" "}
          <em>Layout</em>, and <em>System</em> elements.
        </P>
        <H3 id="input">Input fields</H3>
        <Table
          head={["Element", "Stores", "Notes"]}
          rows={[
            ["Text", "string", "Single-line text; supports input masks."],
            ["Textarea", "string", "Multi-line text."],
            ["Number", "number | null", "Numeric input."],
            ["Select", "string", "Dropdown; editable options with per-option rules."],
            ["Radio group", "string", "Single choice; stacked or inline."],
            ["Multi-select", "string[]", "Pick several; stacked or inline."],
            ["Checkbox", "boolean", "On/off toggle."],
            ["Email", "string", "Validated email format."],
            ["URL", "string", "Validated web address."],
            ["Phone", "string", "Lenient phone format; supports input masks."],
            ["Date", "string", "Date picker."],
            ["Time", "string", "Time picker."],
            ["User", "string (email)", "Dropdown of current users; stores the email."],
            [
              "Confirmation",
              "string",
              "Re-type another field; must match its confirm field.",
            ],
            [
              "Hidden field",
              "string",
              "Not shown; set via default value or URL param.",
            ],
            ["Math / Calculated", "computed", "Formula-driven; see Formula fields."],
          ]}
        />
        <H3 id="advanced">Advanced</H3>
        <Table
          head={["Element", "Stores", "Settings"]}
          rows={[
            ["Rating", "number", "Star count (3/5/7/10)."],
            ["Slider", "number", "Min, max, step."],
            ["Currency", "number | null", "Prefix, suffix, decimals (0 or 2)."],
            ["Signature", "PNG data URL", "Pen color and pen width."],
            [
              "File upload",
              "file id",
              "Allowed types, max size (MB), multiple files.",
            ],
            [
              "Captcha",
              "— (not stored)",
              <>
                Cloudflare Turnstile; see{" "}
                <ArtLink key="c" to="captcha">
                  Captcha
                </ArtLink>
                .
              </>,
            ],
          ]}
        />
        <H3 id="layout">Layout</H3>
        <Table
          head={["Element", "Purpose"]}
          rows={[
            ["Section header", "Title + subtext; also defines steps in a multi-step wizard."],
            ["Divider", "Horizontal rule."],
            ["Paragraph", "Rich help text."],
          ]}
        />
        <H3 id="system">System</H3>
        <Table
          head={["Element", "Purpose"]}
          rows={[
            ["Created date", "When the response was created."],
            ["Modified date", "When the response was last updated."],
            ["Updated by user", "Who last updated the response."],
          ]}
        />
        <P>
          See <ArtLink to="system-fields">System fields</ArtLink> for how the
          system fields behave.
        </P>
      </>
    ),
  },

  /* ------------------------------------------------------------------ */
  /* Advanced guides                                                     */
  /* ------------------------------------------------------------------ */
  {
    id: "smart-tags",
    title: "Smart tags",
    category: "advanced",
    summary:
      "Placeholders like {field.email} that insert live submission data into messages, redirects, and emails.",
    content: (
      <>
        <P>
          Smart tags are placeholders that are replaced with real data when a
          submission is made. They work in the <strong>success message</strong>,{" "}
          <strong>redirect URL</strong>, and <strong>email action</strong>{" "}
          (subject, body, CC/BCC/Reply-To).
        </P>
        <H3 id="reference">Tag reference</H3>
        <Table
          head={["Tag", "Replaced with"]}
          rows={[
            [<Code key="a">{"{field.KEY}"}</Code>, "The formatted value of the field with that key (arrays join with commas, booleans become yes/no)."],
            [<Code key="b">{"{field.KEY.label}"}</Code>, "The field's label."],
            [<Code key="c">{"{form.title}"}</Code>, "The form title."],
            [<Code key="d">{"{form.id}"}</Code>, "The form id."],
            [<Code key="e">{"{submission.id}"}</Code>, "The submission id."],
            [<Code key="f">{"{record_url}"}</Code>, "Link to view the submission record."],
            [<Code key="g">{"{receipt}"}</Code>, "Receipt number (when enabled), e.g. RES-1A2B3C4D."],
            [<Code key="h">{"{date}"}</Code>, "The current date and time."],
            [<Code key="i">{"{all_fields}"}</Code>, "Plain-text “Label: value” lines for every filled field."],
            [<Code key="j">{"{all_fields_html}"}</Code>, "The same as an HTML list."],
            [
              <Code key="k">{"{submission.context.KEY}"}</Code>,
              "Visitor context captured on submit (see table below).",
            ],
          ]}
        />
        <H3 id="context-tags">Submission context tags</H3>
        <P>
          Context is captured automatically on every new submission (see{" "}
          <ArtLink to="query-strings">URL query strings &amp; tracking</ArtLink>
          ). Keys are <strong>camelCase</strong>:
        </P>
        <Table
          head={["Tag", "Source"]}
          rows={[
            [<Code key="ip">{"{submission.context.ip}"}</Code>, "Client IP (server)."],
            [<Code key="ua">{"{submission.context.userAgent}"}</Code>, "Browser user-agent."],
            [<Code key="lang">{"{submission.context.language}"}</Code>, "Browser language."],
            [<Code key="ref">{"{submission.context.referrer}"}</Code>, "HTTP referrer."],
            [<Code key="src">{"{submission.context.sourcePage}"}</Code>, "Full page URL at submit."],
            [<Code key="scr">{"{submission.context.screen}"}</Code>, "Screen size, e.g. 1920x1080."],
            [<Code key="us">{"{submission.context.utmSource}"}</Code>, "utm_source query param."],
            [<Code key="um">{"{submission.context.utmMedium}"}</Code>, "utm_medium query param."],
            [<Code key="uc">{"{submission.context.utmCampaign}"}</Code>, "utm_campaign query param."],
            [<Code key="ut">{"{submission.context.utmTerm}"}</Code>, "utm_term query param."],
            [<Code key="uco">{"{submission.context.utmContent}"}</Code>, "utm_content query param."],
          ]}
        />
        <H3 id="if">Conditional blocks</H3>
        <P>
          Wrap content in <Code>{"{if …}…{/if}"}</Code> to include it only when
          a condition is true. Nested <Code>{"{if}"}</Code> blocks are not
          supported. Conditions:
        </P>
        <Ul>
          <Li>
            <Code>{"{if field.KEY}"}</Code> — true when the field has a value.
          </Li>
          <Li>
            <Code>{"{if field.KEY == value}"}</Code> /{" "}
            <Code>{"{if field.KEY != value}"}</Code> — string comparison
            (quotes around the value are optional).
          </Li>
          <Li>
            <Code>{"{if field.KEY contains value}"}</Code> — case-insensitive
            substring check.
          </Li>
        </Ul>
        <CodeBlock title="Success message">
          {`Thanks {field.first_name}!

Your order {receipt} has been received.
{record_url}`}
        </CodeBlock>
        <CodeBlock title="Email subject with a condition">
          {`{if field.urgent == "yes"}URGENT: {/if}New order from {field.first_name} {field.last_name}`}
        </CodeBlock>
        <CodeBlock title="Body with context + conditionals">
          {`<p>New lead from {submission.context.utmSource}</p>
{if field.plan == "pro"}<p>Pro plan selected.</p>{/if}
{if field.notes}<p>Notes: {field.notes}</p>{/if}`}
        </CodeBlock>
        <Note>
          Unknown tags render as empty text, and empty values are skipped in{" "}
          <Code>{"{all_fields}"}</Code>. Signatures and file uploads render as{" "}
          <Code>[signature]</Code> and <Code>[file]</Code>. There is no{" "}
          <Code>{"{field.x || fallback}"}</Code> syntax — use an{" "}
          <Code>{"{if}"}</Code> block instead.
        </Note>
      </>
    ),
  },

  {
    id: "regex",
    title: "Regex patterns",
    category: "advanced",
    summary:
      "How to write the pattern validator, with ready-to-use examples for common formats.",
    content: (
      <>
        <P>
          The <strong>Pattern (regex)</strong> validation option tests the value
          against a JavaScript regular expression. The pattern is matched with{" "}
          <Code>.test()</Code>, so use <Code>^</Code> and <Code>$</Code> anchors
          to require the whole value to match.
        </P>
        <H3 id="examples">Common patterns</H3>
        <Table
          head={["Use case", "Pattern"]}
          rows={[
            [
              "US ZIP (+4 optional)",
              <Code key="a">{"/^\\d{5}(-\\d{4})?$/"}</Code>,
            ],
            [
              "Simple email",
              <Code key="b">{"/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/"}</Code>,
            ],
            [
              "US phone",
              <Code key="c">{"/^\\+?1?\\s?\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}$/"}</Code>,
            ],
            [
              "SKU like ABC-12345",
              <Code key="d">{"/^[A-Z]{3}-\\d{5}$/"}</Code>,
            ],
            [
              "Plate code AAA123",
              <Code key="e">{"/^[A-Z]{3}\\d{3}$/"}</Code>,
            ],
            [
              "Date DD/MM/YYYY",
              <Code key="f">{"/^\\d{2}\\/\\d{2}\\/\\d{4}$/"}</Code>,
            ],
            [
              "Letters and spaces only",
              <Code key="g">{"/^[A-Za-z ]+$/"}</Code>,
            ],
            [
              "Alphanumeric 5–10 chars",
              <Code key="h">{"/^[A-Za-z0-9]{5,10}$/"}</Code>,
            ],
          ]}
        />
        <CodeBlock title="Example">
          {`Pattern:   /^[A-Z]{3}\d{3}$/
Message:   "Enter 3 letters followed by 3 digits, e.g. ABC123"

"ABC123"  → valid
"abc123"  → invalid (lowercase)
"ABC12"   → invalid (too short)`}
        </CodeBlock>
        <H3 id="tips">Tips</H3>
        <Ul>
          <Li>
            Escape literal special characters: a literal dot is{" "}
            <Code>\.</Code>, a literal dash inside a class is{" "}
            <Code>[-]</Code> or at the end.
          </Li>
          <Li>
            <Code>{"\\d"}</Code> is a digit, <Code>{"\\s"}</Code> whitespace,{" "}
            <Code>{"\\w"}</Code> a word character.
          </Li>
          <Li>
            An invalid pattern is silently ignored, so a typo won&apos;t block
            submissions — but it also won&apos;t validate.
          </Li>
        </Ul>
      </>
    ),
  },

  {
    id: "formulas",
    title: "Formula reference",
    category: "advanced",
    summary:
      "The complete formula syntax: field references, operators, comparisons, and built-in functions with examples.",
    content: (
      <>
        <P>
          Formulas are used by <strong>Math fields</strong>,{" "}
          <strong>Set value</strong> actions, and <strong>Custom rule</strong>{" "}
          validation. This is the complete syntax reference.
        </P>
        <H3 id="fields">Field references</H3>
        <P>
          Wrap a field key in square brackets: <Code>[unit_price]</Code>. Empty
          or non-numeric values evaluate as <Code>0</Code>. Date fields evaluate
          as day numbers so <Code>dateDiff</Code> works on them.
        </P>
        <H3 id="ops">Operators</H3>
        <Table
          head={["Operators", "Meaning"]}
          rows={[
            [
              <Code key="a">+ - * / % ^</Code>,
              "Add, subtract, multiply, divide, modulo, power.",
            ],
            [
              <Code key="b">- (unary)</Code>,
              "Negation: -[amount].",
            ],
            [
              <Code key="c">( )</Code>,
              "Grouping.",
            ],
            [
              <Code key="d">{"< > <= >= == !="}</Code>,
              "Comparisons; evaluate to 1 (true) or 0 (false).",
            ],
          ]}
        />
        <H3 id="fns">Functions</H3>
        <Table
          head={["Function", "Description", "Example"]}
          rows={[
            ["sum(a, b, …)", "Sum of arguments", "sum([a], [b], 5)"],
            ["avg(a, b, …)", "Average", "avg([a], [b], [c])"],
            ["min(a, b, …)", "Smallest", "min([a], [b])"],
            ["max(a, b, …)", "Largest", "max([a], [b])"],
            ["round(x, d)", "Round to d decimals", "round([total] * 1.1, 2)"],
            ["abs(x)", "Absolute value", "abs([diff])"],
            ["count(a, b, …)", "Counts non-zero args", "count([a], [b], [c])"],
            [
              "if(cond, a, b)",
              "a when cond ≠ 0, else b",
              "if([qty] > 10, [qty] * 0.9, [qty])",
            ],
            ["dateDiff(a, b)", "a − b in days", "dateDiff([end_date], [start_date])"],
          ]}
        />
        <CodeBlock title="Real-world examples">
          {`// Total with quantity discount
[quantity] * if([quantity] > 10, [unit_price] * 0.9, [unit_price])

// Time between two dates
dateDiff([end_date], [start_date])

// Fraction of a budget used, rounded
round([spent] / [budget] * 100, 0)

// Validation rule: quantity cannot exceed stock
[quantity] <= [stock]`}
        </CodeBlock>
        <Note>
          Invalid formulas render as empty; a custom-rule formula that evaluates
          to zero (or is invalid) fails validation.
        </Note>
      </>
    ),
  },

  {
    id: "custom-js",
    title: "Custom JavaScript",
    category: "advanced",
    summary:
      "The form API (getValue, setValue, values, fields) for page-load scripts and run-js logic actions, with examples.",
    content: (
      <>
        <P>
          You can run your own JavaScript in two places — the{" "}
          <strong>Custom JS on page load</strong> box (once, when the form
          loads) and <strong>Run custom JS</strong> logic actions (whenever a
          condition branch is active). Both receive the same{" "}
          <Code>form</Code> API:
        </P>
        <Table
          head={["Helper", "Description"]}
          rows={[
            [<Code key="a">form.getValue(key)</Code>, "Current value of a field ('' when unset)."],
            [<Code key="b">form.setValue(key, value)</Code>, "Set a field's value: string, number, boolean, or array."],
            [<Code key="c">form.values()</Code>, "All current values as an object."],
            [<Code key="d">form.fields</Code>, "Field definitions (key, label, type, options…)."],
          ]}
        />
        <H3 id="onload">Page-load examples</H3>
        <CodeBlock title="Prefill a hidden field">
          {`// Hidden "submitted_from" seeded from the page URL
form.setValue("submitted_from", window.location.href);`}
        </CodeBlock>
        <CodeBlock title="Read a URL param into a field">
          {`const value = new URLSearchParams(window.location.search).get("promo");
if (value) form.setValue("promo_code", value);`}
        </CodeBlock>
        <H3 id="run-js">Run-JS (conditional) examples</H3>
        <P>
          A condition with <em>Run custom JS</em> re-runs whenever its rules
          change, making it a good place for side effects:
        </P>
        <CodeBlock title="Enable a value when a checkbox is checked">
          {`if (form.getValue("terms") === true) {
  form.setValue("consent_date", new Date().toISOString().slice(0, 10));
}`}
        </CodeBlock>
        <CodeBlock title="Auto-join selected options">
          {`const names = form.fields
  .filter((f) => f.key === "team_members")
  .flatMap((f) => f.options ?? []);
form.setValue("team_summary", names.join(", "));`}
        </CodeBlock>
        <Warn>
          <Ul>
            <Li>
              Errors are caught and logged to the console — they never block
              the form, so test your script in the browser console.
            </Li>
            <Li>
              The script runs inside a sandboxed function that still has access
              to <Code>window</Code> and <Code>document</Code>, so you can use
              browser APIs.
            </Li>
            <Li>
              Use <Code>form.setValue</Code> rather than directly touching the
              DOM — the framework keeps values in its own state and DOM edits
              will be overwritten.
            </Li>
          </Ul>
        </Warn>
      </>
    ),
  },

  {
    id: "query-strings",
    title: "URL query strings & tracking",
    category: "advanced",
    summary:
      "Prefill fields via ?key=value, and capture UTM parameters and visitor context on every submission.",
    content: (
      <>
        <P>
          Query strings do three jobs for you:
        </P>
        <H3 id="prefill">1. Prefill fields</H3>
        <P>
          Any query parameter whose name matches a <em>field key</em> prefills
          that field and overrides its default value. Great for campaign links
          or pre-selecting choices.
        </P>
        <CodeBlock title="Prefill examples">
          {`/forms/abc?referrer=partner        → fills field "referrer"
/forms/abc?plan=pro               → selects option "pro" on a select/radio
/forms/abc?tags=a&tags=b           → not supported; use a single comma value?`}
        </CodeBlock>
        <P>
          Arrays aren&apos;t built from repeated parameters — for a multi-select
          prefill you&apos;d need a default value or page-load JS. The{" "}
          <Code>token</Code> parameter is reserved for self-edit links.
        </P>
        <H3 id="context">2. Capture submission context</H3>
        <P>
          Every new submission silently records <em>visitor context</em>. It
          appears in the <strong>Submission context</strong> panel on the
          record page and as{" "}
          <ArtLink to="smart-tags">smart tags</ArtLink> (
          <Code>{"{submission.context.*}"}</Code>).
        </P>
        <Table
          head={["Captured", "How"]}
          rows={[
            ["ip", "Server (request IP / X-Forwarded-For)."],
            ["userAgent", "Browser user-agent string."],
            ["language", "navigator.language."],
            ["referrer", "document.referrer."],
            ["sourcePage", "Full URL of the form page at submit."],
            ["screen", "Screen width×height."],
            [
              "utmSource / utmMedium / utmCampaign / utmTerm / utmContent",
              <>
                From URL params <Code>utm_source</Code>, <Code>utm_medium</Code>
                , <Code>utm_campaign</Code>, <Code>utm_term</Code>,{" "}
                <Code>utm_content</Code> (snake_case in the URL, camelCase in
                context / smart tags).
              </>,
            ],
          ]}
        />
        <CodeBlock title="A fully-tracked marketing link">
          {`https://forms.example.com/forms/abc?plan=pro&utm_source=newsletter&utm_medium=email&utm_campaign=spring22

# Prefills field "plan", and stores:
#   context.utmSource = "newsletter"
#   context.utmMedium = "email"
#   context.utmCampaign = "spring22"`}
        </CodeBlock>
        <Note>
          Context is captured on <strong>create</strong> only (not rewritten
          when a record is later edited). Empty values are omitted from the
          stored JSON.
        </Note>
        <H3 id="append">3. Append data on redirect</H3>
        <P>
          With the <ArtLink to="after-submit">Append response data to URL</ArtLink>{" "}
          setting on, the redirect URL carries the submitted values as query
          parameters — useful for third-party thank-you pages.
        </P>
      </>
    ),
  },

  /* ------------------------------------------------------------------ */
  /* Submissions                                                         */
  /* ------------------------------------------------------------------ */
  {
    id: "submissions",
    title: "The submissions table",
    category: "submissions",
    summary:
      "Search, filter, select, export, and manage every response to a form.",
    content: (
      <>
        <P>
          The submissions page (<Code>/forms/:id/submissions</Code>) is the
          command center for a form&apos;s responses.
        </P>
        <H3 id="stats">Analytics</H3>
        <P>
          A stats row shows <strong>total responses</strong>, responses in the{" "}
          <strong>last 7 days</strong>, <strong>average per day</strong>, and the{" "}
          <strong>top field fill rate</strong>.
        </P>
        <H3 id="table">The table</H3>
        <Ul>
          <Li>
            One column per visible field plus <em>Submitted at</em>. Arrays
            render comma-joined, signatures show a label, and file uploads get
            a <strong>Download</strong> button (auth-gated).
          </Li>
          <Li>
            The search box filters across the whole submission data.
          </Li>
          <Li>
            Per-field <strong>filters</strong> are generated automatically from
            the form&apos;s fields — the operator and input style come from each
            element&apos;s <ArtLink to="filters">Data table &amp; filters</ArtLink>{" "}
            settings, and placement from the{" "}
            <ArtLink to="submissions-table">form settings</ArtLink>.
          </Li>
        </Ul>
        <H3 id="actions">Row &amp; bulk actions</H3>
        <Ul>
          <Li>
            <strong>View</strong>, <strong>Edit</strong>, <strong>Delete</strong>{" "}
            (with confirmation), and <strong>Download PDF</strong> — positioned
            inline or in the row&apos;s ⋯ menu per the form settings.
          </Li>
          <Li>
            Checkboxes enable <strong>bulk actions</strong>:{" "}
            <strong>Export CSV</strong>, <strong>Export Excel</strong>, and{" "}
            <strong>Delete</strong> the selected rows. Select-all applies to the
            currently filtered rows.
          </Li>
        </Ul>
      </>
    ),
  },

  {
    id: "records",
    title: "Record view, edit & PDF",
    category: "submissions",
    summary:
      "Viewing a single response, editing it, downloading a PDF, and anonymous self-edit links.",
    content: (
      <>
        <P>
          Each response has its own record page, reachable from the submissions
          table.
        </P>
        <Setting name={<>View</>}>
          <Code>/forms/:id/records/:submissionId</Code> renders the full record,
          including the <em>Submission context</em> panel (IP, referrer, source
          page, UTM params, browser, screen…) and a{" "}
          <strong>Download PDF</strong> button. Context is also available to{" "}
          <ArtLink to="smart-tags">smart tags</ArtLink> as{" "}
          <Code>{"{submission.context.*}"}</Code> — see{" "}
          <ArtLink to="query-strings">URL query strings &amp; tracking</ArtLink>.
        </Setting>
        <Setting name={<>Edit</>}>
          <Code>/forms/:id/records/:submissionId/edit</Code> loads the saved
          values back into the form for correction. Requires edit access to the
          form.
        </Setting>
        <Setting name={<>PDF</>}>
          A server-generated A4 PDF with the form title, timestamps, and every
          label/value pair — signatures embedded as images, files listed by
          name. Also available per row on the submissions table, and as an{" "}
          <em>email attachment</em> in the email action.
        </Setting>
        <Setting name={<>Anonymous self-edit</>}>
          With the{" "}
          <ArtLink to="automation">Let submitters edit their response</ArtLink>{" "}
          setting on, the success panel links to the edit page with a one-time{" "}
          <Code>?token=…</Code>. Anyone with the link (without the token) can
          view; only the token holder can edit.
        </Setting>
      </>
    ),
  },

  /* ------------------------------------------------------------------ */
  /* Sharing & admin                                                     */
  /* ------------------------------------------------------------------ */
  {
    id: "sharing",
    title: "Sharing forms",
    category: "admin",
    summary:
      "Share a form with other users by assigning a per-form role that controls submission access.",
    content: (
      <>
        <P>
          Use the <strong>Access</strong> page (<Code>/forms/:id/access</Code>,
          owner or admin only) to share a form with other users by email. Each
          person is assigned one of the form&apos;s{" "}
          <ArtLink to="record-roles">record roles</ArtLink>.
        </P>
        <Table
          head={["Who", "Can do"]}
          rows={[
            [
              <strong key="shared">Shared user</strong>,
              "Whatever their assigned role allows for submissions (view, edit, and/or delete — optionally only when a condition matches).",
            ],
            [
              <strong key="o">Owner</strong>,
              "Full control: form structure, access list, and all submissions (bypasses role conditions).",
            ],
            [
              <strong key="a">Admin</strong>,
              "Same full record access as the owner on every form.",
            ],
          ]}
        />
        <Note>
          Form <strong>structure</strong> edits (the builder) always require the
          owner or an admin — shared users never edit the form definition, only
          submissions as their role allows.
        </Note>
        <Tip>
          Configure role capabilities under form settings →{" "}
          <strong>Record roles</strong>, then assign those roles on the Access
          page.
        </Tip>
      </>
    ),
  },

  {
    id: "record-roles",
    title: "Record roles & conditions",
    category: "admin",
    summary:
      "Per-form roles that gate submission view, edit, and delete — with optional conditions and per-field hide/lock lists.",
    content: (
      <>
        <P>
          Every form has <strong>record roles</strong> stored in its settings.
          When you share a form, you assign one of these roles to each person.
          Capabilities apply to <em>submissions</em> only — not to editing the
          form structure.
        </P>
        <H3 id="defaults">Default roles</H3>
        <P>
          New forms start with three built-in roles (you can change labels and
          capabilities; built-ins cannot be deleted):
        </P>
        <Table
          head={["Role", "View", "Edit", "Delete"]}
          rows={[
            [<strong key="v">Viewer</strong>, "always", "no", "no"],
            [<strong key="e">Editor</strong>, "always", "always", "no"],
            [<strong key="m">Manager</strong>, "always", "always", "always"],
          ]}
        />
        <P>
          Older shares that used View map to <strong>Viewer</strong>; Edit maps
          to <strong>Manager</strong> (edit + delete), matching previous
          behavior.
        </P>
        <H3 id="conditions">Optional conditions</H3>
        <P>
          For each enabled capability you can add <strong>Only when…</strong> —
          the same condition builder used for visibility and actions. The rule
          is evaluated against that submission&apos;s field values, plus:
        </P>
        <Ul>
          <Li>
            <Code>_user_email</Code> — the signed-in user&apos;s email
          </Li>
          <Li>
            <Code>_user_id</Code> — the signed-in user&apos;s id
          </Li>
        </Ul>
        <P>Examples (configure these yourself; nothing is hard-coded):</P>
        <Ul>
          <Li>
            Editor may edit only when <Code>status</Code> equals{" "}
            <Code>open</Code>
          </Li>
          <Li>
            Custom role may edit only when <Code>assigned_to</Code> equals{" "}
            <Code>_user_email</Code> (records assigned to them)
          </Li>
        </Ul>
        <H3 id="field-restrictions">Field restrictions</H3>
        <P>
          Each role can also list fields that the assignee{" "}
          <strong>cannot view</strong> or <strong>cannot edit</strong>:
        </P>
        <Ul>
          <Li>
            <strong>Cannot view</strong> — redacted from the record page,
            submissions table, CSV/Excel exports, and PDFs. The server never
            returns those values to that role.
          </Li>
          <Li>
            <strong>Cannot edit</strong> — still visible, but read-only on the
            edit form. On save, the server keeps the previous values for those
            keys (even if the client tries to change them).
          </Li>
        </Ul>
        <Note>
          Hidden fields are also treated as non-editable. Owners and global
          admins bypass field restrictions as well as capability conditions.
        </Note>
        <H3 id="audit">Audit log access</H3>
        <P>
          Each role includes <strong>Can view audit log</strong> (on by
          default). Anyone with form access who has this capability can open
          the form&apos;s audit page and the global Audit menu. Owners and
          admins always can.
        </P>
        <Tip>
          Record ACL is separate from{" "}
          <ArtLink to="conditions">Conditional logic</ArtLink> (show/hide
          fields while filling). They share the same condition primitives but
          answer different questions.
        </Tip>
      </>
    ),
  },

  {
    id: "audit",
    title: "Audit log",
    category: "admin",
    summary:
      "Track form saves, submission field edits, sharing changes, and form actions — with filters and per-role access.",
    content: (
      <>
        <P>
          The audit log records mutating activity on forms. Open the global{" "}
          <strong>Audit</strong> menu or a form&apos;s{" "}
          <strong>Audit</strong> link on the submissions page (
          <Code>/forms/:id/audit</Code>).
        </P>
        <H3 id="what">What is logged</H3>
        <Ul>
          <Li>Form create, update, delete, duplicate, import, template save</Li>
          <Li>
            Submission create, update (with per-field before/after values),
            delete
          </Li>
          <Li>Sharing grant / update / revoke</Li>
          <Li>Form actions that actually run (email, API, set field, …)</Li>
        </Ul>
        <P>
          Page views, CSV/PDF downloads, and submissions-table filter changes
          are <em>not</em> logged.
        </P>
        <H3 id="filters">Filters</H3>
        <P>
          Use the dropdowns for event type, actor, and date range (plus form on
          the global page). Expand a row for field-level diffs or other
          details. Hidden fields for your role are redacted from diffs.
        </P>
        <H3 id="access">Who can see it</H3>
        <P>
          Controlled by the role capability{" "}
          <ArtLink to="record-roles">Can view audit log</ArtLink>, which
          defaults to on for Viewer, Editor, and Manager. Owners and admins
          always have access.
        </P>
      </>
    ),
  },

  {
    id: "roles",
    title: "Users & roles",
    category: "admin",
    summary:
      "The three account roles — admin, editor, viewer — and the user management page.",
    content: (
      <>
        <P>
          Accounts have one of three <strong>global</strong> roles, set by an
          admin on the <strong>Users</strong> page (<Code>/admin/users</Code>).
          These are separate from{" "}
          <ArtLink to="record-roles">per-form record roles</ArtLink> used when
          sharing a form.
        </P>
        <Table
          head={["Role", "Permissions"]}
          rows={[
            [
              <strong key="a">Admin</strong>,
              "Everything. Can manage users, edit any form, and access all forms and submissions.",
            ],
            [
              <strong key="e">Editor</strong>,
              "Create and edit forms, view submissions, manage their own forms. Default role.",
            ],
            [
              <strong key="v">Viewer</strong>,
              "Can only view forms/submissions they are given access to; cannot create or edit forms.",
            ],
          ]}
        />
        <H3 id="manage">User management</H3>
        <Ul>
          <Li>
            <strong>Add user</strong> — email, password, name, and role.
          </Li>
          <Li>
            <strong>Edit</strong> a user&apos;s name or role;{" "}
            <strong>delete</strong> removes the account and cascades to their
            forms, submissions, and access rows.
          </Li>
          <Li>
            Admins cannot demote or delete <em>themselves</em> (prevents
            locking the workspace out of admin).
          </Li>
        </Ul>
        <P>
          The <em>User</em> form element draws its dropdown from this user list
          — the selected user&apos;s email is stored in the submission.
        </P>
      </>
    ),
  },
];

export const ARTICLE_INDEX = new Map(
  WIKI_ARTICLES.map((article) => [article.id, article]),
);

export function categoryLabel(categoryId: string): string {
  return (
    WIKI_CATEGORIES.find((category) => category.id === categoryId)?.label ??
    categoryId
  );
}
