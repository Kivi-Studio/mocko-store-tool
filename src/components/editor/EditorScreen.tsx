"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/model/types";
import { redo, undo } from "@/store/useProjectStore";
import { EditorSidebar } from "./EditorSidebar";
import { EditorTopbar } from "./EditorTopbar";
import { ShotGrid } from "./ShotGrid";
import { ShotDetailPanel } from "./ShotDetailPanel";

/** Full editor: global-settings sidebar + topbar + screenshot grid. */
export function EditorScreen({ project }: { project: Project }) {
  // Ephemeral UI state: which shot's detail panel is open. Not persisted and
  // not undoable. Derive the selected shot so a deleted one falls away.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedShot = project.shots.find((s) => s.id === selectedId) ?? null;

  // Undo/redo keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <EditorSidebar project={project} />
      <main className="flex min-w-0 flex-1 flex-col">
        <EditorTopbar project={project} />
        <ShotGrid
          project={project}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </main>
      {selectedShot && (
        <ShotDetailPanel
          project={project}
          shot={selectedShot}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
