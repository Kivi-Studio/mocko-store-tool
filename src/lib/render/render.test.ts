import { describe, it, expect } from "vitest";
import {
  computeDeviceRect,
  roundRect,
  screenAspectFor,
  wrapText,
} from "@/lib/render/render";

/** A measurer where each character is 10px wide — makes wrapping predictable. */
const measurer = {
  measureText: (text: string) => ({ width: text.length * 10 }) as TextMetrics,
};

describe("wrapText", () => {
  it("returns no lines for empty or whitespace text", () => {
    expect(wrapText(measurer, "", 100)).toEqual([]);
    expect(wrapText(measurer, "   ", 100)).toEqual([]);
  });

  it("keeps words on one line when they fit", () => {
    // "one two" = 7 chars * 10 = 70 <= 100
    expect(wrapText(measurer, "one two", 100)).toEqual(["one two"]);
  });

  it("wraps to a new line when the next word would overflow", () => {
    // "aaa bbb" = 70 fits; adding " ccc" -> 110 > 100, so ccc wraps.
    expect(wrapText(measurer, "aaa bbb ccc", 100)).toEqual(["aaa bbb", "ccc"]);
  });

  it("puts an over-long single word on its own line", () => {
    expect(wrapText(measurer, "supercalifragilistic", 50)).toEqual([
      "supercalifragilistic",
    ]);
  });

  it("collapses runs of whitespace between words", () => {
    expect(wrapText(measurer, "a\n\t  b", 100)).toEqual(["a b"]);
  });
});

describe("roundRect", () => {
  it("traces a closed path via one moveTo and four arcTo calls", () => {
    const calls: string[] = [];
    const ctx = {
      beginPath: () => calls.push("begin"),
      moveTo: () => calls.push("moveTo"),
      arcTo: () => calls.push("arcTo"),
      closePath: () => calls.push("close"),
    };
    roundRect(ctx, 0, 0, 100, 200, 10);
    expect(calls).toEqual([
      "begin",
      "moveTo",
      "arcTo",
      "arcTo",
      "arcTo",
      "arcTo",
      "close",
    ]);
  });

  it("clamps the radius to at most half the shorter side", () => {
    // A huge radius must not throw and must still produce a valid path.
    const calls: string[] = [];
    const ctx = {
      beginPath: () => calls.push("begin"),
      moveTo: (x: number) => calls.push(`moveTo:${x}`),
      arcTo: () => calls.push("arcTo"),
      closePath: () => calls.push("close"),
    };
    // width 40 -> max radius 20, so the start point is x = 0 + 20 = 20.
    roundRect(ctx, 0, 0, 40, 400, 999);
    expect(calls).toContain("moveTo:20");
  });
});

describe("computeDeviceRect", () => {
  // A tall area so the device is width-driven (not height-capped) and the math
  // stays easy to reason about.
  const args = [1000, 4000, 0, 4000, "iphone"] as const;

  it("centers the device horizontally with no offset", () => {
    const r = computeDeviceRect(...args, 0.8, 0, 0);
    // deviceW = 1000 * 0.8 = 800, centered in 1000 => dx = 100.
    expect(r.deviceW).toBeCloseTo(800);
    expect(r.dx).toBeCloseTo(100);
  });

  it("shifts by a fraction of width/height for offsets", () => {
    const base = computeDeviceRect(...args, 0.8, 0, 0);
    const moved = computeDeviceRect(...args, 0.8, 0.1, -0.05);
    // offX * W = 0.1 * 1000 = 100; offY * H = -0.05 * 4000 = -200.
    expect(moved.dx - base.dx).toBeCloseTo(100);
    expect(moved.dy - base.dy).toBeCloseTo(-200);
  });

  it("keeps the screen inset from the frame by the bezel", () => {
    const r = computeDeviceRect(...args, 0.8, 0, 0);
    expect(r.sx).toBeCloseTo(r.dx + r.bezel);
    expect(r.sy).toBeCloseTo(r.dy + r.bezel);
    expect(r.screenW).toBeCloseTo(r.deviceW - 2 * r.bezel);
  });

  it("caps the device height to its area, shrinking width to keep aspect", () => {
    // A short area forces the height cap; width must come down accordingly.
    const r = computeDeviceRect(1000, 4000, 0, 500, "iphone", 0.95, 0, 0);
    expect(r.deviceH).toBeLessThanOrEqual(500 * 1.02 + 0.001);
    expect(r.deviceW).toBeLessThan(1000 * 0.95);
  });

  it("draws the screen at a supplied aspect override", () => {
    // A tall area keeps the device width-driven so the screen aspect shows.
    const r = computeDeviceRect(
      1000,
      8000,
      0,
      8000,
      "android-phone",
      0.8,
      0,
      0,
      2.5,
    );
    expect(r.screenH / r.screenW).toBeCloseTo(2.5);
  });
});

describe("screenAspectFor", () => {
  it("returns the device's nominal aspect when there is no image", () => {
    expect(screenAspectFor("android-phone", null)).toBeCloseTo(20 / 9);
    expect(screenAspectFor("iphone", null)).toBeCloseTo(19.5 / 9);
  });

  it("matches a Pixel 3a screenshot (1080×2220) so it fills without cropping", () => {
    // 2220 / 1080 ≈ 2.056 is inside the android-phone range, so it's used as-is.
    expect(
      screenAspectFor("android-phone", { width: 1080, height: 2220 }),
    ).toBeCloseTo(2220 / 1080);
  });

  it("clamps an out-of-range image to the device bounds", () => {
    // A square image would warp the phone frame — clamp up to the min aspect.
    expect(
      screenAspectFor("android-phone", { width: 1000, height: 1000 }),
    ).toBeCloseTo(1.7);
    // An ultra-tall panorama clamps down to the max aspect.
    expect(
      screenAspectFor("android-phone", { width: 500, height: 3000 }),
    ).toBeCloseTo(2.34);
  });
});
