export const inputClasses =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[13px] text-neutral-800 outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:border-primary-600 focus:shadow-[0_0_0_3px_#EFF6FF] disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400";

export const textareaClasses = `${inputClasses} min-h-24 resize-y leading-relaxed`;

export const selectClasses = `${inputClasses} select-input`;

export const labelClasses = "text-xs font-semibold tracking-[-0.005em] text-neutral-800";

export const fieldClasses = "flex min-w-0 flex-col gap-1.5";

export const helpTextClasses = "text-[11.5px] leading-snug text-neutral-500";

export const errorTextClasses = "text-[11.5px] text-danger";

/** Shared horizontal/vertical padding for page content shells. */
export const pageShellClasses =
  "mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8";

export const pageShellNarrowClasses =
  "mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:px-8";
