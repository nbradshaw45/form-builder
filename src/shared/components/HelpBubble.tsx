import { useLayoutEffect, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "wasp/client/router";
import { twJoin } from "tailwind-merge";
import { QuestionMarkIcon } from "../../components/builder/icons";
import { ARTICLE_INDEX } from "../../wiki/articles";

type HelpBubbleProps = {
  /** Wiki article id to link to. */
  article: string;
  /** Short bubble text; falls back to the article's summary. */
  summary?: string;
  /** Preferred alignment relative to the icon; the popover flips to fit the viewport. */
  align?: "left" | "right";
  className?: string;
};

const POPOVER_WIDTH = 288;
const EDGE_MARGIN = 8;
const GAP = 8;

function positionPopover(
  button: DOMRect,
  popoverSize: { width: number; height: number },
  align: "left" | "right",
): { top: number; left: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(popoverSize.width || POPOVER_WIDTH, viewportWidth - EDGE_MARGIN * 2);
  const height = popoverSize.height;

  let top: number;
  const below = button.bottom + GAP;
  const above = button.top - GAP - height;
  if (height > 0 && above >= EDGE_MARGIN && below + height > viewportHeight - EDGE_MARGIN) {
    top = above;
  } else {
    top = below;
  }
  top = Math.max(EDGE_MARGIN, Math.min(top, Math.max(EDGE_MARGIN, viewportHeight - height - EDGE_MARGIN)));

  let left = align === "right" ? button.right - width : button.left;
  if (left + width > viewportWidth - EDGE_MARGIN) {
    left = button.right - width;
  }
  if (left < EDGE_MARGIN) {
    left = EDGE_MARGIN;
  }
  left = Math.min(left, Math.max(EDGE_MARGIN, viewportWidth - width - EDGE_MARGIN));

  return { top, left };
}

/**
 * Small question-mark icon that opens a popover with a short explanation
 * and a link to the full wiki article. The popover is rendered in a portal
 * and repositioned to stay inside the viewport (it never gets clipped by
 * parent overflow or the edge of the screen).
 */
export function HelpBubble({
  article,
  summary,
  align = "left",
  className,
}: HelpBubbleProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  function placePopover() {
    const button = rootRef.current;
    const popover = popoverRef.current;
    if (!button) {
      return;
    }
    const size = popover
      ? {
          width: popover.getBoundingClientRect().width,
          height: popover.getBoundingClientRect().height,
        }
      : { width: POPOVER_WIDTH, height: 0 };
    setCoords(
      positionPopover(button.getBoundingClientRect(), size, align),
    );
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
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

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    placePopover();
    window.addEventListener("resize", placePopover);
    window.addEventListener("scroll", placePopover, true);
    return () => {
      window.removeEventListener("resize", placePopover);
      window.removeEventListener("scroll", placePopover, true);
    };
  }, [open, align]);

  const entry = ARTICLE_INDEX.get(article);
  const text = summary ?? entry?.summary ?? "Learn more in the documentation.";

  return (
    <div ref={rootRef} className={twJoin("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={`Help: ${entry?.title ?? article}`}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          if (!open) {
            placePopover();
            setOpen(true);
          } else {
            setOpen(false);
          }
        }}
        className={twJoin(
          "grid size-4.5 shrink-0 place-items-center rounded-full border text-[10.5px] font-bold leading-none transition-colors",
          open
            ? "border-primary-500 bg-primary-600 text-white"
            : "border-neutral-300 bg-white text-neutral-400 hover:border-primary-400 hover:text-primary-600",
        )}
      >
        ?
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            id={popoverId}
            ref={popoverRef}
            role="tooltip"
            style={{
              top: coords.top,
              left: coords.left,
              width: POPOVER_WIDTH,
              maxWidth: "calc(100vw - 16px)",
            }}
            className="fixed z-50 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-lg"
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
          </div>,
          document.body,
        )}
    </div>
  );
}
