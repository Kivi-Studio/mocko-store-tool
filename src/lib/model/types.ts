/**
 * Core domain types for Mocko.
 *
 * The model is intentionally flat: a Project holds one set of global styling
 * (preset/format, background, text, device), the languages it is maintained in,
 * and an ordered list of shot positions. Every shot shares the same global
 * styling, which keeps a store listing visually consistent — the only per-shot
 * overrides are the device's position and (optionally) its size.
 *
 * One project therefore covers one store format in every language: the six
 * variants a cross-platform release used to need collapse to one per format.
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
  /** Content id of the background image (see `storage/image-store`), or null. */
  imageId: string | null;
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

/** A language a project maintains screenshots and captions for. */
export type Language = {
  /** BCP-47-ish code, used verbatim in export folder and file names. */
  code: string;
  /** Human-readable label shown in the UI. */
  label: string;
};

/** The text over one screenshot, in one language. */
export type Caption = {
  /** Headline shown above the device. */
  claim: string;
  /** Optional supporting line shown under the claim. */
  sub: string;
};

/**
 * One position in a store listing, across every language.
 *
 * A localized app looks different per language, so both the screenshot and the
 * caption vary — the shot is the *position* ("the third screenshot"), and each
 * language fills it with its own image and text. The device's placement is
 * shared: it is a layout decision about the position, not about a translation.
 *
 * Entries are absent until a language is filled in; read them through
 * `model/caption` rather than indexing directly.
 */
export type Shot = {
  id: string;
  /**
   * Content id of the screenshot per language code (see `storage/image-store`),
   * or null where a language has none yet. The bytes live outside the persisted
   * state so that keeping many releases neither bloats every autosave nor
   * stores the same unchanged screenshot once per version.
   */
  images: Record<string, string | null>;
  /** Caption per language code; a missing key means "not translated yet". */
  captions: Record<string, Caption>;
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
  /**
   * Languages this project maintains, in display order. Never empty; the first
   * is the default — the one the editor opens on and a single-language export
   * uses.
   */
  languages: Language[];
  /** Ordered screenshot positions. */
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
  /**
   * Explicit app membership, overriding the one derived from the folder name.
   * Normally a release folder groups under the base of its name — "Telly 1.3.0"
   * belongs to "Telly" — and this stays `null`. Set it to pull a folder whose
   * name does not follow that convention into an app anyway. Absent on folders
   * created before apps existed, hence optional.
   */
  appName?: string | null;
};

/** How the gallery lists folders and projects. */
export type ViewMode = "grid" | "list";
