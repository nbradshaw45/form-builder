import { useState } from "react";
import { useAuth } from "wasp/client/auth";
import { getForm, submitForm, useQuery } from "wasp/client/operations";
import { Link } from "wasp/client/router";
import { useParams } from "react-router";
import { DynamicFormRenderer } from "../components/DynamicFormRenderer";
import { ButtonLink } from "../shared/components/Button";
import type { FormField, SubmissionData } from "../types";

export function FormPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { data: form, isLoading } = useQuery(getForm, { id });
  const { data: user } = useAuth();
  const [submittedCount, setSubmittedCount] = useState(0);

  if (isLoading) {
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

  const fields = Array.isArray(form.fields)
    ? (form.fields as unknown as FormField[])
    : [];
  const formId = form.id;

  async function handleSubmit(
    data: SubmissionData,
    submitterEmail?: string,
  ) {
    await submitForm({ formId, data, submitterEmail });
    setSubmittedCount((count) => count + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col items-center gap-8 px-8 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-2 text-center">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          Form
        </span>
        <h1 className="font-display text-[clamp(28px,3.2vw,36px)] font-bold leading-tight tracking-[-0.028em] text-neutral-900">
          {form.title}
        </h1>
        {form.description && (
          <p className="text-sm leading-relaxed text-neutral-500">
            {form.description}
          </p>
        )}
        {user && (
          <p className="text-sm">
            <Link
              to="/forms/:id/submissions"
              params={{ id: formId }}
              className="font-semibold text-primary-600 hover:text-primary-700 hover:underline"
            >
              View submissions
            </Link>
          </p>
        )}
      </div>

      <section className="card flex w-full max-w-2xl flex-col gap-6 p-6 lg:p-8">
        {submittedCount > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
            Response submitted successfully. You can submit another response
            below.
          </div>
        )}
        <DynamicFormRenderer
          key={submittedCount}
          fields={fields}
          onSubmit={handleSubmit}
          submitterName={user?.identities.username?.id ?? undefined}
        />
      </section>
    </div>
  );
}
