/** Audit action vocabulary (stored on AuditEvent.action). */
export const AUDIT_ACTIONS = {
  FORM_CREATED: "form.created",
  FORM_UPDATED: "form.updated",
  FORM_DELETED: "form.deleted",
  FORM_TEMPLATE_SAVED: "form.template_saved",
  FORM_TEMPLATE_RENAMED: "form.template_renamed",
  SUBMISSION_CREATED: "submission.created",
  SUBMISSION_UPDATED: "submission.updated",
  SUBMISSION_DELETED: "submission.deleted",
  ACCESS_GRANTED: "access.granted",
  ACCESS_UPDATED: "access.updated",
  ACCESS_REVOKED: "access.revoked",
  ACTION_RAN: "action.ran",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ENTITY_TYPES = {
  FORM: "Form",
  SUBMISSION: "Submission",
  FORM_ACCESS: "FormAccess",
  FORM_ACTION: "FormAction",
} as const;

export type AuditEntityType =
  (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  [AUDIT_ACTIONS.FORM_CREATED]: "Form created",
  [AUDIT_ACTIONS.FORM_UPDATED]: "Form updated",
  [AUDIT_ACTIONS.FORM_DELETED]: "Form deleted",
  [AUDIT_ACTIONS.FORM_TEMPLATE_SAVED]: "Saved as template",
  [AUDIT_ACTIONS.FORM_TEMPLATE_RENAMED]: "Template renamed",
  [AUDIT_ACTIONS.SUBMISSION_CREATED]: "Submission created",
  [AUDIT_ACTIONS.SUBMISSION_UPDATED]: "Submission updated",
  [AUDIT_ACTIONS.SUBMISSION_DELETED]: "Submission deleted",
  [AUDIT_ACTIONS.ACCESS_GRANTED]: "Access granted",
  [AUDIT_ACTIONS.ACCESS_UPDATED]: "Access updated",
  [AUDIT_ACTIONS.ACCESS_REVOKED]: "Access revoked",
  [AUDIT_ACTIONS.ACTION_RAN]: "Form action ran",
};

export type SubmissionFieldChange = {
  key: string;
  label: string;
  from: unknown;
  to: unknown;
};

export type FormDefinitionDiff = {
  title?: { from: string; to: string };
  fieldsAdded: string[];
  fieldsRemoved: string[];
  fieldsModified: string[];
  settingsChanged: string[];
};
