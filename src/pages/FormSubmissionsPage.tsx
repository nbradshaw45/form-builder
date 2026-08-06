import { useMemo, useState } from "react";
import type { AuthUser } from "wasp/auth";
import type { Submission } from "wasp/entities";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  deleteSubmission,
  getFile,
  getForm,
  getFormSubmissions,
  getSubmissionsCsv,
  useQuery,
} from "wasp/client/operations";
import { useParams } from "react-router";
import { Button, ButtonLink } from "../shared/components/Button";
import { Card, CardHead, DataFoot, DataToolbar } from "../shared/components/Card";
import { ConfirmDialog } from "../components/Modal";
import { EyeIcon, PencilIcon, PlusIcon, ShareIcon, TrashIcon } from "../components/builder/icons";
import type { FormField } from "../types";

const columnHelper = createColumnHelper<Submission>();

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatCellValue(key: string, value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.length > 200
  ) {
    return "Signature";
  }
  if (
    (key === "created_date" || key === "modified_date") &&
    typeof value === "string" &&
    value !== ""
  ) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString();
    }
  }
  return formatValue(value);
}

export function FormSubmissionsPage({ user }: { user: AuthUser }) {
  const { id = "" } = useParams<{ id: string }>();
  const { data: form } = useQuery(getForm, { id });
  const { data: submissionsData, isLoading, error } = useQuery(
    getFormSubmissions,
    { formId: id },
  );

  const submissions = submissionsData?.submissions;
  const access = submissionsData?.access ?? "view";

  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const canEdit = access === "owner" || access === "admin" || access === "edit";
  const canManage = access === "owner" || access === "admin";

  const filteredSubmissions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query || !submissions) {
      return submissions ?? [];
    }
    return submissions.filter((submission) =>
      JSON.stringify(submission.data).toLowerCase().includes(query),
    );
  }, [submissions, search]);

  const fields = useMemo<FormField[]>(
    () =>
      Array.isArray(form?.fields)
        ? (form.fields as unknown as FormField[])
        : [],
    [form],
  );

  const stats = useMemo(() => {
    if (!submissions || submissions.length === 0) {
      return null;
    }
    const total = submissions.length;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = submissions.filter(
      (submission) => new Date(submission.createdAt) >= weekAgo,
    ).length;
    const firstTime = Math.min(
      ...submissions.map((submission) =>
        new Date(submission.createdAt).getTime(),
      ),
    );
    const days = Math.max(1, Math.round((now.getTime() - firstTime) / 86400000) + 1);
    const avgPerDay = total / days;
    const dataKeys = fields
      .filter((field) => field.showInTable !== false)
      .map((field) => field.key);
    const completion = dataKeys.map((key) => {
      const label = fields.find((field) => field.key === key)?.label ?? key;
      const filled = submissions.filter((submission) => {
        const value = (submission.data as Record<string, unknown>)[key];
        return (
          value !== null &&
          value !== undefined &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0)
        );
      }).length;
      return { label, rate: Math.round((filled / total) * 100) };
    });
    return {
      total,
      thisWeek,
      avgPerDay: avgPerDay.toFixed(1),
      completion,
    };
  }, [submissions, fields]);

  async function exportCsv() {
    setExporting(true);
    try {
      const { fileName, content } = await getSubmissionsCsv({ formId: id });
      const blob = new Blob([content], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(`Export failed: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo(() => {
    const INPUT_TYPES = new Set([
      "text",
      "number",
      "select",
      "textarea",
      "checkbox",
      "date",
      "created_date",
      "modified_date",
      "updated_by_user",
    ]);

    const dataFieldKeys = fields
      .filter(
        (field) =>
          INPUT_TYPES.has(field.type) && field.showInTable !== false,
      )
      .map((field) => field.key);

    const allKeys: string[] = [];
    for (const key of dataFieldKeys) {
      if (!allKeys.includes(key)) {
        allKeys.push(key);
      }
    }
    for (const submission of submissions ?? []) {
      const data = submission.data as Record<string, unknown>;
      for (const key of Object.keys(data)) {
        if (!allKeys.includes(key)) {
          allKeys.push(key);
        }
      }
    }

    const keyToLabel = new Map(fields.map((field) => [field.key, field.label]));
    const keyToType = new Map(fields.map((field) => [field.key, field.type]));

    return [
      ...allKeys.map((key) =>
        columnHelper.accessor(
          (row) => (row.data as Record<string, unknown>)[key],
          {
            id: key,
            header: keyToLabel.get(key) ?? key,
            cell: (info) => {
              const value = info.getValue();
              if (keyToType.get(key) === "file_upload") {
                const fileId = typeof value === "string" ? value : "";
                return fileId ? <FileCell fileId={fileId} /> : "—";
              }
              return formatCellValue(key, value);
            },
          },
        ),
      ),
      columnHelper.accessor((row) => row.createdAt, {
        id: "createdAt",
        header: "Submitted at",
        cell: (info) => (
          <span className="whitespace-nowrap text-xs text-neutral-500">
            {new Date(info.getValue()).toLocaleString()}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => (
          <RowActions
            formId={id}
            submissionId={info.row.original.id}
            canEdit={canEdit}
            onDelete={() => setDeleteTarget(info.row.original)}
          />
        ),
      }),
    ];
  }, [fields, submissions, canEdit, id]);

  const table = useReactTable({
    data: filteredSubmissions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return <p className="px-8 py-12">Loading submissions...</p>;
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col items-center gap-4 px-8 py-12">
        <h1 className="font-display text-3xl font-bold tracking-[-0.028em] text-neutral-900">
          Can&apos;t load submissions
        </h1>
        <p className="text-neutral-500">
          {String(error)}. This form may belong to another account.
        </p>
        <ButtonLink to="/forms">Back to forms</ButtonLink>
      </div>
    );
  }

  const count = submissions?.length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col gap-6 px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            Submissions
          </span>
          <h1 className="font-display text-[clamp(28px,3.2vw,36px)] font-bold leading-tight tracking-[-0.028em] text-neutral-900">
            {form ? form.title : "Form"} submissions
          </h1>
          <p className="max-w-[60ch] text-sm leading-relaxed text-neutral-500">
            {count} {count === 1 ? "response" : "responses"} for{" "}
            <span className="font-semibold">
              {user.identities.username?.id ?? "user"}
            </span>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink to="/forms/:id" params={{ id }} size="sm">
            <PlusIcon className="size-3.5" />
            New Record
          </ButtonLink>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void exportCsv()}
            disabled={exporting || count === 0}
          >
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
          {canManage && (
            <ButtonLink to="/forms/:id/access" params={{ id }} variant="ghost">
              <ShareIcon className="size-3.5" />
              Access
            </ButtonLink>
          )}
          <ButtonLink to="/forms/:id" params={{ id }} variant="ghost">
            Back to form
          </ButtonLink>
        </div>
      </div>

      {stats && (
        <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total responses" value={String(stats.total)} />
          <StatCard label="This week" value={String(stats.thisWeek)} />
          <StatCard label="Avg / day" value={stats.avgPerDay} />
          <StatCard
            label="Top field fill rate"
            value={
              stats.completion.length > 0
                ? `${Math.max(...stats.completion.map((item) => item.rate))}%`
                : "—"
            }
          />
        </div>
      )}

      <Card className="w-full">
        <div className="p-6 pb-0">
          <CardHead
            eyebrow="Data grid"
            title="Responses"
            action={
              <span className="text-xs text-neutral-500">
                {count} {count === 1 ? "row" : "rows"}
              </span>
            }
          />
        </div>

        {count === 0 ? (
          <p className="p-6 text-neutral-500">
            No submissions yet. Share the form link to start collecting
            responses.
          </p>
        ) : (
          <>
            <div className="px-6 pt-5">
              <DataToolbar
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search responses..."
                right={
                  <span className="text-xs text-neutral-500">
                    {filteredSubmissions.length} of {count} shown
                  </span>
                }
              />
            </div>
            <div className="overflow-x-auto px-2 pb-2">
              <table className="w-full border-collapse">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="table-head">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="p-8 text-center text-[13px] text-neutral-500"
                      >
                        No responses match your search.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="transition-colors duration-150 hover:bg-neutral-50"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="table-cell">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <DataFoot
              left={`Showing ${filteredSubmissions.length} of ${count}`}
            />
          </>
        )}
      </Card>

      {deleteTarget && (
        <DeleteSubmissionDialog
          submission={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function RowActions({
  formId,
  submissionId,
  canEdit,
  onDelete,
}: {
  formId: string;
  submissionId: string;
  canEdit: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <ButtonLink
        to="/forms/:id/records/:submissionId"
        params={{ id: formId, submissionId }}
        size="xs"
        variant="ghost"
      >
        <EyeIcon className="size-3.5" />
        View
      </ButtonLink>
      {canEdit && (
        <ButtonLink
          to="/forms/:id/records/:submissionId/edit"
          params={{ id: formId, submissionId }}
          size="xs"
          variant="ghost"
        >
          <PencilIcon className="size-3.5" />
          Edit
        </ButtonLink>
      )}
      {canEdit && (
        <Button
          size="xs"
          variant="ghost"
          className="text-danger hover:border-danger hover:bg-danger-soft hover:text-danger"
          onClick={onDelete}
        >
          <TrashIcon className="size-3.5" />
          Delete
        </Button>
      )}
    </div>
  );
}

function DeleteSubmissionDialog({
  submission,
  onCancel,
}: {
  submission: Submission;
  onCancel: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirmDelete() {
    setIsDeleting(true);
    try {
      await deleteSubmission({ submissionId: submission.id });
      onCancel();
    } catch (err) {
      window.alert(`Error while deleting submission: ${String(err)}`);
      onCancel();
    }
  }

  return (
    <ConfirmDialog
      title="Delete submission"
      message="Are you sure you want to permanently delete this submission?"
      isLoading={isDeleting}
      onConfirm={confirmDelete}
      onCancel={onCancel}
    />
  );
}

function FileCell({ fileId }: { fileId: string }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const file = await getFile({ fileId });
      const bytes = atob(file.dataBase64);
      const array = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        array[i] = bytes.charCodeAt(i);
      }
      const blob = new Blob([array], { type: file.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.originalName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(String(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => void download()}
        disabled={downloading}
        className="inline-flex w-fit items-center gap-1.5 rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-primary-600 hover:border-primary-300 hover:bg-primary-50 disabled:opacity-60"
      >
        <DownloadIcon className="size-3.5" />
        {downloading ? "Downloading..." : "Download"}
      </button>
      {error && <span className="mt-1 text-[11px] text-red-500">{error}</span>}
    </div>
  );
}

function DownloadIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
    </svg>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </span>
      <span className="font-display text-2xl font-bold tracking-[-0.02em] text-neutral-900">
        {value}
      </span>
    </div>
  );
}
