import { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center px-4 py-8 sm:px-6 sm:py-12">
      {/* Auth UI has margin-top on title, so we lower the top padding */}
      <div className="card mt-8 h-fit w-full max-w-md px-6 py-10 pt-4 sm:mt-16 sm:px-8">
        {children}
      </div>
    </div>
  );
}
