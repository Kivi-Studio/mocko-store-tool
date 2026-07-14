"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Redo2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/model/types";
import { exportProjectZip } from "@/lib/render/export";
import { useProjectStore, useTemporal } from "@/store/useProjectStore";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function EditorTopbar({ project }: { project: Project }) {
  const renameProject = useProjectStore((s) => s.renameProject);
  const { canUndo, canRedo, undo, redo } = useTemporal();
  const [exporting, setExporting] = useState(false);

  const handleExportClick = async () => {
    if (project.shots.length === 0) {
      toast.error("No screenshots to export yet");
      return;
    }
    setExporting(true);
    try {
      await exportProjectZip(project);
      toast.success(`Exported ${project.shots.length} screenshot(s)`);
    } catch (error) {
      console.error(error);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="bg-card flex h-14 shrink-0 items-center gap-2 border-b px-3">
      <Link
        href="/"
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

      <div className="flex-1" />

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
      <Button onClick={() => void handleExportClick()} disabled={exporting}>
        <Download className="size-4" />
        {exporting ? "Exporting…" : "Export all (ZIP)"}
      </Button>
    </header>
  );
}
