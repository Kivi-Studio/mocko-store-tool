"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { persist } from "zustand/middleware";
import { temporal } from "zundo";

import type {
  Background,
  DeviceStyle,
  Folder,
  Project,
  Shot,
  TextStyle,
  ViewMode,
} from "@/lib/model/types";
import { makeFolder, makeProject, makeShot } from "@/lib/model/defaults";
import { createIdbStorage, onExternalWrite } from "@/lib/storage/idb-storage";
import { createId, uniqueName } from "@/lib/utils";

/** Reorder direction: one step towards the front (-1) or the back (1). */
type MoveDir = -1 | 1;

/** The mutable styling of a project (everything except its shots and identity). */
type SettingsPatch = Partial<{
  name: string;
  presetId: string;
  background: Background;
  text: TextStyle;
  device: DeviceStyle;
}>;

export type ProjectStore = {
  projects: Record<string, Project>;
  /** Gallery order, newest first. */
  projectOrder: string[];
  /** Folders keyed by id. */
  folders: Record<string, Folder>;
  /** Folder display order, newest first. */
  folderOrder: string[];
  /** How the gallery lists items (persisted, not undoable). */
  viewMode: ViewMode;

  createProject: (name?: string, folderId?: string | null) => string;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => string | null;
  moveProject: (id: string, dir: MoveDir) => void;
  /** Adds an already-built project (e.g. from a `.studio` import). Lands at root. */
  addProject: (project: Project) => string;
  /**
   * Imports a workspace payload (folders + projects, already carrying fresh
   * ids). `"add"` merges it in, uniquifying names; `"replace"` discards the
   * current setup first.
   */
  importWorkspace: (
    payload: { folders: Folder[]; projects: Project[] },
    mode: "add" | "replace",
  ) => void;

  createFolder: (name?: string) => string;
  renameFolder: (id: string, name: string) => void;
  /** Deletes a folder; its projects fall back to the root, they are not removed. */
  deleteFolder: (id: string) => void;
  /** Moves a project into a folder, or to the root with `null`. */
  moveProjectToFolder: (projectId: string, folderId: string | null) => void;

  setViewMode: (mode: ViewMode) => void;

  patchSettings: (id: string, patch: SettingsPatch) => void;
  addShots: (id: string, images: string[]) => void;
  /** Appends an image-less shot that can be filled in later. */
  addEmptyShot: (id: string) => void;
  /** Sets or replaces (or clears, with null) a single shot's image. */
  setShotImage: (
    projectId: string,
    shotId: string,
    image: string | null,
  ) => void;
  /** Patches a single shot's caption text (claim / subtext). */
  updateShotText: (
    projectId: string,
    shotId: string,
    patch: Partial<Pick<Shot, "claim" | "sub">>,
  ) => void;
  /** Patches a single shot's device position/size overrides. */
  updateShotLayout: (
    projectId: string,
    shotId: string,
    patch: Partial<Pick<Shot, "offX" | "offY" | "scale">>,
  ) => void;
  removeShot: (projectId: string, shotId: string) => void;
  moveShot: (projectId: string, shotId: string, dir: MoveDir) => void;
  /** Moves the shot at `from` to index `to`, shifting the others (drag & drop). */
  reorderShots: (projectId: string, from: number, to: number) => void;
};

/** Replaces a project immutably, stamping updatedAt. */
function withProject(
  s: ProjectStore,
  id: string,
  update: (p: Project) => Project,
): Partial<ProjectStore> {
  const p = s.projects[id];
  if (!p) return {};
  return {
    projects: {
      ...s.projects,
      [id]: { ...update(p), updatedAt: Date.now() },
    },
  };
}

export const useProjectStore = create<ProjectStore>()(
  temporal(
    persist(
      (set, get) => ({
        projects: {},
        projectOrder: [],
        folders: {},
        folderOrder: [],
        viewMode: "grid",

        createProject: (name, folderId = null) => {
          const taken = Object.values(get().projects).map((p) => p.name);
          const target = folderId && get().folders[folderId] ? folderId : null;
          const project = makeProject(
            uniqueName(name ?? "Untitled project", taken),
            target,
          );
          set((s) => ({
            projects: { ...s.projects, [project.id]: project },
            projectOrder: [project.id, ...s.projectOrder],
          }));
          return project.id;
        },

        addProject: (project) => {
          set((s) => ({
            // Imported projects always land at the root — their `folderId`
            // (if any) refers to folders from another app instance.
            projects: { ...s.projects, [project.id]: { ...project, folderId: null } },
            projectOrder: [project.id, ...s.projectOrder],
          }));
          return project.id;
        },

        importWorkspace: (payload, mode) =>
          set((s) => {
            if (mode === "replace") {
              const projects: Record<string, Project> = {};
              for (const p of payload.projects) projects[p.id] = p;
              const folders: Record<string, Folder> = {};
              for (const f of payload.folders) folders[f.id] = f;
              return {
                projects,
                projectOrder: payload.projects.map((p) => p.id),
                folders,
                folderOrder: payload.folders.map((f) => f.id),
              };
            }
            // Merge: keep existing, prepend imports, uniquify names as we go.
            const takenProjectNames = new Set(
              Object.values(s.projects).map((p) => p.name),
            );
            const takenFolderNames = new Set(
              Object.values(s.folders).map((f) => f.name),
            );
            const folders = { ...s.folders };
            const newFolderIds: string[] = [];
            for (const f of payload.folders) {
              const name = uniqueName(f.name, takenFolderNames);
              takenFolderNames.add(name);
              folders[f.id] = { ...f, name };
              newFolderIds.push(f.id);
            }
            const projects = { ...s.projects };
            const newProjectIds: string[] = [];
            for (const p of payload.projects) {
              const name = uniqueName(p.name, takenProjectNames);
              takenProjectNames.add(name);
              projects[p.id] = { ...p, name };
              newProjectIds.push(p.id);
            }
            return {
              projects,
              projectOrder: [...newProjectIds, ...s.projectOrder],
              folders,
              folderOrder: [...newFolderIds, ...s.folderOrder],
            };
          }),

        renameProject: (id, name) =>
          set((s) => withProject(s, id, (p) => ({ ...p, name }))),

        deleteProject: (id) =>
          set((s) => {
            if (!s.projects[id]) return s;
            const projects = { ...s.projects };
            delete projects[id];
            return {
              projects,
              projectOrder: s.projectOrder.filter((x) => x !== id),
            };
          }),

        duplicateProject: (id) => {
          const src = get().projects[id];
          if (!src) return null;
          const taken = Object.values(get().projects).map((p) => p.name);
          const now = Date.now();
          const copy: Project = {
            ...src,
            id: createId(),
            name: uniqueName(`${src.name} copy`, taken),
            createdAt: now,
            updatedAt: now,
            background: { ...src.background },
            text: { ...src.text },
            device: { ...src.device },
            shots: src.shots.map((sh) => ({ ...sh, id: createId() })),
          };
          set((s) => {
            const order = [...s.projectOrder];
            const i = order.indexOf(id);
            order.splice(i >= 0 ? i + 1 : order.length, 0, copy.id);
            return {
              projects: { ...s.projects, [copy.id]: copy },
              projectOrder: order,
            };
          });
          return copy.id;
        },

        moveProject: (id, dir) =>
          set((s) => {
            const order = [...s.projectOrder];
            const i = order.indexOf(id);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= order.length) return s;
            [order[i], order[j]] = [order[j], order[i]];
            return { projectOrder: order };
          }),

        createFolder: (name) => {
          const taken = Object.values(get().folders).map((f) => f.name);
          const folder = makeFolder(uniqueName(name ?? "New folder", taken));
          set((s) => ({
            folders: { ...s.folders, [folder.id]: folder },
            folderOrder: [folder.id, ...s.folderOrder],
          }));
          return folder.id;
        },

        renameFolder: (id, name) =>
          set((s) => {
            const f = s.folders[id];
            if (!f) return s;
            return {
              folders: {
                ...s.folders,
                [id]: { ...f, name, updatedAt: Date.now() },
              },
            };
          }),

        deleteFolder: (id) =>
          set((s) => {
            if (!s.folders[id]) return s;
            const folders = { ...s.folders };
            delete folders[id];
            // Orphaned projects fall back to the root rather than being deleted.
            const projects = { ...s.projects };
            for (const pid of s.projectOrder) {
              const p = projects[pid];
              if (p?.folderId === id) {
                projects[pid] = { ...p, folderId: null, updatedAt: Date.now() };
              }
            }
            return {
              folders,
              folderOrder: s.folderOrder.filter((x) => x !== id),
              projects,
            };
          }),

        moveProjectToFolder: (projectId, folderId) =>
          set((s) => {
            const p = s.projects[projectId];
            if (!p) return s;
            const target = folderId && s.folders[folderId] ? folderId : null;
            if (p.folderId === target) return s;
            return {
              projects: {
                ...s.projects,
                [projectId]: { ...p, folderId: target, updatedAt: Date.now() },
              },
            };
          }),

        setViewMode: (mode) => set({ viewMode: mode }),

        patchSettings: (id, patch) =>
          set((s) => withProject(s, id, (p) => ({ ...p, ...patch }))),

        addShots: (id, images) =>
          set((s) =>
            withProject(s, id, (p) => ({
              ...p,
              shots: [...p.shots, ...images.map((img) => makeShot(img))],
            })),
          ),

        addEmptyShot: (id) =>
          set((s) =>
            withProject(s, id, (p) => ({
              ...p,
              shots: [...p.shots, makeShot(null)],
            })),
          ),

        setShotImage: (projectId, shotId, image) =>
          set((s) =>
            withProject(s, projectId, (p) => ({
              ...p,
              shots: p.shots.map((sh) =>
                sh.id === shotId ? { ...sh, image } : sh,
              ),
            })),
          ),

        updateShotLayout: (projectId, shotId, patch) =>
          set((s) =>
            withProject(s, projectId, (p) => ({
              ...p,
              shots: p.shots.map((sh) =>
                sh.id === shotId ? { ...sh, ...patch } : sh,
              ),
            })),
          ),

        updateShotText: (projectId, shotId, patch) =>
          set((s) =>
            withProject(s, projectId, (p) => ({
              ...p,
              shots: p.shots.map((sh) =>
                sh.id === shotId ? { ...sh, ...patch } : sh,
              ),
            })),
          ),

        removeShot: (projectId, shotId) =>
          set((s) =>
            withProject(s, projectId, (p) => ({
              ...p,
              shots: p.shots.filter((sh) => sh.id !== shotId),
            })),
          ),

        moveShot: (projectId, shotId, dir) =>
          set((s) =>
            withProject(s, projectId, (p) => {
              const shots = [...p.shots];
              const i = shots.findIndex((sh) => sh.id === shotId);
              const j = i + dir;
              if (i < 0 || j < 0 || j >= shots.length) return p;
              [shots[i], shots[j]] = [shots[j], shots[i]];
              return { ...p, shots };
            }),
          ),

        reorderShots: (projectId, from, to) =>
          set((s) =>
            withProject(s, projectId, (p) => {
              const shots = [...p.shots];
              if (
                from === to ||
                from < 0 ||
                from >= shots.length ||
                to < 0 ||
                to >= shots.length
              )
                return p;
              const [moved] = shots.splice(from, 1);
              shots.splice(to, 0, moved);
              return { ...p, shots };
            }),
          ),
      }),
      {
        name: "screenshot-studio",
        // v5 added folders and a per-project folderId. That change is purely
        // additive, so v4 state is migrated in place (existing projects are
        // kept, just given `folderId: null`). Anything older than v4 predates
        // the current shot shape and is discarded (the app is pre-release).
        version: 5,
        migrate: (persisted, version) => {
          const empty = {
            projects: {},
            projectOrder: [],
            folders: {},
            folderOrder: [],
          };
          if (version !== 4 || !persisted || typeof persisted !== "object") {
            return empty;
          }
          const s = persisted as {
            projects?: Record<string, Project>;
            projectOrder?: string[];
          };
          const projects: Record<string, Project> = {};
          for (const [id, p] of Object.entries(s.projects ?? {})) {
            projects[id] = { ...p, folderId: p.folderId ?? null };
          }
          return {
            projects,
            projectOrder: s.projectOrder ?? Object.keys(projects),
            folders: {},
            folderOrder: [],
          };
        },
        storage: createIdbStorage(),
        partialize: (state) => ({
          projects: state.projects,
          projectOrder: state.projectOrder,
          folders: state.folders,
          folderOrder: state.folderOrder,
          // A persisted UI preference — restored across sessions.
          viewMode: state.viewMode,
        }),
      },
    ),
    {
      limit: 100,
      // Undo tracks data only; the view mode is a UI preference and must not
      // create undo steps.
      partialize: (state) => ({
        projects: state.projects,
        projectOrder: state.projectOrder,
        folders: state.folders,
        folderOrder: state.folderOrder,
      }),
      equality: (a, b) =>
        a.projects === b.projects &&
        a.projectOrder === b.projectOrder &&
        a.folders === b.folders &&
        a.folderOrder === b.folderOrder,
    },
  ),
);

if (typeof window !== "undefined") {
  // IndexedDB rehydration must not become an undoable step.
  useProjectStore.persist.onFinishHydration(() => {
    useProjectStore.temporal.getState().clear();
  });
  // Rehydrate when another tab writes so tabs don't clobber each other.
  onExternalWrite(() => void useProjectStore.persist.rehydrate());
}

/** Undo the last change. */
export function undo(): void {
  useProjectStore.temporal.getState().undo();
}

/** Redo the last undone change. */
export function redo(): void {
  useProjectStore.temporal.getState().redo();
}

/** Selects a single project by id. */
export function useProject(id: string): Project | undefined {
  return useProjectStore((s) => s.projects[id]);
}

/** Undo/redo controls and availability, sourced from the temporal store. */
export function useTemporal() {
  const state = useStore(
    useProjectStore.temporal,
    useShallow((s) => ({
      canUndo: s.pastStates.length > 0,
      canRedo: s.futureStates.length > 0,
    })),
  );
  return { ...state, undo, redo };
}

/**
 * True once the persisted state has finished loading from IndexedDB. Uses a
 * fixed server snapshot (`false`) to avoid SSR hydration mismatches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useProjectStore.persist.onFinishHydration(onChange),
    () => useProjectStore.persist.hasHydrated(),
    () => false,
  );
}
