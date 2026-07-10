/**
 * Shared value ranges and size caps.
 *
 * The styling ranges drive the editor's sliders AND the `.json` import
 * normalizers, so an imported file can never carry values outside what the
 * editor itself allows.
 */

/** Claim (headline) size, as a fraction of canvas width. */
export const CLAIM_SIZE_MIN = 0.03;
export const CLAIM_SIZE_MAX = 0.09;

/** Subtext size, as a fraction of canvas width. */
export const SUB_SIZE_MIN = 0.018;
export const SUB_SIZE_MAX = 0.06;

/** Device width, as a fraction of canvas width. */
export const DEVICE_SCALE_MIN = 0.5;
export const DEVICE_SCALE_MAX = 0.95;

/** Top text-area height, as a fraction of canvas height. */
export const TOP_SPACE_MIN = 0.14;
export const TOP_SPACE_MAX = 0.42;

/** Gradient angle bounds, in degrees. */
export const GRADIENT_ANGLE_MIN = 0;
export const GRADIENT_ANGLE_MAX = 360;

/** Maximum length of a claim or subtext. */
export const CAPTION_MAX_LENGTH = 2000;

/** Maximum shots kept from a single imported project. */
export const MAX_SHOTS_PER_PROJECT = 60;

/** Screenshot uploads: allowed types and maximum file size. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** A `.studio` archive (ZIP) is decompressed fully in memory, so it is capped. */
export const MAX_PROJECT_FILE_BYTES = 80 * 1024 * 1024;
/** Manifest JSON size cap (guards against a huge inline payload). */
export const MAX_MANIFEST_CHARS = 5 * 1024 * 1024;
