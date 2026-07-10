/**
 * Core domain types for the Screenshot Studio.
 *
 * The model is intentionally flat: a Project holds one set of global styling
 * (preset/format, background, text, device) plus an ordered list of shots
 * (uploaded screenshots with a per-shot claim and subtext). Every shot in a
 * project is rendered with the same styling, which keeps a store listing
 * visually consistent and the UI simple.
 *
 * Sizes that scale with the artboard (font sizes, device width, top space) are
 * stored as fractions (0..1) so they stay resolution-independent between the
 * scaled-down preview and the full-resolution export.
 */

/** The mockup drawn behind a screenshot. `none` = frameless (e.g. banner). */
export type DeviceKind =
  | "iphone"
  | "ipad"
  | "android-phone"
  | "android-tablet"
  | "none";

/** Encoded output type. JPEG is required/recommended for some Play assets. */
export type FileType = "png" | "jpeg";

/** A store export target: pixel dimensions, device mockup and file type. */
export type Preset = {
  id: string;
  name: string;
  w: number;
  h: number;
  device: DeviceKind;
  fileType: FileType;
};

export type TextAlign = "left" | "center" | "right";

export type SolidBackground = {
  type: "solid";
  color: string;
};

export type GradientBackground = {
  type: "gradient";
  from: string;
  to: string;
  /** Angle in degrees (0 = left→right, grows clockwise). */
  angle: number;
};

export type ImageBackground = {
  type: "image";
  /** Background image as a data URL, or null when none chosen yet. */
  image: string | null;
};

export type Background = SolidBackground | GradientBackground | ImageBackground;

/** Global text styling shared by every shot's claim and subtext. */
export type TextStyle = {
  color: string;
  align: TextAlign;
  /** Font-family CSS stack; validated against a known allowlist. */
  font: string;
  /** Claim (headline) size as a fraction of canvas width. */
  claimSize: number;
  /** Subtext size as a fraction of canvas width. */
  subSize: number;
};

/** Global device-mockup styling shared by every shot. */
export type DeviceStyle = {
  /** Frame body color (hex). */
  frameColor: string;
  /** Draw a thin contour so the frame stays visible on same-color backgrounds. */
  edge: boolean;
  /** Device width as a fraction of canvas width. */
  scale: number;
  /** Height of the top text area as a fraction of canvas height. */
  topSpace: number;
};

/** A single uploaded screenshot with its caption. */
export type Shot = {
  id: string;
  /** The screenshot as a data URL, or null for the empty placeholder. */
  image: string | null;
  /** Headline shown above the device. */
  claim: string;
  /** Optional supporting line shown under the claim. */
  sub: string;
};

/** A collection of shots sharing one styling, exported to one store format. */
export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Selected export preset (see `@/lib/presets`). */
  presetId: string;
  background: Background;
  text: TextStyle;
  device: DeviceStyle;
  /** Ordered screenshots. */
  shots: Shot[];
};
