"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Upload } from "lucide-react";
import { toast } from "sonner";
import { useHydrated, useProjectStore } from "@/store/useProjectStore";
import { readProjectFile } from "@/lib/storage/project-file";
import { APP_VERSION } from "@/lib/version";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "./ProjectCard";

export function ProjectGallery() {
  const router = useRouter();
  const projectOrder = useProjectStore((s) => s.projectOrder);
  const projects = useProjectStore((s) => s.projects);
  const createProject = useProjectStore((s) => s.createProject);
  const addProject = useProjectStore((s) => s.addProject);
  const hydrated = useHydrated();
  const fileRef = useRef<HTMLInputElement>(null);

  const items = projectOrder.map((id) => projects[id]).filter(Boolean);

  const handleCreate = () => {
    const id = createProject();
    router.push(`/project/?id=${id}`);
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const imported = await readProjectFile(file);
      const id = addProject(imported);
      toast.success("Project imported");
      router.push(`/project/?id=${id}`);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Could not read file",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG asset, no optimization needed */}
          <img
            src="/logo.svg"
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-[9px]"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mocko</h1>
            <p className="text-muted-foreground text-sm">
              Design App Store &amp; Google Play screenshots — upload, caption
              and export in store sizes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".studio,application/zip"
            className="hidden"
            onChange={(e) => void handleImport(e.target.files?.[0])}
          />
          {hydrated && (
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" />
              Import
            </Button>
          )}
          {/* Disabled until hydration: a project created before the persisted
              state arrives would be overwritten by it. */}
          <Button onClick={handleCreate} disabled={!hydrated}>
            <FolderPlus className="size-4" />
            New project
          </Button>
        </div>
      </header>

      {!hydrated ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted/40 h-[320px] animate-pulse rounded-xl border"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <button
          type="button"
          onClick={handleCreate}
          className="text-muted-foreground hover:border-foreground/30 hover:text-foreground flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 transition-colors"
        >
          <FolderPlus className="size-10" />
          <span className="text-sm font-medium">Create your first project</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      <footer className="text-muted-foreground mt-12 text-center text-xs">
        Mocko v{APP_VERSION} · Powered by{" "}
        <a
          href="https://www.kivistudio.de"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground font-medium underline underline-offset-2"
        >
          Kivi Studio
        </a>
      </footer>
    </div>
  );
}
