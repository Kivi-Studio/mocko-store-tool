import type { Language, Project, Shot } from "@/lib/model/types";
import {
  guessLangCode,
  labelForCode,
  stripLangSuffix,
} from "@/lib/model/locales";

/**
 * Combining one-project-per-language setups into multilingual projects.
 *
 * The language migration deliberately leaves every existing project alone, one
 * language each — it must not risk mixing content up. This is the second half:
 * an explicit, previewable step that folds "Telly (iOS) (DE)" and
 * "Telly (iOS) (EN)" into a single "Telly (iOS)" holding both.
 *
 * Detection is conservative. A group only forms when the names agree exactly
 * once their locale suffix is removed, every member names a language, and no
 * two members name the *same* one — anything less and it is not obvious what
 * should happen, so nothing is offered.
 */

/** Projects that look like the same listing in different languages. */
export type MergeGroup = {
  /** The shared name, with the locale suffix removed. */
  name: string;
  /** Members, in the order they were given. */
  projects: Project[];
};

/** True when a project is a plain single-language one that names its language. */
function isMergeCandidate(project: Project): boolean {
  return project.languages.length === 1 && guessLangCode(project.name) !== null;
}

/**
 * Finds sets of projects that differ only by their language. Only sets of two
 * or more are returned, and a set with two projects claiming the same language
 * is dropped rather than guessed at.
 */
export function detectLanguageGroups(projects: Project[]): MergeGroup[] {
  const byName = new Map<string, Project[]>();
  const order: string[] = [];
  for (const project of projects) {
    if (!isMergeCandidate(project)) continue;
    const name = stripLangSuffix(project.name);
    if (!name) continue;
    const members = byName.get(name);
    if (members) members.push(project);
    else {
      byName.set(name, [project]);
      order.push(name);
    }
  }

  const groups: MergeGroup[] = [];
  for (const name of order) {
    const members = byName.get(name)!;
    if (members.length < 2) continue;
    const codes = members.map((p) => guessLangCode(p.name)!);
    if (new Set(codes).size !== codes.length) continue;
    groups.push({ name, projects: members });
  }
  return groups;
}

/** The language a candidate project contributes to a merge. */
export function languageOf(project: Project): Language {
  const code = guessLangCode(project.name) ?? project.languages[0]?.code ?? "";
  return (
    project.languages.find((l) => l.code === code) ?? {
      code,
      label: labelForCode(code),
    }
  );
}

/**
 * Folds several projects into one that holds each of their languages.
 *
 * Positions are matched by order, the same assumption "Apply to…" makes: the
 * first project's shot 3 and the second's shot 3 are the same position in two
 * languages. Design, preset and folder come from the first project, since a
 * release's variants share them anyway.
 */
export function mergeProjects(projects: Project[], name: string): Project {
  const [first] = projects;

  const languages: Language[] = [];
  const seen = new Set<string>();
  for (const project of projects) {
    const language = languageOf(project);
    if (seen.has(language.code)) continue;
    seen.add(language.code);
    languages.push(language);
  }

  const rowCount = Math.max(0, ...projects.map((p) => p.shots.length));
  const shots: Shot[] = [];
  for (let i = 0; i < rowCount; i += 1) {
    // Layout comes from the first project that actually has this position.
    const layoutSource = projects.find((p) => p.shots[i]) ?? first;
    const base = layoutSource.shots[i];
    const images: Record<string, string | null> = {};
    const captions: Shot["captions"] = {};
    for (const project of projects) {
      const shot = project.shots[i];
      if (!shot) continue;
      Object.assign(images, shot.images);
      Object.assign(captions, shot.captions);
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

  return {
    ...first,
    name,
    updatedAt: Date.now(),
    languages,
    shots,
  };
}
