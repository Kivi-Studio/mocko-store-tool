import { saveAs } from "file-saver";
import JSZip from "jszip";
import type {
  Background,
  DeviceStyle,
  Folder,
  Project,
  Shot,
  TextAlign,
  TextStyle,
} from "@/lib/model/types";
import { isPresetId } from "@/lib/model/presets";
import { safeFont } from "@/lib/model/fonts";
import { safeColor } from "@/lib/model/color";
import {
  DEFAULT_BACKGROUND,
  DEFAULT_DEVICE,
  DEFAULT_TEXT,
  makeFolder,
} from "@/lib/model/defaults";
import { clamp, createId, finiteOr, slugify } from "@/lib/utils";
import {
  ACCEPTED_IMAGE_TYPES,
  CAPTION_MAX_LENGTH,
  CLAIM_SIZE_MAX,
  CLAIM_SIZE_MIN,
  DEVICE_SCALE_MAX,
  DEVICE_SCALE_MIN,
  GRADIENT_ANGLE_MAX,
  GRADIENT_ANGLE_MIN,
  MAX_FOLDERS_PER_WORKSPACE,
  MAX_IMAGE_BYTES,
  MAX_MANIFEST_CHARS,
  MAX_PROJECT_FILE_BYTES,
  MAX_PROJECTS_PER_WORKSPACE,
  MAX_SHOTS_PER_PROJECT,
  OFFSET_MAX,
  OFFSET_MIN,
  SUB_SIZE_MAX,
  SUB_SIZE_MIN,
  TEXT_WIDTH_MAX,
  TEXT_WIDTH_MIN,
  TOP_SPACE_MAX,
  TOP_SPACE_MIN,
} from "@/lib/model/limits";

export const PROJECT_FORMAT = "screenshot-studio";
export const PROJECT_VERSION = 5;
export const PROJECT_FILE_EXT = ".studio";

/**
 * The `.studio` file is a ZIP container: a small `manifest.json` plus the raw
 * image bytes under `images/`. Storing images as binary (instead of base64 in
 * JSON) avoids the ~33% base64 inflation and keeps the manifest small.
 *
 * Two manifest shapes are read:
 *  - single project — `{ project: {...} }` (also the pre-v5 shape)
 *  - workspace — `{ folders: [...], projects: [...] }`, which can hold one
 *    project, a folder and its projects, a selection, or the entire local
 *    setup. Folders are referenced from projects by a bundle-local `ref` handle
 *    (resolved to fresh ids on import) so membership survives a round-trip.
 */

/** A reference from the manifest to an image entry inside the archive. */
type ImageRef = { path: string; mime: string } | null;

type ManifestBackground =
  | { type: "solid"; color: string }
  | { type: "gradient"; from: string; to: string; angle: number }
  | { type: "image"; image: ImageRef };

type ManifestShot = {
  image: ImageRef;
  claim: string;
  sub: string;
  offX: number;
  offY: number;
  scale: number | null;
};

/** The per-project payload, shared by the single and workspace shapes. */
type ManifestProject = {
  name: string;
  presetId: string;
  background: ManifestBackground;
  text: TextStyle;
  device: DeviceStyle;
  shots: ManifestShot[];
};

type ManifestFolder = { name: string; ref: string };

type Manifest = {
  format: string;
  version: number;
  exportedAt: string;
  /** Single-project shape. */
  project?: ManifestProject;
  /** Workspace shape. */
  folders?: ManifestFolder[];
  projects?: (ManifestProject & { folderRef: string | null })[];
};

/** A validated import payload: fresh folders plus projects wired to them. */
export type WorkspacePayload = {
  folders: Folder[];
  projects: Project[];
};

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function extForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? "png";
}

function parseDataUrl(
  dataUrl: string,
): { mime: string; base64: string } | null {
  const match = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function addImage(zip: JSZip, dataUrl: string | null, name: string): ImageRef {
  if (!dataUrl) return null;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const path = `images/${name}.${extForMime(parsed.mime)}`;
  zip.file(path, parsed.base64, { base64: true });
  return { path, mime: parsed.mime };
}

/**
 * Writes a project's images into the archive and returns its manifest payload.
 * `prefix` namespaces the image paths so several projects can coexist in one
 * workspace archive without colliding (e.g. `p0-shot-0`, `p1-shot-0`).
 */
function writeProject(
  zip: JSZip,
  project: Project,
  prefix: string,
): ManifestProject {
  const bg = project.background;
  const background: ManifestBackground =
    bg.type === "image"
      ? { type: "image", image: addImage(zip, bg.image, `${prefix}background`) }
      : bg;

  const shots: ManifestShot[] = project.shots.map((shot, i) => ({
    image: addImage(zip, shot.image, `${prefix}shot-${i}`),
    claim: shot.claim,
    sub: shot.sub,
    offX: shot.offX,
    offY: shot.offY,
    scale: shot.scale,
  }));

  return {
    name: project.name,
    presetId: project.presetId,
    background,
    text: project.text,
    device: project.device,
    shots,
  };
}

/** Builds a single-project `.studio` ZIP archive. */
export async function buildProjectArchive(project: Project): Promise<Blob> {
  const zip = new JSZip();
  const manifest: Manifest = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    exportedAt: new Date().toISOString(),
    project: writeProject(zip, project, ""),
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: "blob" });
}

/**
 * Builds a workspace `.studio` ZIP archive from any set of projects and the
 * folders to preserve. A project whose `folderId` is not among `folders` is
 * exported at the root (folderRef `null`).
 */
export async function buildWorkspaceArchive(
  projects: Project[],
  folders: Folder[],
): Promise<Blob> {
  const zip = new JSZip();

  const manifestFolders: ManifestFolder[] = folders.map((f, i) => ({
    name: f.name,
    ref: `f${i}`,
  }));
  const idToRef = new Map(folders.map((f, i) => [f.id, `f${i}`]));

  const manifestProjects = projects.map((project, i) => ({
    ...writeProject(zip, project, `p${i}-`),
    folderRef:
      project.folderId != null ? (idToRef.get(project.folderId) ?? null) : null,
  }));

  const manifest: Manifest = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    exportedAt: new Date().toISOString(),
    folders: manifestFolders,
    projects: manifestProjects,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: "blob" });
}

/** Downloads a single project as a `.studio` archive. */
export async function exportProjectFile(project: Project): Promise<void> {
  const blob = await buildProjectArchive(project);
  saveAs(blob, `${slugify(project.name)}${PROJECT_FILE_EXT}`);
}

/** Downloads a set of projects (and their folders) as a workspace archive. */
export async function exportWorkspaceFile(
  projects: Project[],
  folders: Folder[],
  baseName: string,
): Promise<void> {
  const blob = await buildWorkspaceArchive(projects, folders);
  saveAs(blob, `${slugify(baseName)}${PROJECT_FILE_EXT}`);
}

// ---------------------------------------------------------------------------
// Import (all input is untrusted)
// ---------------------------------------------------------------------------

function boundedNumber(
  raw: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return clamp(finiteOr(raw, fallback), min, max);
}

/**
 * Re-embeds an archived image as a data URL. Returns null when the image is
 * missing, oversized, or not an allowed raster type — the mime from the
 * manifest is untrusted and must never reach the data URL unvalidated.
 */
async function readArchiveImage(
  zip: JSZip,
  ref: unknown,
): Promise<string | null> {
  if (!ref || typeof ref !== "object") return null;
  const { path, mime } = ref as Record<string, unknown>;
  if (typeof path !== "string" || typeof mime !== "string") return null;
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(mime)) return null;
  const entry = zip.file(path);
  if (!entry) return null;
  const base64 = await entry.async("base64");
  if (base64.length > (MAX_IMAGE_BYTES / 3) * 4) {
    throw new Error("An image in the archive is too large (max 10 MB)");
  }
  return `data:${mime};base64,${base64}`;
}

function cappedString(value: unknown): string {
  return typeof value === "string" ? value.slice(0, CAPTION_MAX_LENGTH) : "";
}

async function normalizeBackground(
  zip: JSZip,
  raw: unknown,
): Promise<Background> {
  if (raw && typeof raw === "object" && "type" in raw) {
    const bg = raw as Record<string, unknown>;
    if (bg.type === "gradient") {
      return {
        type: "gradient",
        from: safeColor(bg.from, DEFAULT_BACKGROUND.from),
        to: safeColor(bg.to, DEFAULT_BACKGROUND.to),
        angle: boundedNumber(
          bg.angle,
          135,
          GRADIENT_ANGLE_MIN,
          GRADIENT_ANGLE_MAX,
        ),
      };
    }
    if (bg.type === "solid") {
      return { type: "solid", color: safeColor(bg.color, "#0B1020") };
    }
    if (bg.type === "image") {
      return { type: "image", image: await readArchiveImage(zip, bg.image) };
    }
  }
  return { ...DEFAULT_BACKGROUND };
}

function normalizeText(raw: unknown): TextStyle {
  const t = (raw ?? {}) as Record<string, unknown>;
  const align: TextAlign =
    t.align === "left" || t.align === "right" ? t.align : "center";
  return {
    color: safeColor(t.color, DEFAULT_TEXT.color),
    align,
    font: safeFont(t.font),
    claimSize: boundedNumber(
      t.claimSize,
      DEFAULT_TEXT.claimSize,
      CLAIM_SIZE_MIN,
      CLAIM_SIZE_MAX,
    ),
    subSize: boundedNumber(
      t.subSize,
      DEFAULT_TEXT.subSize,
      SUB_SIZE_MIN,
      SUB_SIZE_MAX,
    ),
    textWidth: boundedNumber(
      t.textWidth,
      DEFAULT_TEXT.textWidth,
      TEXT_WIDTH_MIN,
      TEXT_WIDTH_MAX,
    ),
  };
}

function normalizeDevice(raw: unknown): DeviceStyle {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    frameColor: safeColor(d.frameColor, DEFAULT_DEVICE.frameColor),
    edge: d.edge === true,
    scale: boundedNumber(
      d.scale,
      DEFAULT_DEVICE.scale,
      DEVICE_SCALE_MIN,
      DEVICE_SCALE_MAX,
    ),
    topSpace: boundedNumber(
      d.topSpace,
      DEFAULT_DEVICE.topSpace,
      TOP_SPACE_MIN,
      TOP_SPACE_MAX,
    ),
  };
}

/** A per-shot size override: null (use global), or a finite, clamped fraction. */
function normalizeShotScale(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return clamp(raw, DEVICE_SCALE_MIN, DEVICE_SCALE_MAX);
}

async function normalizeShot(zip: JSZip, raw: unknown): Promise<Shot> {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    id: createId(),
    image: await readArchiveImage(zip, s.image),
    claim: cappedString(s.claim),
    sub: cappedString(s.sub),
    offX: boundedNumber(s.offX, 0, OFFSET_MIN, OFFSET_MAX),
    offY: boundedNumber(s.offY, 0, OFFSET_MIN, OFFSET_MAX),
    scale: normalizeShotScale(s.scale),
  };
}

/**
 * Opens and validates a `.studio` archive, returning its zip handle and parsed
 * manifest. Throws with a user-facing message when the file is not a valid
 * screenshot-studio archive.
 */
async function parseArchive(
  file: Blob,
): Promise<{ zip: JSZip; manifest: Manifest }> {
  if (file.size > MAX_PROJECT_FILE_BYTES) {
    throw new Error("File is too large");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("This file is not a valid .studio archive");
  }

  const manifestEntry = zip.file("manifest.json");
  if (!manifestEntry) throw new Error("No manifest.json in the archive");
  const manifestText = await manifestEntry.async("string");
  if (manifestText.length > MAX_MANIFEST_CHARS) {
    throw new Error("manifest.json is too large");
  }

  let manifest: Manifest;
  try {
    manifest = JSON.parse(manifestText) as Manifest;
  } catch {
    throw new Error("manifest.json is corrupt");
  }
  if (!manifest || typeof manifest !== "object") {
    throw new Error("manifest.json is corrupt");
  }
  if (manifest.format !== PROJECT_FORMAT) {
    throw new Error("Unrecognised file format");
  }
  if (
    typeof manifest.version === "number" &&
    manifest.version > PROJECT_VERSION
  ) {
    throw new Error(
      "This file was created with a newer version — please update",
    );
  }

  return { zip, manifest };
}

/**
 * Turns one untrusted manifest project entry into a validated {@link Project}
 * with a fresh id and timestamps. `folderId` is left at the root; workspace
 * imports rewire it afterwards.
 */
async function buildProjectFromRaw(
  zip: JSZip,
  rawInput: unknown,
): Promise<Project> {
  const raw = (rawInput ?? {}) as Record<string, unknown>;

  const rawShots = Array.isArray(raw.shots)
    ? raw.shots.slice(0, MAX_SHOTS_PER_PROJECT)
    : [];

  const [background, shots] = await Promise.all([
    normalizeBackground(zip, raw.background),
    Promise.all(rawShots.map((s) => normalizeShot(zip, s))),
  ]);

  const now = Date.now();
  return {
    id: createId(),
    name:
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name
        : "Imported project",
    createdAt: now,
    updatedAt: now,
    presetId: isPresetId(raw.presetId) ? raw.presetId : "ios-6-9",
    background,
    text: normalizeText(raw.text),
    device: normalizeDevice(raw.device),
    shots,
    folderId: null,
  };
}

/**
 * Reads a `.studio` archive into a single {@link Project}. Accepts both the
 * single-project and workspace shapes (returns the first project of a
 * workspace). Throws when the archive contains no project.
 */
export async function readProjectFile(file: Blob): Promise<Project> {
  const { zip, manifest } = await parseArchive(file);
  const rawProject = Array.isArray(manifest.projects)
    ? manifest.projects[0]
    : manifest.project;
  if (!rawProject) throw new Error("The archive contains no project");
  return buildProjectFromRaw(zip, rawProject);
}

/**
 * Reads a `.studio` archive into a validated {@link WorkspacePayload}: folders
 * with fresh ids, and projects wired to them (via the manifest's `folderRef`
 * handles). A single-project archive reads as one project and no folders.
 */
export async function readWorkspaceFile(file: Blob): Promise<WorkspacePayload> {
  const { zip, manifest } = await parseArchive(file);

  // Single-project archive → one project, no folders.
  if (!Array.isArray(manifest.projects)) {
    if (!manifest.project) throw new Error("The archive contains no project");
    return {
      folders: [],
      projects: [await buildProjectFromRaw(zip, manifest.project)],
    };
  }

  // Workspace archive: resolve folder refs to fresh folder ids.
  const rawFolders = Array.isArray(manifest.folders)
    ? manifest.folders.slice(0, MAX_FOLDERS_PER_WORKSPACE)
    : [];
  const refToId = new Map<string, string>();
  const folders: Folder[] = [];
  for (const rawFolder of rawFolders) {
    const rf = (rawFolder ?? {}) as Record<string, unknown>;
    const name =
      typeof rf.name === "string" && rf.name.trim() ? rf.name : "Folder";
    const folder = makeFolder(name.slice(0, CAPTION_MAX_LENGTH));
    folders.push(folder);
    if (typeof rf.ref === "string") refToId.set(rf.ref, folder.id);
  }

  const rawProjects = manifest.projects.slice(0, MAX_PROJECTS_PER_WORKSPACE);
  const projects = await Promise.all(
    rawProjects.map(async (rawProject) => {
      const project = await buildProjectFromRaw(zip, rawProject);
      const ref = (rawProject as Record<string, unknown>)?.folderRef;
      project.folderId =
        typeof ref === "string" ? (refToId.get(ref) ?? null) : null;
      return project;
    }),
  );

  return { folders, projects };
}
