/**
 * Color validation for user- and file-provided values.
 *
 * Colors flow into inline `background`/`color` CSS and into the exported PNG.
 * Restricting them to hex notation rules out CSS injection such as
 * `url(https://…)` (a valid `background` shorthand that would trigger remote
 * fetches whenever a design renders or exports).
 */
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** True when the string is a #rgb/#rgba/#rrggbb/#rrggbbaa hex color. */
export function isHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value.trim());
}

/** Returns the trimmed color if it is a safe hex value, else the fallback. */
export function safeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return isHexColor(trimmed) ? trimmed : fallback;
}
