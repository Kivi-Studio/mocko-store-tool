import type { Caption, Shot } from "@/lib/model/types";

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

/** True when the shot has a screenshot for every one of `codes`. */
export function isComplete(shot: Shot, codes: readonly string[]): boolean {
  return codes.every((code) => imageIdFor(shot, code) !== null);
}
