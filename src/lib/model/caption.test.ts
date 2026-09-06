import { describe, it, expect } from "vitest";
import {
  captionFor,
  imageIdFor,
  referencedImageIds,
} from "@/lib/model/caption";
import { makeProject, makeShot } from "@/lib/model/defaults";
import type { Project, Shot } from "@/lib/model/types";

const shot = (over: Partial<Shot> = {}): Shot => ({
  ...makeShot(null, "de"),
  ...over,
});

describe("captionFor", () => {
  it("returns the caption written for that language", () => {
    const s = shot({ captions: { de: { claim: "Hallo", sub: "Welt" } } });
    expect(captionFor(s, "de")).toEqual({ claim: "Hallo", sub: "Welt" });
  });

  it("reads an untranslated language as empty, not as an error", () => {
    expect(captionFor(shot(), "fr")).toEqual({ claim: "", sub: "" });
  });
});

describe("imageIdFor", () => {
  it("returns the screenshot for that language, or null", () => {
    const s = shot({ images: { de: "img-1", en: null } });
    expect(imageIdFor(s, "de")).toBe("img-1");
    expect(imageIdFor(s, "en")).toBeNull();
    expect(imageIdFor(s, "fr")).toBeNull();
  });
});

describe("referencedImageIds", () => {
  const withShots = (ids: (string | null)[], bg?: string | null): Project => {
    const p = makeProject("P");
    p.shots = ids.map((imageId, i) => ({
      id: `s${i}`,
      images: { de: imageId },
      captions: {},
      offX: 0,
      offY: 0,
      scale: null,
    }));
    if (bg !== undefined) p.background = { type: "image", imageId: bg };
    return p;
  };

  it("collects shot and background ids, skipping empty ones", () => {
    const ids = referencedImageIds({
      a: withShots(["one", null, "two"], "bg"),
      b: withShots(["two"]),
    });
    expect([...ids].sort()).toEqual(["bg", "one", "two"]);
  });

  it("collects every language's screenshot of a shot", () => {
    const p = makeProject("P");
    p.shots = [
      {
        id: "s0",
        images: { de: "de-img", en: "en-img", fr: null },
        captions: {},
        offX: 0,
        offY: 0,
        scale: null,
      },
    ];
    expect([...referencedImageIds({ a: p })].sort()).toEqual([
      "de-img",
      "en-img",
    ]);
  });

  it("ignores an image background with no image chosen", () => {
    expect(referencedImageIds({ a: withShots([], null) }).size).toBe(0);
  });

  it("returns nothing for an empty library", () => {
    expect(referencedImageIds({}).size).toBe(0);
  });
});
