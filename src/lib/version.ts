/**
 * App release version and build number, surfaced to the UI.
 *
 * Both are injected by `next.config.ts` and inlined into the bundle at build
 * time: the version from `package.json` (the single source of truth), the
 * build number from the build time (yyyyMMddHHmm). The fallbacks only apply
 * outside a Next build (e.g. unit tests).
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
export const APP_BUILD = process.env.NEXT_PUBLIC_APP_BUILD ?? "0";

/** "1.3.0 (202609061442)", the way app stores print version and build. */
export function appVersionLabel(version: string, build: string): string {
  return build && build !== "0" ? `${version} (${build})` : version;
}

export const APP_VERSION_LABEL = appVersionLabel(APP_VERSION, APP_BUILD);
