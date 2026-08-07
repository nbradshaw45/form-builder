import { useEffect, useState } from "react";
import {
  getForm,
  getFormAccess,
  removeFormAccess,
  setFormAccess,
  useQuery,
} from "wasp/client/operations";
import type { AuthUser } from "wasp/auth";
import { useParams } from "react-router";
import type { FormAccessInfo } from "../queries";
import { BUILTIN_ROLE_VIEWER } from "../shared/formRoles";
import { Button, ButtonLink } from "../shared/components/Button";
import { Card, CardHead } from "../shared/components/Card";
import { inputClasses, pageShellClasses, selectClasses } from "../shared/styles";

export function FormAccessPage({ user }: { user: AuthUser }) {
  const { id = "" } = useParams<{ id: string }>();
  const { data: form } = useQuery(getForm, { id });
  const { data: accessInfo, isLoading, isError, error, refetch } = useQuery(
    getFormAccess,
    { formId: id },
  );

  const roles = accessInfo?.roles ?? [];
  const defaultRoleId = roles[0]?.id ?? BUILTIN_ROLE_VIEWER;
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(defaultRoleId);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (roles.length > 0 && !roles.some((role) => role.id === roleId)) {
      setRoleId(roles[0].id);
    }
  }, [roles, roleId]);

  async function handleAdd() {
    if (!email.trim()) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await setFormAccess({ formId: id, email, roleId });
      setEmail("");
      await refetch();
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove(entry: FormAccessInfo["entries"][number]) {
    try {
      await removeFormAccess({ formId: id, userId: entry.user.id });
      await refetch();
    } catch (err) {
      window.alert(`Error while removing access: ${String(err)}`);
    }
  }

  if (isError) {
    return (
      <div className={`${pageShellClasses} items-center`}>
        <h1 className="font-display text-3xl font-bold tracking-[-0.028em] text-neutral-900">
          Can&apos;t manage access
        </h1>
        <p className="text-neutral-500">
          {String(error)}. Only the form owner or an admin can manage sharing.
        </p>
        <ButtonLink to="/forms" variant="ghost">
          Back to forms
        </ButtonLink>
      </div>
    );
  }

  const ownerLabel =
    accessInfo?.owner.name ?? accessInfo?.owner.id.slice(0, 8) ?? "—";

  return (
    <div className={pageShellClasses}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            Sharing
          </span>
          <h1 className="font-display text-[clamp(28px,3.2vw,36px)] font-bold leading-tight tracking-[-0.028em] text-neutral-900">
            {form ? form.title : "Form"} access
          </h1>
          <p className="max-w-[60ch] text-sm leading-relaxed text-neutral-500">
            Assign per-form roles that control who can view, edit, or delete
            submissions. Role capabilities (and optional conditions) are
            configured in the form builder under{" "}
            <strong>Record roles</strong>. The form structure stays under
            owner/admin control.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink to="/forms/:id/submissions" params={{ id }} variant="ghost">
            Submissions
          </ButtonLink>
          <ButtonLink to="/forms/:id" params={{ id }} variant="ghost">
            View form
          </ButtonLink>
        </div>
      </div>

      <Card className="w-full">
        <div className="p-6 pb-0">
          <CardHead eyebrow="People" title="Who has access" />
        </div>
        {isLoading ? (
          <p className="p-6 text-neutral-500">Loading access...</p>
        ) : (
          <ul className="divide-y divide-neutral-100 px-6 pb-6 pt-2">
            <li className="flex items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-neutral-800">
                  {ownerLabel}
                  <span className="ml-2 text-xs font-normal text-neutral-400">
                    (owner)
                  </span>
                </span>
                <span className="text-xs text-neutral-500">
                  Full control of this form and all submissions
                </span>
              </div>
              <span className="rounded-full bg-danger-soft px-2.5 py-1 text-[10.5px] font-semibold text-danger">
                OWNER
              </span>
            </li>
            {accessInfo?.entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-neutral-800">
                    {entry.user.name ?? "Unnamed user"}
                    {entry.user.id === user.id && (
                      <span className="ml-2 text-xs font-normal text-neutral-400">
                        (you)
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-neutral-500">
                    {entry.user.id.slice(0, 8)}… · {entry.user.role}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10.5px] font-semibold text-primary-700">
                    {entry.roleLabel}
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="text-danger hover:border-danger hover:bg-danger-soft hover:text-danger"
                    onClick={() => handleRemove(entry)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
            {accessInfo?.entries.length === 0 && (
              <li className="py-4 text-[13px] text-neutral-500">
                No one else has access yet. Add a user below to share this
                form.
              </li>
            )}
          </ul>
        )}
      </Card>

      <Card className="w-full">
        <div className="p-6">
          <CardHead
            eyebrow="Add access"
            title="Share with a user"
            action={
              <span className="text-xs text-neutral-500">
                Users are found by email
              </span>
            }
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              aria-label="User email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
              className={`${inputClasses} sm:flex-1`}
            />
            <select
              aria-label="Form role"
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              className={`${selectClasses} sm:w-48`}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
            <Button onClick={handleAdd} disabled={isSaving || !email.trim()}>
              {isSaving ? "Adding..." : "Add access"}
            </Button>
          </div>
          {saveError && <p className="mt-3 text-sm text-red-500">{saveError}</p>}
        </div>
      </Card>
    </div>
  );
}
