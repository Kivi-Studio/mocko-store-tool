import type { Caption, Shot } from "@/lib/types";

/** An empty caption (no claim, no subtext). */
export function emptyCaption(): Caption {
  return { claim: "", sub: "" };
}

/** Returns a shot's caption for a language, or an empty one when untranslated. */
export function captionFor(shot: Shot, language: string): Caption {
  return shot.captions[language] ?? emptyCaption();
}

/** True when a shot has any non-empty text for the given language. */
export function hasCaption(shot: Shot, language: string): boolean {
  const c = shot.captions[language];
  return !!c && (c.claim.trim() !== "" || c.sub.trim() !== "");
}
