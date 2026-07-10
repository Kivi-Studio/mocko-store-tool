"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
 * Name dialog shared for creating and renaming projects: Enter submits, blank
 * names are ignored. When `takenNames` is given, a name already in that list is
 * rejected (submit disabled + inline hint) — used to keep names unique at
 * creation. Pass the already-trimmed sibling names, excluding the current one
 * when renaming.
 */
export function RenameDialog({
  open,
  onOpenChange,
  title,
  initialName,
  onSubmit,
  takenNames = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialName: string;
  onSubmit: (name: string) => void;
  takenNames?: readonly string[];
}) {
  const [draft, setDraft] = useState(initialName);
  const [prevInitial, setPrevInitial] = useState(initialName);
  // Reset the draft whenever the dialog opens with a new source name.
  if (prevInitial !== initialName) {
    setPrevInitial(initialName);
    setDraft(initialName);
  }

  const trimmed = draft.trim();
  const isDuplicate = takenNames.includes(trimmed);
  const canSubmit = trimmed !== "" && !isDuplicate;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          aria-label="Name"
          aria-invalid={isDuplicate || undefined}
          autoFocus
        />
        {isDuplicate && (
          <p className="text-destructive text-sm">That name already exists.</p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={submit} disabled={!canSubmit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Destructive confirmation dialog shared by the gallery cards. */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
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
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
