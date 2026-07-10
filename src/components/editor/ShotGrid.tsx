"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { Project } from "@/lib/types";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/limits";
import { ShotCard } from "./ShotCard";
import { useAddShots } from "./useAddShots";

/** The stage: a drop target holding one card per screenshot. */
export function ShotGrid({ project }: { project: Project }) {
  const addShots = useAddShots(project.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = () => inputRef.current?.click();

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
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
        <button
          type="button"
          onClick={openPicker}
          className="text-muted-foreground hover:border-foreground/30 hover:text-foreground mx-auto flex h-full min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-colors"
        >
          <ImagePlus className="size-10" />
          <span className="text-sm font-medium">
            Drop screenshots here or click to choose
          </span>
          <span className="text-xs">
            Add a claim and subtext per image, then export in store sizes.
          </span>
        </button>
      ) : (
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {project.shots.map((shot, i) => (
            <ShotCard key={shot.id} project={project} index={i} />
          ))}
          <button
            type="button"
            onClick={openPicker}
            className="text-muted-foreground hover:border-foreground/30 hover:text-foreground flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors"
          >
            <ImagePlus className="size-6" />
            <span className="text-xs font-medium">Add screenshots</span>
          </button>
        </div>
      )}
    </div>
  );
}
