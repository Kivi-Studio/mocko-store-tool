"use client";

import { useState } from "react";
import type { Folder } from "@/lib/model/types";
import { folderGroupKey, parseVersionedName } from "@/lib/model/version";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
 * Files a folder under an app explicitly.
 *
 * Grouping normally comes from the folder name — "Telly 1.3.0" lands under
 * "Telly" — which covers the common case without any bookkeeping. This is the
 * escape hatch for the folders that do not follow the convention: leaving the
 * field empty restores the name-derived grouping.
 */
export function AssignAppDialog({
  open,
  onOpenChange,
  folder,
  appNames,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder;
  /** Apps that already exist, offered as one-click suggestions. */
  appNames: readonly string[];
  onSubmit: (appName: string | null) => void;
}) {
  const [draft, setDraft] = useState(folder.appName ?? "");

  const derived = parseVersionedName(folder.name).base;
  const trimmed = draft.trim();
  const resulting = trimmed || derived;
  const suggestions = appNames.filter((n) => n !== trimmed);

  const submit = () => {
    onSubmit(trimmed || null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign to app</DialogTitle>
          <DialogDescription>
            “{folder.name}” is currently filed under “{folderGroupKey(folder)}”.
            Folders group by their name automatically — set this only when the
            name does not say which app it belongs to.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Label htmlFor="app-name">App</Label>
          <Input
            id="app-name"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={derived}
            autoFocus
          />
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">Existing:</span>
              {suggestions.map((name) => (
                <Button
                  key={name}
                  variant="outline"
                  size="sm"
                  onClick={() => setDraft(name)}
                >
                  {name}
                </Button>
              ))}
            </div>
          )}
          <p className="text-muted-foreground text-sm">
            {trimmed ? (
              <>
                Files under <span className="text-foreground">{resulting}</span>
                . The folder keeps its name.
              </>
            ) : (
              <>
                Empty — grouping falls back to the folder name, so this lands
                under <span className="text-foreground">{derived}</span>.
              </>
            )}
          </p>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
