import { type ReactNode, useState } from "react";
import { useAuth } from "wasp/client/auth";
import {
  getForm,
  getSubmission,
  submitForm,
  updateSubmission,
  useQuery,
} from "wasp/client/operations";
import { Link } from "wasp/client/router";
import { useLocation, useParams } from "react-router";
import { DynamicFormRenderer } from "../components/DynamicFormRenderer";
import { Button, ButtonLink } from "../shared/components/Button";
import type { FormField, FormSettings, SubmissionData } from "../types";
import { DEFAULT_FORM_SETTINGS } from "../types";

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
  const isEditPath = location.pathname.endsWith("/edit");
  const recordMode: RecordMode = submissionId
    ? isEditPath
      ? "edit"
      : "view"
    : "new";

  const { data: form, isLoading } = useQuery(getForm, { id });
  const { data: user } = useAuth();
  const {
    data: record,
    isLoading: recordLoading,
    error: recordError,
  } = useQuery(
    getSubmission,
    { submissionId: submissionId ?? "" },
    { enabled: Boolean(submissionId) },
  );

  const [submitted, setSubmitted] = useState(false);
  const [lastData, setLastData] = useState<SubmissionData | null>(null);

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
  const settings: FormSettings = {
    ...DEFAULT_FORM_SETTINGS,
    ...((form.settings as unknown as FormSettings | null) ?? {}),
  };
  const formId = form.id;
  const successMessage =
    settings.successMessage?.trim() ||
    (recordMode === "new" ? DEFAULT_SUCCESS_MESSAGE : RECORD_SAVED_MESSAGE);
  const isModal = settings.displayMode === "modal";
  const modalWidth = settings.modalWidth ?? 560;
  const modalHeight = settings.modalHeight ?? null;

  const recordData = (record?.submission.data as unknown as SubmissionData) ??
    undefined;
  const canEdit = record ? EDIT_ACCESS.has(record.access) : true;
  const isReadOnly =
    recordMode === "view" || (recordMode === "edit" && !canEdit);

  function buildRedirectUrl(data: SubmissionData): string {
    const base =
      settings.redirectTarget === "custom"
        ? settings.redirectUrl?.trim()
        : `/forms/${formId}/submissions`;
    if (!base) {
      return `/forms/${formId}/submissions`;
    }
    if (settings.appendData !== true) {
      return base;
    }
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    }
    const query = params.toString();
    if (!query) {
      return base;
    }
    return `${base}${base.includes("?") ? "&" : "?"}${query}`;
  }

  function redirectNow(data: SubmissionData) {
    window.location.assign(buildRedirectUrl(data));
  }

  async function handleSubmit(
    data: SubmissionData,
    submitterEmail?: string,
  ) {
    if (recordMode === "edit" && submissionId) {
      await updateSubmission({ submissionId, data });
    } else {
      await submitForm({ formId, data, submitterEmail });
    }
    if (settings.successMode === "redirect") {
      redirectNow(data);
      return;
    }
    setLastData(data);
    setSubmitted(true);
    if (settings.successMode === "both") {
      window.setTimeout(() => redirectNow(data), 4000);
    }
  }

  const wantsRedirect =
    settings.successMode === "redirect" || settings.successMode === "both";

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
        {recordMode === "view" && canEdit && (
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
      message={successMessage}
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
            <Button onClick={() => redirectNow(lastData)}>Continue</Button>
          )}
        </>
      }
    />
  ) : (
    <DynamicFormRenderer
      key={`${recordMode}-${submissionId ?? "new"}-${formId}`}
      fields={fields}
      onSubmit={handleSubmit}
      submitLabel={recordMode === "edit" ? "Save changes" : "Submit"}
      hideSubmit={isReadOnly}
      readOnly={isReadOnly}
      submitterName={user?.identities.username?.id ?? undefined}
      initialValues={recordData}
    />
  );

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
          {isReadOnly && recordMode === "edit" && (
            <p className="rounded-lg border border-neutral-100 bg-muted px-4 py-3 text-[13px] text-neutral-600">
              You only have view access to this record.
            </p>
          )}
          {formBody}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-12">
      {heading}
      <section className="card flex w-full flex-col gap-6 p-6 lg:p-8">
        {isReadOnly && recordMode === "edit" && (
          <p className="rounded-lg border border-neutral-100 bg-muted px-4 py-3 text-[13px] text-neutral-600">
            You only have view access to this record.
          </p>
        )}
        {formBody}
      </section>
    </div>
  );
}

function SuccessPanel({
  message,
  actions,
}: {
  message: string;
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
      {actions && (
        <div className="flex flex-wrap justify-center gap-2">{actions}</div>
      )}
    </div>
  );
}
