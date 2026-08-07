import { HttpError, prisma } from "wasp/server";
import { evaluateCondition } from "../shared/logic";
import {
  isEmptyValue,
  submissionValueEquals,
  validateFieldSync,
} from "../shared/fieldValidation";
import type { FormField, SubmissionData } from "../types";

const SUBMITTABLE_TYPES = new Set([
  "text",
  "number",
  "select",
  "textarea",
  "checkbox",
  "yes_no",
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
  "confirm",
  "hidden",
]);

function isSubmittableField(field: FormField): boolean {
  return SUBMITTABLE_TYPES.has(field.type);
}

export async function isFieldValueUnique(args: {
  formId: string;
  fieldKey: string;
  value: unknown;
  excludeSubmissionId?: string;
}): Promise<boolean> {
  const { formId, fieldKey, value, excludeSubmissionId } = args;
  if (value === undefined || value === null || String(value).trim() === "") {
    return true;
  }
  const submissions = await prisma.submission.findMany({
    where: { formId },
    select: { id: true, data: true },
  });
  for (const submission of submissions) {
    if (excludeSubmissionId && submission.id === excludeSubmissionId) {
      continue;
    }
    const data =
      submission.data && typeof submission.data === "object"
        ? (submission.data as SubmissionData)
        : {};
    if (submissionValueEquals(data[fieldKey], value)) {
      return false;
    }
  }
  return true;
}

export async function doesUserExist(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  const identity = await prisma.authIdentity.findUnique({
    where: {
      providerName_providerUserId: {
        providerName: "username",
        providerUserId: normalized,
      },
    },
  });
  return Boolean(identity);
}

/**
 * Enforce sync + unique + userExists validators. Throws HttpError(400).
 */
export async function assertSubmissionDataValid(args: {
  fields: FormField[];
  data: SubmissionData;
  formId: string;
  excludeSubmissionId?: string;
}): Promise<void> {
  const { fields, data, formId, excludeSubmissionId } = args;

  for (const field of fields) {
    if (!isSubmittableField(field)) {
      continue;
    }
    if (field.type === "captcha") {
      continue;
    }
    if (
      field.visibleWhen &&
      !evaluateCondition(field.visibleWhen, data)
    ) {
      continue;
    }

    const value = data[field.key];
    const syncError = validateFieldSync(field, value, data, fields);
    if (syncError) {
      throw new HttpError(400, `${field.label}: ${syncError}`);
    }

    const validation = field.validation;
    if (!validation || isEmptyValue(field, value)) {
      continue;
    }

    if (validation.unique) {
      const unique = await isFieldValueUnique({
        formId,
        fieldKey: field.key,
        value,
        excludeSubmissionId,
      });
      if (!unique) {
        throw new HttpError(
          400,
          `${field.label}: ${
            validation.uniqueMessage ||
            "This value has already been submitted"
          }`,
        );
      }
    }

    if (validation.userExists || validation.emailExists) {
      const exists = await doesUserExist(String(value));
      if (!exists) {
        throw new HttpError(
          400,
          `${field.label}: ${
            validation.emailExists
              ? validation.emailExistsMessage ||
                "No account with that email exists"
              : validation.userExistsMessage ||
                "No user with that email exists"
          }`,
        );
      }
    }
  }
}
