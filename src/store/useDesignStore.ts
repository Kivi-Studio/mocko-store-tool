"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { persist } from "zustand/middleware";
import { temporal } from "zundo";

import type {
  Design,
  DeviceId,
  Frame,
  Project,
  Storebild,
  TextOverlay,
} from "@/lib/types";
import { defaultExportSizeId } from "@/lib/devices";
import { createIdbStorage, onExternalWrite } from "@/lib/idb-storage";
import { createId, uniqueName } from "@/lib/utils";

type StorebildPatch = Partial<
  Omit<Storebild, "id" | "createdAt" | "designId" | "frames" | "texts">
>;
type FramePatch = Partial<Omit<Frame, "id">>;
type TextPatch = Partial<Omit<TextOverlay, "id">>;
/** Reorder direction: one step towards the front (-1) or the back (1). */
type MoveDir = -1 | 1;

export type DesignStore = {
  /** Top-level apps/products. */
  projects: Record<string, Project>;
  projectOrder: string[];
  /** Designs (collections like "App Store"), keyed by id. */
  designs: Record<string, Design>;
  /** Store images (the exportable PNGs), keyed by id. */
  storebilder: Record<string, Storebild>;
  /** Editor selection (UI-only, not in history). */
  selectedFrameId: string | null;
  selectedTextId: string | null;

  // Project CRUD
  createProject: (name?: string) => string;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;

  // Design CRUD (within a project)
  createDesign: (projectId: string, name?: string) => string | null;
  duplicateDesign: (id: string) => string | null;
  renameDesign: (id: string, name: string) => void;
  deleteDesign: (id: string) => void;
  moveDesign: (id: string, dir: MoveDir) => void;

  // Storebild CRUD (within a design)
  createStorebild: (designId: string) => string | null;
  duplicateStorebild: (id: string) => string | null;
  renameStorebild: (id: string, name: string) => void;
  deleteStorebild: (id: string) => void;
  moveStorebild: (id: string, dir: MoveDir) => void;

  // Import
  addStorebilderToDesign: (designId: string, incoming: Storebild[]) => void;
  importAsNewDesign: (
    projectId: string,
    name: string,
    incoming: Storebild[],
  ) => string | null;

  // Storebild editing
  patchStorebild: (id: string, patch: StorebildPatch) => void;
  addFrame: (storebildId: string, device?: DeviceId) => string | null;
  updateFrame: (
    storebildId: string,
    frameId: string,
    patch: FramePatch,
  ) => void;
  removeFrame: (storebildId: string, frameId: string) => void;
  selectFrame: (frameId: string | null) => void;
  addText: (storebildId: string) => string | null;
  updateText: (storebildId: string, textId: string, patch: TextPatch) => void;
  removeText: (storebildId: string, textId: string) => void;
  selectText: (textId: string | null) => void;
};

const DEFAULT_BACKGROUND = {
  type: "gradient" as const,
  from: "#8B5CF6",
  to: "#EC4899",
  angle: 135,
};

function makeText(partial: Partial<TextOverlay> = {}): TextOverlay {
  return {
    id: createId(),
    text: "Deine Headline",
    xPct: 50,
    yPct: 12,
    fontSizePct: 7,
    fontWeight: 700,
    color: "#FFFFFF",
    align: "center",
    letterSpacing: -0.02,
    lineHeight: 1.05,
    ...partial,
  };
}

function makeFrame(device: DeviceId, partial: Partial<Frame> = {}): Frame {
  return {
    id: createId(),
    device,
    screenshot: null,
    scale: 1,
    xPct: 0,
    yPct: 6,
    rotation: 0,
    ...partial,
  };
}

function makeStorebild(designId: string, name: string): Storebild {
  const now = Date.now();
  return {
    id: createId(),
    designId,
    name,
    createdAt: now,
    updatedAt: now,
    format: "iphone",
    exportSizeId: defaultExportSizeId("iphone"),
    background: { ...DEFAULT_BACKGROUND },
    frames: [makeFrame("iphone")],
    texts: [makeText()],
  };
}

function makeDesign(projectId: string, name: string): Design {
  const now = Date.now();
  return {
    id: createId(),
    projectId,
    name,
    createdAt: now,
    updatedAt: now,
    storebildIds: [],
  };
}

function makeProject(name: string): Project {
  const now = Date.now();
  return {
    id: createId(),
    name,
    createdAt: now,
    updatedAt: now,
    designIds: [],
  };
}

/** Clones store images with fresh storebild/frame/text ids for a design. */
function adopt(
  incoming: Storebild[],
  designId: string,
): { storebilder: Record<string, Storebild>; ids: string[] } {
  const storebilder: Record<string, Storebild> = {};
  const ids: string[] = [];
  for (const sb of incoming) {
    const id = createId();
    storebilder[id] = {
      ...sb,
      id,
      designId,
      frames: sb.frames.map((f) => ({ ...f, id: createId() })),
      texts: sb.texts.map((t) => ({ ...t, id: createId() })),
    };
    ids.push(id);
  }
  return { storebilder, ids };
}

/** Replaces a store image immutably and stamps updatedAt. */
function withStorebild(
  s: DesignStore,
  id: string,
  update: (sb: Storebild) => Storebild,
): Partial<DesignStore> | DesignStore {
  const sb = s.storebilder[id];
  if (!sb) return s;
  return {
    storebilder: {
      ...s.storebilder,
      [id]: { ...update(sb), updatedAt: Date.now() },
    },
  };
}

export const useDesignStore = create<DesignStore>()(
  temporal(
    persist(
      (set, get) => ({
        projects: {},
        projectOrder: [],
        designs: {},
        storebilder: {},
        selectedFrameId: null,
        selectedTextId: null,

        // ---- Projects ----
        createProject: (name) => {
          const project = makeProject(
            name ?? `Projekt ${get().projectOrder.length + 1}`,
          );
          set((s) => ({
            projects: { ...s.projects, [project.id]: project },
            projectOrder: [project.id, ...s.projectOrder],
          }));
          return project.id;
        },

        renameProject: (id, name) =>
          set((s) => {
            const p = s.projects[id];
            if (!p) return s;
            return {
              projects: {
                ...s.projects,
                [id]: { ...p, name, updatedAt: Date.now() },
              },
            };
          }),

        deleteProject: (id) =>
          set((s) => {
            const p = s.projects[id];
            if (!p) return s;
            const projects = { ...s.projects };
            delete projects[id];
            const designs = { ...s.designs };
            const storebilder = { ...s.storebilder };
            for (const did of p.designIds) {
              const d = designs[did];
              if (d) for (const sid of d.storebildIds) delete storebilder[sid];
              delete designs[did];
            }
            return {
              projects,
              projectOrder: s.projectOrder.filter((x) => x !== id),
              designs,
              storebilder,
            };
          }),

        // ---- Designs ----
        createDesign: (projectId, name) => {
          const project = get().projects[projectId];
          if (!project) return null;
          const design = makeDesign(
            projectId,
            name ?? `Design ${project.designIds.length + 1}`,
          );
          set((s) => ({
            designs: { ...s.designs, [design.id]: design },
            projects: {
              ...s.projects,
              [projectId]: {
                ...s.projects[projectId],
                designIds: [design.id, ...s.projects[projectId].designIds],
                updatedAt: Date.now(),
              },
            },
          }));
          return design.id;
        },

        duplicateDesign: (id) => {
          const src = get().designs[id];
          if (!src) return null;
          if (!get().projects[src.projectId]) return null;
          const now = Date.now();
          const copy = makeDesign(src.projectId, `${src.name} Kopie`);
          // Clone every store image in order with fresh ids (frames + texts
          // too); reuses the same adopter as import.
          const sources = src.storebildIds
            .map((sid) => get().storebilder[sid])
            .filter(Boolean);
          const { storebilder, ids } = adopt(sources, copy.id);
          copy.storebildIds = ids;
          set((s) => {
            const project = s.projects[src.projectId];
            if (!project) return s;
            const designIds = [...project.designIds];
            const i = designIds.indexOf(id);
            designIds.splice(i >= 0 ? i + 1 : designIds.length, 0, copy.id);
            return {
              designs: { ...s.designs, [copy.id]: copy },
              storebilder: { ...s.storebilder, ...storebilder },
              projects: {
                ...s.projects,
                [src.projectId]: { ...project, designIds, updatedAt: now },
              },
            };
          });
          return copy.id;
        },

        renameDesign: (id, name) =>
          set((s) => {
            const d = s.designs[id];
            if (!d) return s;
            return {
              designs: {
                ...s.designs,
                [id]: { ...d, name, updatedAt: Date.now() },
              },
            };
          }),

        deleteDesign: (id) =>
          set((s) => {
            const d = s.designs[id];
            if (!d) return s;
            const designs = { ...s.designs };
            delete designs[id];
            const storebilder = { ...s.storebilder };
            for (const sid of d.storebildIds) delete storebilder[sid];
            const project = s.projects[d.projectId];
            const projects = project
              ? {
                  ...s.projects,
                  [d.projectId]: {
                    ...project,
                    designIds: project.designIds.filter((x) => x !== id),
                    updatedAt: Date.now(),
                  },
                }
              : s.projects;
            return { designs, storebilder, projects };
          }),

        moveDesign: (id, dir) =>
          set((s) => {
            const d = s.designs[id];
            if (!d) return s;
            const project = s.projects[d.projectId];
            if (!project) return s;
            const ids = [...project.designIds];
            const i = ids.indexOf(id);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= ids.length) return s;
            [ids[i], ids[j]] = [ids[j], ids[i]];
            return {
              projects: {
                ...s.projects,
                [d.projectId]: {
                  ...project,
                  designIds: ids,
                  updatedAt: Date.now(),
                },
              },
            };
          }),

        // ---- Storebilder ----
        createStorebild: (designId) => {
          const design = get().designs[designId];
          if (!design) return null;
          const sb = makeStorebild(
            designId,
            `Storebild ${design.storebildIds.length + 1}`,
          );
          set((s) => ({
            storebilder: { ...s.storebilder, [sb.id]: sb },
            designs: {
              ...s.designs,
              [designId]: {
                ...s.designs[designId],
                storebildIds: [sb.id, ...s.designs[designId].storebildIds],
                updatedAt: Date.now(),
              },
            },
          }));
          return sb.id;
        },

        duplicateStorebild: (id) => {
          const src = get().storebilder[id];
          if (!src) return null;
          const now = Date.now();
          const copy: Storebild = {
            ...src,
            id: createId(),
            name: `${src.name} Kopie`,
            createdAt: now,
            updatedAt: now,
            frames: src.frames.map((f) => ({ ...f, id: createId() })),
            texts: src.texts.map((t) => ({ ...t, id: createId() })),
          };
          set((s) => {
            const design = s.designs[src.designId];
            if (!design) return s;
            const ids = [...design.storebildIds];
            const idx = ids.indexOf(id);
            ids.splice(idx >= 0 ? idx + 1 : ids.length, 0, copy.id);
            return {
              storebilder: { ...s.storebilder, [copy.id]: copy },
              designs: {
                ...s.designs,
                [src.designId]: {
                  ...design,
                  storebildIds: ids,
                  updatedAt: now,
                },
              },
            };
          });
          return copy.id;
        },

        renameStorebild: (id, name) =>
          set((s) => withStorebild(s, id, (sb) => ({ ...sb, name }))),

        deleteStorebild: (id) =>
          set((s) => {
            const sb = s.storebilder[id];
            if (!sb) return s;
            const storebilder = { ...s.storebilder };
            delete storebilder[id];
            const design = s.designs[sb.designId];
            const designs = design
              ? {
                  ...s.designs,
                  [sb.designId]: {
                    ...design,
                    storebildIds: design.storebildIds.filter((x) => x !== id),
                    updatedAt: Date.now(),
                  },
                }
              : s.designs;
            return { storebilder, designs };
          }),

        moveStorebild: (id, dir) =>
          set((s) => {
            const sb = s.storebilder[id];
            if (!sb) return s;
            const design = s.designs[sb.designId];
            if (!design) return s;
            const ids = [...design.storebildIds];
            const i = ids.indexOf(id);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= ids.length) return s;
            [ids[i], ids[j]] = [ids[j], ids[i]];
            return {
              designs: {
                ...s.designs,
                [sb.designId]: {
                  ...design,
                  storebildIds: ids,
                  updatedAt: Date.now(),
                },
              },
            };
          }),

        // ---- Import ----
        addStorebilderToDesign: (designId, incoming) =>
          set((s) => {
            const design = s.designs[designId];
            if (!design) return s;
            const { storebilder, ids } = adopt(incoming, designId);
            return {
              storebilder: { ...s.storebilder, ...storebilder },
              designs: {
                ...s.designs,
                [designId]: {
                  ...design,
                  storebildIds: [...ids, ...design.storebildIds],
                  updatedAt: Date.now(),
                },
              },
            };
          }),

        importAsNewDesign: (projectId, name, incoming) => {
          const existing = get().projects[projectId];
          if (!existing) return null;
          // Keep the imported design's name unique within its project.
          const takenNames = existing.designIds
            .map((id) => get().designs[id]?.name)
            .filter((n): n is string => typeof n === "string");
          const design = makeDesign(projectId, uniqueName(name, takenNames));
          const { storebilder, ids } = adopt(incoming, design.id);
          design.storebildIds = ids;
          set((s) => {
            const project = s.projects[projectId];
            if (!project) return s;
            return {
              designs: { ...s.designs, [design.id]: design },
              storebilder: { ...s.storebilder, ...storebilder },
              projects: {
                ...s.projects,
                [projectId]: {
                  ...project,
                  designIds: [design.id, ...project.designIds],
                  updatedAt: Date.now(),
                },
              },
            };
          });
          return design.id;
        },

        // ---- Storebild editing ----
        patchStorebild: (id, patch) =>
          set((s) => {
            const existing = s.storebilder[id];
            if (!existing) return s;
            const next: Storebild = {
              ...existing,
              ...patch,
              updatedAt: Date.now(),
            };
            if (
              patch.format &&
              patch.format !== existing.format &&
              !patch.exportSizeId
            ) {
              next.exportSizeId = defaultExportSizeId(patch.format);
            }
            return { storebilder: { ...s.storebilder, [id]: next } };
          }),

        addFrame: (storebildId, device) => {
          const sb = get().storebilder[storebildId];
          if (!sb) return null;
          const frame = makeFrame(device ?? sb.format, {
            xPct: 18,
            scale: 0.9,
          });
          set((s) =>
            withStorebild(s, storebildId, (cur) => ({
              ...cur,
              frames: [...cur.frames, frame],
            })),
          );
          set({ selectedFrameId: frame.id, selectedTextId: null });
          return frame.id;
        },

        updateFrame: (storebildId, frameId, patch) =>
          set((s) =>
            withStorebild(s, storebildId, (sb) => ({
              ...sb,
              frames: sb.frames.map((f) =>
                f.id === frameId ? { ...f, ...patch } : f,
              ),
            })),
          ),

        removeFrame: (storebildId, frameId) => {
          set((s) =>
            withStorebild(s, storebildId, (sb) => ({
              ...sb,
              frames: sb.frames.filter((f) => f.id !== frameId),
            })),
          );
          if (get().selectedFrameId === frameId) set({ selectedFrameId: null });
        },

        selectFrame: (frameId) =>
          set({ selectedFrameId: frameId, selectedTextId: null }),

        addText: (storebildId) => {
          const sb = get().storebilder[storebildId];
          if (!sb) return null;
          const text = makeText({ text: "Neuer Text", yPct: 50 });
          set((s) =>
            withStorebild(s, storebildId, (cur) => ({
              ...cur,
              texts: [...cur.texts, text],
            })),
          );
          set({ selectedTextId: text.id, selectedFrameId: null });
          return text.id;
        },

        updateText: (storebildId, textId, patch) =>
          set((s) =>
            withStorebild(s, storebildId, (sb) => ({
              ...sb,
              texts: sb.texts.map((t) =>
                t.id === textId ? { ...t, ...patch } : t,
              ),
            })),
          ),

        removeText: (storebildId, textId) => {
          set((s) =>
            withStorebild(s, storebildId, (sb) => ({
              ...sb,
              texts: sb.texts.filter((t) => t.id !== textId),
            })),
          );
          if (get().selectedTextId === textId) set({ selectedTextId: null });
        },

        selectText: (textId) =>
          set({ selectedTextId: textId, selectedFrameId: null }),
      }),
      {
        name: "screenshot-creator",
        version: 5,
        storage: createIdbStorage(),
        partialize: (state) => ({
          projects: state.projects,
          projectOrder: state.projectOrder,
          designs: state.designs,
          storebilder: state.storebilder,
        }),
        migrate: (persisted) => {
          const s = persisted as Record<string, unknown>;
          // Already on the 3-level shape.
          if (s.storebilder) return s;

          type LegacyContent = Record<string, unknown>;
          const content = (s.designs ?? {}) as Record<string, LegacyContent>;

          // Ensure each legacy content item has a frames[] array (v4 shape).
          for (const id of Object.keys(content)) {
            const d = content[id];
            if (!Array.isArray(d.frames)) {
              const device = typeof d.device === "string" ? d.device : "iphone";
              d.format = device;
              d.frames = [
                {
                  id: createId(),
                  device,
                  screenshot: (d.screenshot as string | null) ?? null,
                  scale: typeof d.deviceScale === "number" ? d.deviceScale : 1,
                  xPct:
                    typeof d.deviceOffsetXPct === "number"
                      ? d.deviceOffsetXPct
                      : 0,
                  yPct:
                    typeof d.deviceOffsetYPct === "number"
                      ? d.deviceOffsetYPct
                      : 6,
                  rotation: 0,
                },
              ];
              delete d.device;
              delete d.screenshot;
              delete d.deviceScale;
              delete d.deviceOffsetXPct;
              delete d.deviceOffsetYPct;
            }
            if (typeof d.format !== "string") d.format = "iphone";
            if (typeof d.exportSizeId !== "string") {
              d.exportSizeId = defaultExportSizeId(d.format as DeviceId);
            }
          }

          const now = Date.now();

          // Ensure projects exist (older flat shape).
          let projects = s.projects as Record<string, Project> | undefined;
          let projectOrder = s.projectOrder as string[] | undefined;
          if (!projects) {
            const order = (s.order as string[]) ?? Object.keys(content);
            const pid = createId();
            projects = {
              [pid]: {
                id: pid,
                name: "Mein Projekt",
                createdAt: now,
                updatedAt: now,
                designIds: order,
              },
            };
            projectOrder = [pid];
          }

          // Wrap each project's content into one default Design (collection).
          const designs: Record<string, Design> = {};
          const storebilder: Record<string, Storebild> = {};
          for (const pid of Object.keys(projects)) {
            const p = projects[pid];
            const contentIds = (p.designIds ?? []).filter(
              (cid) => content[cid],
            );
            const did = createId();
            designs[did] = {
              id: did,
              projectId: pid,
              name: "Designs",
              createdAt: now,
              updatedAt: now,
              storebildIds: contentIds,
            };
            for (const cid of contentIds) {
              const c = content[cid];
              c.designId = did;
              delete c.projectId;
              storebilder[cid] = c as unknown as Storebild;
            }
            p.designIds = [did];
          }

          return {
            projects,
            projectOrder: projectOrder ?? Object.keys(projects),
            designs,
            storebilder,
          };
        },
      },
    ),
    {
      limit: 100,
      partialize: (state) => ({
        projects: state.projects,
        projectOrder: state.projectOrder,
        designs: state.designs,
        storebilder: state.storebilder,
      }),
      equality: (a, b) =>
        a.projects === b.projects &&
        a.projectOrder === b.projectOrder &&
        a.designs === b.designs &&
        a.storebilder === b.storebilder,
    },
  ),
);

if (typeof window !== "undefined") {
  // The async IndexedDB rehydration should not become an undoable step. This
  // also runs after multi-tab rehydrates, so external changes clear history.
  useDesignStore.persist.onFinishHydration(() => {
    useDesignStore.temporal.getState().clear();
  });
  // When another tab writes, rehydrate so the tabs don't silently overwrite
  // each other (rehydration does not write back, so this cannot ping-pong).
  onExternalWrite(() => void useDesignStore.persist.rehydrate());
}

/**
 * Clears selection ids that no longer resolve to an existing frame/text —
 * selection is UI-only state excluded from history, so undoing e.g. an
 * `addFrame` would otherwise leave it dangling.
 */
function pruneStaleSelection(): void {
  const s = useDesignStore.getState();
  const all = Object.values(s.storebilder);
  const patch: Partial<DesignStore> = {};
  if (
    s.selectedFrameId &&
    !all.some((sb) => sb.frames.some((f) => f.id === s.selectedFrameId))
  ) {
    patch.selectedFrameId = null;
  }
  if (
    s.selectedTextId &&
    !all.some((sb) => sb.texts.some((t) => t.id === s.selectedTextId))
  ) {
    patch.selectedTextId = null;
  }
  if (Object.keys(patch).length > 0) useDesignStore.setState(patch);
}

/** Undoes the last design change and drops any now-dangling selection. */
export function undoDesign(): void {
  useDesignStore.temporal.getState().undo();
  pruneStaleSelection();
}

/** Redoes the last undone design change and re-validates the selection. */
export function redoDesign(): void {
  useDesignStore.temporal.getState().redo();
  pruneStaleSelection();
}

/** Selects a single project by id. */
export function useProject(id: string): Project | undefined {
  return useDesignStore((s) => s.projects[id]);
}

/** Selects a single design (collection) by id. */
export function useDesign(id: string): Design | undefined {
  return useDesignStore((s) => s.designs[id]);
}

/** Selects a single store image by id. */
export function useStorebild(id: string): Storebild | undefined {
  return useDesignStore((s) => s.storebilder[id]);
}

/** Undo/redo controls and availability, sourced from the temporal store. */
export function useTemporal() {
  const state = useStore(
    useDesignStore.temporal,
    useShallow((s) => ({
      clear: s.clear,
      canUndo: s.pastStates.length > 0,
      canRedo: s.futureStates.length > 0,
    })),
  );
  return { ...state, undo: undoDesign, redo: redoDesign };
}

/**
 * True once the persisted state has finished loading from IndexedDB.
 * Uses useSyncExternalStore with a fixed server snapshot (`false`) to avoid
 * SSR hydration mismatches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useDesignStore.persist.onFinishHydration(onChange),
    () => useDesignStore.persist.hasHydrated(),
    () => false,
  );
}
