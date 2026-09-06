"use client";

import { Download } from "lucide-react";
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
 * The last confirmation before the whole library goes. It names what is about
 * to be deleted and offers the export right here: the moment of deleting is
 * when a missing backup is noticed, and a `.studio` file is the only way back
 * once the button is pressed.
 */
export function WipeDialog({
  open,
  onOpenChange,
  projectCount,
  folderCount,
  onExport,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectCount: number;
  folderCount: number;
  onExport: () => void;
  onConfirm: () => void;
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
          <DialogTitle>Delete everything?</DialogTitle>
          <DialogDescription>
            {projectCount > 0
              ? `This removes ${summary} and every screenshot from this browser, along with anything an older version of Mocko left behind.`
              : "Your workspace is empty. This still clears stored screenshots and anything an older version of Mocko left behind."}{" "}
            There is no undo.
          </DialogDescription>
        </DialogHeader>
        {projectCount > 0 && (
          <div className="bg-muted/40 flex items-center justify-between gap-3 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">
              A <span className="font-medium">.studio</span> backup is the only
              way back.
            </p>
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="size-4" />
              Export backup
            </Button>
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Delete everything
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
