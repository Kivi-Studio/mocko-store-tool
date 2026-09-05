"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, LayoutGrid, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import type { Folder } from "@/lib/model/types";
import { useShallow } from "zustand/react/shallow";
import { useProjectStore } from "@/store/useProjectStore";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewVersionDialog } from "./NewVersionDialog";

/**
 * Actions on an app tile. "New version…" starts from the app's newest release,
 * which is the entry point you actually want — you rarely branch a new version
 * off an old one.
 */
export function AppMenu({
  appKey,
  latest,
  projectCount,
}: {
  appKey: string;
  /** The app's newest release — the source a new version copies from. */
  latest: Folder;
  projectCount: number;
}) {
  const router = useRouter();
  const createFolderVersion = useProjectStore((s) => s.createFolderVersion);
  const folderNames = useProjectStore(
    useShallow((s) => Object.values(s.folders).map((f) => f.name)),
  );
  const [versionOpen, setVersionOpen] = useState(false);

  const href = `/?app=${encodeURIComponent(appKey)}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${appKey}`}
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(href)}>
            <LayoutGrid className="size-4" />
            Open versions
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setVersionOpen(true)}>
            <GitBranch className="size-4" />
            New version…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewVersionDialog
        // Remount on open so the draft re-reads the latest release.
        key={versionOpen ? "open" : "closed"}
        open={versionOpen}
        onOpenChange={setVersionOpen}
        folder={latest}
        projectCount={projectCount}
        takenNames={folderNames}
        baseName={appKey}
        onSubmit={(name, options) => {
          const id = createFolderVersion(latest.id, name, options);
          if (!id) return;
          toast.success(`Created “${name}”`);
          router.push(`/?folder=${id}`);
        }}
      />
    </>
  );
}
