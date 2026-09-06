"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Redo2, SquareStack, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/model/types";
import { useShallow } from "zustand/react/shallow";
import { useProjectStore, useTemporal } from "@/store/useProjectStore";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ApplyToSiblingsDialog } from "./ApplyToSiblingsDialog";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ExportDialog } from "./ExportDialog";

export function EditorTopbar({ project }: { project: Project }) {
  const renameProject = useProjectStore((s) => s.renameProject);
  const applyToProjects = useProjectStore((s) => s.applyToProjects);
  // Only the other projects in this project's folder. Applying across the
  // whole root would hit unrelated projects, so the action is folder-scoped.
  const siblings = useProjectStore(
    useShallow((s) =>
      project.folderId === null
        ? []
        : s.projectOrder
            .map((id) => s.projects[id])
            .filter(
              (p) =>
                p && p.id !== project.id && p.folderId === project.folderId,
            ),
    ),
  );
  const { canUndo, canRedo, undo, redo } = useTemporal();
  const [applyOpen, setApplyOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const handleExportClick = () => {
    if (project.shots.length === 0) {
      toast.error("No screenshots to export yet");
      return;
    }
    setExportOpen(true);
  };

  return (
    <header className="bg-card flex h-14 shrink-0 items-center gap-2 border-b px-3">
      <Link
        // Back lands where the project lives — its folder, or the root view.
        href={project.folderId ? `/?folder=${project.folderId}` : "/"}
        aria-label="Back to projects"
        className={buttonVariants({ variant: "ghost", size: "icon" })}
      >
        <ChevronLeft className="size-4" />
      </Link>
      <Input
        value={project.name}
        aria-label="Project name"
        onChange={(e) => renameProject(project.id, e.target.value)}
        className="h-8 w-56 font-medium"
      />

      <LanguageSwitcher project={project} />

      <div className="flex-1" />

      {siblings.length > 0 && (
        <>
          <Button variant="outline" onClick={() => setApplyOpen(true)}>
            <SquareStack className="size-4" />
            Apply to…
          </Button>
          <Separator orientation="vertical" className="mx-1 h-6" />
        </>
      )}

      <Button
        variant="ghost"
        size="icon"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={undo}
      >
        <Undo2 className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={redo}
      >
        <Redo2 className="size-4" />
      </Button>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button onClick={handleExportClick}>
        <Download className="size-4" />
        Export…
      </Button>

      <ExportDialog
        // Remount on open so the language selection starts fresh.
        key={exportOpen ? "open" : "closed"}
        open={exportOpen}
        onOpenChange={setExportOpen}
        project={project}
      />

      {siblings.length > 0 && (
        <ApplyToSiblingsDialog
          // Remount on open so the selection starts fresh each time.
          key={applyOpen ? "open" : "closed"}
          open={applyOpen}
          onOpenChange={setApplyOpen}
          project={project}
          siblings={siblings}
          onSubmit={(targetIds, options) => {
            const n = applyToProjects(project.id, targetIds, options);
            if (n > 0) {
              toast.success(
                `Applied to ${n} ${n === 1 ? "project" : "projects"} — use undo to revert`,
              );
            }
          }}
        />
      )}
    </header>
  );
}
