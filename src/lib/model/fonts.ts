/**
 * Font choices for captions.
 *
 * The selected value is written straight into `CanvasRenderingContext2D.font`,
 * so, like colors, it is restricted to a known allowlist. An imported project
 * that carries an unknown font string falls back to the default rather than
 * letting arbitrary text reach the canvas font shorthand.
 */
export type FontOption = {
  label: string;
  value: string;
};

export const FONT_OPTIONS: readonly FontOption[] = [
  {
    label: "System (Sans)",
    value:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Trebuchet", value: "'Trebuchet MS', Verdana, sans-serif" },
  { label: "Mono", value: "'Courier New', monospace" },
] as const;

export const DEFAULT_FONT = FONT_OPTIONS[0].value;

/** Returns the font stack if it is a known option, else the fallback. */
export function safeFont(
  value: unknown,
  fallback: string = DEFAULT_FONT,
): string {
  return typeof value === "string" &&
    FONT_OPTIONS.some((f) => f.value === value)
    ? value
    : fallback;
}
