"use client";

import { useState } from "react";
import Link from "next/link";
import { Folder as FolderIcon } from "lucide-react";
import type { Folder } from "@/lib/model/types";
import { useProjectStore } from "@/store/useProjectStore";
import { cn } from "@/lib/utils";
import { FolderMenu } from "./FolderMenu";

/** A single folder as a row in the gallery's list view; a drop target too. */
export function FolderRow({
  folder,
  projectCount,
  label,
}: {
  folder: Folder;
  projectCount: number;
  /** Overrides the displayed name — inside an app this is the version. */
  label?: string;
}) {
  const moveProjectToFolder = useProjectStore((s) => s.moveProjectToFolder);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={cn(
        "hover:bg-muted/40 flex items-center gap-3 px-3 py-2 transition-colors",
        dragOver && "bg-primary/10",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const projectId = e.dataTransfer.getData("text/plain");
        if (projectId) moveProjectToFolder(projectId, folder.id);
      }}
    >
      <Link
        href={`/?folder=${folder.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
        aria-label={`Open folder ${folder.name}`}
      >
        <div className="bg-muted/40 text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-md">
          <FolderIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label ?? folder.name}</p>
          <p className="text-muted-foreground text-xs">
            {projectCount} {projectCount === 1 ? "project" : "projects"}
          </p>
        </div>
      </Link>

      <FolderMenu folder={folder} projectCount={projectCount} />
    </div>
  );
}
