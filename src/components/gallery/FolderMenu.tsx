"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Copy,
  Merge,
  Download,
  Folder as FolderIcon,
  GitBranch,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Folder } from "@/lib/model/types";
import { useShallow } from "zustand/react/shallow";
import { useProjectStore } from "@/store/useProjectStore";
import { exportWorkspaceFile } from "@/lib/storage/project-file";
import { cn, uniqueName } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog, RenameDialog } from "./dialogs";
import { NewVersionDialog } from "./NewVersionDialog";
import { AssignAppDialog } from "./AssignAppDialog";
import { MergeLanguagesDialog } from "./MergeLanguagesDialog";
import { folderGroupKey } from "@/lib/model/version";

/** Shared actions menu for a folder, used by both the grid tile and list row. */
export function FolderMenu({
  folder,
  projectCount,
}: {
  folder: Folder;
  projectCount: number;
}) {
  const router = useRouter();
  const renameFolder = useProjectStore((s) => s.renameFolder);
  const deleteFolder = useProjectStore((s) => s.deleteFolder);
  const duplicateFolder = useProjectStore((s) => s.duplicateFolder);
  const createFolderVersion = useProjectStore((s) => s.createFolderVersion);
  const setFolderApp = useProjectStore((s) => s.setFolderApp);
  const mergeProjects = useProjectStore((s) => s.mergeProjects);
  const folderProjects = useProjectStore(
    useShallow((s) =>
      s.projectOrder
        .map((id) => s.projects[id])
        .filter((p) => p && p.folderId === folder.id),
    ),
  );
  // Apps that already exist, offered as suggestions when filing this folder.
  const appNames = useProjectStore(
    useShallow((s) =>
      [
        ...new Set(
          Object.values(s.folders)
            .filter((f) => f.id !== folder.id)
            .map(folderGroupKey),
        ),
      ].sort(),
    ),
  );
  const allFolderNames = useProjectStore(
    useShallow((s) => Object.values(s.folders).map((f) => f.name)),
  );
  const folderNames = allFolderNames.filter((n) => n !== folder.name);

  const [renameOpen, setRenameOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleExport = async () => {
    const { projects, projectOrder } = useProjectStore.getState();
    const inFolder = projectOrder
      .map((id) => projects[id])
      .filter((p) => p && p.folderId === folder.id);
    if (inFolder.length === 0) {
      toast.error("This folder has no projects to export");
      return;
    }
    try {
      await exportWorkspaceFile(inFolder, [folder], folder.name);
      toast.success(`Exported “${folder.name}” (${inFolder.length})`);
    } catch (error) {
      console.error(error);
      toast.error("Export failed");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Folder actions"
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => router.push(`/?folder=${folder.id}`)}
          >
            <FolderIcon className="size-4" />
            Open
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDuplicateOpen(true)}>
            <Copy className="size-4" />
            Duplicate…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setVersionOpen(true)}>
            <GitBranch className="size-4" />
            New version…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMergeOpen(true)}>
            <Merge className="size-4" />
            Merge by language…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAssignOpen(true)}>
            <Boxes className="size-4" />
            Assign to app…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleExport()}>
            <Download className="size-4" />
            Export folder (.studio)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename folder"
        initialName={folder.name}
        takenNames={folderNames}
        onSubmit={(name) => renameFolder(folder.id, name)}
      />

      <RenameDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        title="Duplicate folder"
        initialName={uniqueName(`${folder.name} copy`, allFolderNames)}
        takenNames={allFolderNames}
        onSubmit={(name) => {
          duplicateFolder(folder.id, name);
          toast.success(
            `Duplicated “${folder.name}” with ${projectCount} ${
              projectCount === 1 ? "project" : "projects"
            }`,
          );
        }}
      />

      <NewVersionDialog
        // Remount on open so the draft re-reads the folder's current name.
        key={versionOpen ? "open" : "closed"}
        open={versionOpen}
        onOpenChange={setVersionOpen}
        folder={folder}
        projectCount={projectCount}
        takenNames={allFolderNames}
        onSubmit={(name, options) => {
          const id = createFolderVersion(folder.id, name, options);
          if (!id) return;
          toast.success(`Created “${name}”`);
          router.push(`/?folder=${id}`);
        }}
      />

      <MergeLanguagesDialog
        // Remount on open so the preview reflects the folder as it is now.
        key={mergeOpen ? "merge-open" : "merge-closed"}
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        projects={folderProjects}
        onMerge={(parts, name) => {
          if (mergeProjects(parts, name)) {
            toast.success(`Merged ${parts.length} projects into “${name}”`);
          }
        }}
      />

      <AssignAppDialog
        // Remount on open so the draft reflects the folder's current app.
        key={assignOpen ? "open" : "closed"}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        folder={folder}
        appNames={appNames}
        onSubmit={(appName) => {
          setFolderApp(folder.id, appName);
          toast.success(
            appName
              ? `“${folder.name}” filed under “${appName}”`
              : `“${folder.name}” groups by its name again`,
          );
        }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete folder?"
        description={`“${folder.name}” will be removed. Its ${projectCount} ${
          projectCount === 1 ? "project" : "projects"
        } will move back to All projects.`}
        onConfirm={() => deleteFolder(folder.id)}
      />
    </>
  );
}
