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
  Project,
  Shot,
  TextStyle,
} from "@/lib/types";
import { makeProject, makeShot } from "@/lib/defaults";
import { createIdbStorage, onExternalWrite } from "@/lib/idb-storage";
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

type ShotPatch = Partial<Omit<Shot, "id">>;

export type ProjectStore = {
  projects: Record<string, Project>;
  /** Gallery order, newest first. */
  projectOrder: string[];

  createProject: (name?: string) => string;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => string | null;
  moveProject: (id: string, dir: MoveDir) => void;
  /** Adds an already-built project (e.g. from a `.json` import). */
  addProject: (project: Project) => string;

  patchSettings: (id: string, patch: SettingsPatch) => void;
  addShots: (id: string, images: string[]) => void;
  updateShot: (projectId: string, shotId: string, patch: ShotPatch) => void;
  removeShot: (projectId: string, shotId: string) => void;
  moveShot: (projectId: string, shotId: string, dir: MoveDir) => void;
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

        createProject: (name) => {
          const taken = Object.values(get().projects).map((p) => p.name);
          const project = makeProject(
            uniqueName(name ?? "Untitled project", taken),
          );
          set((s) => ({
            projects: { ...s.projects, [project.id]: project },
            projectOrder: [project.id, ...s.projectOrder],
          }));
          return project.id;
        },

        addProject: (project) => {
          set((s) => ({
            projects: { ...s.projects, [project.id]: project },
            projectOrder: [project.id, ...s.projectOrder],
          }));
          return project.id;
        },

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

        patchSettings: (id, patch) =>
          set((s) => withProject(s, id, (p) => ({ ...p, ...patch }))),

        addShots: (id, images) =>
          set((s) =>
            withProject(s, id, (p) => ({
              ...p,
              shots: [...p.shots, ...images.map((img) => makeShot(img))],
            })),
          ),

        updateShot: (projectId, shotId, patch) =>
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
      }),
      {
        name: "screenshot-studio",
        version: 1,
        storage: createIdbStorage(),
        partialize: (state) => ({
          projects: state.projects,
          projectOrder: state.projectOrder,
        }),
      },
    ),
    {
      limit: 100,
      partialize: (state) => ({
        projects: state.projects,
        projectOrder: state.projectOrder,
      }),
      equality: (a, b) =>
        a.projects === b.projects && a.projectOrder === b.projectOrder,
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
