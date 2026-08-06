import { type ReactNode } from "react";
import { twJoin } from "tailwind-merge";

export function H2({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="mt-9 scroll-mt-20 font-display text-xl font-bold tracking-[-0.02em] text-neutral-900"
    >
      {children}
    </h2>
  );
}

export function H3({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <h3
      id={id}
      className="mt-6 scroll-mt-20 font-display text-[15px] font-bold tracking-[-0.015em] text-neutral-900"
    >
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-[13.5px] leading-relaxed text-neutral-600">
      {children}
    </p>
  );
}

export function Ul({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] leading-relaxed text-neutral-600 marker:text-primary-400">
      {children}
    </ul>
  );
}

export function Ol({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-[13.5px] leading-relaxed text-neutral-600 marker:text-primary-400">
      {children}
    </ol>
  );
}

export function Li({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px] font-medium text-neutral-800">
      {children}
    </code>
  );
}

export function CodeBlock({
  title,
  children,
}: {
  title?: string;
  children: string;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950">
      {title && (
        <div className="flex items-center gap-2 border-b border-neutral-800 px-3.5 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-700" />
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-700" />
          <span className="ml-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            {title}
          </span>
        </div>
      )}
      <pre className="overflow-x-auto px-4 py-3.5">
        <code className="font-mono text-[12.5px] leading-relaxed text-neutral-100">
          {children}
        </code>
      </pre>
    </div>
  );
}

export function Table({
  head,
  rows,
}: {
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {head.map((cell) => (
              <th
                key={cell}
                className="border-b border-neutral-200 bg-neutral-50 px-3.5 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="align-top">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="border-b border-neutral-100 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-neutral-700 last-of-type:border-b-0"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Note({
  title = "Note",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 flex gap-2.5 rounded-xl border border-info/20 bg-info-soft p-3.5">
      <span className="mt-px shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-info">
        {title}
      </span>
      <div className="text-[12.5px] leading-relaxed text-neutral-700">
        {children}
      </div>
    </div>
  );
}

export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex gap-2.5 rounded-xl border border-success/20 bg-success-soft p-3.5">
      <span className="mt-px shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-success">
        Tip
      </span>
      <div className="text-[12.5px] leading-relaxed text-neutral-700">
        {children}
      </div>
    </div>
  );
}

export function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex gap-2.5 rounded-xl border border-warning/20 bg-warning-soft p-3.5">
      <span className="mt-px shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-warning">
        Warning
      </span>
      <div className="text-[12.5px] leading-relaxed text-neutral-700">
        {children}
      </div>
    </div>
  );
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "danger" | "success";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-neutral-100 text-neutral-600",
    primary: "bg-primary-50 text-primary-700",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
  };
  return (
    <span
      className={twJoin(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Setting({
  name,
  children,
}: {
  name: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-3.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-neutral-800">
        {name}
      </div>
      <div className="mt-1 text-[12.5px] leading-relaxed text-neutral-600">
        {children}
      </div>
    </div>
  );
}
