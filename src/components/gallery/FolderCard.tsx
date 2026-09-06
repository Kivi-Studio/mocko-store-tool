"use client";

import { useState } from "react";
import Link from "next/link";
import { Folder as FolderIcon } from "lucide-react";
import type { Folder, Project } from "@/lib/model/types";
import { useProjectStore } from "@/store/useProjectStore";
import { cn } from "@/lib/utils";
import { ShotCanvas } from "@/components/editor/ShotCanvas";
import { FolderMenu } from "./FolderMenu";

/**
 * A folder tile in the gallery. Shows a mosaic preview of its projects' covers,
 * navigates into the folder on click, and accepts projects dropped onto it.
 */
export function FolderCard({
  folder,
  projects,
  label,
}: {
  folder: Folder;
  projects: Project[];
  /** Overrides the displayed name — inside an app this is the version. */
  label?: string;
}) {
  const moveProjectToFolder = useProjectStore((s) => s.moveProjectToFolder);
  const [dragOver, setDragOver] = useState(false);

  const count = projects.length;
  // Up to four covers for the mosaic preview.
  const previews = projects
    .map((p) => ({ project: p, shot: p.shots[0] }))
    .filter((x) => x.shot)
    .slice(0, 4);

  const href = `/?folder=${folder.id}`;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const projectId = e.dataTransfer.getData("text/plain");
    if (projectId) moveProjectToFolder(projectId, folder.id);
  };

  return (
    <div
      className={cn(
        "group bg-card overflow-hidden rounded-xl border transition-shadow hover:shadow-md",
        dragOver && "ring-primary ring-2 ring-offset-2",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <Link
        href={href}
        className="bg-muted/40 flex h-[260px] items-center justify-center overflow-hidden p-6"
        aria-label={`Open folder ${folder.name}`}
      >
        {previews.length > 0 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-2">
            {previews.map(({ project, shot }) => (
              <div
                key={project.id}
                className="bg-background/60 flex items-center justify-center overflow-hidden rounded-md p-1"
              >
                <ShotCanvas
                  project={project}
                  shot={shot!}
                  language={project.languages[0]?.code ?? ""}
                  className="h-auto max-h-full w-auto max-w-full rounded-sm shadow-sm"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2">
            <FolderIcon className="size-10" />
            <span className="text-xs">Empty folder</span>
          </div>
        )}
      </Link>

      <div className="flex items-center justify-between gap-2 border-t p-3">
        <div className="flex min-w-0 items-center gap-2">
          <FolderIcon className="text-muted-foreground size-4 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {label ?? folder.name}
            </p>
            <p className="text-muted-foreground text-xs">
              {count} {count === 1 ? "project" : "projects"}
            </p>
          </div>
        </div>

        <FolderMenu folder={folder} projectCount={count} />
      </div>
    </div>
  );
}
