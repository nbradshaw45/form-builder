import { type ReactNode, useState } from "react";
import { useAuth } from "wasp/client/auth";
import {
  getForm,
  getSubmission,
  getSubmissionByToken,
  getSubmissionPdf,
  submitForm,
  updateSubmission,
  updateSubmissionByToken,
  useQuery,
} from "wasp/client/operations";
import { Link } from "wasp/client/router";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { DynamicFormRenderer } from "../components/DynamicFormRenderer";
import { Button, ButtonLink } from "../shared/components/Button";
import { ArrowLeftIcon, DownloadIcon } from "../components/builder/icons";
import type { FormField, FormSettings, SubmissionData } from "../types";
import { DEFAULT_FORM_SETTINGS } from "../types";
import {
  renderSmartTags,
  type SmartTagContext,
} from "../shared/smartTags";
import {
  collectClientContext,
  CONTEXT_DISPLAY_KEYS,
  formatContextLabel,
  type SubmissionContext,
} from "../shared/submissionContext";

const DEFAULT_SUCCESS_MESSAGE = "Thank you! Your response has been submitted.";
const RECORD_SAVED_MESSAGE = "Record saved successfully.";

type RecordMode = "new" | "view" | "edit";

const EDIT_ACCESS = new Set(["owner", "admin", "edit"]);

export function FormPage() {
  const { id = "", submissionId } = useParams<{
    id: string;
    submissionId?: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? undefined;
  const isEditPath = location.pathname.endsWith("/edit");
  const recordMode: RecordMode = submissionId
    ? isEditPath
      ? "edit"
      : "view"
    : "new";

  const { data: form, isLoading } = useQuery(getForm, { id });
  const { data: user } = useAuth();
  const submissionArgs = token
    ? { submissionId: submissionId ?? "", token }
    : { submissionId: submissionId ?? "" };
  const {
    data: record,
    isLoading: recordLoading,
    error: recordError,
  } = useQuery(
    token ? getSubmissionByToken : getSubmission,
    submissionArgs as never,
    { enabled: Boolean(submissionId) },
  );

  const [submitted, setSubmitted] = useState(false);
  const [lastData, setLastData] = useState<SubmissionData | null>(null);
  const [lastSubmission, setLastSubmission] = useState<{
    id: string;
    editToken: string | null;
  } | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (isLoading || (recordMode !== "new" && recordLoading)) {
    return <p className="px-8 py-12">Loading form...</p>;
  }

  if (!form) {
    return (
      <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col items-center gap-4 px-8 py-12">
        <h1 className="font-display text-3xl font-bold tracking-[-0.028em] text-neutral-900">
          Form not found
        </h1>
        <p className="text-neutral-500">
          This form may have been deleted or the link is incorrect.
        </p>
        <ButtonLink to="/">Back to dashboard</ButtonLink>
      </div>
    );
  }

  if (recordMode !== "new" && recordError) {
    return (
      <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col items-center gap-4 px-8 py-12">
        <h1 className="font-display text-3xl font-bold tracking-[-0.028em] text-neutral-900">
          Record unavailable
        </h1>
        <p className="max-w-[60ch] text-center text-neutral-500">
          {String(recordError)}. Sign in with an account that has access to
          this form to view or edit the record.
        </p>
        <ButtonLink to="/forms" variant="ghost">
          Back to forms
        </ButtonLink>
      </div>
    );
  }

  const fields = Array.isArray(form.fields)
    ? (form.fields as unknown as FormField[])
    : [];
  const fieldRestrictions = record?.fieldRestrictions ?? {
    cannotView: [],
    cannotEdit: [],
  };
  const visibleFields =
    recordMode === "new"
      ? fields
      : fields.filter(
          (field) => !fieldRestrictions.cannotView.includes(field.key),
        );
  const readonlyFieldKeys =
    recordMode === "new" ? [] : fieldRestrictions.cannotEdit;
  const settings: FormSettings = {
    ...DEFAULT_FORM_SETTINGS,
    ...((form.settings as unknown as FormSettings | null) ?? {}),
  };
  const formId = form.id;
  const formTitle = form.title;
  const successMessage =
    settings.successMessage?.trim() ||
    (recordMode === "new" ? DEFAULT_SUCCESS_MESSAGE : RECORD_SAVED_MESSAGE);
  const isModal = settings.displayMode === "modal";
  const modalWidth = settings.modalWidth ?? 560;
  const modalHeight = settings.modalHeight ?? null;

  const recordData = (record?.submission.data as unknown as SubmissionData) ??
    undefined;
  const recordCanEdit = record
    ? record.permissions
      ? record.permissions.edit
      : EDIT_ACCESS.has(record.access)
    : true;
  const isReadOnly =
    recordMode === "view" || (recordMode === "edit" && !recordCanEdit);

  const fieldDefaults: SubmissionData = {};
  for (const field of fields) {
    if (field.defaultValue !== undefined) {
      fieldDefaults[field.key] = field.defaultValue;
    }
  }

  const queryPrefill: SubmissionData = {};
  const knownKeys = new Set(fields.map((field) => field.key));
  for (const [key, value] of searchParams.entries()) {
    if (key === "token" || !knownKeys.has(key)) {
      continue;
    }
    queryPrefill[key] = value;
  }

  const initialValues: SubmissionData | undefined =
    recordMode === "new"
      ? { ...fieldDefaults, ...queryPrefill }
      : { ...fieldDefaults, ...queryPrefill, ...(recordData ?? {}) };

  const now = new Date().getTime();
  const openTime = settings.openDate ? new Date(settings.openDate).getTime() : null;
  const closeTime = settings.closeDate ? new Date(settings.closeDate).getTime() : null;
  const isClosed =
    (openTime !== null && now < openTime) ||
    (closeTime !== null && now > closeTime);

  function buildReceipt(submissionId: string): string {
    return `RES-${submissionId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  }

  function smartTagContext(
    data: SubmissionData,
    submissionId?: string,
    submissionContext?: SubmissionContext | null,
  ): SmartTagContext {
    return {
      form: { id: formId, title: formTitle },
      fields,
      data,
      submissionId,
      recordUrl: submissionId
        ? `${window.location.origin}/forms/${formId}/records/${submissionId}`
        : undefined,
      receipt: submissionId ? buildReceipt(submissionId) : undefined,
      context: submissionContext ?? undefined,
    };
  }

  function buildRedirectUrl(data: SubmissionData, submissionId?: string): string {
    const customBase =
      settings.redirectTarget === "custom"
        ? settings.redirectUrl?.trim()
        : undefined;
    const base = customBase
      ? renderSmartTags(customBase, smartTagContext(data, submissionId))
      : `/forms/${formId}/submissions`;
    if (!base) {
      return `/forms/${formId}/submissions`;
    }
    if (settings.appendData !== true) {
      return base;
    }
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        continue;
      }
      if (Array.isArray(value)) {
        if (value.length > 0) {
          params.set(key, value.join(","));
        }
        continue;
      }
      if (value !== "") {
        params.set(key, String(value));
      }
    }
    const query = params.toString();
    if (!query) {
      return base;
    }
    return `${base}${base.includes("?") ? "&" : "?"}${query}`;
  }

  function redirectNow(data: SubmissionData, submissionId?: string) {
    window.location.assign(buildRedirectUrl(data, submissionId));
  }

  function goBack() {
    if (recordMode === "new") {
      navigate("/forms");
    } else {
      navigate(`/forms/${formId}/submissions`);
    }
  }

  async function downloadPdf() {
    if (!submissionId) {
      return;
    }
    setDownloadingPdf(true);
    try {
      const { filename, base64 } = await getSubmissionPdf({
        formId,
        submissionId,
      });
      const bytes = atob(base64);
      const array = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        array[i] = bytes.charCodeAt(i);
      }
      const blob = new Blob([array], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(`PDF download failed: ${String(err)}`);
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleSubmit(
    data: SubmissionData,
    submitterEmail?: string,
  ) {
    let savedSubmissionId: string | undefined = submissionId;
    if (recordMode === "edit" && submissionId) {
      if (token) {
        await updateSubmissionByToken({ submissionId, data, token });
      } else {
        await updateSubmission({ submissionId, data });
      }
    } else {
      const result = await submitForm({
        formId,
        data,
        submitterEmail,
        context: collectClientContext(),
      });
      savedSubmissionId = result.id;
      setLastSubmission({
        id: result.id,
        editToken: result.editToken ?? null,
      });
    }
    if (settings.successMode === "redirect") {
      redirectNow(data, savedSubmissionId);
      return;
    }
    setLastData(data);
    setSubmitted(true);
    if (settings.successMode === "both") {
      window.setTimeout(() => redirectNow(data, savedSubmissionId), 4000);
    }
  }

  const wantsRedirect =
    settings.successMode === "redirect" || settings.successMode === "both";

  const closedNotice =
    recordMode === "new" && isClosed ? (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        This form is currently closed and not accepting submissions.
      </div>
    ) : null;

  const backButton = settings.showBackButton !== false ? (
    <div className="flex w-full items-center justify-between">
      <Button variant="ghost" size="sm" onClick={goBack}>
        <ArrowLeftIcon className="size-3.5" />
        Back
      </Button>
    </div>
  ) : null;

  const heading = (
    <div className="flex w-full flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          Form
          {recordMode === "new"
            ? " · New record"
            : recordMode === "edit"
              ? " · Edit record"
              : " · Record"}
        </span>
        <h1 className="font-display text-[clamp(28px,3.2vw,36px)] font-bold leading-tight tracking-[-0.028em] text-neutral-900">
          {form.title}
        </h1>
        {form.description && (
          <p className="max-w-[60ch] text-sm leading-relaxed text-neutral-500">
            {form.description}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {recordMode === "new" && user && (
          <Link
            to="/forms/:id/submissions"
            params={{ id: formId }}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline"
          >
            View submissions
          </Link>
        )}
        {recordMode === "view" && !token && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void downloadPdf()}
            disabled={downloadingPdf}
          >
            <DownloadIcon className="size-3.5" />
            {downloadingPdf ? "Preparing PDF..." : "Download PDF"}
          </Button>
        )}
        {recordMode === "view" && recordCanEdit && (
          <ButtonLink
            to="/forms/:id/records/:submissionId/edit"
            params={{ id: formId, submissionId: submissionId ?? "" }}
            size="sm"
          >
            Edit record
          </ButtonLink>
        )}
        {recordMode === "edit" && (
          <ButtonLink
            to="/forms/:id/records/:submissionId"
            params={{ id: formId, submissionId: submissionId ?? "" }}
            size="sm"
            variant="ghost"
          >
            View record
          </ButtonLink>
        )}
        {recordMode !== "new" && (
          <ButtonLink
            to="/forms/:id/submissions"
            params={{ id: formId }}
            size="sm"
            variant="ghost"
          >
            All submissions
          </ButtonLink>
        )}
      </div>
    </div>
  );

  const formBody = submitted ? (
    <SuccessPanel
      message={renderSmartTags(
        successMessage,
        smartTagContext(lastData ?? {}, lastSubmission?.id),
      )}
      receipt={
        settings.enableReceipt === true && lastSubmission
          ? buildReceipt(lastSubmission.id)
          : null
      }
      selfEditHref={
        settings.allowSelfEdit === true && lastSubmission?.editToken
          ? `/forms/${formId}/records/${lastSubmission.id}/edit?token=${lastSubmission.editToken}`
          : null
      }
      actions={
        <>
          {recordMode === "new" && settings.successMode === "message" && (
            <Button variant="ghost" onClick={() => setSubmitted(false)}>
              Submit another response
            </Button>
          )}
          {recordMode === "edit" && (
            <ButtonLink
              to="/forms/:id/records/:submissionId"
              params={{ id: formId, submissionId: submissionId ?? "" }}
              variant="ghost"
            >
              View record
            </ButtonLink>
          )}
          {wantsRedirect && lastData && (
            <Button onClick={() => redirectNow(lastData, lastSubmission?.id)}>
              Continue
            </Button>
          )}
        </>
      }
    />
  ) : closedNotice ? (
    closedNotice
  ) : (
    <DynamicFormRenderer
      key={`${recordMode}-${submissionId ?? "new"}-${formId}`}
      fields={visibleFields}
      onSubmit={handleSubmit}
      submitLabel={recordMode === "edit" ? "Save changes" : "Submit"}
      hideSubmit={isReadOnly}
      readOnly={isReadOnly}
      readonlyFieldKeys={readonlyFieldKeys}
      showReset={settings.showResetButton}
      multiStep={settings.multiStep === true}
      honeypot={settings.honeypot === true}
      formId={formId}
      submitterName={user?.identities.username?.id ?? undefined}
      initialValues={initialValues}
      settings={settings}
      recordMode={recordMode === "new" ? "new" : "update"}
    />
  );

  const recordContext =
    record?.submission?.context &&
    typeof record.submission.context === "object"
      ? (record.submission.context as SubmissionContext)
      : null;

  const contextPanel =
    recordMode === "view" && recordContext ? (
      <SubmissionContextPanel context={recordContext} />
    ) : null;

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={form.title}
          className="flex w-full flex-col gap-6 overflow-y-auto rounded-[16px] border border-neutral-200 bg-white p-6 shadow-lg lg:p-8"
          style={{
            maxWidth: modalWidth,
            width: "100%",
            height: modalHeight ? `${modalHeight}px` : undefined,
            maxHeight: modalHeight ? undefined : "88vh",
          }}
        >
          {heading}
          {backButton}
          {isReadOnly && recordMode === "edit" && (
            <p className="rounded-lg border border-neutral-100 bg-muted px-4 py-3 text-[13px] text-neutral-600">
              You only have view access to this record.
            </p>
          )}
          {formBody}
          {contextPanel}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-12">
      {heading}
      <section className="card flex w-full flex-col gap-6 p-6 lg:p-8">
        {backButton}
        {isReadOnly && recordMode === "edit" && (
          <p className="rounded-lg border border-neutral-100 bg-muted px-4 py-3 text-[13px] text-neutral-600">
            You only have view access to this record.
          </p>
        )}
        {formBody}
        {contextPanel}
      </section>
    </div>
  );
}

function SubmissionContextPanel({ context }: { context: SubmissionContext }) {
  const entries = CONTEXT_DISPLAY_KEYS.map((key) => {
    const value = context[key];
    if (!value) {
      return null;
    }
    return (
      <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
        <dt className="min-w-[7.5rem] shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
          {formatContextLabel(key)}
        </dt>
        <dd className="break-all text-sm text-neutral-700">{value}</dd>
      </div>
    );
  }).filter(Boolean);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-neutral-100 pt-5">
      <h2 className="font-display text-sm font-bold tracking-[-0.02em] text-neutral-800">
        Submission context
      </h2>
      <dl className="flex flex-col gap-2.5">{entries}</dl>
    </div>
  );
}

function SuccessPanel({
  message,
  receipt,
  selfEditHref,
  actions,
}: {
  message: string;
  receipt?: string | null;
  selfEditHref?: string | null;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
        <svg
          className="size-6"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <p className="max-w-[45ch] text-[15px] font-medium text-neutral-800">
        {message}
      </p>
      {receipt && (
        <p className="text-xs text-neutral-500">
          Your receipt number is{" "}
          <span className="rounded bg-muted px-2 py-0.5 font-mono font-semibold text-neutral-700">
            {receipt}
          </span>
        </p>
      )}
      {actions && (
        <div className="flex flex-wrap justify-center gap-2">{actions}</div>
      )}
      {selfEditHref && (
        <a
          href={selfEditHref}
          className="text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline"
        >
          Edit this response
        </a>
      )}
    </div>
  );
}
