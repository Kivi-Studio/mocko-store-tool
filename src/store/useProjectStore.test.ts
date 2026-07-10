import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "@/store/useProjectStore";
import { DEFAULT_PRESET_ID } from "@/lib/presets";

const store = () => useProjectStore.getState();

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
    expect(project.shots).toEqual([]);
  });

  it("keeps project names unique", () => {
    store().createProject("Same");
    const second = store().createProject("Same");
    expect(store().projects[second].name).toBe("Same (2)");
  });

  it("renames and deletes projects", () => {
    const id = store().createProject("X");
    store().renameProject(id, "Y");
    expect(store().projects[id].name).toBe("Y");
    store().deleteProject(id);
    expect(store().projects[id]).toBeUndefined();
    expect(store().projectOrder).not.toContain(id);
  });

  it("duplicates a project with fresh ids right after the original", () => {
    const id = store().createProject("Orig");
    store().addShots(id, ["data:a", "data:b"]);
    const copyId = store().duplicateProject(id);
    expect(copyId).not.toBeNull();
    const copy = store().projects[copyId!];
    expect(copy.name).toBe("Orig copy");
    expect(copy.shots).toHaveLength(2);
    // Fresh shot ids.
    expect(copy.shots[0].id).not.toBe(store().projects[id].shots[0].id);
    // Placed directly after the original.
    const order = store().projectOrder;
    expect(order.indexOf(copyId!)).toBe(order.indexOf(id) + 1);
  });

  it("moveProject swaps neighbours and ignores out-of-range moves", () => {
    const a = store().createProject("A");
    const b = store().createProject("B"); // order: [b, a]
    store().moveProject(a, -1); // a towards front
    expect(store().projectOrder).toEqual([a, b]);
    store().moveProject(a, -1); // already at front: no-op
    expect(store().projectOrder).toEqual([a, b]);
  });
});

describe("settings & shots", () => {
  it("patches settings and stamps updatedAt", () => {
    const id = store().createProject("P");
    const before = store().projects[id].updatedAt;
    store().patchSettings(id, { presetId: "play-phone" });
    const after = store().projects[id];
    expect(after.presetId).toBe("play-phone");
    expect(after.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("adds shots as empty-caption entries with unique ids", () => {
    const id = store().createProject("P");
    store().addShots(id, ["data:1", "data:2"]);
    const shots = store().projects[id].shots;
    expect(shots.map((s) => s.image)).toEqual(["data:1", "data:2"]);
    expect(shots[0].claim).toBe("");
    expect(new Set(shots.map((s) => s.id)).size).toBe(2);
  });

  it("updates and removes a shot", () => {
    const id = store().createProject("P");
    store().addShots(id, ["data:1"]);
    const shotId = store().projects[id].shots[0].id;
    store().updateShot(id, shotId, { claim: "Hello", sub: "World" });
    expect(store().projects[id].shots[0]).toMatchObject({
      claim: "Hello",
      sub: "World",
    });
    store().removeShot(id, shotId);
    expect(store().projects[id].shots).toHaveLength(0);
  });

  it("moves a shot within the list", () => {
    const id = store().createProject("P");
    store().addShots(id, ["a", "b", "c"]);
    const [, second] = store().projects[id].shots;
    store().moveShot(id, second.id, -1);
    expect(store().projects[id].shots.map((s) => s.image)).toEqual([
      "b",
      "a",
      "c",
    ]);
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
