import { saveAs } from "file-saver";
import JSZip from "jszip";
import type { Project, Shot } from "@/lib/types";
import { getPreset } from "@/lib/presets";
import { drawShot } from "@/lib/render";
import { loadImageOrNull } from "@/lib/image";
import { slugify } from "@/lib/utils";

const JPEG_QUALITY = 0.95;

/** File extension for a preset's file type. */
function extFor(fileType: "png" | "jpeg"): string {
  return fileType === "jpeg" ? "jpg" : "png";
}

/**
 * Builds a sortable, descriptive filename:
 * `<project>_<preset>_<NN>.<ext>` (1-based, zero-padded index).
 */
export function exportFileName(
  projectName: string,
  presetId: string,
  fileType: "png" | "jpeg",
  index: number,
): string {
  const nn = String(index + 1).padStart(2, "0");
  return `${slugify(projectName)}_${presetId}_${nn}.${extFor(fileType)}`;
}

/** Renders a single shot at full resolution and encodes it to a Blob. */
export async function renderShotToBlob(
  project: Project,
  shot: Shot,
): Promise<Blob> {
  const preset = getPreset(project.presetId);
  const [screenshot, backgroundImage] = await Promise.all([
    loadImageOrNull(shot.image),
    loadImageOrNull(
      project.background.type === "image" ? project.background.image : null,
    ),
  ]);

  const canvas = document.createElement("canvas");
  drawShot(canvas, {
    preset,
    background: project.background,
    text: project.text,
    device: project.device,
    claim: shot.claim,
    sub: shot.sub,
    screenshot,
    backgroundImage,
  });

  const mime = preset.fileType === "jpeg" ? "image/jpeg" : "image/png";
  const quality = preset.fileType === "jpeg" ? JPEG_QUALITY : undefined;
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode image"));
      },
      mime,
      quality,
    );
  });
}

/** Exports one shot as a downloaded PNG/JPEG. */
export async function exportShot(
  project: Project,
  shot: Shot,
  index: number,
): Promise<void> {
  const preset = getPreset(project.presetId);
  const blob = await renderShotToBlob(project, shot);
  saveAs(blob, exportFileName(project.name, preset.id, preset.fileType, index));
}

/** Exports every shot of a project into a single downloaded ZIP archive. */
export async function exportProjectZip(project: Project): Promise<void> {
  const preset = getPreset(project.presetId);
  const zip = new JSZip();
  const folder = zip.folder(preset.id) ?? zip;
  for (let i = 0; i < project.shots.length; i += 1) {
    let blob: Blob;
    try {
      blob = await renderShotToBlob(project, project.shots[i]);
    } catch (cause) {
      throw new Error(`Export of shot ${i + 1} failed`, { cause });
    }
    folder.file(
      exportFileName(project.name, preset.id, preset.fileType, i),
      blob,
    );
  }
  const archive = await zip.generateAsync({ type: "blob" });
  saveAs(archive, `${slugify(project.name)}_${preset.id}.zip`);
}
