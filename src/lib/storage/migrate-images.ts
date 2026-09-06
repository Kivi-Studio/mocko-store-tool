import type { Background, Project } from "@/lib/model/types";
import { putImageDataUrl } from "@/lib/storage/image-store";

/**
 * Moving screenshots out of the persisted state and into the content-addressed
 * image store.
 *
 * Before this, every shot carried its screenshot inline as a base64 data URL,
 * so the whole library was structured-cloned on each autosave and every kept
 * release stored its own copy of unchanged screenshots.
 */

/** Layout fields a shot has carried unchanged through every version. */
type ShotLayout = {
  id: string;
  offX: number;
  offY: number;
  scale: number | null;
};

/** A shot as stored before screenshots moved out of the state. */
export type LegacyShot = ShotLayout & {
  image?: string | null;
  claim: string;
  sub: string;
};

/** A shot after this migration: a content id, still one per shot, not per language. */
export type ImageStoreShot = ShotLayout & {
  imageId: string | null;
  claim: string;
  sub: string;
};

/**
 * What this migration produces — the v6 shape. Languages arrive in the next
 * one, which turns each shot's single image and caption into per-language maps.
 */
export type ImageStoreProject = Omit<Project, "shots" | "languages"> & {
  shots: ImageStoreShot[];
};

/**
 * Moves one project's inline data-URL screenshots into the image store,
 * replacing them with content ids. Identical screenshots across releases
 * collapse onto one stored image on the way through.
 */
export async function migrateProjectToImageStore(
  raw: unknown,
): Promise<ImageStoreProject> {
  // The legacy shot/background shapes replace, rather than intersect with, the
  // current ones — otherwise `image` would be typed away by `Shot`.
  const p = (raw ?? {}) as Omit<
    Partial<Project>,
    "shots" | "background" | "languages"
  > & {
    shots?: LegacyShot[];
    background?: { type?: string; image?: string | null };
  };

  const rawBg = p.background;
  const background =
    rawBg?.type === "image"
      ? ({
          type: "image",
          imageId: await putImageDataUrl(rawBg.image ?? null),
        } as Background)
      : (rawBg as Background);

  // Still the flat v6 shot shape — the language migration runs after this one
  // and turns `imageId`/`claim`/`sub` into per-language maps.
  const shots = await Promise.all(
    (p.shots ?? []).map(async (raw) => {
      const { image, ...rest } = raw;
      return { ...rest, imageId: await putImageDataUrl(image ?? null) };
    }),
  );

  return {
    ...(p as unknown as ImageStoreProject),
    folderId: p.folderId ?? null,
    background,
    shots,
  };
}

/** Every image id the state still points at — the survivors of a sweep. */
export function referencedImageIds(
  projects: Record<string, Project>,
): Set<string> {
  const ids = new Set<string>();
  for (const p of Object.values(projects)) {
    if (p.background.type === "image" && p.background.imageId) {
      ids.add(p.background.imageId);
    }
    for (const shot of p.shots) {
      for (const id of Object.values(shot.images)) if (id) ids.add(id);
    }
  }
  return ids;
}
