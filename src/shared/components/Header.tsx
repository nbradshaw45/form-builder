import { useState } from "react";
import { logout, useAuth } from "wasp/client/auth";
import { Link } from "wasp/client/router";
import { Button, ButtonLink } from "./Button";
import { Sheet } from "../../components/Sheet";
import { MD_UP, useMediaQuery } from "../hooks/useMediaQuery";

function MenuIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function Header() {
  const { data: user } = useAuth();
  const isMdUp = useMediaQuery(MD_UP);
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  const navLinks = user ? (
    <>
      <li>
        <ButtonLink to="/forms" variant="ghost" size="sm" onClick={closeMenu}>
          Forms
        </ButtonLink>
      </li>
      <li>
        <ButtonLink to="/audit" variant="ghost" size="sm" onClick={closeMenu}>
          Audit
        </ButtonLink>
      </li>
      <li>
        <ButtonLink to="/docs" variant="ghost" size="sm" onClick={closeMenu}>
          Wiki
        </ButtonLink>
      </li>
      {user.role === "ADMIN" && (
        <li>
          <ButtonLink
            to="/admin/users"
            variant="ghost"
            size="sm"
            onClick={closeMenu}
          >
            Users
          </ButtonLink>
        </li>
      )}
      {user.role !== "VIEWER" && (
        <li>
          <ButtonLink to="/forms/new" variant="primary" size="sm" onClick={closeMenu}>
            New form
          </ButtonLink>
        </li>
      )}
    </>
  ) : (
    <>
      <li>
        <ButtonLink to="/signup" size="sm" onClick={closeMenu}>
          Sign up
        </ButtonLink>
      </li>
      <li>
        <ButtonLink to="/login" variant="ghost" size="sm" onClick={closeMenu}>
          Login
        </ButtonLink>
      </li>
    </>
  );

  return (
    <header className="sticky top-0 z-10 flex justify-center border-b border-neutral-200 bg-white">
      <div className="flex w-full max-w-(--breakpoint-2xl) items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
        <Link
          to={user ? "/forms" : "/login"}
          className="flex min-w-0 items-center gap-2.5"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-600 text-[13px] font-bold text-white">
            F
          </span>
          <h1 className="truncate font-display text-lg font-bold tracking-[-0.02em] text-neutral-800">
            Form Builder
          </h1>
        </Link>

        {isMdUp ? (
          <nav>
            <ul className="flex items-center gap-3 font-semibold">
              {navLinks}
              {user && (
                <>
                  <li className="hidden px-1 text-xs text-neutral-500 lg:block">
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
              )}
            </ul>
          </nav>
        ) : (
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
        )}
      </div>

      {!isMdUp && menuOpen && (
        <Sheet title="Menu" onClose={closeMenu}>
          <nav>
            <ul className="flex flex-col gap-1 font-semibold [&_a]:flex [&_a]:min-h-11 [&_a]:items-center [&_button]:min-h-11 [&_button]:w-full">
              {navLinks}
              {user && (
                <li className="mt-2 border-t border-neutral-100 pt-3">
                  <p className="mb-2 px-1 text-xs text-neutral-500">
                    {user.name
                      ? `${user.name} · ${user.identities.username?.id ?? "user"}`
                      : `Signed in as ${user.identities.username?.id ?? "user"}`}
                  </p>
                  <Button
                    onClick={() => {
                      closeMenu();
                      void logout();
                    }}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                  >
                    Log out
                  </Button>
                </li>
              )}
            </ul>
          </nav>
        </Sheet>
      )}
    </header>
  );
}
