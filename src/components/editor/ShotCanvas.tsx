"use client";

import { useEffect, useRef } from "react";
import type { Project, Shot } from "@/lib/types";
import { getPreset } from "@/lib/presets";
import { drawShot } from "@/lib/render";
import { loadImageOrNull } from "@/lib/image";
import { captionFor } from "@/lib/caption";

/**
 * Renders one shot to a full-resolution canvas that is scaled down with CSS.
 * Images are decoded asynchronously (and cached), then drawn synchronously —
 * so the preview pixels match the export exactly. The `language` selects which
 * caption is drawn.
 */
export function ShotCanvas({
  project,
  shot,
  language,
  className,
}: {
  project: Project;
  shot: Shot;
  language: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preset = getPreset(project.presetId);
  const { background, text, device } = project;
  const bgImage = background.type === "image" ? background.image : null;
  const { claim, sub } = captionFor(shot, language);

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
        claim,
        sub,
        screenshot,
        backgroundImage,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [preset, background, text, device, bgImage, shot.image, claim, sub]);

  return <canvas ref={canvasRef} className={className} />;
}
