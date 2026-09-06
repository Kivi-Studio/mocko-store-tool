import type { WorkspacePayload } from "@/lib/storage/project-file";

/**
 * How an imported `.studio` file enters the workspace.
 *
 * - `"open"`: a single loose project, added and opened right away.
 * - `"add"`: imported outright, without asking.
 * - `"ask"`: the user decides between merging and replacing.
 */
export type ImportPlan = "open" | "add" | "ask";

/**
 * Decides whether an import needs the merge-or-replace question. That question
 * only has two different answers when there is something to merge with or to
 * replace: into an empty workspace both do exactly the same thing, so a fresh
 * install restores a backup without a detour through the dialog.
 */
export function planImport(
  payload: Pick<WorkspacePayload, "projects" | "folders">,
  workspaceEmpty: boolean,
): ImportPlan {
  if (payload.folders.length === 0 && payload.projects.length === 1) {
    return "open";
  }
  return workspaceEmpty ? "add" : "ask";
}
