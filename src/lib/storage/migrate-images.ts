import type { Background, Project, Shot } from "@/lib/model/types";
import { putImageDataUrl } from "@/lib/storage/image-store";

/**
 * Moving screenshots out of the persisted state and into the content-addressed
 * image store.
 *
 * Before this, every shot carried its screenshot inline as a base64 data URL,
 * so the whole library was structured-cloned on each autosave and every kept
 * release stored its own copy of unchanged screenshots.
 */

/** A project as stored before screenshots moved out of the state. */
export type LegacyShot = Omit<Shot, "imageId"> & { image?: string | null };

/**
 * Moves one project's inline data-URL screenshots into the image store,
 * replacing them with content ids. Identical screenshots across releases
 * collapse onto one stored image on the way through.
 */
export async function migrateProjectToImageStore(
  raw: unknown,
): Promise<Project> {
  // The legacy shot/background shapes replace, rather than intersect with, the
  // current ones — otherwise `image` would be typed away by `Shot`.
  const p = (raw ?? {}) as Omit<Partial<Project>, "shots" | "background"> & {
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

  const shots = await Promise.all(
    (p.shots ?? []).map(async (raw) => {
      const { image, ...rest } = raw;
      return { ...rest, imageId: await putImageDataUrl(image ?? null) };
    }),
  );

  return {
    ...(p as unknown as Project),
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
    for (const shot of p.shots) if (shot.imageId) ids.add(shot.imageId);
  }
  return ids;
}
