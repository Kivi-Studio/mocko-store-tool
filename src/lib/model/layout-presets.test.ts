import { describe, it, expect } from "vitest";
import { LAYOUT_PRESETS, activeLayoutPreset } from "@/lib/model/layout-presets";
import { makeShot } from "@/lib/model/defaults";
import type { Shot } from "@/lib/model/types";

const LANG = "en";

const withLayout = (patch: Partial<Shot>): Shot => ({
  ...makeShot(null, LANG),
  ...patch,
});

describe("activeLayoutPreset", () => {
  it("matches the centered preset for a fresh shot", () => {
    expect(activeLayoutPreset(makeShot(null, LANG))?.id).toBe("centered");
  });

  it("matches a preset when all three values line up", () => {
    const cropped = LAYOUT_PRESETS.find((p) => p.id === "cropped")!;
    const shot = withLayout({
      offX: cropped.offX,
      offY: cropped.offY,
      scale: cropped.scale,
    });
    expect(activeLayoutPreset(shot)?.id).toBe("cropped");
  });

  it("returns undefined for a custom placement", () => {
    expect(activeLayoutPreset(withLayout({ offX: 0.123 }))).toBeUndefined();
  });

  it("distinguishes a global-size preset from a same-offset custom size", () => {
    // 'top' has scale null; the same offsets with an explicit scale must not match.
    const shot = withLayout({ offX: 0, offY: -0.14, scale: 0.8 });
    expect(activeLayoutPreset(shot)).toBeUndefined();
  });
});
