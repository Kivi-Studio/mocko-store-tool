"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Folder as FolderIcon,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Folder } from "@/lib/model/types";
import { useShallow } from "zustand/react/shallow";
import { useProjectStore } from "@/store/useProjectStore";
import { exportWorkspaceFile } from "@/lib/storage/project-file";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog, RenameDialog } from "./dialogs";

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
  const folderNames = useProjectStore(
    useShallow((s) =>
      Object.values(s.folders)
        .filter((f) => f.id !== folder.id)
        .map((f) => f.name),
    ),
  );

  const [renameOpen, setRenameOpen] = useState(false);
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
