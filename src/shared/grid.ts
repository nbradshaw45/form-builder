import type { CSSProperties } from "react";

export const GRID_COLUMNS = 12;

export function columnWidthPercent(width?: number): number {
  const clamped = Math.min(
    GRID_COLUMNS,
    Math.max(1, Math.round(width ?? GRID_COLUMNS)),
  );
  return (clamped / GRID_COLUMNS) * 100;
}

export function columnStyle(width?: number): CSSProperties {
  return { width: `${columnWidthPercent(width)}%` };
}

export const gridRowClasses = "flex w-full flex-wrap";

export function gridColumnClasses(): string {
  return "mb-4 box-border min-w-0 px-1.5 max-md:!w-full";
}
