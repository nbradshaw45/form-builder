import { useState } from "react";
import type { AuthUser } from "wasp/auth";
import {
  getForm,
  getFormAuditEvents,
  useQuery,
} from "wasp/client/operations";
import { useParams } from "react-router";
import { ButtonLink } from "../shared/components/Button";
import {
  AuditLogPanel,
  EMPTY_AUDIT_FILTERS,
  type AuditFilterState,
} from "../shared/components/AuditLogPanel";

const PAGE_SIZE = 50;

export function FormAuditPage({ user: _user }: { user: AuthUser }) {
  const { id = "" } = useParams<{ id: string }>();
  const [filters, setFilters] = useState<AuditFilterState>(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(0);

  const { data: form } = useQuery(getForm, { id });
  const queryArgs = {
    formId: id,
    action: filters.action || undefined,
    actor: filters.actor || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
  };
  const { data, isLoading, error } = useQuery(getFormAuditEvents, queryArgs, {
    enabled: Boolean(id),
  });

  return (
    <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col gap-6 px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            Form activity
          </span>
          <h1 className="font-display text-[clamp(28px,3.2vw,36px)] font-bold leading-tight tracking-[-0.028em] text-neutral-900">
            {form?.title ?? "Form"} audit
          </h1>
          <p className="max-w-[60ch] text-sm leading-relaxed text-neutral-500">
            Submission field changes, form saves, sharing, and automated
            actions for this form.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink
            to="/forms/:id/submissions"
            params={{ id }}
            variant="ghost"
          >
            Submissions
          </ButtonLink>
          <ButtonLink to="/audit" variant="ghost">
            All audit
          </ButtonLink>
        </div>
      </div>

      <AuditLogPanel
        data={data}
        isLoading={isLoading}
        error={error}
        filters={filters}
        onFiltersChange={(next) => {
          setFilters(next);
          setPage(0);
        }}
        showFormFilter={false}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}
