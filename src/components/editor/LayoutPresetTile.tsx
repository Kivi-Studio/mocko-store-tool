"use client";

import { useEffect, useRef } from "react";
import type { Background, Project } from "@/lib/model/types";
import type { LayoutPreset } from "@/lib/model/layout-presets";
import { getPreset } from "@/lib/model/presets";
import { computeDeviceRect, roundRect } from "@/lib/render/render";
import { cn } from "@/lib/utils";

/** Backdrop color used behind the mini device (solid/gradient start, else gray). */
function backdropColor(bg: Background): string {
  if (bg.type === "solid") return bg.color;
  if (bg.type === "gradient") return bg.from;
  return "#334155";
}

/** Canvas backing resolution for a tile (square); scaled down by CSS. */
const TILE_PX = 180;

/**
 * Draws the store artboard (in the preset's aspect ratio, letterboxed inside a
 * square) with a mini device placed via the SAME math as the real render, so a
 * tile faithfully previews what the layout preset applies. Content that spills
 * past the artboard is clipped — exactly how the export crops it.
 */
function drawTile(
  canvas: HTMLCanvasElement,
  project: Project,
  layout: LayoutPreset,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const S = TILE_PX;
  canvas.width = S;
  canvas.height = S;
  ctx.clearRect(0, 0, S, S);

  const preset = getPreset(project.presetId);
  const aspect = preset.h / preset.w;

  // Fit the artboard inside the square with a little padding.
  const pad = S * 0.08;
  let fw = S - pad * 2;
  let fh = fw * aspect;
  if (fh > S - pad * 2) {
    fh = S - pad * 2;
    fw = fh / aspect;
  }
  const fx = (S - fw) / 2;
  const fy = (S - fh) / 2;

  ctx.save();
  roundRect(ctx, fx, fy, fw, fh, 6);
  ctx.clip();

  ctx.fillStyle = backdropColor(project.background);
  ctx.fillRect(fx, fy, fw, fh);

  if (preset.device !== "none") {
    const scale = layout.scale ?? project.device.scale;
    const topH = fh * project.device.topSpace;
    const r = computeDeviceRect(
      fw,
      fh,
      topH,
      fh - topH,
      preset.device,
      scale,
      layout.offX,
      layout.offY,
    );
    // Frame.
    ctx.fillStyle = project.device.frameColor;
    roundRect(ctx, fx + r.dx, fy + r.dy, r.deviceW, r.deviceH, r.outerR);
    ctx.fill();
    // Screen placeholder.
    ctx.fillStyle = "#cbd5e1";
    roundRect(ctx, fx + r.sx, fy + r.sy, r.screenW, r.screenH, r.screenR);
    ctx.fill();
  }
  ctx.restore();

  // Thin artboard outline.
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  roundRect(ctx, fx + 0.5, fy + 0.5, fw - 1, fh - 1, 6);
  ctx.stroke();
}

/** A clickable square preview of one placement preset. */
export function LayoutPresetTile({
  project,
  layout,
  active,
  onClick,
}: {
  project: Project;
  layout: LayoutPreset;
  active: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) drawTile(ref.current, project, layout);
  }, [project, layout]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={layout.label}
      title={layout.label}
      className={cn(
        "bg-muted block overflow-hidden rounded-md border transition-colors",
        active
          ? "border-ring ring-ring/40 ring-2"
          : "border-border hover:border-foreground/40",
      )}
    >
      <canvas ref={ref} className="block aspect-square w-full" />
      <span className="sr-only">{layout.label}</span>
    </button>
  );
}
