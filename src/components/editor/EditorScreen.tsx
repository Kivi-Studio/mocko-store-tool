"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import { redo, undo } from "@/store/useProjectStore";
import { EditorSidebar } from "./EditorSidebar";
import { EditorTopbar } from "./EditorTopbar";
import { ShotGrid } from "./ShotGrid";
import { LanguageProvider } from "./LanguageContext";

/** Full editor: global-settings sidebar + topbar + screenshot grid. */
export function EditorScreen({ project }: { project: Project }) {
  const [language, setLanguage] = useState(project.defaultLanguage);
  // Derive the effective language so a removed one falls back to the default
  // without needing to write state from an effect.
  const languageExists = project.languages.some((l) => l.code === language);
  const activeLanguage = languageExists ? language : project.defaultLanguage;

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
    <LanguageProvider value={{ language: activeLanguage, setLanguage }}>
      <div className="flex h-screen w-full overflow-hidden">
        <EditorSidebar project={project} />
        <main className="flex min-w-0 flex-1 flex-col">
          <EditorTopbar project={project} />
          <ShotGrid project={project} />
        </main>
      </div>
    </LanguageProvider>
  );
}
