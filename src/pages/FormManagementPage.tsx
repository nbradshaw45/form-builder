import { useMemo, useState } from "react";
import type { AuthUser } from "wasp/auth";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Row,
} from "@tanstack/react-table";
import { deleteForm } from "wasp/client/operations";
import { getForms, useQuery } from "wasp/client/operations";
import { Link } from "wasp/client/router";
import type { FormWithAccess } from "../queries";
import { Button, ButtonLink } from "../shared/components/Button";
import { Card, CardHead, DataFoot, DataToolbar } from "../shared/components/Card";
import { ConfirmDialog } from "../components/Modal";
import { EyeIcon, PencilIcon, ShareIcon, TableIcon, TrashIcon } from "../components/builder/icons";

const columnHelper = createColumnHelper<FormWithAccess>();

interface DeleteState {
  form: FormWithAccess;
  isDeleting: boolean;
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
  const { data: forms, isLoading, isSuccess } = useQuery(getForms);
  const [search, setSearch] = useState("");
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);

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
          <RowActions row={info.row} user={user} onDelete={setDeleteState} />
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

  return (
    <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col gap-6 px-8 py-8">
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
        <ButtonLink to="/forms/new">New form</ButtonLink>
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
            <div className="px-6 pt-5">
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
            <DataFoot
              left={`Showing ${filteredForms.length} of ${forms.length}`}
            />
          </>
        )}
      </Card>

      {deleteState && (
        <ConfirmDialog
          title="Delete form"
          message={`Are you sure you want to delete "${deleteState.form.title}"? All ${deleteState.form._count?.submissions ?? 0} submission(s) will be permanently removed.`}
          isLoading={deleteState.isDeleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteState(null)}
        />
      )}
    </div>
  );
}

function RowActions({
  row,
  user,
  onDelete,
}: {
  row: Row<FormWithAccess>;
  user: AuthUser;
  onDelete: (state: DeleteState) => void;
}) {
  const { id, access } = row.original;
  const canManage = access === "owner" || user.role === "ADMIN";
  return (
    <div className="flex flex-wrap gap-1.5">
      <ButtonLink to="/forms/:id" params={{ id }} size="xs" variant="ghost">
        <EyeIcon className="size-3.5" />
        View
      </ButtonLink>
      <ButtonLink
        to="/forms/:id/submissions"
        params={{ id }}
        size="xs"
        variant="ghost"
      >
        <TableIcon className="size-3.5" />
        Submissions
      </ButtonLink>
      {canManage && (
        <ButtonLink
          to="/forms/:id/access"
          params={{ id }}
          size="xs"
          variant="ghost"
        >
          <ShareIcon className="size-3.5" />
          Access
        </ButtonLink>
      )}
      {canManage && (
        <ButtonLink to="/forms/:id/edit" params={{ id }} size="xs" variant="ghost">
          <PencilIcon className="size-3.5" />
          Edit
        </ButtonLink>
      )}
      {canManage && (
        <Button
          size="xs"
          variant="ghost"
          className="text-danger hover:border-danger hover:bg-danger-soft hover:text-danger"
          onClick={() => onDelete({ form: row.original, isDeleting: false })}
        >
          <TrashIcon className="size-3.5" />
          Delete
        </Button>
      )}
    </div>
  );
}
