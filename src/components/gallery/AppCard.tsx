"use client";

import Link from "next/link";
import { Boxes } from "lucide-react";
import type { Folder, Project } from "@/lib/model/types";
import { versionLabel } from "@/lib/model/version";
import { ShotCanvas } from "@/components/editor/ShotCanvas";
import { AppMenu } from "./AppMenu";

/**
 * An app tile in the gallery: several release folders that share a name, shown
 * as one entry so the root does not grow by one card per release. The preview
 * comes from the newest release, which is the one you are usually working on.
 */
export function AppCard({
  appKey,
  folders,
  latestProjects,
}: {
  appKey: string;
  /** The app's releases, newest first. */
  folders: Folder[];
  /** Projects of the newest release, for the preview mosaic. */
  latestProjects: Project[];
}) {
  const latest = folders[0];
  const previews = latestProjects
    .map((p) => ({ project: p, shot: p.shots[0] }))
    .filter((x) => x.shot)
    .slice(0, 4);

  return (
    <div className="group bg-card overflow-hidden rounded-xl border transition-shadow hover:shadow-md">
      <Link
        href={`/?app=${encodeURIComponent(appKey)}`}
        className="bg-muted/40 flex h-[260px] items-center justify-center overflow-hidden p-6"
        aria-label={`Open app ${appKey}`}
      >
        {previews.length > 0 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-2">
            {previews.map(({ project, shot }) => (
              <div
                key={project.id}
                className="bg-background/60 flex items-center justify-center overflow-hidden rounded-md p-1"
              >
                <ShotCanvas
                  project={project}
                  shot={shot!}
                  language={project.languages[0]?.code ?? ""}
                  className="h-auto max-h-full w-auto max-w-full rounded-sm shadow-sm"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2">
            <Boxes className="size-10" />
            <span className="text-xs">No screenshots yet</span>
          </div>
        )}
      </Link>

      <div className="flex items-center justify-between gap-2 border-t p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Boxes className="text-muted-foreground size-4 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{appKey}</p>
            <p className="text-muted-foreground text-xs">
              {versionLabel(latest)} · {folders.length} versions
            </p>
          </div>
        </div>

        <AppMenu
          appKey={appKey}
          latest={latest}
          projectCount={latestProjects.length}
        />
      </div>
    </div>
  );
}
