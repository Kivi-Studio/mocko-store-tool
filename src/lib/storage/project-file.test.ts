import "fake-indexeddb/auto";
import { beforeAll, describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  buildProjectArchive,
  buildWorkspaceArchive,
  readProjectFile,
  readWorkspaceFile,
  PROJECT_FORMAT,
  PROJECT_VERSION,
} from "@/lib/storage/project-file";
import { makeFolder, makeProject } from "@/lib/model/defaults";
import { MAX_SHOTS_PER_PROJECT } from "@/lib/model/limits";
import type { Project } from "@/lib/model/types";
import { putImageDataUrl } from "@/lib/storage/image-store";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

/** Content id of {@link PNG}, once it is in the image store. */
let pngId: string;

beforeAll(async () => {
  pngId = (await putImageDataUrl(PNG))!;
});

function sample(): Project {
  const p = makeProject("My App");
  p.presetId = "play-phone";
  p.shots = [
    {
      id: "x",
      imageId: pngId,
      claim: "Hi",
      sub: "There",
      offX: 0.1,
      offY: -0.2,
      scale: 0.8,
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

describe("archive round-trip", () => {
  it("preserves the shot's caption text and image", async () => {
    const parsed = await readProjectFile(await buildProjectArchive(sample()));
    expect(parsed.shots[0].claim).toBe("Hi");
    expect(parsed.shots[0].sub).toBe("There");
    // Content addressing makes the id survive a round-trip exactly.
    expect(parsed.shots[0].imageId).toBe(pngId);
  });

  it("preserves per-shot device offset and size", async () => {
    const parsed = await readProjectFile(await buildProjectArchive(sample()));
    expect(parsed.shots[0].offX).toBe(0.1);
    expect(parsed.shots[0].offY).toBe(-0.2);
    expect(parsed.shots[0].scale).toBe(0.8);
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

describe("workspace round-trip", () => {
  it("preserves folders and per-project membership", async () => {
    const folder = makeFolder("Marketing");
    const inFolder = sample();
    inFolder.name = "A";
    inFolder.folderId = folder.id;
    const atRoot = sample();
    atRoot.name = "B";
    atRoot.folderId = null;

    const payload = await readWorkspaceFile(
      await buildWorkspaceArchive([inFolder, atRoot], [folder]),
    );

    expect(payload.folders).toHaveLength(1);
    expect(payload.folders[0].name).toBe("Marketing");
    // Folders get fresh ids on import.
    expect(payload.folders[0].id).not.toBe(folder.id);

    const a = payload.projects.find((p) => p.name === "A")!;
    const b = payload.projects.find((p) => p.name === "B")!;
    expect(a.folderId).toBe(payload.folders[0].id);
    expect(b.folderId).toBeNull();
  });

  it("preserves an explicit app assignment, and omits it when unset", async () => {
    const assigned = makeFolder("Telly Rebrand Draft");
    assigned.appName = "Telly";
    const plain = makeFolder("Marketing");

    const payload = await readWorkspaceFile(
      await buildWorkspaceArchive([], [assigned, plain]),
    );

    expect(payload.folders[0].appName).toBe("Telly");
    // No override travels as no override, not as an empty string.
    expect(payload.folders[1].appName).toBeNull();
  });

  it("reads a single-project archive as one project, no folders", async () => {
    const payload = await readWorkspaceFile(
      await buildProjectArchive(sample()),
    );
    expect(payload.folders).toHaveLength(0);
    expect(payload.projects).toHaveLength(1);
    expect(payload.projects[0].folderId).toBeNull();
  });

  it("drops a project's folderRef when the folder is absent", async () => {
    const orphan = sample();
    orphan.folderId = "missing-folder";
    const payload = await readWorkspaceFile(
      await buildWorkspaceArchive([orphan], []),
    );
    expect(payload.projects[0].folderId).toBeNull();
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

  it("reads caption text and drops non-string values", async () => {
    const blob = await archiveFrom({
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      project: {
        shots: [{ image: null, claim: "Keep", sub: 42 }, { image: null }],
      },
    });
    const parsed = await readProjectFile(blob);
    expect(parsed.shots[0]).toMatchObject({ claim: "Keep", sub: "" });
    expect(parsed.shots[1]).toMatchObject({ claim: "", sub: "" });
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

  it("clamps out-of-range offsets and defaults a bad scale to null", async () => {
    const blob = await archiveFrom({
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      project: {
        shots: [
          { image: null, offX: 5, offY: -9, scale: "big" },
          { image: null, offX: 0.2, offY: 0.3, scale: 0.3 },
        ],
      },
    });
    const parsed = await readProjectFile(blob);
    // Offsets clamp into [-0.5, 0.5]; a non-numeric scale becomes null (global).
    expect(parsed.shots[0].offX).toBe(0.5);
    expect(parsed.shots[0].offY).toBe(-0.5);
    expect(parsed.shots[0].scale).toBeNull();
    // A too-small scale clamps up to the device-size minimum (0.5).
    expect(parsed.shots[1].scale).toBe(0.5);
  });

  it("defaults missing layout fields (older files) to centered/global", async () => {
    const blob = await archiveFrom({
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      project: { shots: [{ image: null }] },
    });
    const parsed = await readProjectFile(blob);
    expect(parsed.shots[0].offX).toBe(0);
    expect(parsed.shots[0].offY).toBe(0);
    expect(parsed.shots[0].scale).toBeNull();
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
    expect(parsed.shots[0].imageId).toBeNull();
    expect(parsed.shots[1].imageId).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("export deduplication", () => {
  it("writes a screenshot shared by several projects only once", async () => {
    const a = sample();
    const b = sample();
    b.name = "Second";

    const zip = await JSZip.loadAsync(await buildWorkspaceArchive([a, b], []));
    // JSZip also lists the implicit "images/" directory entry.
    const images = Object.keys(zip.files).filter(
      (n) => n.startsWith("images/") && !zip.files[n].dir,
    );

    // Two projects, the same screenshot — one entry, named by content id.
    expect(images).toHaveLength(1);
    expect(images[0]).toBe(`images/${pngId}.png`);
  });

  it("collapses duplicate entries from an older archive on import", async () => {
    // Pre-dedup archives stored one copy per shot, under per-shot paths.
    const blob = await archiveFrom(
      {
        format: PROJECT_FORMAT,
        version: PROJECT_VERSION,
        project: {
          name: "Old",
          shots: [
            { image: { path: "images/p0-shot-0.png", mime: "image/png" } },
            { image: { path: "images/p0-shot-1.png", mime: "image/png" } },
          ],
        },
      },
      { "images/p0-shot-0.png": "AAAA", "images/p0-shot-1.png": "AAAA" },
    );

    const parsed = await readProjectFile(blob);
    expect(parsed.shots[0].imageId).toBe(parsed.shots[1].imageId);
  });
});
