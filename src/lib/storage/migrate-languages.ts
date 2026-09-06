import type { Caption, Project, Shot } from "@/lib/model/types";
import { DEFAULT_LANGUAGE } from "@/lib/model/locales";
import type {
  ImageStoreProject,
  ImageStoreShot,
} from "@/lib/storage/migrate-images";

/**
 * Turning one-project-per-language setups into projects that hold every
 * language themselves.
 *
 * Before this, a shot had a single screenshot and a single caption, so covering
 * a localized app meant a separate project per language — six of them for a
 * cross-platform release. Now a shot is a *position* whose image and text vary
 * by language.
 *
 * The migration is deliberately mechanical: each existing project becomes a
 * project with exactly one language. It moves no content between projects, so
 * nothing can be mixed up. Combining the per-language projects into one is a
 * separate, explicit step the user confirms.
 */

/** A v6 project, or anything close enough to read as one. */
type RawProject = Partial<ImageStoreProject> & { name?: string };

/** Moves one shot's single image and caption under `code`. */
function shotToLanguages(shot: ImageStoreShot, code: string): Shot {
  const caption: Caption = { claim: shot.claim ?? "", sub: shot.sub ?? "" };
  return {
    id: shot.id,
    images: { [code]: shot.imageId ?? null },
    // An untouched caption stays absent rather than being stored as empty, so
    // "not translated yet" and "deliberately blank" do not look the same.
    captions: caption.claim || caption.sub ? { [code]: caption } : {},
    offX: shot.offX,
    offY: shot.offY,
    scale: shot.scale,
  };
}

/** Gives a v6 project a single language and files its content under it. */
export function migrateProjectToLanguages(raw: unknown): Project {
  const p = (raw ?? {}) as RawProject;
  const language = { ...DEFAULT_LANGUAGE };
  return {
    ...(p as unknown as Project),
    languages: [language],
    shots: (p.shots ?? []).map((shot) => shotToLanguages(shot, language.code)),
  };
}
