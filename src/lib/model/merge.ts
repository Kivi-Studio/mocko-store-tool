import type { Language, Project, Shot } from "@/lib/model/types";

/**
 * Folding one-project-per-language setups into multilingual projects.
 *
 * The language model made a shot a *position* that every language fills, but a
 * library built before that has one project per language. This turns
 * "Telly (iOS) (DE)" and "Telly (iOS) (EN)" into a single "Telly (iOS)"
 * holding both.
 *
 * Which project is which language is **stated by the caller, not inferred**.
 * Names are written in whatever way suited at the time (brackets, dashes,
 * copy suffixes), and a rule that reads them all correctly is a rule that will
 * eventually read one of them wrongly. Since this is a step taken once, saying
 * it outright is both simpler and safer than parsing it.
 */

/** One project and the language its content turns out to be in. */
export type MergePart = { project: Project; language: Language };

/**
 * Re-keys one project's per-language content onto `code`.
 *
 * After an import every project carries the same default language code, so a
 * project's own key says nothing about what it holds. The caller's assignment
 * does. A project that genuinely maintains several languages is passed through
 * untouched; there is nothing to reassign.
 */
function contentUnder(
  shot: Shot | undefined,
  project: Project,
  code: string,
): Pick<Shot, "images" | "captions"> {
  if (!shot) return { images: {}, captions: {} };
  if (project.languages.length !== 1) {
    return { images: shot.images, captions: shot.captions };
  }
  const from = project.languages[0].code;
  const images: Shot["images"] = {};
  const captions: Shot["captions"] = {};
  if (from in shot.images) images[code] = shot.images[from];
  if (from in shot.captions) captions[code] = shot.captions[from];
  return { images, captions };
}

/**
 * Folds several projects into one that holds each of their languages.
 *
 * Positions are matched by order, the same assumption "Apply to…" makes: the
 * first project's third shot and the second's third shot are the same position
 * in two languages. Design, preset, folder and identity come from the first
 * part, since a release's variants share them anyway.
 */
export function mergeProjects(parts: MergePart[], name: string): Project {
  const first = parts[0].project;

  const languages: Language[] = [];
  const seen = new Set<string>();
  for (const { language } of parts) {
    if (seen.has(language.code)) continue;
    seen.add(language.code);
    languages.push(language);
  }

  const rowCount = Math.max(0, ...parts.map((p) => p.project.shots.length));
  const shots: Shot[] = [];
  for (let i = 0; i < rowCount; i += 1) {
    // Layout belongs to the position, so it comes from the first part that
    // actually has one, not from whichever translation happens to be first.
    const base = (parts.find((p) => p.project.shots[i]) ?? parts[0]).project
      .shots[i];
    const images: Shot["images"] = {};
    const captions: Shot["captions"] = {};
    for (const { project, language } of parts) {
      const content = contentUnder(project.shots[i], project, language.code);
      Object.assign(images, content.images);
      Object.assign(captions, content.captions);
    }
    shots.push({
      id: base.id,
      images,
      captions,
      offX: base.offX,
      offY: base.offY,
      scale: base.scale,
    });
  }

  return { ...first, name, updatedAt: Date.now(), languages, shots };
}
