"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useHydrated, useProject } from "@/store/useProjectStore";
import { EditorScreen } from "@/components/editor/EditorScreen";
import { buttonVariants } from "@/components/ui/button";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const hydrated = useHydrated();
  const project = useProject(id);

  if (!hydrated) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center py-24 text-sm">
        Loading…
      </div>
    );
  }

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
