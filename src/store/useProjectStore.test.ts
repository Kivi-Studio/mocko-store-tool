import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "@/store/useProjectStore";
import { DEFAULT_PRESET_ID } from "@/lib/presets";

const store = () => useProjectStore.getState();
const shots = (id: string) => store().projects[id].shots;

beforeEach(() => {
  useProjectStore.setState({ projects: {}, projectOrder: [] });
  useProjectStore.temporal.getState().clear();
});

describe("project CRUD", () => {
  it("creates a project with defaults, newest first", () => {
    const a = store().createProject("A");
    const b = store().createProject("B");
    expect(store().projectOrder).toEqual([b, a]);
    const project = store().projects[a];
    expect(project.name).toBe("A");
    expect(project.presetId).toBe(DEFAULT_PRESET_ID);
    expect(project.languages).toEqual([{ code: "en", label: "English" }]);
    expect(project.defaultLanguage).toBe("en");
    expect(project.shots).toEqual([]);
  });

  it("keeps project names unique", () => {
    store().createProject("Same");
    const second = store().createProject("Same");
    expect(store().projects[second].name).toBe("Same (2)");
  });

  it("duplicates a project with fresh, independent captions", () => {
    const id = store().createProject("Orig");
    store().addShots(id, ["data:a"]);
    const shotId = shots(id)[0].id;
    store().updateCaption(id, shotId, "en", { claim: "Hi" });
    const copyId = store().duplicateProject(id)!;
    const copy = store().projects[copyId];
    expect(copy.shots[0].captions.en.claim).toBe("Hi");
    // Mutating the copy must not touch the original.
    store().updateCaption(copyId, copy.shots[0].id, "en", { claim: "X" });
    expect(shots(id)[0].captions.en.claim).toBe("Hi");
  });
});

describe("shots & captions", () => {
  it("adds shots with an empty caption per project language", () => {
    const id = store().createProject("P");
    store().addLanguage(id, { code: "de", label: "German" });
    store().addShots(id, ["data:1"]);
    expect(shots(id)[0].captions).toEqual({
      en: { claim: "", sub: "" },
      de: { claim: "", sub: "" },
    });
  });

  it("updates a caption for a single language only", () => {
    const id = store().createProject("P");
    store().addLanguage(id, { code: "de", label: "German" });
    store().addShots(id, ["data:1"]);
    const shotId = shots(id)[0].id;
    store().updateCaption(id, shotId, "de", { claim: "Hallo", sub: "Welt" });
    expect(shots(id)[0].captions.de).toEqual({ claim: "Hallo", sub: "Welt" });
    expect(shots(id)[0].captions.en).toEqual({ claim: "", sub: "" });
  });

  it("creates the caption entry when updating a new language key", () => {
    const id = store().createProject("P");
    store().addShots(id, ["data:1"]);
    const shotId = shots(id)[0].id;
    store().updateCaption(id, shotId, "fr", { claim: "Bonjour" });
    expect(shots(id)[0].captions.fr).toEqual({ claim: "Bonjour", sub: "" });
  });

  it("moves a shot within the list", () => {
    const id = store().createProject("P");
    store().addShots(id, ["a", "b", "c"]);
    const second = shots(id)[1];
    store().moveShot(id, second.id, -1);
    expect(shots(id).map((s) => s.image)).toEqual(["b", "a", "c"]);
  });
});

describe("languages", () => {
  it("adds a language and ignores duplicates", () => {
    const id = store().createProject("P");
    store().addLanguage(id, { code: "de", label: "German" });
    store().addLanguage(id, { code: "de", label: "German (dup)" });
    expect(store().projects[id].languages.map((l) => l.code)).toEqual([
      "en",
      "de",
    ]);
  });

  it("removes a language and its captions, keeping at least one", () => {
    const id = store().createProject("P");
    store().addLanguage(id, { code: "de", label: "German" });
    store().addShots(id, ["data:1"]);
    store().removeLanguage(id, "de");
    expect(store().projects[id].languages.map((l) => l.code)).toEqual(["en"]);
    expect(shots(id)[0].captions.de).toBeUndefined();
    // Removing the last remaining language is a no-op.
    store().removeLanguage(id, "en");
    expect(store().projects[id].languages).toHaveLength(1);
  });

  it("reassigns the default when the default language is removed", () => {
    const id = store().createProject("P");
    store().addLanguage(id, { code: "de", label: "German" });
    store().setDefaultLanguage(id, "de");
    store().removeLanguage(id, "de");
    expect(store().projects[id].defaultLanguage).toBe("en");
  });

  it("only accepts a default that exists", () => {
    const id = store().createProject("P");
    store().setDefaultLanguage(id, "zz");
    expect(store().projects[id].defaultLanguage).toBe("en");
  });
});

describe("undo/redo", () => {
  it("undoes and redoes a settings change", () => {
    const id = store().createProject("P");
    useProjectStore.temporal.getState().clear();
    store().patchSettings(id, { presetId: "ipad-13" });
    expect(store().projects[id].presetId).toBe("ipad-13");
    useProjectStore.temporal.getState().undo();
    expect(store().projects[id].presetId).toBe(DEFAULT_PRESET_ID);
    useProjectStore.temporal.getState().redo();
    expect(store().projects[id].presetId).toBe("ipad-13");
  });
});
