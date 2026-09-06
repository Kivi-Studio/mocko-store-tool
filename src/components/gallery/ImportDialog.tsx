"use client";

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

/**
 * Asks how to bring in an imported workspace: merge it with the current setup,
 * or replace everything. Shown only for multi-project / folder archives, and
 * only when the workspace already has content. A single loose project is added
 * without prompting, and so is any backup landing in an empty workspace, where
 * both answers would do the same thing.
 */
export function ImportChoiceDialog({
  open,
  onOpenChange,
  projectCount,
  folderCount,
  onAdd,
  onReplace,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectCount: number;
  folderCount: number;
  onAdd: () => void;
  onReplace: () => void;
}) {
  const summary = [
    `${projectCount} ${projectCount === 1 ? "project" : "projects"}`,
    folderCount > 0
      ? `${folderCount} ${folderCount === 1 ? "folder" : "folders"}`
      : null,
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import backup</DialogTitle>
          <DialogDescription>
            This file contains {summary}. How would you like to import it?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={() => {
              onAdd();
              onOpenChange(false);
            }}
          >
            Add to my projects
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onReplace();
              onOpenChange(false);
            }}
          >
            Replace everything
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          “Replace everything” permanently removes your current projects and
          folders before importing.
        </p>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
