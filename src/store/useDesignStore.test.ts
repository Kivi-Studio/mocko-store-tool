import { describe, it, expect, beforeEach } from "vitest";
import { defaultExportSizeId } from "@/lib/devices";
import { undoDesign, useDesignStore } from "@/store/useDesignStore";

const store = () => useDesignStore.getState();

/** Creates project → design → storebild and returns the three ids. */
function seed() {
  const projectId = store().createProject("Test");
  const designId = store().createDesign(projectId)!;
  const storebildId = store().createStorebild(designId)!;
  return { projectId, designId, storebildId };
}

beforeEach(() => {
  useDesignStore.setState({
    projects: {},
    projectOrder: [],
    designs: {},
    storebilder: {},
    selectedFrameId: null,
    selectedTextId: null,
  });
  useDesignStore.temporal.getState().clear();
});

describe("three-level hierarchy", () => {
  it("wires project → design → storebild", () => {
    const { projectId, designId, storebildId } = seed();
    expect(store().projects[projectId].designIds).toContain(designId);
    expect(store().designs[designId].projectId).toBe(projectId);
    expect(store().designs[designId].storebildIds).toContain(storebildId);
    expect(store().storebilder[storebildId].designId).toBe(designId);
  });

  it("createStorebild gets one frame, one text and iphone defaults", () => {
    const { storebildId } = seed();
    const sb = store().storebilder[storebildId];
    expect(sb.format).toBe("iphone");
    expect(sb.exportSizeId).toBe(defaultExportSizeId("iphone"));
    expect(sb.frames).toHaveLength(1);
    expect(sb.frames[0].device).toBe("iphone");
    expect(sb.texts).toHaveLength(1);
  });

  it("createDesign / createStorebild return null for a missing parent", () => {
    expect(store().createDesign("missing")).toBeNull();
    expect(store().createStorebild("missing")).toBeNull();
  });

  it("deleteProject cascades designs and storebilder", () => {
    const { projectId, designId, storebildId } = seed();
    store().deleteProject(projectId);
    expect(store().projects[projectId]).toBeUndefined();
    expect(store().designs[designId]).toBeUndefined();
    expect(store().storebilder[storebildId]).toBeUndefined();
  });

  it("deleteDesign cascades its storebilder", () => {
    const { designId, storebildId } = seed();
    store().deleteDesign(designId);
    expect(store().designs[designId]).toBeUndefined();
    expect(store().storebilder[storebildId]).toBeUndefined();
  });
});

describe("storebild editing", () => {
  it("duplicateStorebild clones with fresh ids, inserted after the source", () => {
    const { designId, storebildId } = seed();
    const copyId = store().duplicateStorebild(storebildId)!;
    const copy = store().storebilder[copyId];
    const src = store().storebilder[storebildId];
    expect(copyId).not.toBe(storebildId);
    expect(copy.name).toBe("Storebild 1 Kopie");
    expect(copy.designId).toBe(designId);
    expect(copy.frames[0].id).not.toBe(src.frames[0].id);
    const ids = store().designs[designId].storebildIds;
    expect(ids[ids.indexOf(storebildId) + 1]).toBe(copyId);
  });

  it("patchStorebild resets the export size on format change", () => {
    const { storebildId } = seed();
    store().patchStorebild(storebildId, { format: "ipad" });
    const sb = store().storebilder[storebildId];
    expect(sb.format).toBe("ipad");
    expect(sb.exportSizeId).toBe(defaultExportSizeId("ipad"));
  });

  it("addFrame appends, selects it, and clears text selection", () => {
    const { storebildId } = seed();
    store().selectText("x");
    const frameId = store().addFrame(storebildId)!;
    expect(store().storebilder[storebildId].frames).toHaveLength(2);
    expect(store().selectedFrameId).toBe(frameId);
    expect(store().selectedTextId).toBeNull();
  });

  it("updateFrame patches and removeFrame deletes + clears selection", () => {
    const { storebildId } = seed();
    const frameId = store().storebilder[storebildId].frames[0].id;
    store().updateFrame(storebildId, frameId, { rotation: 12 });
    expect(store().storebilder[storebildId].frames[0].rotation).toBe(12);
    const added = store().addFrame(storebildId)!;
    store().removeFrame(storebildId, added);
    expect(store().storebilder[storebildId].frames).toHaveLength(1);
    expect(store().selectedFrameId).toBeNull();
  });
});

describe("design duplication", () => {
  it("clones the design and its storebilder with fresh ids, after the source", () => {
    const { projectId, designId, storebildId } = seed();
    store().createStorebild(designId); // a second store image
    const copyId = store().duplicateDesign(designId)!;
    const copy = store().designs[copyId];
    const src = store().designs[designId];

    expect(copyId).not.toBe(designId);
    expect(copy.name).toBe("Design 1 Kopie");
    expect(copy.projectId).toBe(projectId);
    // same number of store images, but all-new ids belonging to the copy
    expect(copy.storebildIds).toHaveLength(src.storebildIds.length);
    expect(copy.storebildIds).not.toContain(storebildId);
    for (const sid of copy.storebildIds) {
      expect(store().storebilder[sid].designId).toBe(copyId);
    }
    // inserted directly after the source within the project
    const dids = store().projects[projectId].designIds;
    expect(dids[dids.indexOf(designId) + 1]).toBe(copyId);
  });

  it("deep-clones each store image's frames and texts", () => {
    const { designId, storebildId } = seed();
    const copyId = store().duplicateDesign(designId)!;
    const copySb = store().storebilder[store().designs[copyId].storebildIds[0]];
    const srcSb = store().storebilder[storebildId];
    expect(copySb.frames[0].id).not.toBe(srcSb.frames[0].id);
    expect(copySb.texts[0].id).not.toBe(srcSb.texts[0].id);
  });

  it("duplicates an empty design as an empty design", () => {
    const projectId = store().createProject("P");
    const designId = store().createDesign(projectId)!;
    const copyId = store().duplicateDesign(designId)!;
    expect(store().designs[copyId].storebildIds).toEqual([]);
  });

  it("returns null for a missing design", () => {
    expect(store().duplicateDesign("missing")).toBeNull();
  });
});

describe("reordering", () => {
  it("moveStorebild reorders within its design", () => {
    const projectId = store().createProject("P");
    const designId = store().createDesign(projectId)!;
    const a = store().createStorebild(designId)!;
    const b = store().createStorebild(designId)!;
    expect(store().designs[designId].storebildIds).toEqual([b, a]);
    store().moveStorebild(b, 1);
    expect(store().designs[designId].storebildIds).toEqual([a, b]);
  });

  it("moveDesign reorders within its project", () => {
    const projectId = store().createProject("P");
    const a = store().createDesign(projectId)!;
    const b = store().createDesign(projectId)!;
    expect(store().projects[projectId].designIds).toEqual([b, a]);
    store().moveDesign(b, 1);
    expect(store().projects[projectId].designIds).toEqual([a, b]);
  });
});

describe("undo/redo", () => {
  it("undo reverts createProject and redo restores it", () => {
    const id = store().createProject("X");
    useDesignStore.temporal.getState().undo();
    expect(store().projects[id]).toBeUndefined();
    useDesignStore.temporal.getState().redo();
    expect(store().projects[id]).toBeDefined();
  });

  it("selecting a frame is not an undoable step", () => {
    const { storebildId } = seed();
    const frameId = store().storebilder[storebildId].frames[0].id;
    store().updateFrame(storebildId, frameId, { scale: 0.8 });
    store().selectFrame(frameId); // UI-only

    useDesignStore.temporal.getState().undo();
    expect(store().storebilder[storebildId].frames[0].scale).toBe(1);
    expect(store().selectedFrameId).toBe(frameId);
  });

  it("undoDesign prunes a selection that no longer resolves", () => {
    const { storebildId } = seed();
    const frameId = store().addFrame(storebildId)!;
    expect(store().selectedFrameId).toBe(frameId);

    undoDesign(); // reverts addFrame → the selected frame no longer exists
    expect(
      store().storebilder[storebildId].frames.some((f) => f.id === frameId),
    ).toBe(false);
    expect(store().selectedFrameId).toBeNull();
  });
});
