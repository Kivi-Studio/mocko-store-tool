"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Folder, Language, Project } from "@/lib/model/types";
import { captionFor, imageIdFor } from "@/lib/model/caption";
import { useProjectStore } from "@/store/useProjectStore";
import { useUndoGroup } from "@/store/useUndoGroup";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShotThumb } from "./ShotThumb";

/**
 * One project's caption for one shot position. Editing writes straight through
 * to the store; a burst of typing collapses into a single undo step.
 */
function CaptionCell({
  project,
  language,
  index,
}: {
  project: Project;
  language: string;
  index: number;
}) {
  const updateShotText = useProjectStore((s) => s.updateShotText);
  const { group, end } = useUndoGroup();
  const shot = project.shots[index];
  const caption = shot ? captionFor(shot, language) : null;

  if (!shot) {
    // A shorter project simply has nothing at this position. Typing here would
    // have to invent a shot, which is what "Apply to…" is for — this view only
    // ever edits text.
    return (
      <span className="text-muted-foreground/60 text-xs italic">no shot</span>
    );
  }

  const where = `${project.name} ${language}, shot ${index + 1}`;
  return (
    <div className="space-y-1">
      <Input
        value={caption!.claim}
        placeholder="Claim"
        aria-label={`Claim, ${where}`}
        onChange={(e) =>
          group(() =>
            updateShotText(project.id, shot.id, language, {
              claim: e.target.value,
            }),
          )
        }
        onBlur={end}
        className="h-8 font-medium"
      />
      <Input
        value={caption!.sub}
        placeholder="Subtext"
        aria-label={`Subtext, ${where}`}
        onChange={(e) =>
          group(() =>
            updateShotText(project.id, shot.id, language, {
              sub: e.target.value,
            }),
          )
        }
        onBlur={end}
        className="text-muted-foreground h-8 text-xs"
      />
    </div>
  );
}

/** One editable column: a project seen through one of its languages. */
type Column = { project: Project; language: Language };

/**
 * Every caption in a release, side by side.
 *
 * A release folder holds the same screenshots per store, device and language,
 * so its copy is written once and then repeated across four to six projects.
 * Clicking through each project to compare or fix a line is the slow part;
 * here the whole release is one grid — rows are shot positions, columns are
 * projects. After captions move to a per-language model the columns become
 * languages, which is the shape a translator actually wants.
 */
export function CaptionsScreen({
  folder,
  projects,
}: {
  folder: Folder;
  projects: Project[];
}) {
  const rowCount = Math.max(0, ...projects.map((p) => p.shots.length));
  const columns: Column[] = projects.flatMap((project) =>
    project.languages.map((language) => ({ project, language })),
  );
  const totalCaptions = columns.reduce((n, c) => n + c.project.shots.length, 0);

  /** The first screenshot at this position, for orientation in the row head. */
  const thumbFor = (index: number) => {
    for (const { project, language } of columns) {
      const shot = project.shots[index];
      const id = shot ? imageIdFor(shot, language.code) : null;
      if (id) return id;
    }
    return null;
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-card flex h-14 shrink-0 items-center gap-3 border-b px-3">
        <Link
          href={`/?folder=${folder.id}`}
          aria-label="Back to folder"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{folder.name}</p>
          <p className="text-muted-foreground text-xs">
            {projects.length} {projects.length === 1 ? "project" : "projects"} ·{" "}
            {columns.length} {columns.length === 1 ? "column" : "columns"} ·{" "}
            {totalCaptions} {totalCaptions === 1 ? "caption" : "captions"}
          </p>
        </div>
      </header>

      {columns.length === 0 || rowCount === 0 ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center py-24 text-sm">
          Nothing to caption yet — add screenshots to this release first.
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="bg-background sticky top-0 left-0 z-20 w-40 border-r border-b px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  Shot
                </th>
                {columns.map(({ project, language }) => (
                  <th
                    key={`${project.id}:${language.code}`}
                    scope="col"
                    className="bg-background sticky top-0 z-10 min-w-56 border-r border-b px-3 py-2 text-left font-medium"
                  >
                    <span className="block truncate">{project.name}</span>
                    <span className="text-muted-foreground block truncate text-xs font-normal">
                      {language.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }, (_, i) => (
                <tr key={i}>
                  <th
                    scope="row"
                    className="bg-background sticky left-0 z-10 border-r border-b px-3 py-2 text-left align-top font-normal"
                  >
                    <span className="flex items-center gap-2">
                      <ShotThumb imageId={thumbFor(i)} />
                      <span className="text-muted-foreground text-xs">
                        Shot {i + 1}
                      </span>
                    </span>
                  </th>
                  {columns.map(({ project, language }) => (
                    <td
                      key={`${project.id}:${language.code}`}
                      className="border-r border-b px-3 py-2 align-top"
                    >
                      <CaptionCell
                        project={project}
                        language={language.code}
                        index={i}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
