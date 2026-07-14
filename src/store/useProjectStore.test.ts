import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "@/store/useProjectStore";
import { DEFAULT_PRESET_ID } from "@/lib/model/presets";
import { makeFolder, makeProject } from "@/lib/model/defaults";

const store = () => useProjectStore.getState();
const shots = (id: string) => store().projects[id].shots;

beforeEach(() => {
  useProjectStore.setState({
    projects: {},
    projectOrder: [],
    folders: {},
    folderOrder: [],
    viewMode: "grid",
  });
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
    expect(project.shots).toEqual([]);
  });

  it("keeps project names unique", () => {
    store().createProject("Same");
    const second = store().createProject("Same");
    expect(store().projects[second].name).toBe("Same (2)");
  });

  it("duplicates a project with fresh, independent shots", () => {
    const id = store().createProject("Orig");
    store().addShots(id, ["data:a"]);
    const shotId = shots(id)[0].id;
    store().updateShotText(id, shotId, { claim: "Hi" });
    const copyId = store().duplicateProject(id)!;
    const copy = store().projects[copyId];
    expect(copy.shots[0].claim).toBe("Hi");
    // Mutating the copy must not touch the original.
    store().updateShotText(copyId, copy.shots[0].id, { claim: "X" });
    expect(shots(id)[0].claim).toBe("Hi");
  });
});

describe("shots & captions", () => {
  it("adds shots with empty caption text", () => {
    const id = store().createProject("P");
    store().addShots(id, ["data:1"]);
    expect(shots(id)[0]).toMatchObject({ claim: "", sub: "" });
  });

  it("updates a shot's claim and subtext", () => {
    const id = store().createProject("P");
    store().addShots(id, ["data:1"]);
    const shotId = shots(id)[0].id;
    store().updateShotText(id, shotId, { claim: "Hello", sub: "World" });
    expect(shots(id)[0]).toMatchObject({ claim: "Hello", sub: "World" });
  });

  it("updates only the addressed shot's text", () => {
    const id = store().createProject("P");
    store().addShots(id, ["a", "b"]);
    const first = shots(id)[0].id;
    store().updateShotText(id, first, { claim: "Only me" });
    expect(shots(id)[0].claim).toBe("Only me");
    expect(shots(id)[1].claim).toBe("");
  });

  it("moves a shot within the list", () => {
    const id = store().createProject("P");
    store().addShots(id, ["a", "b", "c"]);
    const second = shots(id)[1];
    store().moveShot(id, second.id, -1);
    expect(shots(id).map((s) => s.image)).toEqual(["b", "a", "c"]);
  });

  it("reorders a shot from one index to another", () => {
    const id = store().createProject("P");
    store().addShots(id, ["a", "b", "c", "d"]);
    // Move the first shot to the third slot.
    store().reorderShots(id, 0, 2);
    expect(shots(id).map((s) => s.image)).toEqual(["b", "c", "a", "d"]);
    // Move it back towards the front.
    store().reorderShots(id, 2, 1);
    expect(shots(id).map((s) => s.image)).toEqual(["b", "a", "c", "d"]);
  });

  it("ignores out-of-range or no-op reorders", () => {
    const id = store().createProject("P");
    store().addShots(id, ["a", "b"]);
    store().reorderShots(id, 0, 0);
    store().reorderShots(id, 0, 5);
    store().reorderShots(id, -1, 1);
    expect(shots(id).map((s) => s.image)).toEqual(["a", "b"]);
  });

  it("adds an empty shot with centered/global layout defaults", () => {
    const id = store().createProject("P");
    store().addEmptyShot(id);
    const shot = shots(id)[0];
    expect(shot.image).toBeNull();
    expect(shot).toMatchObject({ offX: 0, offY: 0, scale: null });
  });

  it("sets and replaces a shot's image", () => {
    const id = store().createProject("P");
    store().addEmptyShot(id);
    const shotId = shots(id)[0].id;
    store().setShotImage(id, shotId, "data:new");
    expect(shots(id)[0].image).toBe("data:new");
    store().setShotImage(id, shotId, null);
    expect(shots(id)[0].image).toBeNull();
  });

  it("patches only the addressed shot's layout", () => {
    const id = store().createProject("P");
    store().addShots(id, ["a", "b"]);
    const first = shots(id)[0].id;
    store().updateShotLayout(id, first, { offX: 0.25, scale: 0.7 });
    expect(shots(id)[0]).toMatchObject({ offX: 0.25, offY: 0, scale: 0.7 });
    // The sibling is untouched.
    expect(shots(id)[1]).toMatchObject({ offX: 0, offY: 0, scale: null });
  });

  it("undoes a layout change", () => {
    const id = store().createProject("P");
    store().addShots(id, ["a"]);
    const shotId = shots(id)[0].id;
    useProjectStore.temporal.getState().clear();
    store().updateShotLayout(id, shotId, { offX: 0.3 });
    expect(shots(id)[0].offX).toBe(0.3);
    useProjectStore.temporal.getState().undo();
    expect(shots(id)[0].offX).toBe(0);
  });
});

describe("folders", () => {
  it("creates a folder, newest first, with unique names", () => {
    const a = store().createFolder("Work");
    const b = store().createFolder("Work");
    expect(store().folderOrder).toEqual([b, a]);
    expect(store().folders[a].name).toBe("Work");
    expect(store().folders[b].name).toBe("Work (2)");
  });

  it("creates a project inside a folder", () => {
    const f = store().createFolder("F");
    const p = store().createProject("P", f);
    expect(store().projects[p].folderId).toBe(f);
  });

  it("defaults a project to the root and ignores unknown folder ids", () => {
    const root = store().createProject("Root");
    const bogus = store().createProject("Bogus", "nope");
    expect(store().projects[root].folderId).toBeNull();
    expect(store().projects[bogus].folderId).toBeNull();
  });

  it("moves a project into and back out of a folder", () => {
    const f = store().createFolder("F");
    const p = store().createProject("P");
    store().moveProjectToFolder(p, f);
    expect(store().projects[p].folderId).toBe(f);
    store().moveProjectToFolder(p, null);
    expect(store().projects[p].folderId).toBeNull();
  });

  it("ignores moves to an unknown folder (stays at root)", () => {
    const p = store().createProject("P");
    store().moveProjectToFolder(p, "nope");
    expect(store().projects[p].folderId).toBeNull();
  });

  it("deletes a folder and reparents its projects to the root", () => {
    const f = store().createFolder("F");
    const inside = store().createProject("Inside", f);
    const outside = store().createProject("Outside");
    store().deleteFolder(f);
    expect(store().folders[f]).toBeUndefined();
    expect(store().folderOrder).not.toContain(f);
    expect(store().projects[inside].folderId).toBeNull();
    expect(store().projects[outside].folderId).toBeNull();
    // The projects themselves survive.
    expect(store().projectOrder).toContain(inside);
  });

  it("carries the folder over when duplicating a project", () => {
    const f = store().createFolder("F");
    const p = store().createProject("P", f);
    const copy = store().duplicateProject(p)!;
    expect(store().projects[copy].folderId).toBe(f);
  });

  it("renames a folder", () => {
    const f = store().createFolder("Old");
    store().renameFolder(f, "New");
    expect(store().folders[f].name).toBe("New");
  });

  it("sets the view mode without creating an undo step", () => {
    store().createProject("P");
    useProjectStore.temporal.getState().clear();
    store().setViewMode("list");
    expect(store().viewMode).toBe("list");
    expect(useProjectStore.temporal.getState().pastStates.length).toBe(0);
  });

  it("undoes folder creation", () => {
    store().createProject("P");
    useProjectStore.temporal.getState().clear();
    const f = store().createFolder("F");
    expect(store().folders[f]).toBeDefined();
    useProjectStore.temporal.getState().undo();
    expect(store().folders[f]).toBeUndefined();
  });
});

describe("workspace import", () => {
  it("merges a payload, uniquifying folder and project names", () => {
    store().createFolder("Marketing");
    store().createProject("A");

    const folder = makeFolder("Marketing");
    const project = makeProject("A", folder.id);
    store().importWorkspace({ folders: [folder], projects: [project] }, "add");

    expect(store().folders[folder.id].name).toBe("Marketing (2)");
    expect(store().projects[project.id].name).toBe("A (2)");
    // Membership survives the rename.
    expect(store().projects[project.id].folderId).toBe(folder.id);
    // Imports are prepended (newest first).
    expect(store().projectOrder[0]).toBe(project.id);
    expect(store().folderOrder[0]).toBe(folder.id);
  });

  it("replaces the whole setup", () => {
    store().createFolder("Old folder");
    store().createProject("Old");

    const project = makeProject("New");
    store().importWorkspace({ folders: [], projects: [project] }, "replace");

    expect(Object.keys(store().projects)).toEqual([project.id]);
    expect(store().projectOrder).toEqual([project.id]);
    expect(store().folderOrder).toEqual([]);
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
