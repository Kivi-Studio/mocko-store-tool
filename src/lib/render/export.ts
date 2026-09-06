import { saveAs } from "file-saver";
import JSZip from "jszip";
import type { Project, Shot } from "@/lib/model/types";
import { getPreset } from "@/lib/model/presets";
import { drawShot } from "@/lib/render/render";
import { loadImageById } from "@/lib/render/image";
import { captionFor, imageIdFor } from "@/lib/model/caption";
import { slugify } from "@/lib/utils";

const JPEG_QUALITY = 0.95;

/** File extension for a preset's file type. */
function extFor(fileType: "png" | "jpeg"): string {
  return fileType === "jpeg" ? "jpg" : "png";
}

/**
 * Builds a sortable, descriptive filename:
 * `<project>_<preset>_<language>_<NN>.<ext>` (1-based, zero-padded index).
 *
 * The language code is part of the name, not only of the enclosing folder, so
 * files stay identifiable once they are uploaded or moved around.
 */
export function exportFileName(
  projectName: string,
  presetId: string,
  language: string,
  fileType: "png" | "jpeg",
  index: number,
): string {
  const nn = String(index + 1).padStart(2, "0");
  const parts = [slugify(projectName), presetId, slugify(language), nn];
  return `${parts.join("_")}.${extFor(fileType)}`;
}

/** Renders a single shot at full resolution to a Blob. */
async function renderShotToBlob(
  project: Project,
  shot: Shot,
  language: string,
): Promise<Blob> {
  const preset = getPreset(project.presetId);
  const { claim, sub } = captionFor(shot, language);
  const [screenshot, backgroundImage] = await Promise.all([
    loadImageById(imageIdFor(shot, language)),
    loadImageById(
      project.background.type === "image" ? project.background.imageId : null,
    ),
  ]);

  const canvas = document.createElement("canvas");
  drawShot(canvas, {
    preset,
    background: project.background,
    text: project.text,
    device: project.device,
    claim,
    sub,
    screenshot,
    backgroundImage,
    offX: shot.offX,
    offY: shot.offY,
    scale: shot.scale,
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

/** Exports one shot, in one language, as a downloaded PNG/JPEG. */
export async function exportShot(
  project: Project,
  shot: Shot,
  language: string,
  index: number,
): Promise<void> {
  const preset = getPreset(project.presetId);
  const blob = await renderShotToBlob(project, shot, language);
  saveAs(
    blob,
    exportFileName(project.name, preset.id, language, preset.fileType, index),
  );
}

/**
 * Exports a project into a single downloaded ZIP.
 *
 * With more than one language the archive gets a folder per language, which is
 * the shape the stores expect for a localized listing. Every position is
 * exported for every language chosen, including ones with no screenshot yet —
 * dropping them would silently renumber the rest, so an incomplete language is
 * something the export dialog warns about rather than something this hides.
 */
export async function exportProjectZip(
  project: Project,
  languages: string[],
): Promise<void> {
  const preset = getPreset(project.presetId);
  const codes = languages.length
    ? languages
    : [project.languages[0]?.code ?? ""];
  const perLanguageFolders = codes.length > 1;
  const zip = new JSZip();

  for (const code of codes) {
    for (let i = 0; i < project.shots.length; i += 1) {
      let blob: Blob;
      try {
        blob = await renderShotToBlob(project, project.shots[i], code);
      } catch (cause) {
        throw new Error(`Export of shot ${i + 1} (${code}) failed`, { cause });
      }
      const name = exportFileName(
        project.name,
        preset.id,
        code,
        preset.fileType,
        i,
      );
      zip.file(perLanguageFolders ? `${slugify(code)}/${name}` : name, blob);
    }
  }

  const archive = await zip.generateAsync({ type: "blob" });
  saveAs(archive, `${slugify(project.name)}_${preset.id}.zip`);
}
