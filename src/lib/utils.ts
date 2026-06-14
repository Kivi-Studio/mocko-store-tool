import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generates a short, collision-resistant id for designs and overlays. */
export function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

/** Clamps a number into the inclusive [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Coerces a value to a finite number, falling back when it isn't one. */
export function finiteOr(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Returns `desired` if it isn't already in `taken`, otherwise appends a
 * numeric suffix (" (2)", " (3)", …) until the result is free. Comparison is
 * exact (callers pass already-trimmed names).
 */
export function uniqueName(desired: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(desired)) return desired;
  let n = 2;
  while (set.has(`${desired} (${n})`)) n++;
  return `${desired} (${n})`;
}

/** Makes a string safe to use as a filename segment. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "design"
  );
}
