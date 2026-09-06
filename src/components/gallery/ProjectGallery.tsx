"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Archive,
  CheckSquare,
  ChevronDown,
  Download,
  FilePlus2,
  FolderPlus,
  GitBranch,
  Sparkles,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  useHydrated,
  useProjectStore,
  wipeWorkspace,
} from "@/store/useProjectStore";
import {
  exportWorkspaceFile,
  isProjectFile,
  readWorkspaceFile,
  type WorkspacePayload,
} from "@/lib/storage/project-file";
import { APP_VERSION_LABEL } from "@/lib/version";
import { demoLanguageFor } from "@/lib/storage/demo-workspace";
import { groupFolders, versionLabel } from "@/lib/model/version";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ProjectCard } from "./ProjectCard";
import { ProjectRow } from "./ProjectRow";
import { FolderCard } from "./FolderCard";
import { FolderRow } from "./FolderRow";
import { AppCard } from "./AppCard";
import { AppRow } from "./AppRow";
import { GalleryBreadcrumb } from "./GalleryBreadcrumb";
import { ViewToggle } from "./ViewToggle";
import { SelectionBar } from "./SelectionBar";
import { ConfirmDeleteDialog, RenameDialog } from "./dialogs";
import { ImportChoiceDialog } from "./ImportDialog";
import { planImport } from "./import-plan";
import { NewVersionDialog } from "./NewVersionDialog";
import { BackupReminder } from "./BackupReminder";
import { BackupDropZone } from "./BackupDropZone";
import { WipeDialog } from "./WipeDialog";
import { useLoadDemo } from "./useLoadDemo";

export function ProjectGallery() {
  const router = useRouter();
  const params = useSearchParams();
  const folderParam = params.get("folder");
  const appParam = params.get("app");

  const projects = useProjectStore((s) => s.projects);
  const projectOrder = useProjectStore((s) => s.projectOrder);
  const folders = useProjectStore((s) => s.folders);
  const folderOrder = useProjectStore((s) => s.folderOrder);
  const viewMode = useProjectStore((s) => s.viewMode);
  const setViewMode = useProjectStore((s) => s.setViewMode);
  const createProject = useProjectStore((s) => s.createProject);
  const createFolder = useProjectStore((s) => s.createFolder);
  const importWorkspace = useProjectStore((s) => s.importWorkspace);
  const moveProjectToFolder = useProjectStore((s) => s.moveProjectToFolder);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const createFolderVersion = useProjectStore((s) => s.createFolderVersion);

  const hydrated = useHydrated();
  const loadDemo = useLoadDemo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<WorkspacePayload | null>(
    null,
  );
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);

  // `?demo` (or `?demo=de`) loads the sample workspace and then drops the
  // parameter, so the link can be passed around and reloaded without effect.
  // Waits for hydration like every other write to the library. The native
  // replaceState is enough here (the App Router picks it up); there is no
  // navigation to make, only a query string to shed.
  const demoParam = params.get("demo");
  const demoHandled = useRef(false);
  useEffect(() => {
    if (demoParam === null || !hydrated || demoHandled.current) return;
    demoHandled.current = true;
    void loadDemo(demoLanguageFor(demoParam)).finally(() =>
      window.history.replaceState(null, "", "/"),
    );
  }, [demoParam, hydrated, loadDemo]);

  // An unknown/deleted folder id falls back to the root view.
  const activeFolder = folderParam ? folders[folderParam] : undefined;
  const currentFolderId = activeFolder ? activeFolder.id : null;

  // Selection is scoped to the current view. Reset it when navigating between
  // folders (adjust-state-during-render rather than an effect).
  const [prevFolderId, setPrevFolderId] = useState(currentFolderId);
  if (prevFolderId !== currentFolderId) {
    setPrevFolderId(currentFolderId);
    setSelected(new Set());
    setSelectMode(false);
  }

  const projectItems = projectOrder
    .map((id) => projects[id])
    .filter((p) => p && p.folderId === currentFolderId);

  const folderList = useMemo(
    () => folderOrder.map((id) => folders[id]).filter(Boolean),
    [folderOrder, folders],
  );
  // Releases of one app collapse into a single tile, so the root does not grow
  // by one card per version. Folders that share no app stay as they are.
  const { groups, ungrouped } = useMemo(
    () => groupFolders(folderList),
    [folderList],
  );

  // An `?app=` that no longer matches a group (its releases were deleted or
  // renamed) falls back to the root, like an unknown folder id does.
  const activeApp =
    !activeFolder && appParam
      ? (groups.find((g) => g.key === appParam) ?? null)
      : null;
  // The app the open folder belongs to, for the breadcrumb's version picker.
  const folderApp = activeFolder
    ? (groups.find((g) => g.folders.some((f) => f.id === activeFolder.id)) ??
      null)
    : null;

  // At the root only loose folders are listed; inside an app, its releases.
  const folderItems = activeFolder
    ? []
    : activeApp
      ? activeApp.folders
      : ungrouped;

  const projectsInFolder = (id: string) =>
    projectOrder
      .map((pid) => projects[pid])
      .filter((p) => p && p.folderId === id);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearSelection = () => {
    setSelected(new Set());
    setSelectMode(false);
  };

  const handleCreate = () => {
    const id = createProject(undefined, currentFolderId);
    router.push(`/project/?id=${id}`);
  };

  const runImport = (payload: WorkspacePayload, mode: "add" | "replace") => {
    const { projects: ps, folders: fs } = payload;
    importWorkspace(payload, mode);
    setPendingImport(null);
    toast.success(
      mode === "replace"
        ? `Replaced with ${ps.length} project(s)`
        : `Imported ${ps.length} project(s)${fs.length ? ` in ${fs.length} folder(s)` : ""}`,
    );
    router.push("/");
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      // Judged by name before reading: a PNG dropped by mistake should hear
      // "wrong kind of file", not what went wrong while unzipping it.
      if (!isProjectFile(file)) {
        toast.error("Invalid file. Only .studio backups can be imported.");
        return;
      }
      const payload = await readWorkspaceFile(file);
      // The Backup menu only renders once hydrated, so an empty order really
      // is an empty workspace and not one that has yet to load.
      const workspaceEmpty =
        projectOrder.length === 0 && folderOrder.length === 0;
      switch (planImport(payload, workspaceEmpty)) {
        case "open":
          importWorkspace(payload, "add");
          toast.success("Project imported");
          router.push(`/project/?id=${payload.projects[0].id}`);
          break;
        case "add":
          runImport(payload, "add");
          break;
        case "ask":
          setPendingImport(payload);
          break;
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Could not read file",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleExportAll = async () => {
    const all = projectOrder.map((id) => projects[id]).filter(Boolean);
    if (all.length === 0) {
      toast.error("Nothing to export yet");
      return;
    }
    try {
      await exportWorkspaceFile(all, folderList, "mocko-backup");
      toast.success(`Exported ${all.length} project(s)`);
    } catch (error) {
      console.error(error);
      toast.error("Export failed");
    }
  };

  const handleWipe = async () => {
    try {
      await wipeWorkspace();
      toast.success("Everything deleted");
      router.push("/");
    } catch (error) {
      console.error(error);
      toast.error("Could not delete everything");
    }
  };

  const selectedProjects = () =>
    [...selected].map((id) => projects[id]).filter(Boolean);

  const handleExportSelected = async () => {
    const ps = selectedProjects();
    if (ps.length === 0) return;
    const usedFolderIds = new Set(
      ps.map((p) => p.folderId).filter((x): x is string => x != null),
    );
    const usedFolders = folderList.filter((f) => usedFolderIds.has(f.id));
    try {
      await exportWorkspaceFile(ps, usedFolders, "mocko-selection");
      toast.success(`Exported ${ps.length} project(s)`);
      clearSelection();
    } catch (error) {
      console.error(error);
      toast.error("Export failed");
    }
  };

  const handleMoveSelected = (folderId: string | null) => {
    const ids = [...selected];
    ids.forEach((id) => moveProjectToFolder(id, folderId));
    toast.success(`Moved ${ids.length} project(s)`);
    clearSelection();
  };

  const handleDeleteSelected = () => {
    const ids = [...selected];
    ids.forEach((id) => deleteProject(id));
    toast.success(`Deleted ${ids.length} project(s)`);
    clearSelection();
  };

  const appItems = activeFolder || activeApp ? [] : groups;
  const isEmpty =
    folderItems.length === 0 &&
    projectItems.length === 0 &&
    appItems.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG asset, no optimization needed */}
          <img
            src="/logo.svg"
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-[9px]"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mocko</h1>
            <p className="text-muted-foreground text-sm">
              Design App Store &amp; Google Play screenshots: upload, caption
              and export in store sizes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".studio,application/zip"
            className="hidden"
            onChange={(e) => void handleImport(e.target.files?.[0])}
          />
          {/* Same import as the menu, reached by dropping the file anywhere
              on the page. Waits for hydration for the same reason the menu
              does: `handleImport` needs to know whether the workspace is
              really empty. */}
          {hydrated && (
            <BackupDropZone onFile={(file) => void handleImport(file)} />
          )}
          {hydrated && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <Archive className="size-4" />
                Backup
                <ChevronDown className="size-4 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void handleExportAll()}>
                  <Download className="size-4" />
                  Export everything
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                  <Upload className="size-4" />
                  Import from file…
                </DropdownMenuItem>
                {/* Two fictional apps to click through, for a first look
                    or for screenshots. Added like any other import. */}
                <DropdownMenuItem onClick={() => void loadDemo("en")}>
                  <Sparkles className="size-4" />
                  Load sample workspace
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* The one way to also get rid of what older versions left in
                    storage; opening the app never touches that. */}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setWipeOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Delete everything…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* An app lists releases, not projects, so its primary action is
              cutting the next release, not adding a loose project that would
              land at the root and not even show up here. */}
          {activeApp ? (
            <Button
              onClick={() => setNewVersionOpen(true)}
              disabled={!hydrated}
            >
              <GitBranch className="size-4" />
              New version
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setNewFolderOpen(true)}
                disabled={!hydrated}
              >
                <FolderPlus className="size-4" />
                New folder
              </Button>
              {/* Disabled until hydration: a project created before the
                  persisted state arrives would be overwritten by it. */}
              <Button onClick={handleCreate} disabled={!hydrated}>
                <FilePlus2 className="size-4" />
                New project
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Breadcrumb + select + view toggle */}
      <div className="mb-6 flex min-h-9 items-center justify-between gap-4">
        <GalleryBreadcrumb
          app={activeApp?.key ?? folderApp?.key ?? null}
          folder={activeFolder ?? null}
          versions={folderApp?.folders ?? []}
        />
        {hydrated && (
          <div className="flex items-center gap-2">
            {/* A release's copy is written once and repeated across its
                variants, so editing it project by project is the slow part. */}
            {activeFolder && projectItems.length > 0 && (
              <Link
                href={`/captions/?folder=${activeFolder.id}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                )}
              >
                <Table2 className="size-4" />
                Captions
              </Link>
            )}
            {projectItems.length > 0 && (
              <Button
                variant={selectMode ? "secondary" : "outline"}
                size="sm"
                onClick={() =>
                  selectMode ? clearSelection() : setSelectMode(true)
                }
              >
                <CheckSquare className="size-4" />
                {selectMode ? "Done" : "Select"}
              </Button>
            )}
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        )}
      </div>

      {!hydrated ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted/40 h-[320px] animate-pulse rounded-xl border"
            />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleCreate}
            className="text-muted-foreground hover:border-foreground/30 hover:text-foreground flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 transition-colors"
          >
            <FilePlus2 className="size-10" />
            <span className="text-sm font-medium">
              {activeFolder
                ? "This folder is empty. Add a project"
                : activeApp
                  ? "This app has no releases left"
                  : "Create your first project"}
            </span>
          </button>
          {/* Only on an empty library: the sample is a first look at the
              tool, not something to drop into a folder of real work. */}
          {!activeFolder && !activeApp && (
            <p className="text-muted-foreground text-center text-sm">
              Just looking around?{" "}
              <button
                type="button"
                onClick={() => void loadDemo("en")}
                className="text-foreground font-medium underline underline-offset-2 hover:opacity-80"
              >
                Load the sample workspace
              </button>
              : two fictional apps with releases, store formats and languages to
              click through.
            </p>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="space-y-8">
          {appItems.length > 0 && (
            <section>
              <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                Apps
              </h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {appItems.map((g) => (
                  <AppCard
                    key={g.key}
                    appKey={g.key}
                    folders={g.folders}
                    latestProjects={projectsInFolder(g.folders[0].id)}
                  />
                ))}
              </div>
            </section>
          )}
          {folderItems.length > 0 && (
            <section>
              <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                {activeApp ? "Versions" : "Folders"}
              </h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {folderItems.map((f) => (
                  <FolderCard
                    key={f.id}
                    folder={f}
                    projects={projectsInFolder(f.id)}
                    label={activeApp ? versionLabel(f) : undefined}
                  />
                ))}
              </div>
            </section>
          )}
          {projectItems.length > 0 && (
            <section>
              {(folderItems.length > 0 || appItems.length > 0) && (
                <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                  Projects
                </h2>
              )}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {projectItems.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    selection={{
                      active: selectMode,
                      selected: selected.has(p.id),
                      onToggle: toggleSelect,
                    }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border">
          {appItems.map((g) => (
            <AppRow
              key={g.key}
              appKey={g.key}
              folders={g.folders}
              latestProjectCount={projectsInFolder(g.folders[0].id).length}
            />
          ))}
          {folderItems.map((f) => (
            <FolderRow
              key={f.id}
              folder={f}
              projectCount={projectsInFolder(f.id).length}
              label={activeApp ? versionLabel(f) : undefined}
            />
          ))}
          {projectItems.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              selection={{
                active: selectMode,
                selected: selected.has(p.id),
                onToggle: toggleSelect,
              }}
            />
          ))}
        </div>
      )}

      {/* Nothing to lose yet on an empty workspace. The reminder appears
          with the first project. */}
      {hydrated && projectOrder.length > 0 && (
        <BackupReminder onExport={() => void handleExportAll()} />
      )}

      <footer className="text-muted-foreground mt-12 text-center text-xs">
        Mocko v{APP_VERSION_LABEL} · Powered by{" "}
        <a
          href="https://www.kivistudio.de"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground font-medium underline underline-offset-2"
        >
          Kivi Studio
        </a>
      </footer>

      {selectMode && (
        <SelectionBar
          count={selected.size}
          folders={folderList}
          onExport={() => void handleExportSelected()}
          onMove={handleMoveSelected}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={clearSelection}
        />
      )}

      <RenameDialog
        // Remount on each open so the draft always starts empty.
        key={newFolderOpen ? "open" : "closed"}
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        title="New folder"
        initialName=""
        takenNames={Object.values(folders).map((f) => f.name)}
        onSubmit={(name) => createFolder(name)}
      />

      {activeApp && (
        <NewVersionDialog
          // Remount on open so the draft re-reads the newest release.
          key={newVersionOpen ? "open" : "closed"}
          open={newVersionOpen}
          onOpenChange={setNewVersionOpen}
          folder={activeApp.folders[0]}
          projectCount={projectsInFolder(activeApp.folders[0].id).length}
          takenNames={folderList.map((f) => f.name)}
          baseName={activeApp.key}
          onSubmit={(name, options) => {
            const id = createFolderVersion(
              activeApp.folders[0].id,
              name,
              options,
            );
            if (!id) return;
            toast.success(`Created “${name}”`);
            router.push(`/?folder=${id}`);
          }}
        />
      )}

      <ImportChoiceDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null);
        }}
        projectCount={pendingImport?.projects.length ?? 0}
        folderCount={pendingImport?.folders.length ?? 0}
        onAdd={() => pendingImport && runImport(pendingImport, "add")}
        onReplace={() => pendingImport && runImport(pendingImport, "replace")}
      />

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} project(s)?`}
        description="The selected projects and all their screenshots will be permanently removed."
        onConfirm={handleDeleteSelected}
      />

      <WipeDialog
        open={wipeOpen}
        onOpenChange={setWipeOpen}
        projectCount={projectOrder.length}
        folderCount={folderOrder.length}
        onExport={() => void handleExportAll()}
        onConfirm={() => void handleWipe()}
      />
    </div>
  );
}
