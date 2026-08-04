import { useMemo, useState } from "react";
import { getUsers, updateUser, useQuery } from "wasp/client/operations";
import type { AuthUser } from "wasp/auth";
import type { AdminUser } from "../queries";
import { Button, ButtonLink } from "../shared/components/Button";
import { Card, CardHead, DataFoot, DataToolbar } from "../shared/components/Card";
import { inputClasses, selectClasses } from "../shared/styles";

const ROLES = ["ADMIN", "EDITOR", "VIEWER"] as const;
type Role = (typeof ROLES)[number];

const roleBadge: Record<Role, string> = {
  ADMIN: "bg-danger-soft text-danger",
  EDITOR: "bg-primary-50 text-primary-700",
  VIEWER: "bg-neutral-100 text-neutral-600",
};

export function AdminUsersPage({ user }: { user: AuthUser }) {
  const { data: users, isLoading, isSuccess, refetch } = useQuery(getUsers);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("EDITOR");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query || !users) {
      return users ?? [];
    }
    return users.filter((u) =>
      `${u.email ?? ""} ${u.name ?? ""}`.toLowerCase().includes(query),
    );
  }, [users, search]);

  if (user.role !== "ADMIN") {
    return (
      <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col items-center gap-4 px-8 py-12">
        <h1 className="font-display text-3xl font-bold tracking-[-0.028em] text-neutral-900">
          Admins only
        </h1>
        <p className="text-neutral-500">
          You need administrator privileges to manage users.
        </p>
        <ButtonLink to="/forms" variant="ghost">
          Back to forms
        </ButtonLink>
      </div>
    );
  }

  function openEditor(target: AdminUser) {
    setEditing(target);
    setName(target.name ?? "");
    setRole((target.role as Role) || "EDITOR");
    setError(null);
  }

  async function save() {
    if (!editing) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await updateUser({ userId: editing.id, name, role });
      setEditing(null);
      await refetch();
    } catch (err) {
      setError(String(err));
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col gap-6 px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            Administration
          </span>
          <h1 className="font-display text-[clamp(28px,3.2vw,36px)] font-bold leading-tight tracking-[-0.028em] text-neutral-900">
            Users
          </h1>
          <p className="max-w-[60ch] text-sm leading-relaxed text-neutral-500">
            Manage user profiles, roles, and access. Admins can manage all
            forms and data; editors can create and edit forms; viewers can only
            see forms shared with them.
          </p>
        </div>
        <ButtonLink to="/forms" variant="ghost">
          Back to forms
        </ButtonLink>
      </div>

      <Card className="w-full">
        <div className="p-6 pb-0">
          <CardHead
            eyebrow="Accounts"
            title="All users"
            action={
              <span className="text-xs text-neutral-500">
                {isSuccess ? users.length : "—"}{" "}
                user{users?.length === 1 ? "" : "s"}
              </span>
            }
          />
        </div>

        {isLoading && <p className="p-6 text-neutral-500">Loading users...</p>}
        {isSuccess && (
          <>
            <div className="px-6 pt-5">
              <DataToolbar
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search by email or name..."
                right={
                  <span className="text-xs text-neutral-500">
                    {filteredUsers.length} of {users.length} shown
                  </span>
                }
              />
            </div>
            <div className="overflow-x-auto px-2 pb-2">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="table-head">Email</th>
                    <th className="table-head">Name</th>
                    <th className="table-head">Role</th>
                    <th className="table-head">Joined</th>
                    <th className="table-head">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-[13px] text-neutral-500"
                      >
                        No users match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((target) => (
                      <tr
                        key={target.id}
                        className="transition-colors duration-150 hover:bg-neutral-50"
                      >
                        <td className="table-cell font-mono text-xs text-neutral-700">
                          {target.email ?? "—"}
                          {target.id === user.id && (
                            <span className="ml-2 rounded-full bg-info-soft px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-info">
                              You
                            </span>
                          )}
                        </td>
                        <td className="table-cell text-[13px] text-neutral-800">
                          {target.name ?? "—"}
                        </td>
                        <td className="table-cell">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
                              roleBadge[(target.role as Role) ?? "EDITOR"]
                            }`}
                          >
                            {target.role ?? "EDITOR"}
                          </span>
                        </td>
                        <td className="table-cell text-xs text-neutral-500">
                          {new Date(target.createdAt).toLocaleDateString()}
                        </td>
                        <td className="table-cell">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => openEditor(target)}
                            disabled={target.id === user.id}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <DataFoot
              left={`Showing ${filteredUsers.length} of ${users.length}`}
            />
          </>
        )}
      </Card>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit user"
            className="flex w-full max-w-md flex-col gap-4 rounded-[14px] border border-neutral-200 bg-white p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="border-b border-neutral-100 pb-3 font-display text-lg font-bold tracking-[-0.02em] text-neutral-800">
              Edit user
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="label" htmlFor="edit-email">
                  Email
                </label>
                <input
                  id="edit-email"
                  value={editing.email ?? ""}
                  readOnly
                  disabled
                  className={`${inputClasses} font-mono`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="label" htmlFor="edit-name">
                  Display name
                </label>
                <input
                  id="edit-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Full name"
                  className={inputClasses}
                />
                <span className="text-xs text-neutral-400">
                  Used when a form&apos;s &ldquo;Updated by user&rdquo; field is
                  set to record the display name.
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="label" htmlFor="edit-role">
                  Role
                </label>
                <select
                  id="edit-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                  className={selectClasses}
                >
                  {ROLES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-neutral-400">
                  ADMIN: manage users and all forms. EDITOR: create and edit
                  forms. VIEWER: read-only on shared forms.
                </span>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
              <Button
                variant="ghost"
                onClick={() => setEditing(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
