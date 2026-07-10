"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/types";
import { exportShot } from "@/lib/export";
import { useProjectStore } from "@/store/useProjectStore";
import { useUndoGroup } from "@/store/useUndoGroup";
import { ShotCanvas } from "./ShotCanvas";
import { Input } from "@/components/ui/input";

/** One screenshot in the grid: live preview, captions and per-shot actions. */
export function ShotCard({
  project,
  index,
}: {
  project: Project;
  index: number;
}) {
  const shot = project.shots[index];
  const updateShot = useProjectStore((s) => s.updateShot);
  const moveShot = useProjectStore((s) => s.moveShot);
  const removeShot = useProjectStore((s) => s.removeShot);
  const { group } = useUndoGroup();
  const [exporting, setExporting] = useState(false);

  const isFirst = index === 0;
  const isLast = index === project.shots.length - 1;

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
    <div className="bg-card flex w-full flex-col gap-2 rounded-xl border p-3">
      <div className="text-muted-foreground text-xs">#{index + 1}</div>
      <ShotCanvas
        project={project}
        shot={shot}
        className="block h-auto w-full rounded-md bg-black"
      />
      <Input
        value={shot.claim}
        placeholder="Claim / headline"
        aria-label={`Claim for screenshot ${index + 1}`}
        className="font-medium"
        onChange={(e) =>
          group(() =>
            updateShot(project.id, shot.id, { claim: e.target.value }),
          )
        }
      />
      <Input
        value={shot.sub}
        placeholder="Subtext (optional)"
        aria-label={`Subtext for screenshot ${index + 1}`}
        onChange={(e) =>
          group(() => updateShot(project.id, shot.id, { sub: e.target.value }))
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
