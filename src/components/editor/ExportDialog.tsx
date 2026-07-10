"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/types";
import { exportProjectZip } from "@/lib/export";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Lets the user pick which languages to include in the ZIP export. */
export function ExportDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open so the selection resets each time. */}
        {open && (
          <ExportDialogBody
            project={project}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExportDialogBody({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const allCodes = project.languages.map((l) => l.code);
  const [selected, setSelected] = useState<string[]>(allCodes);
  const [exporting, setExporting] = useState(false);

  const toggle = (code: string) =>
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  const handleExport = async () => {
    if (selected.length === 0) {
      toast.error("Select at least one language");
      return;
    }
    setExporting(true);
    try {
      // Export in the project's language order, not click order.
      const ordered = allCodes.filter((c) => selected.includes(c));
      await exportProjectZip(project, ordered);
      toast.success(
        `Exported ${project.shots.length} screenshot(s) × ${ordered.length} language(s)`,
      );
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Export screenshots</DialogTitle>
        <DialogDescription>
          Choose the languages to export. Multiple languages are grouped into
          per-language folders inside the ZIP.
        </DialogDescription>
      </DialogHeader>

      <ul className="space-y-1">
        {project.languages.map((l) => (
          <li key={l.code}>
            <label className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(l.code)}
                onChange={() => toggle(l.code)}
              />
              <span className="flex-1">{l.label}</span>
              <span className="text-muted-foreground text-xs">{l.code}</span>
            </label>
          </li>
        ))}
      </ul>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button onClick={() => void handleExport()} disabled={exporting}>
          <Download className="size-4" />
          {exporting ? "Exporting…" : "Export ZIP"}
        </Button>
      </DialogFooter>
    </>
  );
}
