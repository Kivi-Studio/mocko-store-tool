import { describe, it, expect } from "vitest";
import { roundRect, wrapText } from "@/lib/render";

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
