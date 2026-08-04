import { action, app, page, query, route } from "@wasp.sh/spec";
import { App } from "./src/App" with { type: "ref" };
import {
  createForm,
  deleteForm,
  deleteSubmission,
  removeFormAccess,
  setFormAccess,
  submitForm,
  updateForm,
  updateSubmission,
  updateUser,
} from "./src/actions" with { type: "ref" };
import {
  getForm,
  getFormAccess,
  getFormSubmissions,
  getForms,
  getUsers,
} from "./src/queries" with { type: "ref" };
import { LoginPage } from "./src/auth/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/auth/SignupPage" with { type: "ref" };
import { FormBuilderPage } from "./src/pages/FormBuilderPage" with { type: "ref" };
import { FormManagementPage } from "./src/pages/FormManagementPage" with { type: "ref" };
import { FormPage } from "./src/pages/FormPage" with { type: "ref" };
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
  client: {
    rootComponent: App,
  },
  spec: [
    route("DashboardRoute", "/", page(RedirectToForms, { authRequired: true })),
    route("FormsRoute", "/forms", page(FormManagementPage, { authRequired: true })),
    route("CreateFormRoute", "/forms/new", page(FormBuilderPage, { authRequired: true })),
    route("FormEditRoute", "/forms/:id/edit", page(FormBuilderPage, { authRequired: true })),
    route("FormRoute", "/forms/:id", page(FormPage)),
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
    query(getFormSubmissions, { entities: ["Form", "FormAccess", "Submission"] }),
    query(getUsers, { entities: ["User"] }),
    query(getFormAccess, { entities: ["Form", "FormAccess", "User"] }),
    action(createForm, { entities: ["Form"] }),
    action(updateForm, { entities: ["Form", "FormAccess", "User"] }),
    action(deleteForm, { entities: ["Form", "FormAccess", "User"] }),
    action(submitForm, { entities: ["Form", "Submission"], auth: false }),
    action(updateSubmission, { entities: ["Submission", "Form", "FormAccess", "User"] }),
    action(deleteSubmission, { entities: ["Submission", "Form", "FormAccess", "User"] }),
    action(updateUser, { entities: ["User"] }),
    action(setFormAccess, {
      entities: ["FormAccess", "Form", "User"],
    }),
    action(removeFormAccess, { entities: ["FormAccess", "Form", "User"] }),
  ],
});
