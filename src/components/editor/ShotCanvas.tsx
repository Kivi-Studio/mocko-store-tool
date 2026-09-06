"use client";

import { useEffect, useRef } from "react";
import type { Project, Shot } from "@/lib/model/types";
import { getPreset } from "@/lib/model/presets";
import { drawShot } from "@/lib/render/render";
import { loadImageById } from "@/lib/render/image";
import { captionFor, imageIdFor } from "@/lib/model/caption";

/**
 * Renders one shot to a full-resolution canvas that is scaled down with CSS.
 * Images are decoded asynchronously (and cached), then drawn synchronously —
 * so the preview pixels match the export exactly.
 */
export function ShotCanvas({
  project,
  shot,
  language,
  className,
}: {
  project: Project;
  shot: Shot;
  /** Which language's screenshot and caption to draw. */
  language: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preset = getPreset(project.presetId);
  const { background, text, device } = project;
  const bgImageId = background.type === "image" ? background.imageId : null;
  const { claim, sub } = captionFor(shot, language);
  const imageId = imageIdFor(shot, language);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [screenshot, backgroundImage] = await Promise.all([
        loadImageById(imageId),
        loadImageById(bgImageId),
      ]);
      if (cancelled || !canvasRef.current) return;
      drawShot(canvasRef.current, {
        preset,
        background,
        text,
        device,
        claim,
        sub,
        screenshot,
        backgroundImage,
        offX: shot.offX,
        offY: shot.offY,
        scale: shot.scale,
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
    bgImageId,
    imageId,
    claim,
    sub,
    shot.offX,
    shot.offY,
    shot.scale,
  ]);

  return <canvas ref={canvasRef} className={className} />;
}
