import { describe, it, expect } from "vitest";
import { mergeProjects } from "@/lib/model/merge";
import { makeProject } from "@/lib/model/defaults";
import { captionFor, imageIdFor } from "@/lib/model/caption";
import { DEFAULT_LANGUAGE } from "@/lib/model/locales";
import type { Language, Project } from "@/lib/model/types";

const DE: Language = { code: "de", label: "German" };
const EN: Language = { code: "en", label: "English" };
const FR: Language = { code: "fr", label: "French" };

/**
 * A project as it arrives from an import: one language, and since nothing is
 * inferred from the name, that language is the default one whatever the
 * project actually holds.
 */
function imported(
  name: string,
  shots: { image?: string | null; claim?: string }[] = [],
  language: Language = DEFAULT_LANGUAGE,
): Project {
  const p = makeProject(name, "f1", [language]);
  p.shots = shots.map((s, i) => ({
    id: `${name}-${i}`,
    images: { [language.code]: s.image ?? null },
    captions: s.claim ? { [language.code]: { claim: s.claim, sub: "" } } : {},
    offX: 0,
    offY: 0,
    scale: null,
  }));
  return p;
}

describe("mergeProjects", () => {
  const de = imported("Capitel (iOS) - DE", [
    { image: "de-1", claim: "Alle Serien" },
    { image: "de-2", claim: "Nie wieder suchen" },
  ]);
  const en = imported("Capitel (iOS) - EN", [
    { image: "en-1", claim: "All your shows" },
    { image: "en-2", claim: "Never miss one" },
  ]);

  it("files each project's content under the language it is told, not its own", () => {
    // Both arrive keyed under the default language ("en"); the assignment
    // decides. Assigning French to the second one makes the re-keying visible.
    const merged = mergeProjects(
      [
        { project: de, language: DE },
        { project: en, language: FR },
      ],
      "Capitel (iOS)",
    );

    expect(merged.languages).toEqual([DE, FR]);
    expect(imageIdFor(merged.shots[0], "de")).toBe("de-1");
    expect(imageIdFor(merged.shots[0], "fr")).toBe("en-1");
    expect(captionFor(merged.shots[0], "de").claim).toBe("Alle Serien");
    expect(captionFor(merged.shots[0], "fr").claim).toBe("All your shows");
    // Nothing is left behind under the code the content came in with.
    expect(merged.shots[0].images[DEFAULT_LANGUAGE.code]).toBeUndefined();
  });

  it("keeps the assignment when it matches the code content came in with", () => {
    const merged = mergeProjects(
      [
        { project: de, language: DE },
        { project: en, language: EN },
      ],
      "Capitel (iOS)",
    );
    expect(imageIdFor(merged.shots[0], "de")).toBe("de-1");
    expect(imageIdFor(merged.shots[0], "en")).toBe("en-1");
  });

  it("takes name, design, preset and identity from the first part", () => {
    const first = { ...de, presetId: "ipad-13" };
    const merged = mergeProjects(
      [
        { project: first, language: DE },
        { project: en, language: EN },
      ],
      "Capitel (iOS)",
    );
    expect(merged.name).toBe("Capitel (iOS)");
    expect(merged.id).toBe(first.id);
    expect(merged.presetId).toBe("ipad-13");
    expect(merged.folderId).toBe("f1");
  });

  it("covers the longest project and leaves a shorter one's gaps empty", () => {
    const short = imported("Capitel (iOS) - FR", [{ image: "fr-1" }]);
    const merged = mergeProjects(
      [
        { project: de, language: DE },
        { project: short, language: FR },
      ],
      "Capitel (iOS)",
    );

    expect(merged.shots).toHaveLength(2);
    expect(imageIdFor(merged.shots[1], "de")).toBe("de-2");
    expect(imageIdFor(merged.shots[1], "fr")).toBeNull();
  });

  it("keeps the layout of the position, not of a translation", () => {
    const positioned = imported("A", [{ image: "de-1" }]);
    positioned.shots[0].offX = 0.25;
    positioned.shots[0].scale = 0.6;
    const merged = mergeProjects(
      [
        { project: positioned, language: DE },
        { project: en, language: EN },
      ],
      "A",
    );
    expect(merged.shots[0]).toMatchObject({ offX: 0.25, scale: 0.6 });
  });

  it("takes the layout from the first part that has the position at all", () => {
    const empty = imported("Empty");
    const positioned = imported("B", [{ image: "x" }]);
    positioned.shots[0].offY = 0.4;
    const merged = mergeProjects(
      [
        { project: empty, language: DE },
        { project: positioned, language: EN },
      ],
      "B",
    );
    expect(merged.shots[0].offY).toBe(0.4);
  });

  it("passes an already multilingual project through untouched", () => {
    const multi = makeProject("Multi", "f1", [DE, EN]);
    multi.shots = [
      {
        id: "m0",
        images: { de: "m-de", en: "m-en" },
        captions: {},
        offX: 0,
        offY: 0,
        scale: null,
      },
    ];
    const merged = mergeProjects(
      [
        { project: multi, language: DE },
        { project: imported("C", [{ image: "fr-1" }]), language: FR },
      ],
      "Multi",
    );
    expect(imageIdFor(merged.shots[0], "de")).toBe("m-de");
    expect(imageIdFor(merged.shots[0], "en")).toBe("m-en");
    expect(imageIdFor(merged.shots[0], "fr")).toBe("fr-1");
  });

  it("keeps only the first of two parts claiming the same language", () => {
    const merged = mergeProjects(
      [
        { project: de, language: DE },
        { project: en, language: DE },
      ],
      "X",
    );
    expect(merged.languages).toEqual([DE]);
  });
});
