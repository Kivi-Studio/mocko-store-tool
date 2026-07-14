"use client";

import { X } from "lucide-react";
import type { Project, Shot } from "@/lib/model/types";
import {
  DEVICE_SCALE_MAX,
  DEVICE_SCALE_MIN,
  OFFSET_MAX,
  OFFSET_MIN,
} from "@/lib/model/limits";
import { LAYOUT_PRESETS, activeLayoutPreset } from "@/lib/model/layout-presets";
import { useProjectStore } from "@/store/useProjectStore";
import { LabeledSlider, PanelSection } from "./controls";
import { LayoutPresetTile } from "./LayoutPresetTile";
import { Button } from "@/components/ui/button";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Right-hand panel for the selected shot: device placement presets, manual
 * offset/size overrides, and a reset. Every change writes only to this shot and
 * is undoable. Closing clears the selection.
 */
export function ShotDetailPanel({
  project,
  shot,
  onClose,
}: {
  project: Project;
  shot: Shot;
  onClose: () => void;
}) {
  const updateShotLayout = useProjectStore((s) => s.updateShotLayout);
  const index = project.shots.findIndex((s) => s.id === shot.id);
  const active = activeLayoutPreset(shot);
  const customSize = shot.scale !== null;
  // When there is no per-shot override, show (disabled) the global size.
  const sizeValue = shot.scale ?? project.device.scale;

  const set = (patch: Partial<Pick<Shot, "offX" | "offY" | "scale">>) =>
    updateShotLayout(project.id, shot.id, patch);

  return (
    <aside className="bg-card w-72 shrink-0 space-y-6 overflow-y-auto border-l p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Screenshot #{index >= 0 ? index + 1 : "?"}
        </h2>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <PanelSection title="Position presets">
        <div className="grid grid-cols-5 gap-1.5">
          {LAYOUT_PRESETS.map((preset) => (
            <LayoutPresetTile
              key={preset.id}
              project={project}
              layout={preset}
              active={active?.id === preset.id}
              onClick={() =>
                set({
                  offX: preset.offX,
                  offY: preset.offY,
                  scale: preset.scale,
                })
              }
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Device position">
        <LabeledSlider
          label="Horizontal"
          value={shot.offX}
          min={OFFSET_MIN}
          max={OFFSET_MAX}
          step={0.005}
          onChange={(offX) => set({ offX })}
          format={pct}
        />
        <LabeledSlider
          label="Vertical"
          value={shot.offY}
          min={OFFSET_MIN}
          max={OFFSET_MAX}
          step={0.005}
          onChange={(offY) => set({ offY })}
          format={pct}
        />
      </PanelSection>

      <PanelSection title="Device size">
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={customSize}
            onChange={(e) =>
              set({ scale: e.target.checked ? project.device.scale : null })
            }
          />
          Custom size for this image
        </label>
        <LabeledSlider
          label="Device size"
          value={sizeValue}
          min={DEVICE_SCALE_MIN}
          max={DEVICE_SCALE_MAX}
          step={0.01}
          disabled={!customSize}
          onChange={(scale) => set({ scale })}
          format={pct}
        />
        {!customSize && (
          <p className="text-muted-foreground text-[11px]">
            Using global value
          </p>
        )}
      </PanelSection>

      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => set({ offX: 0, offY: 0, scale: null })}
        >
          Reset to global values
        </Button>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          These adjustments apply only to the selected screenshot.
        </p>
      </div>
    </aside>
  );
}
