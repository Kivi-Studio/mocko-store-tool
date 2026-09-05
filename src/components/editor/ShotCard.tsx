"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  GripVertical,
  ImageIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/model/types";
import { exportShot } from "@/lib/render/export";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/model/limits";
import { fileToImageId } from "@/lib/storage/upload";
import { useProjectStore } from "@/store/useProjectStore";
import { useUndoGroup } from "@/store/useUndoGroup";
import { ShotPreview } from "./ShotPreview";
import { Input } from "@/components/ui/input";

/** Drag & drop wiring for reordering a card within the grid. */
type ShotDrag = {
  /** This card is the one currently being dragged. */
  dragging: boolean;
  /** A drag is in progress and this card is the hovered drop position. */
  isDropTarget: boolean;
  onStart: () => void;
  onEnter: () => void;
  onEnd: () => void;
};

/** One screenshot in the grid: live preview, captions and per-shot actions. */
export function ShotCard({
  project,
  index,
  selected,
  onSelect,
  drag,
}: {
  project: Project;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  drag: ShotDrag;
}) {
  const shot = project.shots[index];
  // The card only becomes draggable while the grip handle is held, so text
  // selection inside the caption inputs keeps working.
  const [armed, setArmed] = useState(false);
  const updateShotText = useProjectStore((s) => s.updateShotText);
  const setShotImage = useProjectStore((s) => s.setShotImage);
  const moveShot = useProjectStore((s) => s.moveShot);
  const removeShot = useProjectStore((s) => s.removeShot);
  const { group } = useUndoGroup();
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isFirst = index === 0;
  const isLast = index === project.shots.length - 1;

  const handleImageFile = async (file: File) => {
    try {
      const imageId = await fileToImageId(file);
      setShotImage(project.id, shot.id, imageId);
    } catch {
      toast.error("Image skipped (unsupported type or too large)");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportShot(project, shot, index);
    } catch (error) {
      console.error(error);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      draggable={armed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        drag.onStart();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        drag.onEnter();
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={() => {
        setArmed(false);
        drag.onEnd();
      }}
      className={`bg-card flex w-full flex-col gap-2 rounded-xl border p-3 transition ${
        drag.dragging ? "opacity-40" : ""
      } ${drag.isDropTarget ? "ring-primary ring-2 ring-offset-2" : ""}`}
    >
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <button
          type="button"
          aria-label="Drag to reorder"
          title="Drag to reorder"
          onPointerDown={() => setArmed(true)}
          onPointerUp={() => setArmed(false)}
          className="hover:text-foreground -ml-1 cursor-grab touch-none rounded p-0.5 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        #{index + 1}
      </div>
      <ShotPreview
        project={project}
        shot={shot}
        selected={selected}
        onSelect={onSelect}
      />
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImageFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="border-input text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors"
      >
        <ImageIcon className="size-4" />
        {shot.imageId ? "Replace image" : "Choose image"}
      </button>
      <Input
        value={shot.claim}
        placeholder="Claim / headline"
        aria-label={`Claim for screenshot ${index + 1}`}
        className="font-medium"
        onChange={(e) =>
          group(() =>
            updateShotText(project.id, shot.id, { claim: e.target.value }),
          )
        }
      />
      <Input
        value={shot.sub}
        placeholder="Subtext (optional)"
        aria-label={`Subtext for screenshot ${index + 1}`}
        onChange={(e) =>
          group(() =>
            updateShotText(project.id, shot.id, { sub: e.target.value }),
          )
        }
      />
      <div className="flex gap-1.5">
        <ShotAction
          label="Move left"
          disabled={isFirst}
          onClick={() => moveShot(project.id, shot.id, -1)}
        >
          <ArrowLeft className="size-4" />
        </ShotAction>
        <ShotAction
          label="Move right"
          disabled={isLast}
          onClick={() => moveShot(project.id, shot.id, 1)}
        >
          <ArrowRight className="size-4" />
        </ShotAction>
        <ShotAction
          label="Export this screenshot"
          disabled={exporting}
          onClick={handleExport}
          grow
        >
          <Download className="size-4" />
          {exporting ? "…" : "Export"}
        </ShotAction>
        <ShotAction
          label="Delete screenshot"
          onClick={() => removeShot(project.id, shot.id)}
        >
          <Trash2 className="size-4" />
        </ShotAction>
      </div>
    </div>
  );
}

function ShotAction({
  label,
  onClick,
  disabled,
  grow,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  grow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`border-input text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        grow ? "flex-1" : ""
      }`}
    >
      {children}
    </button>
  );
}
