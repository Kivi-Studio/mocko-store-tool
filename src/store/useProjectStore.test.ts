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

  it("scopes project name uniqueness to the folder", () => {
    const f = store().createFolder("Release");
    const root = store().createProject("iPhone (de)");
    const inside = store().createProject("iPhone (de)", f);
    // Same name, different folders — no " (2)" suffix.
    expect(store().projects[root].name).toBe("iPhone (de)");
    expect(store().projects[inside].name).toBe("iPhone (de)");
    // Within one folder it still uniquifies.
    const second = store().createProject("iPhone (de)", f);
    expect(store().projects[second].name).toBe("iPhone (de) (2)");
  });

  it("uniquifies a name that collides when moving into a folder", () => {
    const f = store().createFolder("Release");
    store().createProject("iPhone (de)", f);
    const moved = store().createProject("iPhone (de)");
    store().moveProjectToFolder(moved, f);
    expect(store().projects[moved].name).toBe("iPhone (de) (2)");
    expect(store().projects[moved].folderId).toBe(f);
  });

  it("assigns a folder to an app and back to name-derived grouping", () => {
    const f = store().createFolder("Telly Rebrand Draft");
    expect(store().folders[f].appName).toBeNull();

    store().setFolderApp(f, "  Telly  ");
    expect(store().folders[f].appName).toBe("Telly");
    // The folder name itself is never touched.
    expect(store().folders[f].name).toBe("Telly Rebrand Draft");

    store().setFolderApp(f, "   ");
    expect(store().folders[f].appName).toBeNull();
  });

  it("ignores an app assignment for an unknown folder", () => {
    const before = store().folders;
    store().setFolderApp("nope", "Telly");
    expect(store().folders).toBe(before);
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

describe("duplicateFolder", () => {
  /** A folder with two named projects, the first carrying one captioned shot. */
  const seedRelease = () => {
    const f = store().createFolder("Mocko 1.2.0");
    const a = store().createProject("iPhone (de)", f);
    const b = store().createProject("iPad (de)", f);
    store().addShots(a, ["data:a"]);
    store().updateShotText(a, shots(a)[0].id, { claim: "Hi" });
    return { f, a, b };
  };

  const projectsIn = (folderId: string) =>
    store()
      .projectOrder.map((id) => store().projects[id])
      .filter((p) => p.folderId === folderId);

  it("copies the folder and every project inside it, keeping names and order", () => {
    const { f } = seedRelease();
    const copyId = store().duplicateFolder(f, "Mocko 1.3.0")!;

    expect(store().folders[copyId].name).toBe("Mocko 1.3.0");
    // Right after the source, not at the top.
    expect(store().folderOrder).toEqual([f, copyId]);

    const copies = projectsIn(copyId);
    expect(copies.map((p) => p.name)).toEqual(projectsIn(f).map((p) => p.name));
    expect(copies.map((p) => p.name)).toEqual(["iPad (de)", "iPhone (de)"]);
  });

  it("deep-copies shots so the copy is independent", () => {
    const { f, a } = seedRelease();
    const copyId = store().duplicateFolder(f)!;
    const copy = projectsIn(copyId).find((p) => p.name === "iPhone (de)")!;

    expect(copy.id).not.toBe(a);
    expect(copy.shots[0].id).not.toBe(shots(a)[0].id);
    expect(copy.shots[0].claim).toBe("Hi");

    store().updateShotText(copy.id, copy.shots[0].id, { claim: "X" });
    expect(shots(a)[0].claim).toBe("Hi");
  });

  it("defaults to a “copy” name and uniquifies it", () => {
    const f = store().createFolder("Release");
    const first = store().duplicateFolder(f)!;
    const second = store().duplicateFolder(f)!;
    expect(store().folders[first].name).toBe("Release copy");
    expect(store().folders[second].name).toBe("Release copy (2)");
  });

  it("duplicates an empty folder and ignores an unknown id", () => {
    const f = store().createFolder("Empty");
    const copyId = store().duplicateFolder(f)!;
    expect(projectsIn(copyId)).toEqual([]);
    expect(store().duplicateFolder("nope")).toBeNull();
  });

  it("is a single undo step", () => {
    const { f } = seedRelease();
    useProjectStore.temporal.getState().clear();
    const copyId = store().duplicateFolder(f)!;
    expect(projectsIn(copyId)).toHaveLength(2);
    useProjectStore.temporal.getState().undo();
    expect(store().folders[copyId]).toBeUndefined();
    expect(projectsIn(copyId)).toEqual([]);
  });
});

describe("createFolderVersion", () => {
  /** A release folder with one project holding a captioned, positioned shot. */
  const seed = () => {
    const f = store().createFolder("Mocko 1.2.0");
    const p = store().createProject("iPhone (de)", f);
    store().addShots(p, ["data:a", "data:b"]);
    store().updateShotText(p, shots(p)[0].id, { claim: "Hi", sub: "There" });
    store().updateShotLayout(p, shots(p)[0].id, { offX: 0.2, scale: 0.6 });
    return { f, p };
  };

  const copiedShots = (folderId: string) =>
    store()
      .projectOrder.map((id) => store().projects[id])
      .filter((x) => x.folderId === folderId)[0].shots;

  it("uses the supplied name and keeps everything by default", () => {
    const { f } = seed();
    const v = store().createFolderVersion(f, "Mocko 1.3.0", {
      keepImages: true,
      keepCaptions: true,
    })!;
    expect(store().folders[v].name).toBe("Mocko 1.3.0");
    expect(copiedShots(v).map((sh) => sh.image)).toEqual(["data:a", "data:b"]);
    expect(copiedShots(v)[0]).toMatchObject({ claim: "Hi", sub: "There" });
  });

  it("clears images but keeps captions, count and layout", () => {
    const { f } = seed();
    const v = store().createFolderVersion(f, "Mocko 1.3.0", {
      keepImages: false,
      keepCaptions: true,
    })!;
    const copies = copiedShots(v);
    expect(copies).toHaveLength(2);
    expect(copies.map((sh) => sh.image)).toEqual([null, null]);
    expect(copies[0]).toMatchObject({
      claim: "Hi",
      sub: "There",
      offX: 0.2,
      scale: 0.6,
    });
  });

  it("clears captions but keeps images", () => {
    const { f } = seed();
    const v = store().createFolderVersion(f, "Mocko 1.3.0", {
      keepImages: true,
      keepCaptions: false,
    })!;
    expect(copiedShots(v)[0]).toMatchObject({
      image: "data:a",
      claim: "",
      sub: "",
    });
  });

  it("keeps the design, including a background image, when images are cleared", () => {
    const { f, p } = seed();
    store().patchSettings(p, {
      background: { type: "image", image: "data:bg" },
      device: { ...store().projects[p].device, frameColor: "#FF0000" },
    });
    const v = store().createFolderVersion(f, "Mocko 1.3.0", {
      keepImages: false,
      keepCaptions: false,
    })!;
    const copy = store()
      .projectOrder.map((id) => store().projects[id])
      .find((x) => x.folderId === v)!;
    expect(copy.background).toEqual({ type: "image", image: "data:bg" });
    expect(copy.device.frameColor).toBe("#FF0000");
  });

  it("leaves the source untouched and uniquifies a taken name", () => {
    const { f, p } = seed();
    store().createFolder("Mocko 1.3.0");
    const v = store().createFolderVersion(f, "Mocko 1.3.0", {
      keepImages: false,
      keepCaptions: false,
    })!;
    expect(store().folders[v].name).toBe("Mocko 1.3.0 (2)");
    // The original release is a snapshot — it must not change.
    expect(shots(p)[0]).toMatchObject({ image: "data:a", claim: "Hi" });
  });

  it("ignores an unknown folder id", () => {
    expect(
      store().createFolderVersion("nope", "X 1.0.0", {
        keepImages: true,
        keepCaptions: true,
      }),
    ).toBeNull();
  });
});

describe("applyToProjects", () => {
  /** A folder with a captioned, styled master and two thinner siblings. */
  const seed = () => {
    const f = store().createFolder("Mocko 1.2.0");
    const master = store().createProject("iPhone (de)", f);
    const ipad = store().createProject("iPad (de)", f);
    const play = store().createProject("Play (de)", f);
    store().addShots(master, ["m1", "m2", "m3"]);
    store().addShots(ipad, ["i1"]);
    store().addShots(play, ["p1", "p2", "p3", "p4"]);
    store().patchSettings(master, {
      presetId: "ipad-13",
      background: { type: "solid", color: "#123456" },
      device: { ...store().projects[master].device, frameColor: "#FF0000" },
    });
    store().updateShotText(master, shots(master)[0].id, {
      claim: "One",
      sub: "Sub one",
    });
    store().updateShotText(master, shots(master)[2].id, { claim: "Three" });
    return { f, master, ipad, play };
  };

  it("copies the design without touching preset or shots", () => {
    const { master, ipad } = seed();
    const n = store().applyToProjects(master, [ipad], {
      design: true,
      captions: false,
    });
    expect(n).toBe(1);
    expect(store().projects[ipad].background).toEqual({
      type: "solid",
      color: "#123456",
    });
    expect(store().projects[ipad].device.frameColor).toBe("#FF0000");
    // A variant is defined by its preset and its screenshots — never overwritten.
    expect(store().projects[ipad].presetId).toBe(DEFAULT_PRESET_ID);
    expect(shots(ipad).map((sh) => sh.image)).toEqual(["i1"]);
  });

  it("appends placeholders when the source has more shots (variant B)", () => {
    const { master, ipad } = seed();
    store().applyToProjects(master, [ipad], { design: false, captions: true });
    const result = shots(ipad);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      image: "i1",
      claim: "One",
      sub: "Sub one",
    });
    // The two extra captions arrive as empty placeholders, ready for images.
    expect(result[1]).toMatchObject({ image: null, claim: "" });
    expect(result[2]).toMatchObject({ image: null, claim: "Three" });
  });

  it("leaves surplus target shots untouched", () => {
    const { master, play } = seed();
    store().applyToProjects(master, [play], { design: false, captions: true });
    const result = shots(play);
    expect(result).toHaveLength(4);
    expect(result[0].claim).toBe("One");
    // The 4th shot has no counterpart in the source — image and text survive.
    expect(result[3]).toMatchObject({ image: "p4", claim: "" });
  });

  it("does not copy the design when only captions are selected", () => {
    const { master, ipad } = seed();
    const before = store().projects[ipad].background;
    store().applyToProjects(master, [ipad], { design: false, captions: true });
    expect(store().projects[ipad].background).toEqual(before);
  });

  it("skips the source, unknown ids and empty option sets", () => {
    const { master, ipad } = seed();
    expect(
      store().applyToProjects(master, [master, "nope"], {
        design: true,
        captions: true,
      }),
    ).toBe(0);
    expect(
      store().applyToProjects(master, [ipad], {
        design: false,
        captions: false,
      }),
    ).toBe(0);
    expect(
      store().applyToProjects("nope", [ipad], {
        design: true,
        captions: false,
      }),
    ).toBe(0);
  });

  it("hits several targets and undoes as one step", () => {
    const { master, ipad, play } = seed();
    useProjectStore.temporal.getState().clear();
    const n = store().applyToProjects(master, [ipad, play], {
      design: true,
      captions: true,
    });
    expect(n).toBe(2);
    expect(shots(ipad)).toHaveLength(3);
    useProjectStore.temporal.getState().undo();
    expect(shots(ipad)).toHaveLength(1);
    expect(store().projects[play].background).not.toEqual({
      type: "solid",
      color: "#123456",
    });
  });
});

describe("workspace import", () => {
  it("merges a payload, uniquifying folder names", () => {
    store().createFolder("Marketing");
    store().createProject("A");

    const folder = makeFolder("Marketing");
    const project = makeProject("A", folder.id);
    store().importWorkspace({ folders: [folder], projects: [project] }, "add");

    expect(store().folders[folder.id].name).toBe("Marketing (2)");
    // The imported folder is empty, so its project keeps its name even though
    // a project called "A" already exists at the root.
    expect(store().projects[project.id].name).toBe("A");
    expect(store().projects[project.id].folderId).toBe(folder.id);
    // Imports are prepended (newest first).
    expect(store().projectOrder[0]).toBe(project.id);
    expect(store().folderOrder[0]).toBe(folder.id);
  });

  it("uniquifies imported project names against the root", () => {
    store().createProject("A");
    const project = makeProject("A");
    store().importWorkspace({ folders: [], projects: [project] }, "add");
    expect(store().projects[project.id].name).toBe("A (2)");
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
