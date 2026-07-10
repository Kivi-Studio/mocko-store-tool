import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  buildProjectArchive,
  readProjectFile,
  PROJECT_FORMAT,
  PROJECT_VERSION,
} from "@/lib/project-file";
import { makeProject } from "@/lib/defaults";
import { CLAIM_SIZE_MAX, MAX_SHOTS_PER_PROJECT } from "@/lib/limits";
import type { Project } from "@/lib/types";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

function sample(): Project {
  const p = makeProject("My App");
  p.presetId = "play-phone";
  p.background = { type: "solid", color: "#123456" };
  p.shots = [
    { id: "x", image: PNG, claim: "Hi", sub: "There" },
    { id: "y", image: null, claim: "", sub: "" },
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

describe("archive round-trip", () => {
  it("preserves styling, preset and shot captions and images", async () => {
    const parsed = await readProjectFile(await buildProjectArchive(sample()));
    expect(parsed.presetId).toBe("play-phone");
    expect(parsed.background).toEqual({ type: "solid", color: "#123456" });
    expect(parsed.shots).toHaveLength(2);
    expect(parsed.shots[0]).toMatchObject({ claim: "Hi", sub: "There" });
    expect(parsed.shots[0].image).toBe(PNG);
    expect(parsed.shots[1].image).toBeNull();
  });

  it("round-trips an image background", async () => {
    const p = sample();
    p.background = { type: "image", image: PNG };
    const parsed = await readProjectFile(await buildProjectArchive(p));
    expect(parsed.background).toEqual({ type: "image", image: PNG });
  });

  it("stores images as binary entries, not base64 in the manifest", async () => {
    const zip = await JSZip.loadAsync(await buildProjectArchive(sample()));
    const manifest = await zip.file("manifest.json")!.async("string");
    expect(manifest).not.toContain("iVBORw0KGgo");
    expect(zip.file("images/shot-0.png")).not.toBeNull();
  });

  it("assigns fresh ids and timestamps on import", async () => {
    const original = sample();
    const parsed = await readProjectFile(await buildProjectArchive(original));
    expect(parsed.id).not.toBe(original.id);
    expect(parsed.shots[0].id).not.toBe("x");
  });

  it("writes the current format and version", async () => {
    const zip = await JSZip.loadAsync(await buildProjectArchive(sample()));
    const manifest = JSON.parse(
      await zip.file("manifest.json")!.async("string"),
    );
    expect(manifest.format).toBe(PROJECT_FORMAT);
    expect(manifest.version).toBe(PROJECT_VERSION);
  });
});

describe("import validation", () => {
  it("rejects a non-zip file", async () => {
    await expect(readProjectFile(new Blob(["not a zip"]))).rejects.toThrow();
  });

  it("rejects an archive without a manifest", async () => {
    const zip = new JSZip();
    zip.file("random.txt", "hi");
    const blob = await zip.generateAsync({ type: "blob" });
    await expect(readProjectFile(blob)).rejects.toThrow();
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

  it("clamps out-of-range sizes", async () => {
    const blob = await archiveFrom({
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      project: { text: { claimSize: 99 } },
    });
    expect((await readProjectFile(blob)).text.claimSize).toBe(CLAIM_SIZE_MAX);
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

  it("drops image refs pointing at a missing entry", async () => {
    const blob = await archiveFrom({
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      project: {
        shots: [{ image: { path: "images/missing.png", mime: "image/png" } }],
      },
    });
    expect((await readProjectFile(blob)).shots[0].image).toBeNull();
  });
});
