import { useEffect, useMemo, useRef, useState } from "react";
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
  deleteSubmissions,
  getFile,
  getForm,
  getFormSubmissions,
  getSubmissionsCsv,
  getSubmissionsExcel,
  getSubmissionPdf,
  useQuery,
} from "wasp/client/operations";
import { useParams } from "react-router";
import { Link } from "wasp/client/router";
import { Button, ButtonLink } from "../shared/components/Button";
import { Card, CardHead, DataFoot, DataToolbar } from "../shared/components/Card";
import { ConfirmDialog } from "../components/Modal";
import { inputClasses } from "../shared/styles";
import { EllipsisIcon, EyeIcon, PencilIcon, PlusIcon, ShareIcon, TrashIcon } from "../components/builder/icons";
import {
  filterInputForField,
  filterOperatorsForType,
  isFilterActive,
  matchesFilter,
  operatorForField,
} from "../shared/filters";
import type {
  FormField,
  FormSettings,
  SubmissionRowAction,
  SubmissionRowActionPlacement,
} from "../types";
import { DEFAULT_FORM_SETTINGS, rowActionPlacement } from "../types";

type FilterEntry = { value: string; value2: string };

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
  const { data: submissionsData, isLoading, error, refetch } = useQuery(
    getFormSubmissions,
    { formId: id },
  );

  const submissions = submissionsData?.submissions;
  const access = submissionsData?.access ?? "view";

  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<Record<string, FilterEntry>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const canEdit = access === "owner" || access === "admin" || access === "edit";
  const canManage = access === "owner" || access === "admin";

  const fields = useMemo<FormField[]>(
    () =>
      Array.isArray(form?.fields)
        ? (form.fields as unknown as FormField[])
        : [],
    [form],
  );

  const settings = useMemo<FormSettings>(
    () => ({
      ...DEFAULT_FORM_SETTINGS,
      ...((form?.settings as unknown as FormSettings | null) ?? {}),
    }),
    [form],
  );
  const headerMode = settings.filterPlacement === "header";
  const filterColumns = settings.filterColumns ?? 3;
  const showActionLabels = settings.showActionLabels === true;
  const rowActions = useMemo<
    Record<SubmissionRowAction, SubmissionRowActionPlacement>
  >(
    () => ({
      view: rowActionPlacement(settings.submissionRowActions?.view, "view"),
      edit: rowActionPlacement(settings.submissionRowActions?.edit, "edit"),
      delete: rowActionPlacement(
        settings.submissionRowActions?.delete,
        "delete",
      ),
      pdf: rowActionPlacement(settings.submissionRowActions?.pdf, "pdf"),
    }),
    [settings],
  );

  const FILTERABLE_TYPES = new Set([
    "text",
    "textarea",
    "number",
    "select",
    "checkbox",
    "date",
    "time",
    "email",
    "url",
    "phone",
    "radio",
    "multi_select",
    "rating",
    "slider",
    "currency",
    "signature",
    "file_upload",
    "user",
    "created_date",
    "modified_date",
    "updated_by_user",
  ]);

  const filterableFields = useMemo<FormField[]>(
    () =>
      fields.filter(
        (field) =>
          field.filterable !== false && FILTERABLE_TYPES.has(field.type),
      ),
    [fields],
  );

  const distinctValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!submissions) {
      return map;
    }
    for (const field of filterableFields) {
      const values = new Set<string>();
      for (const submission of submissions) {
        const value = (submission.data as Record<string, unknown>)[field.key];
        if (value === null || value === undefined || value === "") {
          continue;
        }
        values.add(Array.isArray(value) ? value.join(", ") : String(value));
      }
      if (values.size > 0) {
        map[field.key] = [...values].sort();
      }
    }
    return map;
  }, [submissions, filterableFields]);

  const filteredSubmissions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (submissions ?? []).filter((submission) => {
      if (
        query &&
        !JSON.stringify(submission.data).toLowerCase().includes(query)
      ) {
        return false;
      }
      const data = submission.data as Record<string, unknown>;
      for (const [key, entry] of Object.entries(filters)) {
        const field = fields.find((item) => item.key === key);
        if (!field || !isFilterActive(field, entry)) {
          continue;
        }
        const operator =
          field.type === "file_upload"
            ? entry.value === "no_file"
              ? "no_file"
              : "has_file"
            : operatorForField(field);
        if (
          !matchesFilter(data, {
            key,
            operator,
            value: entry.value,
            value2: entry.value2,
          })
        ) {
          return false;
        }
      }
      return true;
    });
  }, [submissions, search, filters, fields]);

  function updateFilter(key: string, entry: FilterEntry | undefined) {
    setFilters((prev) => {
      const next = { ...prev };
      if (entry && (entry.value !== "" || entry.value2 !== "")) {
        next[key] = entry;
      } else {
        delete next[key];
      }
      return next;
    });
  }

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

  async function exportCsv(ids?: string[]) {
    setExporting(true);
    try {
      const { fileName, content } = await getSubmissionsCsv({
        formId: id,
        submissionIds: ids,
      });
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

  async function exportExcel(ids?: string[]) {
    setExporting(true);
    try {
      const { fileName, dataBase64 } = await getSubmissionsExcel({
        formId: id,
        submissionIds: ids,
      });
      const bytes = atob(dataBase64);
      const array = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        array[i] = bytes.charCodeAt(i);
      }
      const blob = new Blob([array], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === filteredSubmissions.length && filteredSubmissions.length > 0) {
        return new Set();
      }
      return new Set(filteredSubmissions.map((submission) => submission.id));
    });
  }

  async function confirmBulkDelete() {
    setDeleting(true);
    try {
      await deleteSubmissions({ submissionIds: [...selected] });
      setSelected(new Set());
      setBulkDeleteOpen(false);
      await refetch();
    } catch (err) {
      window.alert(`Error while deleting submissions: ${String(err)}`);
    } finally {
      setDeleting(false);
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
    const keyToField = new Map(fields.map((field) => [field.key, field]));
    const filterableKeySet = new Set(
      filterableFields.map((field) => field.key),
    );

    return [
      columnHelper.display({
        id: "row-select",
        header: () => (
          <input
            type="checkbox"
            aria-label="Select all"
            checked={
              filteredSubmissions.length > 0 &&
              filteredSubmissions.every((submission) =>
                selected.has(submission.id),
              )
            }
            onChange={toggleAll}
            className="size-4 rounded border-neutral-300 accent-primary-600"
          />
        ),
        cell: (info) => (
          <input
            type="checkbox"
            aria-label="Select row"
            checked={selected.has(info.row.original.id)}
            onChange={() => toggleSelected(info.row.original.id)}
            className="size-4 rounded border-neutral-300 accent-primary-600"
          />
        ),
      }),
      ...allKeys.map((key) =>
        columnHelper.accessor(
          (row) => (row.data as Record<string, unknown>)[key],
          {
            id: key,
            header: () => {
              const field = keyToField.get(key);
              const label = keyToLabel.get(key) ?? key;
              if (!headerMode || !field || !filterableKeySet.has(key)) {
                return <span>{label}</span>;
              }
              return (
                <div className="flex min-w-40 flex-col gap-1.5">
                  <span>{label}</span>
                  <HeaderFilter
                    field={field}
                    filter={filters[key]}
                    distinctValues={distinctValues[key] ?? []}
                    onChange={(next) => updateFilter(key, next)}
                  />
                </div>
              );
            },
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
            showLabels={showActionLabels}
            actions={rowActions}
            onDelete={() => setDeleteTarget(info.row.original)}
          />
        ),
      }),
    ];
  }, [fields, submissions, canEdit, id, selected, filteredSubmissions, toggleAll, toggleSelected, headerMode, showActionLabels, rowActions, filters, distinctValues, filterableFields, updateFilter]);

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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void exportExcel()}
            disabled={exporting || count === 0}
          >
            {exporting ? "Exporting..." : "Export Excel"}
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

        {selected.size > 0 && (
          <div className="mx-6 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2.5">
            <span className="text-sm font-medium text-primary-800">
              {selected.size} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={exporting}
                onClick={() => void exportCsv([...selected])}
              >
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={exporting}
                onClick={() => void exportExcel([...selected])}
              >
                Export Excel
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setBulkDeleteOpen(true)}
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {!headerMode && filterableFields.length > 0 && (
          <div className="px-6 pt-4">
            <TopFilterGrid
              filterableFields={filterableFields}
              filters={filters}
              distinctValues={distinctValues}
              columns={filterColumns}
              onFilterChange={updateFilter}
            />
          </div>
        )}

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

      {bulkDeleteOpen && (
        <ConfirmDialog
          title={`Delete ${selected.size} submission${selected.size === 1 ? "" : "s"}?`}
          message="Selected submissions will be permanently deleted."
          isLoading={deleting}
          onConfirm={() => void confirmBulkDelete()}
          onCancel={() => setBulkDeleteOpen(false)}
        />
      )}
    </div>
  );
}

function RowActions({
  formId,
  submissionId,
  canEdit,
  showLabels,
  actions,
  onDelete,
}: {
  formId: string;
  submissionId: string;
  canEdit: boolean;
  showLabels: boolean;
  actions: Record<SubmissionRowAction, SubmissionRowActionPlacement>;
  onDelete: () => void;
}) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  async function downloadPdf() {
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

  // Edit and Delete additionally require edit access to the form.
  const effective: Record<SubmissionRowAction, SubmissionRowActionPlacement> =
    {
      view: actions.view,
      edit: canEdit ? actions.edit : "hidden",
      delete: canEdit ? actions.delete : "hidden",
      pdf: actions.pdf,
    };

  const ACTION_ORDER: SubmissionRowAction[] = ["view", "edit", "delete", "pdf"];
  const inlineActions = ACTION_ORDER.filter(
    (action) => effective[action] === "inline",
  );
  const menuActions = ACTION_ORDER.filter(
    (action) => effective[action] === "dropdown",
  );

  if (inlineActions.length === 0 && menuActions.length === 0) {
    return <span className="text-neutral-300">—</span>;
  }

  const menuItemClasses =
    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60";

  function renderInline(action: SubmissionRowAction) {
    switch (action) {
      case "view":
        return (
          <ButtonLink
            key={action}
            to="/forms/:id/records/:submissionId"
            params={{ id: formId, submissionId }}
            size="xs"
            variant="ghost"
            title="View"
            aria-label="View"
          >
            <EyeIcon className="size-3.5" />
            {showLabels && "View"}
          </ButtonLink>
        );
      case "edit":
        return (
          <ButtonLink
            key={action}
            to="/forms/:id/records/:submissionId/edit"
            params={{ id: formId, submissionId }}
            size="xs"
            variant="ghost"
            title="Edit"
            aria-label="Edit"
          >
            <PencilIcon className="size-3.5" />
            {showLabels && "Edit"}
          </ButtonLink>
        );
      case "delete":
        return (
          <Button
            key={action}
            size="xs"
            variant="ghost"
            title="Delete"
            aria-label="Delete"
            className="text-danger hover:border-danger hover:bg-danger-soft hover:text-danger"
            onClick={onDelete}
          >
            <TrashIcon className="size-3.5" />
            {showLabels && "Delete"}
          </Button>
        );
      case "pdf":
        return (
          <Button
            key={action}
            size="xs"
            variant="ghost"
            title="Download PDF"
            aria-label="Download PDF"
            onClick={() => void downloadPdf()}
            disabled={downloadingPdf}
          >
            <DownloadIcon className="size-3.5" />
            {showLabels && (downloadingPdf ? "PDF..." : "PDF")}
          </Button>
        );
    }
  }

  function renderMenuItem(action: SubmissionRowAction) {
    switch (action) {
      case "view":
        return (
          <Link
            key={action}
            to="/forms/:id/records/:submissionId"
            params={{ id: formId, submissionId }}
            role="menuitem"
            className={menuItemClasses}
            onClick={() => setMenuOpen(false)}
          >
            <EyeIcon className="size-3.5" />
            View
          </Link>
        );
      case "edit":
        return (
          <Link
            key={action}
            to="/forms/:id/records/:submissionId/edit"
            params={{ id: formId, submissionId }}
            role="menuitem"
            className={menuItemClasses}
            onClick={() => setMenuOpen(false)}
          >
            <PencilIcon className="size-3.5" />
            Edit
          </Link>
        );
      case "delete":
        return (
          <button
            key={action}
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
            className={`${menuItemClasses} text-danger hover:bg-danger-soft`}
          >
            <TrashIcon className="size-3.5" />
            Delete
          </button>
        );
      case "pdf":
        return (
          <button
            key={action}
            type="button"
            role="menuitem"
            disabled={downloadingPdf}
            onClick={() => {
              setMenuOpen(false);
              void downloadPdf();
            }}
            className={menuItemClasses}
          >
            <DownloadIcon className="size-3.5" />
            {downloadingPdf ? "Downloading..." : "Download PDF"}
          </button>
        );
    }
  }

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      {inlineActions.map(renderInline)}
      {menuActions.length > 0 && (
        <div className="relative" ref={menuRef}>
          <Button
            size="xs"
            variant="ghost"
            title="More actions"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <EllipsisIcon className="size-3.5" />
          </Button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-30 mt-1 w-40 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
            >
              {menuActions.map(renderMenuItem)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterValueInput({
  field,
  operator,
  value,
  distinctValues,
  onChange,
  inputCls,
}: {
  field: FormField;
  operator: string;
  value: string;
  distinctValues: string[];
  onChange: (value: string) => void;
  inputCls: string;
}) {
  const isDate = ["date", "created_date", "modified_date"].includes(
    field.type,
  );
  const isNumeric = ["number", "currency", "rating", "slider"].includes(
    field.type,
  );
  const useDropdown = filterInputForField(field) === "dropdown";

  if (isDate) {
    return (
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputCls}
      />
    );
  }
  if (isNumeric) {
    return (
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputCls}
      />
    );
  }
  if (useDropdown && operator !== "contains") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputCls}
      >
        <option value="">Any</option>
        {distinctValues.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Value"
      className={inputCls}
    />
  );
}

function FilterControl({
  field,
  filter,
  distinctValues,
  onChange,
}: {
  field: FormField;
  filter: FilterEntry | undefined;
  distinctValues: string[];
  onChange: (filter: FilterEntry | undefined) => void;
}) {
  const operator = operatorForField(field);
  const operatorLabel =
    filterOperatorsForType(field.type).find(
      (option) => option.value === operator,
    )?.label ?? null;
  const value = filter?.value ?? "";
  const value2 = filter?.value2 ?? "";
  const inputCls = `${inputClasses} text-xs`;

  if (field.type === "file_upload") {
    return (
      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
              ? { value: event.target.value, value2: "" }
              : undefined,
          )
        }
        className={inputCls}
      >
        <option value="">Any</option>
        <option value="has_file">Has upload</option>
        <option value="no_file">No upload</option>
      </select>
    );
  }

  function update(patch: Partial<FilterEntry>) {
    const next = { value, value2, ...patch };
    onChange({ value: next.value, value2: next.value2 });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {operatorLabel && (
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
          {operatorLabel}
        </span>
      )}
      <FilterValueInput
        field={field}
        operator={operator}
        value={value}
        distinctValues={distinctValues}
        onChange={(next) => update({ value: next })}
        inputCls={inputCls}
      />
      {operator === "between" && (
        <FilterValueInput
          field={field}
          operator={operator}
          value={value2}
          distinctValues={distinctValues}
          onChange={(next) => update({ value2: next })}
          inputCls={inputCls}
        />
      )}
    </div>
  );
}

function HeaderFilter({
  field,
  filter,
  distinctValues,
  onChange,
}: {
  field: FormField;
  filter: FilterEntry | undefined;
  distinctValues: string[];
  onChange: (filter: FilterEntry | undefined) => void;
}) {
  return (
    <FilterControl
      field={field}
      filter={filter}
      distinctValues={distinctValues}
      onChange={onChange}
    />
  );
}

function TopFilterGrid({
  filterableFields,
  filters,
  distinctValues,
  columns,
  onFilterChange,
}: {
  filterableFields: FormField[];
  filters: Record<string, FilterEntry>;
  distinctValues: Record<string, string[]>;
  columns: number;
  onFilterChange: (key: string, filter: FilterEntry | undefined) => void;
}) {
  if (filterableFields.length === 0) {
    return null;
  }

  return (
    <div
      className="grid items-start gap-2"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {filterableFields.map((field) => (
        <div
          key={field.key}
          className="flex flex-col gap-1.5 rounded-lg border border-neutral-100 bg-muted/50 p-2"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-xs font-semibold text-neutral-700">
              {field.label}
            </span>
            {filters[field.key] && (
              <button
                type="button"
                aria-label={`Clear ${field.label} filter`}
                onClick={() => onFilterChange(field.key, undefined)}
                className="rounded px-1 text-base leading-none text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
              >
                ×
              </button>
            )}
          </div>
          <FilterControl
            field={field}
            filter={filters[field.key]}
            distinctValues={distinctValues[field.key] ?? []}
            onChange={(next) => onFilterChange(field.key, next)}
          />
        </div>
      ))}
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
