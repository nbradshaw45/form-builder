import { useState } from "react";
import type { AuthUser } from "wasp/auth";
import { getAuditEvents, useQuery } from "wasp/client/operations";
import {
  AuditLogPanel,
  EMPTY_AUDIT_FILTERS,
  type AuditFilterState,
} from "../shared/components/AuditLogPanel";
import { pageShellClasses } from "../shared/styles";

const PAGE_SIZE = 50;

export function AuditPage({ user: _user }: { user: AuthUser }) {
  const [filters, setFilters] = useState<AuditFilterState>(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(0);

  const queryArgs = {
    formId: filters.formId || undefined,
    action: filters.action || undefined,
    actor: filters.actor || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
  };

  const { data, isLoading, error } = useQuery(getAuditEvents, queryArgs);

  return (
    <div className={pageShellClasses}>
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          Activity
        </span>
        <h1 className="font-display text-[clamp(28px,3.2vw,36px)] font-bold leading-tight tracking-[-0.028em] text-neutral-900">
          Audit log
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-neutral-500">
          Creates, edits, deletes, sharing changes, and form actions across
          forms you can audit. Use the filters to narrow the table.
        </p>
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
        showFormFilter
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}
