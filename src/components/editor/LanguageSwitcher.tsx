"use client";

import { useState } from "react";
import { Check, ChevronDown, Languages, Settings2 } from "lucide-react";
import type { Project } from "@/lib/model/types";
import { imageIdFor } from "@/lib/model/caption";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "./LanguageContext";
import { ManageLanguagesDialog } from "./ManageLanguagesDialog";

/**
 * The editor's single language control, App-Store-Connect style: switch here
 * and the canvas, captions and uploads all follow.
 *
 * Each entry shows how many positions that language still has no screenshot
 * for, so a half-finished translation is visible before exporting rather than
 * after.
 */
export function LanguageSwitcher({ project }: { project: Project }) {
  const { language, setLanguage } = useLanguage();
  const [manageOpen, setManageOpen] = useState(false);

  const active =
    project.languages.find((l) => l.code === language) ?? project.languages[0];

  const missingFor = (code: string) =>
    project.shots.filter((shot) => imageIdFor(shot, code) === null).length;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Language"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Languages className="size-4" />
          {active?.label ?? "Language"}
          <ChevronDown className="size-4 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {project.languages.map((l) => {
            const missing = missingFor(l.code);
            return (
              <DropdownMenuItem
                key={l.code}
                onClick={() => setLanguage(l.code)}
              >
                <Check
                  className={cn(
                    "size-4",
                    l.code !== active?.code && "opacity-0",
                  )}
                />
                <span className="flex-1">{l.label}</span>
                <span className="text-muted-foreground text-xs">
                  {missing > 0 ? `${missing} without image` : l.code}
                </span>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setManageOpen(true)}>
            <Settings2 className="size-4" />
            Manage languages…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ManageLanguagesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        project={project}
      />
    </>
  );
}
