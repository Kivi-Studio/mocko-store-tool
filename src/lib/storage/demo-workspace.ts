import type { Folder } from "@/lib/model/types";
import { folderGroupKey } from "@/lib/model/version";
import {
  readWorkspaceFile,
  type WorkspacePayload,
} from "@/lib/storage/project-file";

/**
 * The sample workspace: two fictional apps with releases, formats and two
 * languages, so there is something to look at (and to take screenshots of)
 * before the first real project exists.
 *
 * It ships as an ordinary `.studio` file under `public/` and comes in through
 * the same reader every backup does. That reader is also the migrator (see
 * ARCHITECTURE.md), so the file keeps working across model changes without
 * code of its own. To change what the demo shows, edit it in Mocko and export
 * the workspace again.
 */

/** Where the static export serves the sample file from. */
export const DEMO_FILE_URL = "/demo.studio";

/** The app whose presence means the sample workspace is already loaded. */
export const DEMO_APP_NAME = "Ridgeline";

/** The languages the sample is maintained in; either can be the default. */
export type DemoLanguage = "en" | "de";

/** Reads a `?demo=` value: German on request, English otherwise. */
export function demoLanguageFor(value: string | null): DemoLanguage {
  return value === "de" ? "de" : "en";
}

/** True when a release of the sample app is in the workspace. */
export function isDemoPresent(
  folders: Iterable<Pick<Folder, "name" | "appName">>,
): boolean {
  for (const folder of folders) {
    if (folderGroupKey(folder) === DEMO_APP_NAME) return true;
  }
  return false;
}

/**
 * Makes `code` the default language of every project that has it: the first
 * one, which the gallery covers show and the editor opens on. Projects without
 * that language are left alone.
 */
export function withDefaultLanguage(
  payload: WorkspacePayload,
  code: string,
): WorkspacePayload {
  return {
    ...payload,
    projects: payload.projects.map((project) => {
      const i = project.languages.findIndex((l) => l.code === code);
      if (i <= 0) return project;
      const languages = [
        project.languages[i],
        ...project.languages.filter((_, j) => j !== i),
      ];
      return { ...project, languages };
    }),
  };
}

/** Fetches the sample file and reads it like any other backup. */
export async function fetchDemoWorkspace(
  primary: DemoLanguage,
  fetchImpl: typeof fetch = fetch,
): Promise<WorkspacePayload> {
  const response = await fetchImpl(DEMO_FILE_URL);
  if (!response.ok) {
    throw new Error(
      `Could not fetch the sample workspace (${response.status})`,
    );
  }
  const payload = await readWorkspaceFile(await response.blob());
  return withDefaultLanguage(payload, primary);
}
