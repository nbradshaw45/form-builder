import { logout, useAuth } from "wasp/client/auth";
import { Link } from "wasp/client/router";
import { Button, ButtonLink } from "./Button";

export function Header() {
  const { data: user } = useAuth();

  return (
    <header className="sticky top-0 z-10 flex justify-center border-b border-neutral-200 bg-white">
      <div className="flex w-full max-w-(--breakpoint-2xl) items-center justify-between gap-4 px-8 py-3.5">
        <Link
          to={user ? "/forms" : "/login"}
          className="flex items-center gap-2.5"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-primary-600 text-[13px] font-bold text-white">
            F
          </span>
          <h1 className="font-display text-lg font-bold tracking-[-0.02em] text-neutral-800">
            Form Builder
          </h1>
        </Link>
        <nav>
          <ul className="flex items-center gap-3 font-semibold">
            {user ? (
              <>
                <li>
                  <ButtonLink to="/forms" variant="ghost" size="sm">
                    Forms
                  </ButtonLink>
                </li>
                {user.role === "ADMIN" && (
                  <li>
                    <ButtonLink to="/admin/users" variant="ghost" size="sm">
                      Users
                    </ButtonLink>
                  </li>
                )}
                {user.role !== "VIEWER" && (
                  <li>
                    <ButtonLink to="/forms/new" variant="primary" size="sm">
                      New form
                    </ButtonLink>
                  </li>
                )}
                <li className="hidden px-1 text-xs text-neutral-500 sm:block">
                  {user.name
                    ? `${user.name} · ${user.identities.username?.id ?? "user"}`
                    : `Signed in as ${user.identities.username?.id ?? "user"}`}
                </li>
                <li>
                  <Button onClick={logout} variant="ghost" size="sm">
                    Log out
                  </Button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <ButtonLink to="/signup" size="sm">
                    Sign up
                  </ButtonLink>
                </li>
                <li>
                  <ButtonLink to="/login" variant="ghost" size="sm">
                    Login
                  </ButtonLink>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
