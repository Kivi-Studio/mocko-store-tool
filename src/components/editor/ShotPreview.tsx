"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Project, Shot } from "@/lib/model/types";
import { OFFSET_MAX, OFFSET_MIN, SNAP_THRESHOLD } from "@/lib/model/limits";
import { getPreset } from "@/lib/model/presets";
import { clamp, cn } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";
import { useUndoGroup } from "@/store/useUndoGroup";
import { ShotCanvas } from "./ShotCanvas";

type DragState = {
  startX: number;
  startY: number;
  baseOffX: number;
  baseOffY: number;
  moved: boolean;
};

/** Movement (px) before a pointer gesture counts as a drag rather than a click. */
const DRAG_THRESHOLD = 3;

/**
 * The live preview of one shot with click-to-select and Figma-style device
 * dragging. Dragging near an axis snaps the device to the center and shows a
 * pink guide line; the panel sliders follow because both read the same store.
 *
 * Guides are DOM overlays shown only while dragging — they never touch the
 * canvas, so they never appear in the export.
 */
export function ShotPreview({
  project,
  shot,
  selected,
  onSelect,
}: {
  project: Project;
  shot: Shot;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const updateShotLayout = useProjectStore((s) => s.updateShotLayout);
  const { group, end } = useUndoGroup();
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const [guides, setGuides] = useState({ v: false, h: false });

  const hasDevice = getPreset(project.presetId).device !== "none";

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    onSelect(shot.id);
    if (!hasDevice) return; // frameless formats have no device to move
    wrapRef.current?.setPointerCapture(e.pointerId);
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseOffX: shot.offX,
      baseOffY: shot.offY,
      moved: false,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = wrapRef.current;
    if (!d || !el) return;
    const dxPx = e.clientX - d.startX;
    const dyPx = e.clientY - d.startY;
    if (
      !d.moved &&
      Math.abs(dxPx) < DRAG_THRESHOLD &&
      Math.abs(dyPx) < DRAG_THRESHOLD
    ) {
      return;
    }
    d.moved = true;
    const rect = el.getBoundingClientRect();
    let offX = clamp(d.baseOffX + dxPx / rect.width, OFFSET_MIN, OFFSET_MAX);
    let offY = clamp(d.baseOffY + dyPx / rect.height, OFFSET_MIN, OFFSET_MAX);
    const snapV = Math.abs(offX) < SNAP_THRESHOLD;
    const snapH = Math.abs(offY) < SNAP_THRESHOLD;
    if (snapV) offX = 0;
    if (snapH) offY = 0;
    setGuides({ v: snapV, h: snapH });
    group(() => updateShotLayout(project.id, shot.id, { offX, offY }));
  };

  const stopDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    wrapRef.current?.releasePointerCapture?.(e.pointerId);
    drag.current = null;
    setGuides({ v: false, h: false });
    end();
  };

  return (
    <div
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      className={cn(
        "ring-offset-card relative touch-none overflow-hidden rounded-md ring-offset-2",
        hasDevice ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        selected && "ring-2 ring-blue-500",
      )}
    >
      <ShotCanvas
        project={project}
        shot={shot}
        className="pointer-events-none block h-auto w-full rounded-md bg-black select-none"
      />
      {guides.v && (
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-pink-500" />
      )}
      {guides.h && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-pink-500" />
      )}
    </div>
  );
}
