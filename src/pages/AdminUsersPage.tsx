import { useMemo, useState } from "react";
import {
  addUser,
  deleteUser,
  getUsers,
  updateUser,
  useQuery,
} from "wasp/client/operations";
import type { AuthUser } from "wasp/auth";
import type { AdminUser } from "../queries";
import { Button, ButtonLink } from "../shared/components/Button";
import { Card, CardHead, DataFoot, DataToolbar } from "../shared/components/Card";
import { ConfirmDialog } from "../components/Modal";
import { inputClasses, pageShellClasses, selectClasses } from "../shared/styles";
import { MD_UP, useMediaQuery } from "../shared/hooks/useMediaQuery";

const ROLES = ["ADMIN", "EDITOR", "VIEWER"] as const;
type Role = (typeof ROLES)[number];

const roleBadge: Record<Role, string> = {
  ADMIN: "bg-danger-soft text-danger",
  EDITOR: "bg-primary-50 text-primary-700",
  VIEWER: "bg-neutral-100 text-neutral-600",
};

const DEFAULT_EMAIL = "user@example.com";

export function AdminUsersPage({ user }: { user: AuthUser }) {
  const isMdUp = useMediaQuery(MD_UP);
  const { data: users, isLoading, isSuccess, refetch } = useQuery(getUsers);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("EDITOR");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("EDITOR");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [deleteState, setDeleteState] = useState<{
    target: AdminUser;
    isDeleting: boolean;
  } | null>(null);

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
      <div className={`${pageShellClasses} items-center`}>
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

  function openAdd() {
    setNewEmail("");
    setNewPassword("");
    setNewName("");
    setNewRole("EDITOR");
    setAddError(null);
    setShowAdd(true);
  }

  async function addNewUser() {
    setIsAdding(true);
    setAddError(null);
    try {
      await addUser({
        email: newEmail.trim(),
        password: newPassword,
        name: newName.trim() || undefined,
        role: newRole,
      });
      setShowAdd(false);
      await refetch();
    } catch (err) {
      setAddError(String(err));
      setIsAdding(false);
    }
  }

  async function confirmDelete() {
    if (!deleteState) {
      return;
    }
    setDeleteState({ ...deleteState, isDeleting: true });
    try {
      await deleteUser({ userId: deleteState.target.id });
      setDeleteState(null);
      await refetch();
    } catch (err) {
      window.alert(`Error while deleting user: ${String(err)}`);
      setDeleteState(null);
    }
  }

  return (
    <div className={pageShellClasses}>
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
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button onClick={openAdd} className="flex-1 sm:flex-none">
            Add user
          </Button>
          <ButtonLink to="/forms" variant="ghost" className="flex-1 sm:flex-none">
            Back to forms
          </ButtonLink>
        </div>
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
            <div className="px-4 pt-5 sm:px-6">
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
            {isMdUp ? (
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
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => openEditor(target)}
                              disabled={target.id === user.id}
                            >
                              Edit
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              className="text-danger hover:border-danger hover:bg-danger-soft hover:text-danger"
                              disabled={target.id === user.id}
                              onClick={() =>
                                setDeleteState({
                                  target,
                                  isDeleting: false,
                                })
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            ) : (
              <div className="flex flex-col gap-3 px-4 pb-4 sm:px-6">
                {filteredUsers.length === 0 ? (
                  <p className="p-4 text-center text-[13px] text-neutral-500">
                    No users match your search.
                  </p>
                ) : (
                  filteredUsers.map((target) => (
                    <div
                      key={target.id}
                      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs text-neutral-700">
                            {target.email ?? "—"}
                            {target.id === user.id && (
                              <span className="ml-2 rounded-full bg-info-soft px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-info">
                                You
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-[13px] text-neutral-800">
                            {target.name ?? "—"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
                            roleBadge[(target.role as Role) ?? "EDITOR"]
                          }`}
                        >
                          {target.role ?? "EDITOR"}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500">
                        Joined {new Date(target.createdAt).toLocaleDateString()}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => openEditor(target)}
                          disabled={target.id === user.id}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-danger hover:border-danger hover:bg-danger-soft hover:text-danger"
                          disabled={target.id === user.id}
                          onClick={() =>
                            setDeleteState({
                              target,
                              isDeleting: false,
                            })
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
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

      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !isAdding && setShowAdd(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add user"
            className="flex w-full max-w-md flex-col gap-4 rounded-[14px] border border-neutral-200 bg-white p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="border-b border-neutral-100 pb-3 font-display text-lg font-bold tracking-[-0.02em] text-neutral-800">
              Add user
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="label" htmlFor="add-email">
                  Email
                </label>
                <input
                  id="add-email"
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder={DEFAULT_EMAIL}
                  className={`${inputClasses} font-mono`}
                />
                <span className="text-xs text-neutral-400">
                  Used to sign in; usernames are normalized to lowercase.
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="label" htmlFor="add-password">
                  Password
                </label>
                <input
                  id="add-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters with a number"
                  className={inputClasses}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="label" htmlFor="add-name">
                  Display name
                </label>
                <input
                  id="add-name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Full name (optional)"
                  className={inputClasses}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="label" htmlFor="add-role">
                  Role
                </label>
                <select
                  id="add-role"
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value as Role)}
                  className={selectClasses}
                >
                  {ROLES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              {addError && <p className="text-sm text-red-500">{addError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
              <Button
                variant="ghost"
                onClick={() => setShowAdd(false)}
                disabled={isAdding}
              >
                Cancel
              </Button>
              <Button
                onClick={addNewUser}
                disabled={isAdding || !newEmail.trim() || !newPassword}
              >
                {isAdding ? "Creating..." : "Create user"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteState && (
        <ConfirmDialog
          title="Delete user"
          message={`Are you sure you want to delete "${deleteState.target.email ?? deleteState.target.id}"? Their forms, submissions, and shared access will be permanently removed.`}
          confirmLabel="Delete user"
          isLoading={deleteState.isDeleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteState(null)}
        />
      )}
    </div>
  );
}
