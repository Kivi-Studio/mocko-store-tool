"use client";

import { useState } from "react";
import type { Project } from "@/lib/model/types";
import type { ApplyOptions } from "@/store/useProjectStore";
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

/** What a caption transfer would do to one target, for the preview line. */
function captionEffect(source: Project, target: Project) {
  const updated = Math.min(source.shots.length, target.shots.length);
  const added = Math.max(0, source.shots.length - target.shots.length);
  const untouched = Math.max(0, target.shots.length - source.shots.length);
  const parts = [`${updated} updated`];
  if (added > 0) parts.push(`${added} added`);
  if (untouched > 0) parts.push(`${untouched} left as is`);
  return parts.join(" · ");
}

/**
 * Pushes the current project's design and/or captions onto its siblings.
 *
 * A release folder holds the same screenshots per store, device and language,
 * so one variant is usually the master: finish "iPhone (de)", then seed the
 * rest from it instead of repeating every styling tweak six times.
 */
export function ApplyToSiblingsDialog({
  open,
  onOpenChange,
  project,
  siblings,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  siblings: Project[];
  onSubmit: (targetIds: string[], options: ApplyOptions) => void;
}) {
  // The common case is "all of them", so everything starts selected.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(siblings.map((p) => p.id)),
  );
  // Design is the safe default; overwriting text is opt-in.
  const [design, setDesign] = useState(true);
  const [captions, setCaptions] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const count = selected.size;
  const canSubmit = count > 0 && (design || captions);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit([...selected], { design, captions });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply to other projects</DialogTitle>
          <DialogDescription>
            Copies from “{project.name}” onto the other projects in this folder.
            The export preset and the screenshots themselves are never touched.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 rounded-lg border p-3">
            <Label className="gap-3">
              <Checkbox checked={design} onCheckedChange={setDesign} />
              Design: background, text style and device
            </Label>
            <Label className="gap-3">
              <Checkbox checked={captions} onCheckedChange={setCaptions} />
              Captions: claim and subtext, matched by position
            </Label>
            {captions && (
              <p className="text-muted-foreground text-xs">
                Captions are matched by shot order. A target that has fewer
                shots gets empty placeholders for the rest.
              </p>
            )}
          </div>

          <div>
            <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              Apply to
            </p>
            <ScrollArea className="max-h-56 rounded-lg border">
              <div className="grid gap-1 p-2">
                {siblings.map((p) => (
                  <Label
                    key={p.id}
                    className="hover:bg-muted/60 items-start gap-3 rounded-md p-2"
                  >
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{p.name}</span>
                      <span className="text-muted-foreground block text-xs font-normal">
                        {captions
                          ? captionEffect(project, p)
                          : `${p.shots.length} ${
                              p.shots.length === 1 ? "shot" : "shots"
                            }`}
                      </span>
                    </span>
                  </Label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={submit} disabled={!canSubmit}>
            Apply to {count} {count === 1 ? "project" : "projects"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
