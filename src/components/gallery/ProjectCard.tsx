"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Copy,
  Download,
  FolderOpen,
  ImageOff,
  MoreVertical,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/types";
import { getPreset } from "@/lib/presets";
import { exportProjectZip } from "@/lib/export";
import { exportProjectFile } from "@/lib/project-file";
import { useProjectStore } from "@/store/useProjectStore";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShotCanvas } from "@/components/editor/ShotCanvas";
import { ConfirmDeleteDialog, RenameDialog } from "./dialogs";

export function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();
  const renameProject = useProjectStore((s) => s.renameProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const cover = project.shots[0];
  const count = project.shots.length;
  const preset = getPreset(project.presetId);

  const handleExportZip = async () => {
    if (count === 0) {
      toast.error("No screenshots to export yet");
      return;
    }
    try {
      await exportProjectZip(
        project,
        project.languages.map((l) => l.code),
      );
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

  return (
    <div className="group bg-card overflow-hidden rounded-xl border transition-shadow hover:shadow-md">
      <Link
        href={`/project/${project.id}`}
        className="bg-muted/40 flex h-[260px] items-center justify-center overflow-hidden p-4"
        aria-label={`Open ${project.name}`}
      >
        {cover ? (
          <ShotCanvas
            project={project}
            shot={cover}
            language={project.defaultLanguage}
            className="h-auto max-h-full w-auto max-w-full rounded shadow-sm"
          />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2">
            <ImageOff className="size-8" />
            <span className="text-xs">Empty project</span>
          </div>
        )}
      </Link>

      <div className="flex items-center justify-between gap-2 border-t p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <p className="text-muted-foreground text-xs">
            {count} {count === 1 ? "screenshot" : "screenshots"} ·{" "}
            {preset.name.split(" · ")[0]}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Actions"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
            )}
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => router.push(`/project/${project.id}`)}
            >
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
                if (id) router.push(`/project/${id}`);
              }}
            >
              <Copy className="size-4" />
              Duplicate
            </DropdownMenuItem>
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
      </div>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename project"
        initialName={project.name}
        onSubmit={(name) => renameProject(project.id, name)}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project?"
        description={`“${project.name}” and all its screenshots will be permanently removed.`}
        onConfirm={() => deleteProject(project.id)}
      />
    </div>
  );
}
