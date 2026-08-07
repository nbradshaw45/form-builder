import { HttpError, prisma } from "wasp/server";
import {
  applyLogic,
  RECORD_MODE_KEY,
  RECORD_MODE_NEW,
  RECORD_MODE_UPDATE,
} from "../shared/logic";
import {
  isEmptyValue,
  submissionValueEquals,
  validateFieldSync,
} from "../shared/fieldValidation";
import { isEffectivelyVisible } from "../shared/visibility";
import type {
  FormField,
  LogicCondition,
  SubmissionData,
} from "../types";

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
  "math",
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
 * Skips fields that are not effectively visible (visibleWhen, form logic
 * hide/show, or a hidden parent section). Hidden fields are never required.
 */
export async function assertSubmissionDataValid(args: {
  fields: FormField[];
  data: SubmissionData;
  formId: string;
  excludeSubmissionId?: string;
  conditions?: LogicCondition[];
  recordMode?: "new" | "update";
}): Promise<void> {
  const {
    fields,
    data,
    formId,
    excludeSubmissionId,
    conditions,
    recordMode = "new",
  } = args;

  const evalData: SubmissionData = {
    ...data,
    [RECORD_MODE_KEY]:
      recordMode === "update" ? RECORD_MODE_UPDATE : RECORD_MODE_NEW,
  };
  const logic = applyLogic(conditions ?? [], evalData, fields);

  for (const field of fields) {
    if (!isSubmittableField(field)) {
      continue;
    }
    if (field.type === "captcha") {
      continue;
    }
    if (
      !isEffectivelyVisible(field, evalData, fields, logic.visible)
    ) {
      continue;
    }

    const value = data[field.key];
    const syncError = validateFieldSync(field, value, evalData, fields, {
      logicVisible: logic.visible,
    });
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
