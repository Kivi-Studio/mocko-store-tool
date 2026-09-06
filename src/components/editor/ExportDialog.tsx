"use client";

import { useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/model/types";
import { imageIdFor } from "@/lib/model/caption";
import { exportProjectZip } from "@/lib/render/export";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
 * Picks the languages to export.
 *
 * Every chosen language gets every position, including ones it has no
 * screenshot for. Dropping those would renumber the rest and quietly ship a
 * short listing. So the gap is named here instead, before the ZIP is built.
 */
export function ExportDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(project.languages.map((l) => l.code)),
  );
  const [exporting, setExporting] = useState(false);

  const toggle = (code: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const missingFor = (code: string) =>
    project.shots.filter((shot) => imageIdFor(shot, code) === null).length;

  const count = selected.size;
  const canExport = count > 0 && project.shots.length > 0 && !exporting;

  const run = async () => {
    setExporting(true);
    try {
      await exportProjectZip(project, [...selected]);
      toast.success(
        `Exported ${project.shots.length} screenshot(s) in ${count} language(s)`,
      );
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            {project.shots.length} position
            {project.shots.length === 1 ? "" : "s"} per language.
            {count > 1 && " Each language gets its own folder in the ZIP."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {project.languages.map((l) => {
            const missing = missingFor(l.code);
            return (
              <Label
                key={l.code}
                className="hover:bg-muted/60 items-start gap-3 rounded-md border p-3"
              >
                <Checkbox
                  checked={selected.has(l.code)}
                  onCheckedChange={() => toggle(l.code)}
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="block">{l.label}</span>
                  <span className="text-muted-foreground block text-xs font-normal">
                    {l.code}
                  </span>
                  {missing > 0 && selected.has(l.code) && (
                    <span className="text-destructive mt-1 flex items-center gap-1 text-xs font-normal">
                      <AlertTriangle className="size-3.5" />
                      {missing} position{missing === 1 ? "" : "s"} without a
                      screenshot
                    </span>
                  )}
                </span>
              </Label>
            );
          })}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={() => void run()} disabled={!canExport}>
            <Download className="size-4" />
            {exporting ? "Exporting…" : `Export ${count} language(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
