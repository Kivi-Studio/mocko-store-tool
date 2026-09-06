"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { persist } from "zustand/middleware";
import { temporal } from "zundo";

import type {
  Background,
  Caption,
  DeviceStyle,
  Folder,
  Language,
  Project,
  Shot,
  TextStyle,
  ViewMode,
} from "@/lib/model/types";
import { captionFor, imageIdFor } from "@/lib/model/caption";
import { makeFolder, makeProject, makeShot } from "@/lib/model/defaults";
import {
  backupLegacyState,
  createIdbStorage,
  discardLegacyBackup,
  onExternalWrite,
} from "@/lib/storage/idb-storage";
import { sweep } from "@/lib/storage/image-store";
import {
  migrateProjectToImageStore,
  referencedImageIds,
  type ImageStoreProject,
} from "@/lib/storage/migrate-images";
import { migrateProjectToLanguages } from "@/lib/storage/migrate-languages";
import { createId, uniqueName } from "@/lib/utils";

/** Reorder direction: one step towards the front (-1) or the back (1). */
type MoveDir = -1 | 1;

/**
 * What a folder copy carries over from the source shots. Styling (background,
 * text, device) always comes along — it is the folder's design, not its
 * content — including a background image.
 */
export type FolderCopyOptions = {
  /** Keep the screenshots; `false` leaves empty placeholders behind. */
  keepImages: boolean;
  /** Keep claim and subtext; `false` clears them. */
  keepCaptions: boolean;
};

/** What {@link ProjectStore.applyToProjects} carries from one project to others. */
export type ApplyOptions = {
  /** Background, text and device styling — the look shared by a release. */
  design: boolean;
  /**
   * Claim and subtext, matched by shot position. Shots the target does not
   * have yet are appended as empty placeholders, so the target ends up
   * mirroring the source's structure.
   */
  captions: boolean;
};

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
  /**
   * Deep-copies a folder and every project inside it. The copies keep their
   * source names — project names only need to be unique within their folder,
   * and the new folder starts out empty.
   */
  duplicateFolder: (id: string, name?: string) => string | null;
  /**
   * Snapshots a release: like {@link ProjectStore.duplicateFolder}, but under a
   * caller-supplied name (typically `"<App> 1.3.0"`) and with control over what
   * the copied shots keep. Clearing the images leaves the shot count, captions
   * and per-shot layout in place, ready for the next round of screenshots.
   */
  createFolderVersion: (
    id: string,
    name: string,
    options: FolderCopyOptions,
  ) => string | null;
  /**
   * Assigns a folder to an app explicitly, overriding the grouping derived from
   * its name; `null` restores the name-derived grouping. Folder names are left
   * alone — this only changes which app a folder is filed under.
   */
  setFolderApp: (id: string, appName: string | null) => void;
  /** Deletes a folder; its projects fall back to the root, they are not removed. */
  deleteFolder: (id: string) => void;
  /** Moves a project into a folder, or to the root with `null`. */
  moveProjectToFolder: (projectId: string, folderId: string | null) => void;

  /**
   * Pushes one project's design and/or captions onto other projects — the way
   * a finished master variant ("iPhone (de)") seeds its siblings. The export
   * preset and the screenshots themselves are never touched, since those are
   * exactly what makes a variant a variant. Returns how many projects changed.
   */
  applyToProjects: (
    sourceId: string,
    targetIds: string[],
    options: ApplyOptions,
  ) => number;

  setViewMode: (mode: ViewMode) => void;

  patchSettings: (id: string, patch: SettingsPatch) => void;

  /** Adds a language to a project. A code it already has is ignored. */
  addLanguage: (id: string, language: Language) => void;
  /**
   * Drops a language and everything filled in for it. The last remaining
   * language is never removed — a project without one could hold nothing.
   */
  removeLanguage: (id: string, code: string) => void;
  /** Moves a language to the front, making it the project's default. */
  setDefaultLanguage: (id: string, code: string) => void;

  /**
   * Adds screenshots for one language. Positions that language has not filled
   * in yet are used first, in order; only what is left over starts new
   * positions. Dropping the English set into a project whose German set is
   * already there therefore completes the existing shots instead of appending
   * a second, parallel run of them.
   */
  addShots: (id: string, code: string, imageIds: string[]) => void;
  /** Appends an image-less shot position that can be filled in later. */
  addEmptyShot: (id: string) => void;
  /** Sets or replaces (or clears, with null) one language's screenshot. */
  setShotImage: (
    projectId: string,
    shotId: string,
    code: string,
    imageId: string | null,
  ) => void;
  /** Patches one language's caption text (claim / subtext). */
  updateShotText: (
    projectId: string,
    shotId: string,
    code: string,
    patch: Partial<Caption>,
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

/**
 * The project names taken inside one folder (`null` = the gallery root),
 * optionally ignoring one project (when renaming or moving it).
 *
 * Names are unique per folder, not globally: two release folders may each hold
 * an "iPhone (de)", which is what makes duplicating a folder produce an exact
 * copy instead of a set of " (2)"-suffixed projects.
 */
function namesInFolder(
  s: Pick<ProjectStore, "projects">,
  folderId: string | null,
  exceptId?: string,
): string[] {
  return Object.values(s.projects)
    .filter((p) => p.folderId === folderId && p.id !== exceptId)
    .map((p) => p.name);
}

/** A deep, independently mutable copy of a project with fresh ids. */
function cloneProject(
  src: Project,
  name: string,
  folderId: string | null,
): Project {
  const now = Date.now();
  return {
    ...src,
    id: createId(),
    name,
    createdAt: now,
    updatedAt: now,
    folderId,
    background: { ...src.background },
    text: { ...src.text },
    device: { ...src.device },
    shots: src.shots.map((sh) => ({
      ...sh,
      id: createId(),
      images: { ...sh.images },
      captions: { ...sh.captions },
    })),
  };
}

/**
 * Builds the state patch for a folder copy: a fresh folder placed right after
 * the source, plus a deep copy of every project inside it. Copies keep their
 * source names and the source folder's order; `transformShot` lets a caller
 * strip images or captions on the way.
 */
function copyFolder(
  s: ProjectStore,
  id: string,
  name: string | undefined,
  transformShot?: (shot: Shot) => Shot,
): { folderId: string; patch: Partial<ProjectStore> } | null {
  const src = s.folders[id];
  if (!src) return null;
  const folder = makeFolder(
    uniqueName(
      name?.trim() || `${src.name} copy`,
      Object.values(s.folders).map((f) => f.name),
    ),
  );
  // Walk projectOrder so the copies keep the source folder's order.
  const copies = s.projectOrder
    .map((pid) => s.projects[pid])
    .filter((p) => p && p.folderId === id)
    .map((p) => {
      const copy = cloneProject(p, p.name, folder.id);
      return transformShot
        ? { ...copy, shots: copy.shots.map(transformShot) }
        : copy;
    });
  const projects = { ...s.projects };
  for (const c of copies) projects[c.id] = c;
  const folderOrder = [...s.folderOrder];
  const i = folderOrder.indexOf(id);
  folderOrder.splice(i >= 0 ? i + 1 : folderOrder.length, 0, folder.id);
  return {
    folderId: folder.id,
    patch: {
      folders: { ...s.folders, [folder.id]: folder },
      folderOrder,
      projects,
      projectOrder: [...copies.map((c) => c.id), ...s.projectOrder],
    },
  };
}

/**
 * True when this session ran the image-store migration. The pre-migration
 * backup is then kept until the *next* session loads the new shape cleanly —
 * proof that the migrated state was written and reads back.
 */
let migratedThisSession = false;

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
          const s = get();
          const target = folderId && s.folders[folderId] ? folderId : null;
          const project = makeProject(
            uniqueName(name ?? "Untitled project", namesInFolder(s, target)),
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
            projects: {
              ...s.projects,
              [project.id]: {
                ...project,
                name: uniqueName(project.name, namesInFolder(s, null)),
                folderId: null,
              },
            },
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
            // Project names collide only within their destination folder. An
            // imported folder is brand new and therefore empty, so a whole
            // imported folder keeps its project names verbatim; only projects
            // landing at the root can meet an existing sibling.
            const takenByFolder = new Map<string | null, Set<string>>();
            const takenIn = (folderId: string | null) => {
              let taken = takenByFolder.get(folderId);
              if (!taken) {
                taken = new Set(namesInFolder(s, folderId));
                takenByFolder.set(folderId, taken);
              }
              return taken;
            };
            const projects = { ...s.projects };
            const newProjectIds: string[] = [];
            for (const p of payload.projects) {
              const taken = takenIn(p.folderId);
              const name = uniqueName(p.name, taken);
              taken.add(name);
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
          const s = get();
          const src = s.projects[id];
          if (!src) return null;
          const copy = cloneProject(
            src,
            uniqueName(`${src.name} copy`, namesInFolder(s, src.folderId)),
            src.folderId,
          );
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

        duplicateFolder: (id, name) => {
          const result = copyFolder(get(), id, name);
          if (!result) return null;
          set(result.patch);
          return result.folderId;
        },

        createFolderVersion: (id, name, { keepImages, keepCaptions }) => {
          const result = copyFolder(
            get(),
            id,
            name,
            keepImages && keepCaptions
              ? undefined
              : (sh) => ({
                  ...sh,
                  images: keepImages ? { ...sh.images } : {},
                  captions: keepCaptions ? { ...sh.captions } : {},
                }),
          );
          if (!result) return null;
          set(result.patch);
          return result.folderId;
        },

        setFolderApp: (id, appName) =>
          set((s) => {
            const f = s.folders[id];
            if (!f) return s;
            const next = appName?.trim() || null;
            if ((f.appName ?? null) === next) return s;
            return {
              folders: {
                ...s.folders,
                [id]: { ...f, appName: next, updatedAt: Date.now() },
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
            // Names are unique per folder, so a move can collide.
            const name = uniqueName(
              p.name,
              namesInFolder(s, target, projectId),
            );
            return {
              projects: {
                ...s.projects,
                [projectId]: {
                  ...p,
                  name,
                  folderId: target,
                  updatedAt: Date.now(),
                },
              },
            };
          }),

        applyToProjects: (sourceId, targetIds, { design, captions }) => {
          const s = get();
          const src = s.projects[sourceId];
          if (!src || (!design && !captions)) return 0;
          const targets = targetIds.filter(
            (id) => id !== sourceId && s.projects[id],
          );
          if (targets.length === 0) return 0;

          const now = Date.now();
          const projects = { ...s.projects };
          for (const id of targets) {
            const target = projects[id];
            const next: Project = { ...target, updatedAt: now };
            if (design) {
              next.background = { ...src.background };
              next.text = { ...src.text };
              next.device = { ...src.device };
            }
            if (captions) {
              // Every language travels: the target may well maintain the same
              // set, and one it does not have simply carries an unused entry.
              const shots = target.shots.map((sh, i) => {
                const from = src.shots[i];
                return from ? { ...sh, captions: { ...from.captions } } : sh;
              });
              // The source is the master: captions past the target's last shot
              // get an empty placeholder to live in, ready for a screenshot.
              for (let i = shots.length; i < src.shots.length; i++) {
                shots.push({
                  ...makeShot(null, src.languages[0]?.code ?? ""),
                  captions: { ...src.shots[i].captions },
                });
              }
              next.shots = shots;
            }
            projects[id] = next;
          }
          set({ projects });
          return targets.length;
        },

        setViewMode: (mode) => set({ viewMode: mode }),

        patchSettings: (id, patch) =>
          set((s) => withProject(s, id, (p) => ({ ...p, ...patch }))),

        addLanguage: (id, language) =>
          set((s) =>
            withProject(s, id, (p) =>
              p.languages.some((l) => l.code === language.code)
                ? p
                : { ...p, languages: [...p.languages, language] },
            ),
          ),

        removeLanguage: (id, code) =>
          set((s) =>
            withProject(s, id, (p) => {
              const languages = p.languages.filter((l) => l.code !== code);
              if (languages.length === p.languages.length) return p;
              if (languages.length === 0) return p;
              // Drop what the language held, so no orphaned screenshot keeps
              // an image alive that nothing can reach any more.
              const shots = p.shots.map((sh) => {
                const images = { ...sh.images };
                const captions = { ...sh.captions };
                delete images[code];
                delete captions[code];
                return { ...sh, images, captions };
              });
              return { ...p, languages, shots };
            }),
          ),

        setDefaultLanguage: (id, code) =>
          set((s) =>
            withProject(s, id, (p) => {
              const language = p.languages.find((l) => l.code === code);
              if (!language || p.languages[0]?.code === code) return p;
              return {
                ...p,
                languages: [
                  language,
                  ...p.languages.filter((l) => l.code !== code),
                ],
              };
            }),
          ),

        addShots: (id, code, imageIds) =>
          set((s) =>
            withProject(s, id, (p) => {
              const queue = [...imageIds];
              const shots = p.shots.map((sh) => {
                if (queue.length === 0 || imageIdFor(sh, code) !== null) {
                  return sh;
                }
                return {
                  ...sh,
                  images: { ...sh.images, [code]: queue.shift()! },
                };
              });
              return {
                ...p,
                shots: [...shots, ...queue.map((i) => makeShot(i, code))],
              };
            }),
          ),

        addEmptyShot: (id) =>
          set((s) =>
            withProject(s, id, (p) => ({
              ...p,
              shots: [...p.shots, makeShot(null, p.languages[0]?.code ?? "")],
            })),
          ),

        setShotImage: (projectId, shotId, code, imageId) =>
          set((s) =>
            withProject(s, projectId, (p) => ({
              ...p,
              shots: p.shots.map((sh) =>
                sh.id === shotId
                  ? { ...sh, images: { ...sh.images, [code]: imageId } }
                  : sh,
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

        updateShotText: (projectId, shotId, code, patch) =>
          set((s) =>
            withProject(s, projectId, (p) => ({
              ...p,
              shots: p.shots.map((sh) =>
                sh.id === shotId
                  ? {
                      ...sh,
                      captions: {
                        ...sh.captions,
                        // captionFor supplies the blanks for a language that
                        // has not been written in yet.
                        [code]: { ...captionFor(sh, code), ...patch },
                      },
                    }
                  : sh,
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
        // The chain: v5 added folders and a per-project folderId, v6 moved
        // screenshots into the content-addressed image store, v7 made a shot a
        // *position* whose image and caption vary by language. Every version
        // from v4 on migrates in place — no project is ever discarded. Anything
        // older predates the current shot shape and is dropped (pre-release).
        version: 7,
        migrate: async (persisted, version) => {
          const empty = {
            projects: {},
            projectOrder: [],
            folders: {},
            folderOrder: [],
          };
          if (
            version < 4 ||
            version > 6 ||
            !persisted ||
            typeof persisted !== "object"
          ) {
            return empty;
          }
          const s = persisted as {
            projects?: Record<string, unknown>;
            projectOrder?: string[];
            folders?: Record<string, Folder>;
            folderOrder?: string[];
          };

          // Park the untouched original first. Moving every screenshot in the
          // library is the one write that could lose data, so the old state
          // stays recoverable until a later session proves the new one loads.
          await backupLegacyState(persisted);

          const projects: Record<string, Project> = {};
          for (const [id, raw] of Object.entries(s.projects ?? {})) {
            // v6 already holds content ids; anything older still has inline
            // data URLs and has to pass through the image store first.
            const withImages =
              version === 6
                ? (raw as ImageStoreProject)
                : await migrateProjectToImageStore(raw);
            projects[id] = migrateProjectToLanguages(withImages);
          }
          migratedThisSession = true;
          return {
            projects,
            projectOrder: s.projectOrder ?? Object.keys(projects),
            // v4 predates folders entirely.
            folders: version >= 5 ? (s.folders ?? {}) : {},
            folderOrder: version >= 5 ? (s.folderOrder ?? []) : [],
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
  useProjectStore.persist.onFinishHydration((state) => {
    useProjectStore.temporal.getState().clear();

    // A session that did not migrate has loaded the current shape from disk —
    // the pre-migration backup has served its purpose.
    if (!migratedThisSession) void discardLegacyBackup();

    // Drop images nothing points at any more: deleting a release only removes
    // its projects, and an image may still be shared with another release.
    // Skipped on an empty state — that is far more likely to be a failed load
    // than a genuinely empty library, and sweeping it would delete everything.
    const projects = state?.projects ?? {};
    if (Object.keys(projects).length > 0) {
      void sweep(referencedImageIds(projects));
    }
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
