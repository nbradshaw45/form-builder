import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser } from "wasp/auth";
import { useNavigate } from "react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  createFormFromTemplate,
  deleteForm,
  duplicateForm,
  exportForm,
  importForm,
  renameFormTemplate,
  saveFormAsTemplate,
} from "wasp/client/operations";
import { getForms, getFormTemplates, useQuery } from "wasp/client/operations";
import { Link } from "wasp/client/router";
import type { FormTemplateSummary, FormWithAccess } from "../queries";
import type { FormField, FormSettings } from "../types";
import { Button, ButtonLink } from "../shared/components/Button";
import { Card, CardHead, DataFoot, DataToolbar } from "../shared/components/Card";
import { ConfirmDialog, Modal } from "../components/Modal";
import { BookmarkIcon, DownloadIcon, DuplicateIcon, EllipsisIcon, EyeIcon, PencilIcon, PlusIcon, ShareIcon, TableIcon, TrashIcon, UploadIcon } from "../components/builder/icons";
import { inputClasses, pageShellClasses } from "../shared/styles";
import { MD_UP, useMediaQuery } from "../shared/hooks/useMediaQuery";

const columnHelper = createColumnHelper<FormWithAccess>();

interface DeleteState {
  form: FormWithAccess;
  isDeleting: boolean;
}

interface TemplateDeleteState {
  template: FormTemplateSummary;
  isDeleting: boolean;
}

interface TemplateRenameState {
  template: FormTemplateSummary;
  title: string;
  isSaving: boolean;
}

const accessBadge: Record<FormWithAccess["access"], string> = {
  owner: "bg-primary-50 text-primary-700",
  edit: "bg-info-soft text-info",
  view: "bg-neutral-100 text-neutral-600",
};

const accessLabel: Record<FormWithAccess["access"], string> = {
  owner: "Owner",
  edit: "Can edit",
  view: "Can view",
};

export function FormManagementPage({ user }: { user: AuthUser }) {
  const navigate = useNavigate();
  const isMdUp = useMediaQuery(MD_UP);
  const { data: forms, isLoading, isSuccess } = useQuery(getForms);
  const canCreate = user.role !== "VIEWER";
  const isAdmin = user.role === "ADMIN";
  const { data: templates } = useQuery(getFormTemplates, undefined, {
    enabled: canCreate,
  });
  const [search, setSearch] = useState("");
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [templateDeleteState, setTemplateDeleteState] =
    useState<TemplateDeleteState | null>(null);
  const [templateRenameState, setTemplateRenameState] =
    useState<TemplateRenameState | null>(null);
  const [usingTemplateId, setUsingTemplateId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredForms = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query || !forms) {
      return forms ?? [];
    }
    return forms.filter((form) =>
      `${form.title} ${form.description ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [forms, search]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Title",
        cell: (info) => (
          <Link
            to="/forms/:id"
            params={{ id: info.row.original.id }}
            className="font-semibold text-neutral-800 hover:text-primary-600 hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("createdAt", {
        header: "Created",
        cell: (info) => (
          <span className="cell-date">{new Date(info.getValue()).toLocaleDateString()}</span>
        ),
      }),
      columnHelper.accessor("access", {
        header: "Access",
        cell: (info) => (
          <span
            className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
              accessBadge[info.getValue()]
            }`}
          >
            {accessLabel[info.getValue()]}
          </span>
        ),
      }),
      columnHelper.accessor(
        (row) => row._count?.submissions ?? 0,
        {
          id: "submissions",
          header: "Submissions",
          cell: (info) => (
            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10.5px] font-semibold text-primary-700">
              {info.getValue()}
            </span>
          ),
        },
      ),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => (
          <RowActions
            form={info.row.original}
            user={user}
            onDelete={setDeleteState}
          />
        ),
      }),
    ],
    [user],
  );

  const table = useReactTable({
    data: filteredForms,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function confirmDelete() {
    if (!deleteState) {
      return;
    }
    setDeleteState({ ...deleteState, isDeleting: true });
    try {
      await deleteForm({ formId: deleteState.form.id });
      setDeleteState(null);
    } catch (err) {
      window.alert(`Error while deleting form: ${String(err)}`);
      setDeleteState(null);
    }
  }

  async function confirmTemplateDelete() {
    if (!templateDeleteState) {
      return;
    }
    setTemplateDeleteState({ ...templateDeleteState, isDeleting: true });
    try {
      await deleteForm({ formId: templateDeleteState.template.id });
      setTemplateDeleteState(null);
    } catch (err) {
      window.alert(`Error while deleting template: ${String(err)}`);
      setTemplateDeleteState(null);
    }
  }

  async function confirmTemplateRename() {
    if (!templateRenameState) {
      return;
    }
    const title = templateRenameState.title.trim();
    if (!title) {
      window.alert("Template name is required.");
      return;
    }
    setTemplateRenameState({ ...templateRenameState, isSaving: true });
    try {
      await renameFormTemplate({
        templateId: templateRenameState.template.id,
        title,
      });
      setTemplateRenameState(null);
    } catch (err) {
      window.alert(`Error while renaming template: ${String(err)}`);
      setTemplateRenameState({ ...templateRenameState, isSaving: false });
    }
  }

  function openTemplateRename(template: FormTemplateSummary) {
    setTemplateRenameState({
      template,
      title: template.title,
      isSaving: false,
    });
  }

  async function handleUseTemplate(template: FormTemplateSummary) {
    setUsingTemplateId(template.id);
    try {
      const form = await createFormFromTemplate({
        templateId: template.id,
        title: template.title,
      });
      navigate(`/forms/${form.id}/edit`);
    } catch (err) {
      window.alert(`Error while creating form from template: ${String(err)}`);
      setUsingTemplateId(null);
    }
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setIsImporting(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("The selected file is not valid JSON.");
      }
      const candidate = parsed as {
        title?: unknown;
        fields?: unknown;
        settings?: unknown;
      };
      if (
        typeof candidate !== "object" ||
        candidate === null ||
        Array.isArray(candidate) ||
        typeof candidate.title !== "string" ||
        !Array.isArray(candidate.fields) ||
        (candidate.settings !== null &&
          candidate.settings !== undefined &&
          (typeof candidate.settings !== "object" ||
            Array.isArray(candidate.settings)))
      ) {
        throw new Error(
          "Not a valid form export: expected an object with a title (string), fields (array), and settings (object).",
        );
      }
      await importForm({
        title: candidate.title,
        fields: candidate.fields as FormField[],
        settings: (candidate.settings as FormSettings | null) ?? undefined,
      });
    } catch (err) {
      window.alert(
        `Import failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className={pageShellClasses}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            Workspace
          </span>
          <h1 className="font-display text-[clamp(28px,3.2vw,36px)] font-bold leading-tight tracking-[-0.028em] text-neutral-900">
            Forms
          </h1>
          <p className="max-w-[60ch] text-sm leading-relaxed text-neutral-500">
            Manage forms for{" "}
            <span className="font-semibold">
              {user.identities.username?.id ?? "user"}
            </span>
            .
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {canCreate && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(event) => void handleImportFile(event)}
              />
              <Button
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex-1 sm:flex-none"
              >
                <UploadIcon className="size-3.5" />
                {isImporting ? "Importing..." : "Import form"}
              </Button>
            </>
          )}
          <ButtonLink to="/forms/new" className="flex-1 sm:flex-none">
            New form
          </ButtonLink>
        </div>
      </div>

      <Card className="w-full">
        <div className="p-6 pb-0">
          <CardHead
            eyebrow="Management"
            title="All forms"
            action={
              <span className="text-xs text-neutral-500">
                {isSuccess ? forms.length : "—"} form{forms?.length === 1 ? "" : "s"}
              </span>
            }
          />
        </div>

        {isLoading && (
          <p className="p-6 text-neutral-500">Loading forms...</p>
        )}
        {isSuccess && forms.length === 0 && (
          <div className="flex flex-col items-center gap-4 p-12 text-center">
            <p className="text-sm text-neutral-500">
              No forms yet. Create your first form with the visual builder.
            </p>
            <ButtonLink to="/forms/new">Create a form</ButtonLink>
          </div>
        )}
        {isSuccess && forms.length > 0 && (
          <>
            <div className="px-4 pt-5 sm:px-6">
              <DataToolbar
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search forms by title or description..."
                right={
                  <span className="text-xs text-neutral-500">
                    {filteredForms.length} of {forms.length} shown
                  </span>
                }
              />
            </div>
            {isMdUp ? (
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
                  {filteredForms.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="p-8 text-center text-[13px] text-neutral-500"
                      >
                        No forms match your search.
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
            ) : (
              <div className="flex flex-col gap-3 px-4 pb-4 sm:px-6">
                {filteredForms.length === 0 ? (
                  <p className="p-4 text-center text-[13px] text-neutral-500">
                    No forms match your search.
                  </p>
                ) : (
                  filteredForms.map((form) => (
                    <div
                      key={form.id}
                      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <Link
                          to="/forms/:id"
                          params={{ id: form.id }}
                          className="font-semibold text-neutral-800 hover:text-primary-600 hover:underline"
                        >
                          {form.title}
                        </Link>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${accessBadge[form.access]}`}
                        >
                          {accessLabel[form.access]}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
                        <span>
                          Created{" "}
                          {new Date(form.createdAt).toLocaleDateString()}
                        </span>
                        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10.5px] font-semibold text-primary-700">
                          {form._count?.submissions ?? 0} submissions
                        </span>
                      </div>
                      <RowActions
                        form={form}
                        user={user}
                        onDelete={setDeleteState}
                      />
                    </div>
                  ))
                )}
              </div>
            )}
            <DataFoot
              left={`Showing ${filteredForms.length} of ${forms.length}`}
            />
          </>
        )}
      </Card>

      {canCreate && templates && templates.length > 0 && (
        <Card className="w-full">
          <div className="p-6 pb-0">
            <CardHead
              eyebrow="Reusable"
              title="Templates"
              action={
                <span className="text-xs text-neutral-500">
                  {templates.length} template{templates.length === 1 ? "" : "s"}
                </span>
              }
            />
          </div>
          <div className="overflow-x-auto px-2 pb-2 md:block">
            {isMdUp ? (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-head">Title</th>
                  <th className="table-head">Created</th>
                  <th className="table-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr
                    key={template.id}
                    className="transition-colors duration-150 hover:bg-neutral-50"
                  >
                    <td className="table-cell font-semibold text-neutral-800">
                      {template.title}
                    </td>
                    <td className="table-cell">
                      <span className="cell-date">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="xs"
                          onClick={() => void handleUseTemplate(template)}
                          disabled={usingTemplateId === template.id}
                        >
                          <PlusIcon className="size-3.5" />
                          {usingTemplateId === template.id
                            ? "Creating..."
                            : "Use template"}
                        </Button>
                        {isAdmin && (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => openTemplateRename(template)}
                          >
                            <PencilIcon className="size-3.5" />
                            Rename
                          </Button>
                        )}
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-danger hover:border-danger hover:bg-danger-soft hover:text-danger"
                          onClick={() =>
                            setTemplateDeleteState({
                              template,
                              isDeleting: false,
                            })
                          }
                        >
                          <TrashIcon className="size-3.5" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            ) : (
              <div className="flex flex-col gap-3 px-4 pb-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-neutral-800">
                        {template.title}
                      </span>
                      <span className="text-xs text-neutral-500">
                        Created{" "}
                        {new Date(template.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="xs"
                        onClick={() => void handleUseTemplate(template)}
                        disabled={usingTemplateId === template.id}
                      >
                        <PlusIcon className="size-3.5" />
                        {usingTemplateId === template.id
                          ? "Creating..."
                          : "Use template"}
                      </Button>
                      {isAdmin && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => openTemplateRename(template)}
                        >
                          <PencilIcon className="size-3.5" />
                          Rename
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-danger hover:border-danger hover:bg-danger-soft hover:text-danger"
                        onClick={() =>
                          setTemplateDeleteState({
                            template,
                            isDeleting: false,
                          })
                        }
                      >
                        <TrashIcon className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {deleteState && (
        <ConfirmDialog
          title="Delete form"
          message={`Are you sure you want to delete "${deleteState.form.title}"? All ${deleteState.form._count?.submissions ?? 0} submission(s) will be permanently removed.`}
          isLoading={deleteState.isDeleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteState(null)}
        />
      )}

      {templateDeleteState && (
        <ConfirmDialog
          title="Delete template"
          message={`Are you sure you want to delete the template "${templateDeleteState.template.title}"?`}
          isLoading={templateDeleteState.isDeleting}
          onConfirm={confirmTemplateDelete}
          onCancel={() => setTemplateDeleteState(null)}
        />
      )}

      {templateRenameState && (
        <Modal
          title="Rename template"
          onClose={() => {
            if (!templateRenameState.isSaving) {
              setTemplateRenameState(null);
            }
          }}
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setTemplateRenameState(null)}
                disabled={templateRenameState.isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void confirmTemplateRename()}
                disabled={
                  templateRenameState.isSaving ||
                  !templateRenameState.title.trim()
                }
              >
                {templateRenameState.isSaving ? "Saving..." : "Save"}
              </Button>
            </>
          }
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-700">
              Template name
            </span>
            <input
              autoFocus
              value={templateRenameState.title}
              onChange={(event) =>
                setTemplateRenameState({
                  ...templateRenameState,
                  title: event.target.value,
                })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void confirmTemplateRename();
                }
              }}
              disabled={templateRenameState.isSaving}
              className={inputClasses}
            />
          </label>
        </Modal>
      )}
    </div>
  );
}

function RowActions({
  form,
  user,
  onDelete,
}: {
  form: FormWithAccess;
  user: AuthUser;
  onDelete: (state: DeleteState) => void;
}) {
  const { id, access } = form;
  const canManage = access === "owner" || user.role === "ADMIN";
  const [busyAction, setBusyAction] = useState<string | null>(null);
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

  async function runAction(name: string, fn: () => Promise<void>) {
    setBusyAction(name);
    try {
      await fn();
    } catch (err) {
      window.alert(`Error: ${String(err)}`);
    } finally {
      setBusyAction(null);
      setMenuOpen(false);
    }
  }

  function handleDuplicate() {
    return runAction("duplicate", async () => {
      await duplicateForm({ formId: id });
    });
  }

  function handleSaveAsTemplate() {
    return runAction("template", async () => {
      await saveFormAsTemplate({ formId: id });
      window.alert(`Saved "${form.title}" as a template.`);
    });
  }

  function handleExport() {
    return runAction("export", async () => {
      const payload = await exportForm({ formId: id });
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${form.title}.form.json`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  const menuItemClasses =
    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ButtonLink
        to="/forms/:id/submissions"
        params={{ id }}
        size="xs"
        variant="ghost"
      >
        <TableIcon className="size-3.5" />
        Submissions
      </ButtonLink>
      <ButtonLink to="/forms/:id" params={{ id }} size="xs" variant="ghost">
        <EyeIcon className="size-3.5" />
        View
      </ButtonLink>
      {canManage && (
        <ButtonLink to="/forms/:id/edit" params={{ id }} size="xs" variant="ghost">
          <PencilIcon className="size-3.5" />
          Edit
        </ButtonLink>
      )}
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
            className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
          >
            <Link
              to="/forms/:id"
              params={{ id }}
              role="menuitem"
              className={menuItemClasses}
              onClick={() => setMenuOpen(false)}
            >
              <PlusIcon className="size-3.5" />
              New Record
            </Link>
            <button
              type="button"
              role="menuitem"
              className={menuItemClasses}
              disabled={busyAction !== null}
              onClick={() => void handleExport()}
            >
              <DownloadIcon className="size-3.5" />
              {busyAction === "export" ? "Exporting..." : "Export"}
            </button>
            <Link
              to="/forms/:id/audit"
              params={{ id }}
              role="menuitem"
              className={menuItemClasses}
              onClick={() => setMenuOpen(false)}
            >
              Audit
            </Link>
            {canManage && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClasses}
                  disabled={busyAction !== null}
                  onClick={() => void handleDuplicate()}
                >
                  <DuplicateIcon className="size-3.5" />
                  {busyAction === "duplicate" ? "Duplicating..." : "Duplicate"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClasses}
                  disabled={busyAction !== null}
                  onClick={() => void handleSaveAsTemplate()}
                >
                  <BookmarkIcon className="size-3.5" />
                  {busyAction === "template" ? "Saving..." : "Save as template"}
                </button>
                <Link
                  to="/forms/:id/access"
                  params={{ id }}
                  role="menuitem"
                  className={menuItemClasses}
                  onClick={() => setMenuOpen(false)}
                >
                  <ShareIcon className="size-3.5" />
                  Access
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className={`${menuItemClasses} text-danger hover:bg-danger-soft`}
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete({ form, isDeleting: false });
                  }}
                >
                  <TrashIcon className="size-3.5" />
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
