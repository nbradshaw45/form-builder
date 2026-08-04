import { HttpError, prisma } from "wasp/server";

export type UserLike = {
  id: string;
  role: string;
};

export type FormAccessInfo =
  | { kind: "owner" }
  | { kind: "admin" }
  | { kind: "shared"; level: "VIEW" | "EDIT" };

export async function getFormAccessForUser(
  formId: string,
  user: UserLike,
): Promise<FormAccessInfo> {
  if (user.role === "ADMIN") {
    return { kind: "admin" };
  }

  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { userId: true },
  });
  if (!form) {
    throw new HttpError(404, "Form not found");
  }
  if (form.userId === user.id) {
    return { kind: "owner" };
  }

  const access = await prisma.formAccess.findUnique({
    where: { formId_userId: { formId, userId: user.id } },
  });
  if (!access) {
    throw new HttpError(403, "You don't have access to this form");
  }
  return { kind: "shared", level: access.level };
}

export function assertCanView(access: FormAccessInfo) {
  if (
    access.kind === "owner" ||
    access.kind === "admin" ||
    access.kind === "shared"
  ) {
    return;
  }
  throw new HttpError(403, "You don't have access to this form");
}

export function assertCanEdit(access: FormAccessInfo) {
  if (access.kind === "shared" && access.level === "VIEW") {
    throw new HttpError(403, "You only have view access to this form");
  }
}

export function assertIsOwnerOrAdmin(access: FormAccessInfo) {
  if (access.kind !== "owner" && access.kind !== "admin") {
    throw new HttpError(403, "Only the form owner or an admin can do this");
  }
}

export function assertIsAdmin(user: UserLike) {
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "Admin privileges required");
  }
}
