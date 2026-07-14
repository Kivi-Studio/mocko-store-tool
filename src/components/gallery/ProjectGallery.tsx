"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Archive,
  CheckSquare,
  ChevronDown,
  Download,
  FilePlus2,
  FolderPlus,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useHydrated, useProjectStore } from "@/store/useProjectStore";
import {
  exportWorkspaceFile,
  readWorkspaceFile,
  type WorkspacePayload,
} from "@/lib/storage/project-file";
import { APP_VERSION } from "@/lib/version";
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
import { ViewToggle } from "./ViewToggle";
import { SelectionBar } from "./SelectionBar";
import { ConfirmDeleteDialog, RenameDialog } from "./dialogs";
import { ImportChoiceDialog } from "./ImportDialog";

export function ProjectGallery() {
  const router = useRouter();
  const folderParam = useSearchParams().get("folder");

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

  const hydrated = useHydrated();
  const fileRef = useRef<HTMLInputElement>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<WorkspacePayload | null>(
    null,
  );
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // An unknown/deleted folder id falls back to the root view.
  const activeFolder = folderParam ? folders[folderParam] : undefined;
  const currentFolderId = activeFolder ? activeFolder.id : null;

  // Selection is scoped to the current view — reset it when navigating between
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
  const folderItems =
    currentFolderId === null
      ? folderOrder.map((id) => folders[id]).filter(Boolean)
      : [];

  const folderList = folderOrder.map((id) => folders[id]).filter(Boolean);
  const projectsInFolder = (id: string) =>
    projectOrder.map((pid) => projects[pid]).filter((p) => p && p.folderId === id);

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

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const payload = await readWorkspaceFile(file);
      // A single loose project is added directly and opened, as before. A
      // multi-project or folder-bearing backup asks how to import.
      if (payload.folders.length > 0 || payload.projects.length > 1) {
        setPendingImport(payload);
      } else {
        importWorkspace(payload, "add");
        toast.success("Project imported");
        router.push(`/project/?id=${payload.projects[0].id}`);
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not read file");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runImport = (mode: "add" | "replace") => {
    if (!pendingImport) return;
    const { projects: ps, folders: fs } = pendingImport;
    importWorkspace(pendingImport, mode);
    setPendingImport(null);
    toast.success(
      mode === "replace"
        ? `Replaced with ${ps.length} project(s)`
        : `Imported ${ps.length} project(s)${fs.length ? ` in ${fs.length} folder(s)` : ""}`,
    );
    router.push("/");
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

  const isEmpty = folderItems.length === 0 && projectItems.length === 0;

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
              Design App Store &amp; Google Play screenshots — upload, caption
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
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="outline"
            onClick={() => setNewFolderOpen(true)}
            disabled={!hydrated}
          >
            <FolderPlus className="size-4" />
            New folder
          </Button>
          {/* Disabled until hydration: a project created before the persisted
              state arrives would be overwritten by it. */}
          <Button onClick={handleCreate} disabled={!hydrated}>
            <FilePlus2 className="size-4" />
            New project
          </Button>
        </div>
      </header>

      {/* Breadcrumb + select + view toggle */}
      <div className="mb-6 flex min-h-9 items-center justify-between gap-4">
        <nav className="text-muted-foreground flex items-center gap-1.5 text-sm">
          {activeFolder ? (
            <>
              <Link
                href="/"
                className="hover:text-foreground rounded px-1 py-0.5 transition-colors"
              >
                All projects
              </Link>
              <span className="opacity-50">/</span>
              <span className="text-foreground font-medium">
                {activeFolder.name}
              </span>
            </>
          ) : (
            <span className="text-foreground font-medium">All projects</span>
          )}
        </nav>
        {hydrated && (
          <div className="flex items-center gap-2">
            {projectItems.length > 0 && (
              <Button
                variant={selectMode ? "secondary" : "outline"}
                size="sm"
                onClick={() => (selectMode ? clearSelection() : setSelectMode(true))}
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
        <button
          type="button"
          onClick={handleCreate}
          className="text-muted-foreground hover:border-foreground/30 hover:text-foreground flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 transition-colors"
        >
          <FilePlus2 className="size-10" />
          <span className="text-sm font-medium">
            {activeFolder
              ? "This folder is empty — add a project"
              : "Create your first project"}
          </span>
        </button>
      ) : viewMode === "grid" ? (
        <div className="space-y-8">
          {folderItems.length > 0 && (
            <section>
              <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                Folders
              </h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {folderItems.map((f) => (
                  <FolderCard
                    key={f.id}
                    folder={f}
                    projects={projectsInFolder(f.id)}
                  />
                ))}
              </div>
            </section>
          )}
          {projectItems.length > 0 && (
            <section>
              {folderItems.length > 0 && (
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
          {folderItems.map((f) => (
            <FolderRow
              key={f.id}
              folder={f}
              projectCount={projectsInFolder(f.id).length}
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

      <footer className="text-muted-foreground mt-12 text-center text-xs">
        Mocko v{APP_VERSION} · Powered by{" "}
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

      <ImportChoiceDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null);
        }}
        projectCount={pendingImport?.projects.length ?? 0}
        folderCount={pendingImport?.folders.length ?? 0}
        onAdd={() => runImport("add")}
        onReplace={() => runImport("replace")}
      />

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} project(s)?`}
        description="The selected projects and all their screenshots will be permanently removed."
        onConfirm={handleDeleteSelected}
      />
    </div>
  );
}
