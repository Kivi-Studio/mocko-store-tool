import type { Caption, Project, Shot } from "@/lib/model/types";

/**
 * Reading a shot's per-language content.
 *
 * A shot keeps its screenshots and captions keyed by language code, and an
 * entry is simply absent until that language has been filled in. Both readers
 * are therefore total: a language that has not been translated (or not been
 * given a screenshot) yet reads as empty rather than as an error, which is the
 * normal state while a release is being put together.
 */

const EMPTY: Caption = { claim: "", sub: "" };

/** The caption for one language; empty when it has not been written yet. */
export function captionFor(shot: Shot, code: string): Caption {
  return shot.captions[code] ?? EMPTY;
}

/** The screenshot for one language; null when none has been chosen yet. */
export function imageIdFor(shot: Shot, code: string): string | null {
  return shot.images[code] ?? null;
}

/**
 * Every image id a set of projects still points at — the survivors of an image
 * store sweep. An image is shared across languages and releases, so it may only
 * go once the last reference to it has.
 */
export function referencedImageIds(
  projects: Record<string, Project>,
): Set<string> {
  const ids = new Set<string>();
  for (const project of Object.values(projects)) {
    if (project.background.type === "image" && project.background.imageId) {
      ids.add(project.background.imageId);
    }
    for (const shot of project.shots) {
      for (const id of Object.values(shot.images)) if (id) ids.add(id);
    }
  }
  return ids;
}
