import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { makeFolder, makeProject } from "@/lib/model/defaults";
import { getPreset } from "@/lib/model/presets";
import { groupFolders } from "@/lib/model/version";
import {
  buildWorkspaceArchive,
  readWorkspaceFile,
  type WorkspacePayload,
} from "@/lib/storage/project-file";
import { hasImage } from "@/lib/storage/image-store";
import {
  DEMO_APP_NAME,
  DEMO_FILE_URL,
  demoLanguageFor,
  fetchDemoWorkspace,
  isDemoPresent,
  withDefaultLanguage,
} from "@/lib/storage/demo-workspace";

const EN = { code: "en", label: "English" };
const DE = { code: "de", label: "German" };
const FR = { code: "fr", label: "French" };

/** A stand-in for `fetch` that serves one blob for the sample URL. */
const serving = (blob: Blob, ok = true) => {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return {
      ok,
      status: ok ? 200 : 404,
      blob: async () => blob,
    } as Response;
  }) as typeof fetch;
  return { fetchImpl, calls };
};

describe("demoLanguageFor", () => {
  it("is German only on request", () => {
    expect(demoLanguageFor("de")).toBe("de");
    expect(demoLanguageFor("en")).toBe("en");
    expect(demoLanguageFor("")).toBe("en");
    expect(demoLanguageFor(null)).toBe("en");
    expect(demoLanguageFor("fr")).toBe("en");
  });
});

describe("isDemoPresent", () => {
  it("spots a release of the sample app, by name or explicit app", () => {
    expect(isDemoPresent([])).toBe(false);
    expect(isDemoPresent([makeFolder("Telly 1.0.0")])).toBe(false);
    expect(isDemoPresent([makeFolder(`${DEMO_APP_NAME} 2.1.0`)])).toBe(true);
    expect(isDemoPresent([{ name: "Sample", appName: DEMO_APP_NAME }])).toBe(
      true,
    );
  });
});

describe("withDefaultLanguage", () => {
  it("moves the language to the front and leaves the rest in order", () => {
    const project = makeProject("P", null, [EN, DE, FR]);
    const out = withDefaultLanguage({ folders: [], projects: [project] }, "fr");
    expect(out.projects[0].languages).toEqual([FR, EN, DE]);
  });

  it("returns projects untouched when the language is missing or first", () => {
    const first = makeProject("First", null, [DE, EN]);
    const without = makeProject("Without", null, [EN]);
    const out = withDefaultLanguage(
      { folders: [], projects: [first, without] },
      "de",
    );
    expect(out.projects[0]).toBe(first);
    expect(out.projects[1]).toBe(without);
  });
});

describe("fetchDemoWorkspace", () => {
  it("reads the served archive and applies the requested default", async () => {
    const folder = makeFolder(`${DEMO_APP_NAME} 2.1.0`);
    const project = makeProject("iPhone", folder.id, [EN, DE]);
    const blob = await buildWorkspaceArchive([project], [folder]);
    const { fetchImpl, calls } = serving(blob);

    const payload = await fetchDemoWorkspace("de", fetchImpl);

    expect(calls).toEqual([DEMO_FILE_URL]);
    expect(payload.folders.map((f) => f.name)).toEqual([folder.name]);
    expect(payload.projects[0].languages.map((l) => l.code)).toEqual([
      "de",
      "en",
    ]);
    expect(payload.projects[0].folderId).toBe(payload.folders[0].id);
  });

  it("fails loudly when the file is not there", async () => {
    const { fetchImpl } = serving(new Blob([]), false);
    await expect(fetchDemoWorkspace("en", fetchImpl)).rejects.toThrow(/404/);
  });
});

/**
 * The shipped file itself: it has to stay readable by the current reader, and
 * complete, or the demo silently degrades to grey placeholders.
 */
describe("public/demo.studio", () => {
  const readShipped = async (): Promise<WorkspacePayload> => {
    const bytes = readFileSync("public/demo.studio");
    return readWorkspaceFile(new Blob([bytes]));
  };

  it("holds the sample app with two releases plus a loose folder", async () => {
    const { folders, projects } = await readShipped();
    const { groups, ungrouped } = groupFolders(folders);
    expect(groups.map((g) => g.key)).toEqual([DEMO_APP_NAME]);
    expect(groups[0].folders).toHaveLength(2);
    expect(ungrouped).toHaveLength(1);
    expect(isDemoPresent(folders)).toBe(true);
    // Something at the root as well, so all three gallery sections show.
    expect(projects.some((p) => p.folderId === null)).toBe(true);
  });

  it("is complete: every framed shot has an image and a caption per language", async () => {
    const { projects } = await readShipped();
    expect(projects.length).toBeGreaterThan(0);
    for (const project of projects) {
      expect(project.languages.map((l) => l.code)).toEqual(["en", "de"]);
      expect(project.shots.length).toBeGreaterThan(0);
      const framed = getPreset(project.presetId).device !== "none";
      for (const shot of project.shots) {
        for (const { code } of project.languages) {
          expect(shot.captions[code]?.claim, project.name).toBeTruthy();
          if (framed) {
            const id = shot.images[code];
            expect(id, `${project.name} ${code}`).toBeTruthy();
            expect(await hasImage(id!)).toBe(true);
          }
        }
      }
    }
  });
});
