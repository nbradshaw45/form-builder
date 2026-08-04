import { Navigate } from "react-router";

export function RedirectToForms() {
  return <Navigate to="/forms" replace />;
}
