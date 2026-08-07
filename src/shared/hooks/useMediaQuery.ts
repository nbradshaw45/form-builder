import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query. Returns false during SSR / first paint until
 * the match is known (safe default for progressive enhancement).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export const MD_UP = "(min-width: 768px)";
export const LG_UP = "(min-width: 1024px)";
export const XL_UP = "(min-width: 1280px)";
