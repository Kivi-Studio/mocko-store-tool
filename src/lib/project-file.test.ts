import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  buildProjectArchive,
  readProjectFile,
  PROJECT_FORMAT,
  PROJECT_VERSION,
} from "@/lib/project-file";
import { makeProject } from "@/lib/defaults";
import { MAX_SHOTS_PER_PROJECT } from "@/lib/limits";
import type { Project } from "@/lib/types";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

function sample(): Project {
  const p = makeProject("My App");
  p.presetId = "play-phone";
  p.languages = [
    { code: "en", label: "English" },
    { code: "de", label: "German" },
  ];
  p.defaultLanguage = "de";
  p.shots = [
    {
      id: "x",
      image: PNG,
      captions: {
        en: { claim: "Hi", sub: "There" },
        de: { claim: "Hallo", sub: "Welt" },
      },
    },
  ];
  return p;
}

/** Builds a `.studio` archive from a hand-written manifest + image entries. */
async function archiveFrom(
  manifest: unknown,
  images: Record<string, string> = {},
): Promise<Blob> {
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest));
  for (const [path, base64] of Object.entries(images)) {
    zip.file(path, base64, { base64: true });
  }
  return zip.generateAsync({ type: "blob" });
}

describe("archive round-trip (v3, multilingual)", () => {
  it("preserves languages, default and per-language captions", async () => {
    const parsed = await readProjectFile(await buildProjectArchive(sample()));
    expect(parsed.languages).toEqual([
      { code: "en", label: "English" },
      { code: "de", label: "German" },
    ]);
    expect(parsed.defaultLanguage).toBe("de");
    expect(parsed.shots[0].captions).toEqual({
      en: { claim: "Hi", sub: "There" },
      de: { claim: "Hallo", sub: "Welt" },
    });
    expect(parsed.shots[0].image).toBe(PNG);
  });

  it("writes the current format and version", async () => {
    const zip = await JSZip.loadAsync(await buildProjectArchive(sample()));
    const manifest = JSON.parse(
      await zip.file("manifest.json")!.async("string"),
    );
    expect(manifest.format).toBe(PROJECT_FORMAT);
    expect(manifest.version).toBe(PROJECT_VERSION);
  });

  it("assigns fresh ids on import", async () => {
    const parsed = await readProjectFile(await buildProjectArchive(sample()));
    expect(parsed.shots[0].id).not.toBe("x");
  });
});

describe("import validation", () => {
  it("rejects a non-zip file", async () => {
    await expect(readProjectFile(new Blob(["not a zip"]))).rejects.toThrow();
  });

  it("rejects a foreign format", async () => {
    await expect(
      readProjectFile(await archiveFrom({ format: "other" })),
    ).rejects.toThrow();
  });

  it("rejects a newer file version", async () => {
    const blob = await archiveFrom({
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION + 1,
      project: {},
    });
    await expect(readProjectFile(blob)).rejects.toThrow();
  });

  it("dedupes languages, drops invalid codes and enforces a default", async () => {
    const blob = await archiveFrom({
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      project: {
        languages: [
          { code: "en", label: "English" },
          { code: "en", label: "dup" },
          { code: "!!", label: "bad" },
          { code: "de", label: "German" },
        ],
        defaultLanguage: "zz",
      },
    });
    const parsed = await readProjectFile(blob);
    expect(parsed.languages.map((l) => l.code)).toEqual(["en", "de"]);
    // Invalid default falls back to the first language.
    expect(parsed.defaultLanguage).toBe("en");
  });

  it("drops caption keys for unknown languages", async () => {
    const blob = await archiveFrom({
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      project: {
        languages: [{ code: "en", label: "English" }],
        defaultLanguage: "en",
        shots: [
          {
            image: null,
            captions: {
              en: { claim: "Keep", sub: "" },
              de: { claim: "Drop", sub: "" },
            },
          },
        ],
      },
    });
    const parsed = await readProjectFile(blob);
    expect(parsed.shots[0].captions).toEqual({
      en: { claim: "Keep", sub: "" },
    });
  });

  it("falls back to defaults for unknown preset and bad colors", async () => {
    const blob = await archiveFrom({
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      project: {
        presetId: "does-not-exist",
        background: { type: "solid", color: "url(https://evil)" },
      },
    });
    const parsed = await readProjectFile(blob);
    expect(parsed.presetId).toBe("ios-6-9");
    expect(parsed.background).toEqual({ type: "solid", color: "#0B1020" });
  });

  it("caps the number of shots", async () => {
    const shots = Array.from({ length: MAX_SHOTS_PER_PROJECT + 10 }, () => ({
      image: null,
    }));
    const blob = await archiveFrom({
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      project: { shots },
    });
    expect((await readProjectFile(blob)).shots).toHaveLength(
      MAX_SHOTS_PER_PROJECT,
    );
  });

  it("drops image refs with a disallowed mime type", async () => {
    const blob = await archiveFrom(
      {
        format: PROJECT_FORMAT,
        version: PROJECT_VERSION,
        project: {
          shots: [
            { image: { path: "images/a.svg", mime: "image/svg+xml" } },
            { image: { path: "images/b.png", mime: "image/png" } },
          ],
        },
      },
      { "images/a.svg": "AAAA", "images/b.png": "AAAA" },
    );
    const parsed = await readProjectFile(blob);
    expect(parsed.shots[0].image).toBeNull();
    expect(parsed.shots[1].image).toBe("data:image/png;base64,AAAA");
  });
});
