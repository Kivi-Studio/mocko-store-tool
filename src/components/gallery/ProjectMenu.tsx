"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Download,
  FolderOpen,
  FolderInput,
  Home,
  MoreVertical,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/model/types";
import { exportProjectZip } from "@/lib/render/export";
import { exportProjectFile } from "@/lib/storage/project-file";
import { useShallow } from "zustand/react/shallow";
import { useProjectStore } from "@/store/useProjectStore";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog, RenameDialog } from "./dialogs";

/**
 * The shared actions menu for a project, used by both the grid card and the
 * list row: open, rename, duplicate, move to a folder, export and delete.
 */
export function ProjectMenu({ project }: { project: Project }) {
  const router = useRouter();
  const renameProject = useProjectStore((s) => s.renameProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const moveProjectToFolder = useProjectStore((s) => s.moveProjectToFolder);
  const folders = useProjectStore(
    useShallow((s) => s.folderOrder.map((id) => s.folders[id]).filter(Boolean)),
  );
  // Project names only need to be unique inside their own folder.
  const siblingNames = useProjectStore(
    useShallow((s) =>
      Object.values(s.projects)
        .filter((p) => p.folderId === project.folderId && p.id !== project.id)
        .map((p) => p.name),
    ),
  );

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const count = project.shots.length;
  const href = `/project/?id=${project.id}`;

  const handleExportZip = async () => {
    if (count === 0) {
      toast.error("No screenshots to export yet");
      return;
    }
    try {
      await exportProjectZip(project);
      toast.success(`Exported ${count} screenshot(s) as ZIP`);
    } catch (error) {
      console.error(error);
      toast.error("Export failed");
    }
  };

  const handleSaveFile = async () => {
    try {
      await exportProjectFile(project);
    } catch (error) {
      console.error(error);
      toast.error("Could not save project file");
    }
  };

  const otherFolders = folders.filter((f) => f.id !== project.folderId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Actions"
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(href)}>
            <FolderOpen className="size-4" />
            Open
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              const id = duplicateProject(project.id);
              if (id) router.push(`/project/?id=${id}`);
            }}
          >
            <Copy className="size-4" />
            Duplicate
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput className="size-4" />
              Move to folder
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {project.folderId !== null && (
                <DropdownMenuItem
                  onClick={() => moveProjectToFolder(project.id, null)}
                >
                  <Home className="size-4" />
                  All projects
                </DropdownMenuItem>
              )}
              {otherFolders.length === 0 && project.folderId === null ? (
                <DropdownMenuItem disabled>No folders yet</DropdownMenuItem>
              ) : (
                otherFolders.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    onClick={() => moveProjectToFolder(project.id, f.id)}
                  >
                    <FolderInput className="size-4" />
                    {f.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void handleExportZip()}>
            <Download className="size-4" />
            Export all (ZIP)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleSaveFile()}>
            <Save className="size-4" />
            Save file (.studio)
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
        title="Rename project"
        initialName={project.name}
        takenNames={siblingNames}
        onSubmit={(name) => renameProject(project.id, name)}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project?"
        description={`“${project.name}” and all its screenshots will be permanently removed.`}
        onConfirm={() => deleteProject(project.id)}
      />
    </>
  );
}
