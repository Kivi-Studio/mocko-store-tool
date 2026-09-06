"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useHydrated, useProject } from "@/store/useProjectStore";
import { EditorScreen } from "@/components/editor/EditorScreen";
import { buttonVariants } from "@/components/ui/button";

function Loading() {
  return (
    <div className="text-muted-foreground flex flex-1 items-center justify-center py-24 text-sm">
      Loading…
    </div>
  );
}

// The project id travels in the query string (`/project/?id=…`) rather than a
// path segment. Ids are created at runtime in the browser, so there is nothing
// to prebuild. A single static `/project` page serves every project, which is
// what lets the app ship as a static export.
function ProjectView() {
  const id = useSearchParams().get("id") ?? "";
  const hydrated = useHydrated();
  const project = useProject(id);

  if (!hydrated) return <Loading />;

  if (!project) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
        <p className="text-muted-foreground text-sm">
          This project doesn’t exist.
        </p>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Back to projects
        </Link>
      </div>
    );
  }

  return <EditorScreen project={project} />;
}

export default function ProjectPage() {
  // useSearchParams() requires a Suspense boundary under static export.
  return (
    <Suspense fallback={<Loading />}>
      <ProjectView />
    </Suspense>
  );
}
