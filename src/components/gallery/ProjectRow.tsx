"use client";

import Link from "next/link";
import { Check, ImageOff } from "lucide-react";
import type { Project } from "@/lib/model/types";
import { getPreset } from "@/lib/model/presets";
import { cn } from "@/lib/utils";
import { ShotCanvas } from "@/components/editor/ShotCanvas";
import { ProjectMenu } from "./ProjectMenu";
import type { SelectionProps } from "./selection";

/** A single project as a row in the gallery's list view. */
export function ProjectRow({
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

  const inner = (
    <>
      <div className="bg-muted/40 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md p-1">
        {cover ? (
          <ShotCanvas
            language={project.languages[0]?.code ?? ""}
            project={project}
            shot={cover}
            className="h-auto max-h-full w-auto max-w-full rounded-sm"
          />
        ) : (
          <ImageOff className="text-muted-foreground size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{project.name}</p>
        <p className="text-muted-foreground text-xs">
          {count} {count === 1 ? "screenshot" : "screenshots"} ·{" "}
          {preset.name.split(" · ")[0]}
        </p>
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 transition-colors",
        selected ? "bg-primary/10" : "hover:bg-muted/40",
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
            "flex size-5 shrink-0 items-center justify-center rounded-full border",
            selected
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border",
          )}
          aria-hidden
        >
          {selected && <Check className="size-3.5" />}
        </span>
      )}

      {selecting ? (
        <button
          type="button"
          onClick={() => selection?.onToggle(project.id)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-pressed={selected}
          aria-label={`${selected ? "Deselect" : "Select"} ${project.name}`}
        >
          {inner}
        </button>
      ) : (
        <Link
          href={`/project/?id=${project.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
          aria-label={`Open ${project.name}`}
        >
          {inner}
        </Link>
      )}

      {!selecting && <ProjectMenu project={project} />}
    </div>
  );
}
