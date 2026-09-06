"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { useHydrated, useProjectStore } from "@/store/useProjectStore";
import { CaptionsScreen } from "@/components/captions/CaptionsScreen";
import { buttonVariants } from "@/components/ui/button";

function Loading() {
  return (
    <div className="text-muted-foreground flex flex-1 items-center justify-center py-24 text-sm">
      Loading…
    </div>
  );
}

// Like the editor route, the folder id travels in the query string
// (`/captions/?folder=…`) so a single static page serves every folder. Ids are
// created at runtime in the browser, so there is nothing to prebuild.
function CaptionsView() {
  const folderId = useSearchParams().get("folder") ?? "";
  const hydrated = useHydrated();
  const folder = useProjectStore((s) => s.folders[folderId]);
  const projects = useProjectStore(
    useShallow((s) =>
      s.projectOrder
        .map((id) => s.projects[id])
        .filter((p) => p && p.folderId === folderId),
    ),
  );

  if (!hydrated) return <Loading />;

  if (!folder) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
        <p className="text-muted-foreground text-sm">
          This folder doesn’t exist.
        </p>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Back to projects
        </Link>
      </div>
    );
  }

  return <CaptionsScreen folder={folder} projects={projects} />;
}

export default function CaptionsPage() {
  // useSearchParams() requires a Suspense boundary under static export.
  return (
    <Suspense fallback={<Loading />}>
      <CaptionsView />
    </Suspense>
  );
}
