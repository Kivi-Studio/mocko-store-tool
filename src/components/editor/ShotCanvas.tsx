"use client";

import { useEffect, useRef } from "react";
import type { Project, Shot } from "@/lib/types";
import { getPreset } from "@/lib/presets";
import { drawShot } from "@/lib/render";
import { loadImageOrNull } from "@/lib/image";

/**
 * Renders one shot to a full-resolution canvas that is scaled down with CSS.
 * Images are decoded asynchronously (and cached), then drawn synchronously —
 * so the preview pixels match the export exactly.
 */
export function ShotCanvas({
  project,
  shot,
  className,
}: {
  project: Project;
  shot: Shot;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preset = getPreset(project.presetId);
  const { background, text, device } = project;
  const bgImage = background.type === "image" ? background.image : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [screenshot, backgroundImage] = await Promise.all([
        loadImageOrNull(shot.image),
        loadImageOrNull(bgImage),
      ]);
      if (cancelled || !canvasRef.current) return;
      drawShot(canvasRef.current, {
        preset,
        background,
        text,
        device,
        claim: shot.claim,
        sub: shot.sub,
        screenshot,
        backgroundImage,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    preset,
    background,
    text,
    device,
    bgImage,
    shot.image,
    shot.claim,
    shot.sub,
  ]);

  return <canvas ref={canvasRef} className={className} />;
}
