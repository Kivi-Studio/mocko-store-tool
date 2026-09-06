"use client";

import Link from "next/link";
import { Check, ImageOff } from "lucide-react";
import type { Project } from "@/lib/model/types";
import { getPreset } from "@/lib/model/presets";
import { cn } from "@/lib/utils";
import { ShotCanvas } from "@/components/editor/ShotCanvas";
import { ProjectMenu } from "./ProjectMenu";
import type { SelectionProps } from "./selection";

export function ProjectCard({
  project,
  selection,
}: {
  project: Project;
  selection?: SelectionProps;
}) {
  const cover = project.shots[0];
  const count = project.shots.length;
  const preset = getPreset(project.presetId);

  const selecting = selection?.active ?? false;
  const selected = selection?.selected ?? false;

  const coverInner = cover ? (
    <ShotCanvas
      language={project.languages[0]?.code ?? ""}
      project={project}
      shot={cover}
      className="h-auto max-h-full w-auto max-w-full rounded shadow-sm"
    />
  ) : (
    <div className="text-muted-foreground flex flex-col items-center gap-2">
      <ImageOff className="size-8" />
      <span className="text-xs">Empty project</span>
    </div>
  );

  return (
    <div
      className={cn(
        "group bg-card relative overflow-hidden rounded-xl border transition-shadow hover:shadow-md",
        selected && "ring-primary ring-2",
      )}
      draggable={!selecting}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", project.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      {selecting && (
        <span
          className={cn(
            "absolute top-3 left-3 z-10 flex size-6 items-center justify-center rounded-full border shadow",
            selected
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background/90 border-border",
          )}
          aria-hidden
        >
          {selected && <Check className="size-4" />}
        </span>
      )}

      {selecting ? (
        <button
          type="button"
          onClick={() => selection?.onToggle(project.id)}
          className="bg-muted/40 flex h-[260px] w-full items-center justify-center overflow-hidden p-4"
          aria-pressed={selected}
          aria-label={`${selected ? "Deselect" : "Select"} ${project.name}`}
        >
          {coverInner}
        </button>
      ) : (
        <Link
          href={`/project/?id=${project.id}`}
          className="bg-muted/40 flex h-[260px] items-center justify-center overflow-hidden p-4"
          aria-label={`Open ${project.name}`}
        >
          {coverInner}
        </Link>
      )}

      <div className="flex items-center justify-between gap-2 border-t p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <p className="text-muted-foreground text-xs">
            {count} {count === 1 ? "screenshot" : "screenshots"} ·{" "}
            {preset.name.split(" · ")[0]}
          </p>
        </div>

        {!selecting && <ProjectMenu project={project} />}
      </div>
    </div>
  );
}
