/**
 * Client- and server-safe shape for per-submission context tracking.
 * IP is filled server-side; the rest is collected in the browser.
 */
export type SubmissionContext = {
  ip?: string;
  userAgent?: string;
  language?: string;
  referrer?: string;
  sourcePage?: string;
  screen?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

/** Collect browser/URL context at submit time (client only). */
export function collectClientContext(): SubmissionContext {
  if (typeof window === "undefined") {
    return {};
  }
  const params = new URLSearchParams(window.location.search);
  const pick = (key: string) => params.get(key)?.trim() || undefined;
  return {
    userAgent: navigator.userAgent || undefined,
    language: navigator.language || undefined,
    referrer: document.referrer || undefined,
    sourcePage: window.location.href || undefined,
    screen:
      typeof window.screen?.width === "number"
        ? `${window.screen.width}x${window.screen.height}`
        : undefined,
    utmSource: pick("utm_source"),
    utmMedium: pick("utm_medium"),
    utmCampaign: pick("utm_campaign"),
    utmTerm: pick("utm_term"),
    utmContent: pick("utm_content"),
  };
}

export function formatContextLabel(key: keyof SubmissionContext): string {
  const labels: Record<keyof SubmissionContext, string> = {
    ip: "IP address",
    userAgent: "Browser",
    language: "Language",
    referrer: "Referrer",
    sourcePage: "Source page",
    screen: "Screen",
    utmSource: "UTM source",
    utmMedium: "UTM medium",
    utmCampaign: "UTM campaign",
    utmTerm: "UTM term",
    utmContent: "UTM content",
  };
  return labels[key];
}

export const CONTEXT_DISPLAY_KEYS: (keyof SubmissionContext)[] = [
  "ip",
  "referrer",
  "sourcePage",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmTerm",
  "utmContent",
  "language",
  "screen",
  "userAgent",
];
