import { describe, it, expect } from "vitest";
import {
  detectLanguageGroups,
  languageOf,
  mergeProjects,
} from "@/lib/model/merge";
import { makeProject } from "@/lib/model/defaults";
import { captionFor, imageIdFor } from "@/lib/model/caption";
import type { Project } from "@/lib/model/types";

/** A single-language project whose name names that language. */
function variant(
  name: string,
  code: string,
  shots: { image?: string | null; claim?: string }[] = [],
): Project {
  const p = makeProject(name, "f1", [{ code, label: code.toUpperCase() }]);
  p.shots = shots.map((s, i) => ({
    id: `${code}-${i}`,
    images: { [code]: s.image ?? null },
    captions: s.claim ? { [code]: { claim: s.claim, sub: "" } } : {},
    offX: 0,
    offY: 0,
    scale: null,
  }));
  return p;
}

describe("detectLanguageGroups", () => {
  it("groups projects that differ only by their language suffix", () => {
    const groups = detectLanguageGroups([
      variant("Telly (iOS) (DE)", "de"),
      variant("Telly (iOS) (EN)", "en"),
      variant("Telly (iPad) (DE)", "de"),
      variant("Telly (iPad) (EN)", "en"),
    ]);

    expect(groups.map((g) => g.name)).toEqual(["Telly (iOS)", "Telly (iPad)"]);
    expect(groups[0].projects.map((p) => p.name)).toEqual([
      "Telly (iOS) (DE)",
      "Telly (iOS) (EN)",
    ]);
  });

  it("ignores a project with no language in its name", () => {
    expect(
      detectLanguageGroups([
        variant("Telly (iOS) (DE)", "de"),
        variant("Telly (iOS)", "en"),
      ]),
    ).toEqual([]);
  });

  it("leaves a lone variant alone", () => {
    expect(detectLanguageGroups([variant("Telly (iOS) (DE)", "de")])).toEqual(
      [],
    );
  });

  it("refuses a set where two projects claim the same language", () => {
    // Ambiguous: nothing says which of the two German ones should win.
    expect(
      detectLanguageGroups([
        variant("Telly (iOS) (DE)", "de"),
        variant("Telly (iOS) (de)", "de"),
      ]),
    ).toEqual([]);
  });

  it("skips a project that already holds several languages", () => {
    const multi = variant("Telly (iOS) (DE)", "de");
    multi.languages = [
      { code: "de", label: "German" },
      { code: "en", label: "English" },
    ];
    expect(
      detectLanguageGroups([multi, variant("Telly (iOS) (EN)", "en")]),
    ).toEqual([]);
  });
});

describe("languageOf", () => {
  it("takes the language the name names", () => {
    expect(languageOf(variant("Telly (DE)", "de")).code).toBe("de");
  });
});

describe("mergeProjects", () => {
  const de = variant("Telly (iOS) (DE)", "de", [
    { image: "de-1", claim: "Alle Serien" },
    { image: "de-2", claim: "Nie wieder suchen" },
  ]);
  const en = variant("Telly (iOS) (EN)", "en", [
    { image: "en-1", claim: "All your shows" },
    { image: "en-2", claim: "Never miss one" },
  ]);

  it("keeps every language, in the order given", () => {
    const merged = mergeProjects([de, en], "Telly (iOS)");
    expect(merged.name).toBe("Telly (iOS)");
    expect(merged.languages.map((l) => l.code)).toEqual(["de", "en"]);
  });

  it("puts each language's screenshot and caption on the same position", () => {
    const merged = mergeProjects([de, en], "Telly (iOS)");

    expect(merged.shots).toHaveLength(2);
    expect(imageIdFor(merged.shots[0], "de")).toBe("de-1");
    expect(imageIdFor(merged.shots[0], "en")).toBe("en-1");
    expect(captionFor(merged.shots[0], "de").claim).toBe("Alle Serien");
    expect(captionFor(merged.shots[0], "en").claim).toBe("All your shows");
  });

  it("takes design, preset and identity from the first project", () => {
    const first = { ...de, presetId: "ipad-13" };
    const merged = mergeProjects([first, en], "Telly (iOS)");
    expect(merged.id).toBe(first.id);
    expect(merged.presetId).toBe("ipad-13");
    expect(merged.folderId).toBe("f1");
  });

  it("covers the longest project and leaves the short one's gaps empty", () => {
    const short = variant("Telly (iOS) (FR)", "fr", [{ image: "fr-1" }]);
    const merged = mergeProjects([de, short], "Telly (iOS)");

    expect(merged.shots).toHaveLength(2);
    expect(imageIdFor(merged.shots[1], "de")).toBe("de-2");
    // French never had a second position; it simply has none here either.
    expect(imageIdFor(merged.shots[1], "fr")).toBeNull();
  });

  it("keeps the layout of the position, not of a translation", () => {
    const positioned = variant("Telly (iOS) (DE)", "de", [{ image: "de-1" }]);
    positioned.shots[0].offX = 0.25;
    positioned.shots[0].scale = 0.6;
    const merged = mergeProjects([positioned, en], "Telly (iOS)");
    expect(merged.shots[0]).toMatchObject({ offX: 0.25, scale: 0.6 });
  });
});
