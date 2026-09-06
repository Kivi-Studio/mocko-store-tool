"use client";

import { useState } from "react";
import { ArrowRight, Merge } from "lucide-react";
import type { Project } from "@/lib/model/types";
import { detectLanguageGroups, languageOf } from "@/lib/model/merge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Folds a release's per-language projects into one project per store format.
 *
 * Nothing happens without confirmation: this is the one step that moves content
 * between projects, so it shows exactly what would be combined into what, and
 * only offers sets whose names leave no doubt — same name once the locale
 * suffix is dropped, one distinct language each.
 */
export function MergeLanguagesDialog({
  open,
  onOpenChange,
  projects,
  onMerge,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The folder's projects, in gallery order. */
  projects: Project[];
  onMerge: (ids: string[], name: string) => void;
}) {
  const groups = detectLanguageGroups(projects);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const toggle = (name: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const chosen = groups.filter((g) => !skipped.has(g.name));

  const submit = () => {
    for (const group of chosen) {
      onMerge(
        group.projects.map((p) => p.id),
        group.name,
      );
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge by language</DialogTitle>
          <DialogDescription>
            {groups.length === 0
              ? "Nothing to merge — this needs at least two projects whose names match apart from a language suffix, like “Telly (iOS) (DE)” and “Telly (iOS) (EN)”."
              : "Each set below becomes one project holding every language. The screenshots and captions move over; positions are matched by order."}
          </DialogDescription>
        </DialogHeader>

        {groups.length > 0 && (
          <ScrollArea className="max-h-72 rounded-lg border">
            <div className="grid gap-1 p-2">
              {groups.map((group) => (
                <Label
                  key={group.name}
                  className="hover:bg-muted/60 items-start gap-3 rounded-md p-2"
                >
                  <Checkbox
                    checked={!skipped.has(group.name)}
                    onCheckedChange={() => toggle(group.name)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-muted-foreground block text-xs font-normal">
                      {group.projects.map((p) => p.name).join(" + ")}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
                      <span className="truncate">{group.name}</span>
                      <span className="text-muted-foreground text-xs font-normal">
                        {group.projects
                          .map((p) => languageOf(p).code)
                          .join(" · ")}
                      </span>
                    </span>
                  </span>
                </Label>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {groups.length === 0 ? "Close" : "Cancel"}
          </DialogClose>
          {groups.length > 0 && (
            <Button onClick={submit} disabled={chosen.length === 0}>
              <Merge className="size-4" />
              Merge {chosen.length} {chosen.length === 1 ? "set" : "sets"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
