import { saveAs } from "file-saver";
import JSZip from "jszip";
import type {
  Background,
  Caption,
  DeviceStyle,
  Folder,
  Language,
  Project,
  Shot,
  TextAlign,
  TextStyle,
} from "@/lib/model/types";
import { isPresetId } from "@/lib/model/presets";
import { safeFont } from "@/lib/model/fonts";
import { safeColor } from "@/lib/model/color";
import {
  DEFAULT_LANGUAGE,
  isValidLangCode,
  labelForCode,
} from "@/lib/model/locales";
import {
  DEFAULT_BACKGROUND,
  DEFAULT_DEVICE,
  DEFAULT_TEXT,
  makeFolder,
} from "@/lib/model/defaults";
import { clamp, createId, finiteOr, slugify } from "@/lib/utils";
import { getImageBlob, putImageBytes } from "@/lib/storage/image-store";
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
  MAX_LANGUAGES_PER_PROJECT,
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
export const PROJECT_VERSION = 6;
export const PROJECT_FILE_EXT = ".studio";

/**
 * Whether a file is a `.studio` backup, judged by its name. The content is
 * checked when the archive is read; this is the quick answer for a file
 * dropped or picked by mistake, so the message can say so plainly instead of
 * reporting what went wrong while reading a PNG as a zip.
 */
export function isProjectFile(file: { name: string }): boolean {
  return file.name.toLowerCase().endsWith(PROJECT_FILE_EXT);
}

/**
 * The `.studio` file is a ZIP container: a small `manifest.json` plus the raw
 * image bytes under `images/`. Storing images as binary (instead of base64 in
 * JSON) avoids the ~33% base64 inflation and keeps the manifest small.
 *
 * Image entries are named by content id, so a screenshot reused across
 * releases or projects is written once and referenced from every shot that
 * uses it. That matters because screenshots are already-compressed PNG/JPEG:
 * the ZIP's own deflate cannot shrink them, making deduplication the only
 * lever on archive size.
 *
 * Two manifest shapes are read:
 * Since v6 a project also carries its `languages`, and each shot keeps one
 * screenshot and caption per language code. Files written before that held a
 * single unnamed language; they still import, as a one-language project.
 *
 *  - single project: `{ project: {...} }` (also the pre-v5 shape)
 *  - workspace: `{ folders: [...], projects: [...] }`, which can hold one
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
  /** v6+: one screenshot and caption per language code. */
  images?: Record<string, ImageRef>;
  captions?: Record<string, Caption>;
  /** Pre-v6 single-language shape, still read. */
  image?: ImageRef;
  claim?: string;
  sub?: string;
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
  /** v6+. Absent in older files, which held exactly one (unnamed) language. */
  languages?: Language[];
  shots: ManifestShot[];
};

type ManifestFolder = {
  name: string;
  ref: string;
  /** Explicit app membership; omitted when the folder groups by its name. */
  appName?: string;
};

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

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Resolves a content id from the image store and adds its bytes to the archive
 * under a content-addressed path, writing each distinct image only once.
 * `written` tracks what this archive already holds across all its projects.
 */
async function addImage(
  zip: JSZip,
  imageId: string | null,
  written: Set<string>,
): Promise<ImageRef> {
  if (!imageId) return null;
  const blob = await getImageBlob(imageId);
  // A missing image exports as "no image" rather than failing the archive.
  if (!blob) return null;
  const mime = blob.type || "image/png";
  const path = `images/${imageId}.${extForMime(mime)}`;
  if (!written.has(path)) {
    zip.file(path, await blob.arrayBuffer());
    written.add(path);
  }
  return { path, mime };
}

/** Writes a project's images into the archive and returns its manifest payload. */
async function writeProject(
  zip: JSZip,
  project: Project,
  written: Set<string>,
): Promise<ManifestProject> {
  const bg = project.background;
  const background: ManifestBackground =
    bg.type === "image"
      ? { type: "image", image: await addImage(zip, bg.imageId, written) }
      : bg;

  const shots: ManifestShot[] = await Promise.all(
    project.shots.map(async (shot) => {
      const images: Record<string, ImageRef> = {};
      for (const [code, imageId] of Object.entries(shot.images)) {
        images[code] = await addImage(zip, imageId, written);
      }
      return {
        images,
        captions: shot.captions,
        offX: shot.offX,
        offY: shot.offY,
        scale: shot.scale,
      };
    }),
  );

  return {
    name: project.name,
    presetId: project.presetId,
    background,
    text: project.text,
    device: project.device,
    languages: project.languages,
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
    project: await writeProject(zip, project, new Set()),
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
    // Optional in both directions: an older reader ignores it, and a folder
    // without an override simply omits the key.
    ...(f.appName ? { appName: f.appName } : {}),
  }));
  const idToRef = new Map(folders.map((f, i) => [f.id, `f${i}`]));

  // Shared across every project in the archive, so a screenshot used by six
  // variants, or by three releases, is stored once.
  const written = new Set<string>();
  const manifestProjects = [];
  for (const project of projects) {
    manifestProjects.push({
      ...(await writeProject(zip, project, written)),
      folderRef:
        project.folderId != null
          ? (idToRef.get(project.folderId) ?? null)
          : null,
    });
  }

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
 * Reads one image out of the archive into the image store and returns its
 * content id. Identical bytes from different entries (an older archive still
 * stores one copy per shot) collapse onto a single stored image.
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
  const bytes = await entry.async("uint8array");
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("An image in the archive is too large (max 10 MB)");
  }
  return putImageBytes(bytes, mime);
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
      return {
        type: "image",
        imageId: await readArchiveImage(zip, bg.image),
      };
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

/**
 * The languages a project is imported with: the ones the file names, or (for
 * a file written before languages existed) the default one.
 *
 * Nothing is inferred from the project's name. A file from the
 * one-project-per-language era therefore arrives labelled with the default
 * language regardless of what it actually holds; saying which language it is
 * belongs to the merge step, where it is stated rather than guessed.
 */
function normalizeLanguages(raw: unknown): Language[] {
  if (!Array.isArray(raw)) return [{ ...DEFAULT_LANGUAGE }];
  const languages: Language[] = [];
  const seen = new Set<string>();
  for (const entry of raw.slice(0, MAX_LANGUAGES_PER_PROJECT)) {
    const l = (entry ?? {}) as Record<string, unknown>;
    if (!isValidLangCode(l.code) || seen.has(l.code)) continue;
    seen.add(l.code);
    languages.push({
      code: l.code,
      label:
        typeof l.label === "string" && l.label.trim()
          ? l.label.slice(0, CAPTION_MAX_LENGTH)
          : labelForCode(l.code),
    });
  }
  // A file that names no usable language still has to end up with one.
  return languages.length ? languages : [{ ...DEFAULT_LANGUAGE }];
}

async function normalizeShot(
  zip: JSZip,
  raw: unknown,
  languages: Language[],
): Promise<Shot> {
  const s = (raw ?? {}) as Record<string, unknown>;
  const codes = languages.map((l) => l.code);

  const images: Record<string, string | null> = {};
  const captions: Record<string, Caption> = {};

  if (s.images && typeof s.images === "object") {
    // v6+: keyed by language. Entries for languages the project does not
    // declare are dropped rather than resurrecting a language by the back door.
    const rawImages = s.images as Record<string, unknown>;
    for (const code of codes) {
      if (code in rawImages) {
        images[code] = await readArchiveImage(zip, rawImages[code]);
      }
    }
  } else {
    // Pre-v6: one unnamed screenshot, which belongs to the only language.
    images[codes[0]] = await readArchiveImage(zip, s.image);
  }

  const rawCaptions =
    s.captions && typeof s.captions === "object"
      ? (s.captions as Record<string, unknown>)
      : null;
  if (rawCaptions) {
    for (const code of codes) {
      const c = (rawCaptions[code] ?? null) as Record<string, unknown> | null;
      if (!c) continue;
      captions[code] = {
        claim: cappedString(c.claim),
        sub: cappedString(c.sub),
      };
    }
  } else {
    const claim = cappedString(s.claim);
    const sub = cappedString(s.sub);
    if (claim || sub) captions[codes[0]] = { claim, sub };
  }

  return {
    id: createId(),
    images,
    captions,
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
    throw new Error("This file needs a newer version of the app");
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

  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name
      : "Imported project";
  const languages = normalizeLanguages(raw.languages);

  const [background, shots] = await Promise.all([
    normalizeBackground(zip, raw.background),
    Promise.all(rawShots.map((s) => normalizeShot(zip, s, languages))),
  ]);

  const now = Date.now();
  return {
    id: createId(),
    name,
    createdAt: now,
    updatedAt: now,
    presetId: isPresetId(raw.presetId) ? raw.presetId : "ios-6-9",
    background,
    text: normalizeText(raw.text),
    device: normalizeDevice(raw.device),
    languages,
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
    if (typeof rf.appName === "string" && rf.appName.trim()) {
      folder.appName = rf.appName.trim().slice(0, CAPTION_MAX_LENGTH);
    }
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
