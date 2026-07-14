/**
 * Core domain types for Mocko.
 *
 * The model is intentionally flat: a Project holds one set of global styling
 * (preset/format, background, text, device) plus an ordered list of shots
 * (uploaded screenshots with a per-shot caption). Every shot shares the same
 * global styling, which keeps a store listing visually consistent — the only
 * per-shot overrides are the device's position and (optionally) its size.
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
  /**
   * Maximum text block width as a fraction of canvas width (the text is
   * centered within it and wraps to it). 1 = full width, edge to edge.
   */
  textWidth: number;
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
  /**
   * Horizontal device offset as a fraction of canvas width (-0.5..+0.5);
   * 0 keeps the device horizontally centered.
   */
  offX: number;
  /**
   * Vertical device offset as a fraction of canvas height (-0.5..+0.5);
   * 0 keeps the device centered in its area.
   */
  offY: number;
  /**
   * Per-shot device width override, as a fraction of canvas width, or `null`
   * to fall back to the project-global {@link DeviceStyle.scale}.
   */
  scale: number | null;
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
  /**
   * Owning folder id, or `null` when the project lives at the gallery root.
   * Folders are a single flat level — a folder never contains another folder.
   */
  folderId: string | null;
};

/** A one-level grouping of projects in the gallery. */
export type Folder = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

/** How the gallery lists folders and projects. */
export type ViewMode = "grid" | "list";
