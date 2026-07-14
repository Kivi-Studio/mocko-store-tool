import type { Shot } from "@/lib/model/types";

/**
 * Named device-placement presets shown as preview tiles in the shot detail
 * panel. `scale === null` means "use the project-global device size".
 *
 * Applying a preset writes exactly these values onto the selected shot; the
 * detail sliders and the live preview then reflect them. The tiles render the
 * same values through the shared render math, so a tile is a faithful preview
 * of what the preset does.
 */
export type LayoutPreset = {
  id: string;
  label: string;
  /** Horizontal device offset, fraction of canvas width. */
  offX: number;
  /** Vertical device offset, fraction of canvas height. */
  offY: number;
  /** Device size override (fraction of width), or null for the global size. */
  scale: number | null;
};

export const LAYOUT_PRESETS: readonly LayoutPreset[] = [
  { id: "centered", label: "Centered", offX: 0, offY: 0, scale: null },
  { id: "top", label: "Top", offX: 0, offY: -0.14, scale: null },
  { id: "cropped", label: "Cropped", offX: 0, offY: 0.2, scale: 0.9 },
  { id: "large", label: "Large", offX: 0, offY: 0.05, scale: 0.92 },
  { id: "small", label: "Small", offX: 0, offY: 0, scale: 0.62 },
] as const;

/** The preset whose values exactly match a shot's current layout, if any. */
export function activeLayoutPreset(shot: Shot): LayoutPreset | undefined {
  return LAYOUT_PRESETS.find(
    (p) =>
      p.offX === shot.offX && p.offY === shot.offY && p.scale === shot.scale,
  );
}
