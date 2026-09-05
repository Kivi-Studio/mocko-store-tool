/**
 * Version handling for release folders.
 *
 * A release is a folder whose name carries the app version — `"Mocko 1.2.0"`.
 * Splitting that name into base + version lets "New version…" suggest the next
 * number instead of making you retype the whole name.
 */

/** A three-segment version. Missing segments read as 0. */
export type Version = { major: number; minor: number; patch: number };

/** Which segment a bump increments. */
export type BumpKind = "major" | "minor" | "patch";

/** A folder name split into its app name and its trailing version. */
export type VersionedName = { base: string; version: Version | null };

export const FIRST_VERSION: Version = { major: 1, minor: 0, patch: 0 };

/**
 * Trailing version in a name. At least one dot is required so that a name like
 * "Angry Birds 2" stays a plain name rather than becoming version 2.0.0.
 */
const VERSION_SUFFIX = /^(.*?)[\s_-]*v?(\d+)\.(\d+)(?:\.(\d+))?$/;

/** A standalone version string, as typed into the dialog's version field. */
const VERSION_ONLY = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?\s*$/;

function toSegment(raw: string | undefined): number {
  const n = Number(raw ?? 0);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

/** Parses a standalone version string, or `null` when it isn't one. */
export function parseVersion(text: string): Version | null {
  const m = VERSION_ONLY.exec(text);
  if (!m) return null;
  return {
    major: toSegment(m[1]),
    minor: toSegment(m[2]),
    patch: toSegment(m[3]),
  };
}

/**
 * Splits a folder name into its base and trailing version.
 * `"Mocko 1.2.0"` → `{ base: "Mocko", version: { 1, 2, 0 } }`;
 * a name without a version yields `{ base: <name>, version: null }`.
 */
export function parseVersionedName(name: string): VersionedName {
  const trimmed = name.trim();
  const m = VERSION_SUFFIX.exec(trimmed);
  if (!m) return { base: trimmed, version: null };
  return {
    base: m[1].trim(),
    version: {
      major: toSegment(m[2]),
      minor: toSegment(m[3]),
      patch: toSegment(m[4]),
    },
  };
}

/** Always renders all three segments, so bumps stay visually consistent. */
export function formatVersion(v: Version): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

/** Recombines a base name and a version; a blank base yields just the version. */
export function formatVersionedName(base: string, v: Version): string {
  const trimmed = base.trim();
  return trimmed ? `${trimmed} ${formatVersion(v)}` : formatVersion(v);
}

/** The next version after `v`, incrementing one segment and zeroing the rest. */
export function bumpVersion(v: Version, kind: BumpKind): Version {
  if (kind === "major") return { major: v.major + 1, minor: 0, patch: 0 };
  if (kind === "minor") return { major: v.major, minor: v.minor + 1, patch: 0 };
  return { major: v.major, minor: v.minor, patch: v.patch + 1 };
}

/**
 * The version to offer for a folder's next release: the parsed version bumped,
 * or {@link FIRST_VERSION} when the name carries none yet.
 */
export function suggestNextVersion(name: string, kind: BumpKind): Version {
  const { version } = parseVersionedName(name);
  return version ? bumpVersion(version, kind) : FIRST_VERSION;
}
