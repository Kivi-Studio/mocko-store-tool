"use client";

import Link from "next/link";
import { Boxes } from "lucide-react";
import type { Folder } from "@/lib/model/types";
import { versionLabel } from "@/lib/model/version";
import { AppMenu } from "./AppMenu";

/** An app as a row in the gallery's list view. */
export function AppRow({
  appKey,
  folders,
  latestProjectCount,
}: {
  appKey: string;
  /** The app's releases, newest first. */
  folders: Folder[];
  latestProjectCount: number;
}) {
  const latest = folders[0];

  return (
    <div className="hover:bg-muted/40 flex items-center gap-3 px-3 py-2 transition-colors">
      <Link
        href={`/?app=${encodeURIComponent(appKey)}`}
        className="flex min-w-0 flex-1 items-center gap-3"
        aria-label={`Open app ${appKey}`}
      >
        <div className="bg-muted/40 text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-md">
          <Boxes className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{appKey}</p>
          <p className="text-muted-foreground text-xs">
            {versionLabel(latest)} · {folders.length} versions
          </p>
        </div>
      </Link>

      <AppMenu
        appKey={appKey}
        latest={latest}
        projectCount={latestProjectCount}
      />
    </div>
  );
}
