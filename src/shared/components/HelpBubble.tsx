import { useEffect, useId, useRef, useState } from "react";
import { Link } from "wasp/client/router";
import { twJoin } from "tailwind-merge";
import { QuestionMarkIcon } from "../../components/builder/icons";
import { ARTICLE_INDEX } from "../../wiki/articles";

type HelpBubbleProps = {
  /** Wiki article id to link to. */
  article: string;
  /** Short bubble text; falls back to the article's summary. */
  summary?: string;
  /** Align the popover relative to the icon. Defaults to "left". */
  align?: "left" | "right";
  className?: string;
};

/**
 * Small question-mark icon that opens a popover with a short explanation
 * and a link to the full wiki article.
 */
export function HelpBubble({
  article,
  summary,
  align = "left",
  className,
}: HelpBubbleProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const entry = ARTICLE_INDEX.get(article);
  const text = summary ?? entry?.summary ?? "Learn more in the documentation.";

  return (
    <div ref={rootRef} className={twJoin("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={`Help: ${entry?.title ?? article}`}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        className={twJoin(
          "grid size-4.5 shrink-0 place-items-center rounded-full border text-[10.5px] font-bold leading-none transition-colors",
          open
            ? "border-primary-500 bg-primary-600 text-white"
            : "border-neutral-300 bg-white text-neutral-400 hover:border-primary-400 hover:text-primary-600",
        )}
      >
        ?
      </button>
      {open && (
        <div
          id={popoverId}
          role="tooltip"
          className={twJoin(
            "absolute top-6 z-40 w-72 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <p className="text-[12.5px] leading-relaxed text-neutral-600">
            {text}
          </p>
          <Link
            to="/docs"
            search={{ article }}
            onClick={() => setOpen(false)}
            className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary-600 hover:text-primary-700"
          >
            Learn more in the wiki
          </Link>
        </div>
      )}
    </div>
  );
}
