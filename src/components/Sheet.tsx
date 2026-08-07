import { type ReactNode, useEffect } from "react";
import { twJoin } from "tailwind-merge";

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Optional class on the panel (e.g. taller sheets). */
  className?: string;
}

/**
 * Bottom-anchored drawer for mobile/tablet panels (nav, builder palette/inspector).
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  className,
}: SheetProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={twJoin(
          "flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-neutral-200 bg-white shadow-lg sm:max-w-lg sm:rounded-[14px]",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
          <h2 className="font-display text-base font-bold tracking-[-0.02em] text-neutral-800">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
            aria-label="Close"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-neutral-100 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
