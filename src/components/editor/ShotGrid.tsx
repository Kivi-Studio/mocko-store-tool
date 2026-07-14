"use client";

import { useRef, useState } from "react";
import { ImagePlus, SquarePlus } from "lucide-react";
import type { Project } from "@/lib/model/types";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/model/limits";
import { useProjectStore } from "@/store/useProjectStore";
import { ShotCard } from "./ShotCard";
import { useAddShots } from "./useAddShots";

/** The stage: a drop target holding one card per screenshot. */
export function ShotGrid({
  project,
  selectedId,
  onSelect,
}: {
  project: Project;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const addShots = useAddShots(project.id);
  const addEmptyShot = useProjectStore((s) => s.addEmptyShot);
  const reorderShots = useProjectStore((s) => s.reorderShots);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const openPicker = () => inputRef.current?.click();

  const endReorder = () => {
    if (dragIndex !== null && overIndex !== null) {
      reorderShots(project.id, dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  /** Only real file drags (not card reordering) trigger the import overlay. */
  const isFileDrag = (e: React.DragEvent) =>
    e.dataTransfer.types.includes("Files");

  return (
    <div
      onDragOver={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) void addShots(e.dataTransfer.files);
      }}
      className={`flex-1 overflow-auto p-6 ${dragOver ? "bg-accent/40" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void addShots(e.target.files);
          e.target.value = "";
        }}
      />

      {project.shots.length === 0 ? (
        <div className="mx-auto flex h-full min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={openPicker}
            className="text-muted-foreground hover:border-foreground/30 hover:text-foreground flex w-full flex-1 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-colors"
          >
            <ImagePlus className="size-10" />
            <span className="text-sm font-medium">
              Drop screenshots here or click to choose
            </span>
            <span className="text-xs">
              Add a claim and subtext per image, then export in store sizes.
            </span>
          </button>
          <button
            type="button"
            onClick={() => addEmptyShot(project.id)}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium"
          >
            <SquarePlus className="size-4" />
            Empty screen (add image later)
          </button>
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] gap-5">
          {project.shots.map((shot, i) => (
            <ShotCard
              key={shot.id}
              project={project}
              index={i}
              selected={selectedId === shot.id}
              onSelect={onSelect}
              drag={{
                dragging: dragIndex === i,
                isDropTarget:
                  dragIndex !== null && dragIndex !== i && overIndex === i,
                onStart: () => setDragIndex(i),
                onEnter: () => {
                  if (dragIndex !== null) setOverIndex(i);
                },
                onEnd: endReorder,
              }}
            />
          ))}
          <div className="flex min-h-[220px] flex-col gap-2">
            <button
              type="button"
              onClick={openPicker}
              className="text-muted-foreground hover:border-foreground/30 hover:text-foreground flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors"
            >
              <ImagePlus className="size-6" />
              <span className="text-xs font-medium">Add screenshots</span>
            </button>
            <button
              type="button"
              onClick={() => addEmptyShot(project.id)}
              className="text-muted-foreground hover:border-foreground/30 hover:text-foreground flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed py-3 transition-colors"
            >
              <SquarePlus className="size-5" />
              <span className="text-xs font-medium">Empty screen</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
