import { type ReactNode } from "react";
import { twJoin } from "tailwind-merge";
import { SearchIcon } from "../../components/builder/icons";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return <section className={twJoin("card", className)}>{children}</section>;
}

interface CardHeadProps {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children?: ReactNode;
}

export function CardHead({ title, eyebrow, action, children }: CardHeadProps) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-b border-neutral-100 pb-4">
      <div className="min-w-0">
        {eyebrow && (
          <span className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            {eyebrow}
          </span>
        )}
        <h2 className="font-display text-base font-bold tracking-[-0.02em] text-neutral-800">
          {title}
        </h2>
        {children}
      </div>
      {action && <div className="shrink-0 pb-0.5">{action}</div>}
    </div>
  );
}

interface DataFootProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

interface DataToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  right?: ReactNode;
}

export function DataToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  right,
}: DataToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="relative min-w-[240px] flex-1 sm:max-w-[320px]">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search"
          className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-[13px] text-neutral-800 outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:border-primary-600 focus:shadow-[0_0_0_3px_#EFF6FF]"
        />
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function DataFoot({ left, right, className }: DataFootProps) {
  return (
    <div
      className={twJoin(
        "mt-4 flex items-center justify-between gap-4 border-t border-neutral-100 px-6 pb-6 pt-4 text-xs text-neutral-500",
        className,
      )}
    >
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}
