import { Fragment, useMemo, useState } from "react";
import { Link } from "wasp/client/router";
import type { AuditEventRow, AuditEventsResult } from "../../queries";
import type { SubmissionFieldChange, FormDefinitionDiff } from "../audit";
import { inputClasses, selectClasses } from "../styles";
import { Button } from "./Button";
import { Card } from "./Card";

export type AuditFilterState = {
  formId: string;
  action: string;
  actor: string;
  from: string;
  to: string;
};

export const EMPTY_AUDIT_FILTERS: AuditFilterState = {
  formId: "",
  action: "",
  actor: "",
  from: "",
  to: "",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function ActorCell({ event }: { event: AuditEventRow }) {
  if (event.actorName || event.actorEmail) {
    return (
      <span className="text-sm text-neutral-700">
        {event.actorName ?? event.actorEmail}
        {event.actorName && event.actorEmail ? (
          <span className="block text-xs text-neutral-400">
            {event.actorEmail}
          </span>
        ) : null}
      </span>
    );
  }
  return <span className="text-sm text-neutral-400">Anonymous / system</span>;
}

function EventDetails({ event }: { event: AuditEventRow }) {
  const changes = event.changes;
  if (!changes || typeof changes !== "object") {
    return (
      <p className="text-sm text-neutral-500">No additional details.</p>
    );
  }

  const record = changes as {
    fields?: SubmissionFieldChange[];
    fieldsAdded?: string[];
    fieldsRemoved?: string[];
    fieldsModified?: string[];
    settingsChanged?: string[];
    title?: { from: string; to: string };
  };

  if (Array.isArray(record.fields) && record.fields.length > 0) {
    return (
      <ul className="flex flex-col gap-2">
        {record.fields.map((field) => (
          <li
            key={field.key}
            className="rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm"
          >
            <div className="font-medium text-neutral-800">
              {field.label}{" "}
              <span className="font-mono text-[10px] text-neutral-400">
                {field.key}
              </span>
            </div>
            <div className="mt-1 grid gap-1 text-xs text-neutral-600 sm:grid-cols-2">
              <div>
                <span className="font-semibold text-neutral-500">From: </span>
                {formatValue(field.from)}
              </div>
              <div>
                <span className="font-semibold text-neutral-500">To: </span>
                {formatValue(field.to)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const diff = record as FormDefinitionDiff;
  if (
    diff.title ||
    (diff.fieldsAdded && diff.fieldsAdded.length) ||
    (diff.fieldsRemoved && diff.fieldsRemoved.length) ||
    (diff.fieldsModified && diff.fieldsModified.length) ||
    (diff.settingsChanged && diff.settingsChanged.length)
  ) {
    return (
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-600">
        {diff.title && (
          <li>
            Title: {diff.title.from} → {diff.title.to}
          </li>
        )}
        {diff.fieldsAdded?.length ? (
          <li>Fields added: {diff.fieldsAdded.join(", ")}</li>
        ) : null}
        {diff.fieldsRemoved?.length ? (
          <li>Fields removed: {diff.fieldsRemoved.join(", ")}</li>
        ) : null}
        {diff.fieldsModified?.length ? (
          <li>Fields modified: {diff.fieldsModified.join(", ")}</li>
        ) : null}
        {diff.settingsChanged?.length ? (
          <li>Settings changed: {diff.settingsChanged.join(", ")}</li>
        ) : null}
      </ul>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-md bg-neutral-50 p-3 text-[11px] text-neutral-600">
      {JSON.stringify(changes, null, 2)}
    </pre>
  );
}

export function AuditLogPanel({
  data,
  isLoading,
  error,
  filters,
  onFiltersChange,
  showFormFilter,
  page,
  pageSize,
  onPageChange,
}: {
  data: AuditEventsResult | undefined;
  isLoading: boolean;
  error: unknown;
  filters: AuditFilterState;
  onFiltersChange: (next: AuditFilterState) => void;
  showFormFilter: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const forms = data?.forms ?? [];
  const actors = data?.actors ?? [];
  const actions = data?.actions ?? [];

  const events = useMemo(() => data?.events ?? [], [data?.events]);

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-sm text-danger">{String(error)}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div
          className={`grid gap-3 ${showFormFilter ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-4"}`}
        >
          {showFormFilter && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-600">
              Form
              <select
                className={selectClasses}
                value={filters.formId}
                onChange={(event) =>
                  onFiltersChange({ ...filters, formId: event.target.value })
                }
              >
                <option value="">All forms</option>
                {forms.map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-600">
            Event type
            <select
              className={selectClasses}
              value={filters.action}
              onChange={(event) =>
                onFiltersChange({ ...filters, action: event.target.value })
              }
            >
              <option value="">All events</option>
              {actions.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-600">
            Actor
            <select
              className={selectClasses}
              value={filters.actor}
              onChange={(event) =>
                onFiltersChange({ ...filters, actor: event.target.value })
              }
            >
              <option value="">Anyone</option>
              {actors.map((actor) => (
                <option key={actor.value} value={actor.value}>
                  {actor.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-600">
            From
            <input
              type="date"
              className={inputClasses}
              value={filters.from}
              onChange={(event) =>
                onFiltersChange({ ...filters, from: event.target.value })
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-600">
            To
            <input
              type="date"
              className={inputClasses}
              value={filters.to}
              onChange={(event) =>
                onFiltersChange({ ...filters, to: event.target.value })
              }
            />
          </label>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-neutral-500">Loading audit log…</p>
        ) : events.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">No audit events match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-neutral-100 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">When</th>
                  {showFormFilter && (
                    <th className="px-4 py-3 font-semibold">Form</th>
                  )}
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Summary</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {events.map((event) => {
                  const open = expandedId === event.id;
                  return (
                    <Fragment key={event.id}>
                      <tr className="align-top">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                          {new Date(event.createdAt).toLocaleString()}
                        </td>
                        {showFormFilter && (
                          <td className="px-4 py-3">
                            {event.formId ? (
                              <Link
                                to="/forms/:id/audit"
                                params={{ id: event.formId }}
                                className="font-medium text-primary-700 hover:underline"
                              >
                                {event.formTitle ?? "Form"}
                              </Link>
                            ) : (
                              <span className="text-neutral-500">
                                {event.formTitle ?? "Deleted form"}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                            {event.actionLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ActorCell event={event} />
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {event.summary}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setExpandedId(open ? null : event.id)
                            }
                          >
                            {open ? "Hide" : "Details"}
                          </Button>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td
                            colSpan={showFormFilter ? 6 : 5}
                            className="bg-neutral-50/80 px-4 py-4"
                          >
                            <EventDetails event={event} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > pageSize && (
          <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3">
            <span className="text-xs text-neutral-500">
              {total} event{total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={page <= 0}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </Button>
              <span className="self-center text-xs text-neutral-500">
                Page {page + 1} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page + 1 >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
