/**
 * App release version, surfaced to the UI.
 *
 * The value is injected from `package.json` via `next.config.ts` (the single
 * source of truth) and inlined into the bundle at build time. The fallback
 * only applies outside a Next build (e.g. unit tests).
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
