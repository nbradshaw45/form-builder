import { action, app, page, query, route } from "@wasp.sh/spec";
import { App } from "./src/App" with { type: "ref" };
import { serverMiddlewareFn } from "./src/serverSetup" with { type: "ref" };
import {
  addUser,
  createForm,
  createFormFromTemplate,
  deleteForm,
  deleteSubmission,
  deleteSubmissions,
  deleteUser,
  duplicateForm,
  importForm,
  removeFormAccess,
  saveFormAsTemplate,
  setFormAccess,
  submitForm,
  updateForm,
  updateSubmission,
  updateSubmissionByToken,
  updateUser,
  uploadFile,
} from "./src/actions" with { type: "ref" };
import {
  exportForm,
  getFile,
  getForm,
  getFormAccess,
  getFormSubmissions,
  getFormTemplates,
  getFormUsers,
  getForms,
  getSubmission,
  getSubmissionByToken,
  getSubmissionPdf,
  getSubmissionsCsv,
  getSubmissionsExcel,
  getUsers,
} from "./src/queries" with { type: "ref" };
import { LoginPage } from "./src/auth/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/auth/SignupPage" with { type: "ref" };
import { FormBuilderPage } from "./src/pages/FormBuilderPage" with { type: "ref" };
import { FormManagementPage } from "./src/pages/FormManagementPage" with { type: "ref" };
import { FormPage } from "./src/pages/FormPage" with { type: "ref" };
import { FormRecordPage } from "./src/pages/FormRecordPage" with { type: "ref" };
import { FormEditPage } from "./src/pages/FormEditPage" with { type: "ref" };
import { FormSubmissionsPage } from "./src/pages/FormSubmissionsPage" with { type: "ref" };
import { RedirectToForms } from "./src/pages/RedirectToForms" with { type: "ref" };
import { AdminUsersPage } from "./src/pages/AdminUsersPage" with { type: "ref" };
import { FormAccessPage } from "./src/pages/FormAccessPage" with { type: "ref" };

export default app({
  name: "formBuilder",
  wasp: { version: "^0.25.0" },
  title: "Form Builder",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthSucceededRedirectTo: "/",
    onAuthFailedRedirectTo: "/login",
  },
  emailSender: {
    provider: "SMTP",
    defaultFrom: {
      name: "Form Builder",
      email: "noreply@formbuilder.local",
    },
  },
  client: {
    rootComponent: App,
  },
  server: {
    middlewareConfigFn: serverMiddlewareFn,
  },
  spec: [
    route("DashboardRoute", "/", page(RedirectToForms, { authRequired: true })),
    route("FormsRoute", "/forms", page(FormManagementPage, { authRequired: true })),
    route("CreateFormRoute", "/forms/new", page(FormBuilderPage, { authRequired: true })),
    route("FormEditRoute", "/forms/:id/edit", page(FormBuilderPage, { authRequired: true })),
    route("FormRoute", "/forms/:id", page(FormPage)),
    route(
      "FormRecordViewRoute",
      "/forms/:id/records/:submissionId",
      page(FormRecordPage),
    ),
    route(
      "FormRecordEditRoute",
      "/forms/:id/records/:submissionId/edit",
      page(FormEditPage),
    ),
    route(
      "FormSubmissionsRoute",
      "/forms/:id/submissions",
      page(FormSubmissionsPage, { authRequired: true }),
    ),
    route("FormAccessRoute", "/forms/:id/access", page(FormAccessPage, { authRequired: true })),
    route("AdminUsersRoute", "/admin/users", page(AdminUsersPage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),

    query(getForms, { entities: ["Form", "FormAccess", "User"] }),
    query(getForm, { entities: ["Form"], auth: false }),
    query(getFormTemplates, { entities: ["Form"] }),
    query(exportForm, { entities: ["Form", "FormAccess", "User"] }),
    query(getFormUsers, { entities: ["User"], auth: false }),
    query(getFile, { entities: ["UploadedFile", "Form", "FormAccess", "User"] }),
    query(getFormSubmissions, { entities: ["Form", "FormAccess", "Submission"] }),
    query(getSubmission, { entities: ["Submission", "Form", "FormAccess", "User"] }),
    query(getSubmissionByToken, {
      entities: ["Submission"],
      auth: false,
    }),
    query(getSubmissionsCsv, { entities: ["Form", "FormAccess", "Submission"] }),
    query(getSubmissionPdf, {
      entities: ["Form", "FormAccess", "Submission", "UploadedFile", "User"],
    }),
    query(getSubmissionsExcel, {
      entities: ["Form", "FormAccess", "Submission"],
    }),
    query(getUsers, { entities: ["User"] }),
    query(getFormAccess, { entities: ["Form", "FormAccess", "User"] }),
    action(createForm, { entities: ["Form"] }),
    action(updateForm, { entities: ["Form", "FormAccess", "User"] }),
    action(deleteForm, { entities: ["Form", "FormAccess", "User"] }),
    action(saveFormAsTemplate, { entities: ["Form", "FormAccess", "User"] }),
    action(duplicateForm, { entities: ["Form", "FormAccess", "User"] }),
    action(createFormFromTemplate, { entities: ["Form"] }),
    action(importForm, { entities: ["Form"] }),
    action(submitForm, { entities: ["Form", "Submission"], auth: false }),
    action(updateSubmission, { entities: ["Submission", "Form", "FormAccess", "User"] }),
    action(deleteSubmission, { entities: ["Submission", "Form", "FormAccess", "User"] }),
    action(updateUser, { entities: ["User"] }),
    action(addUser, { entities: ["User"] }),
    action(deleteUser, { entities: ["User"] }),
    action(deleteSubmissions, {
      entities: ["Submission", "Form", "FormAccess", "User"],
    }),
    action(uploadFile, { entities: ["UploadedFile", "Form"], auth: false }),
    action(updateSubmissionByToken, {
      entities: ["Submission", "Form"],
      auth: false,
    }),
    action(setFormAccess, {
      entities: ["FormAccess", "Form", "User"],
    }),
    action(removeFormAccess, { entities: ["FormAccess", "Form", "User"] }),
  ],
});
