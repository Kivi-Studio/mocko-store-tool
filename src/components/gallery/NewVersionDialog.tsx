"use client";

import { useState } from "react";
import type { Folder } from "@/lib/model/types";
import type { FolderCopyOptions } from "@/store/useProjectStore";
import {
  type BumpKind,
  formatVersion,
  formatVersionedName,
  parseVersion,
  parseVersionedName,
  suggestNextVersion,
} from "@/lib/model/version";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BUMPS: { kind: BumpKind; label: string }[] = [
  { kind: "major", label: "Major" },
  { kind: "minor", label: "Minor" },
  { kind: "patch", label: "Patch" },
];

/**
 * Snapshots a release folder under a new version name: the one-step
 * replacement for exporting a folder, re-importing it and renaming the copy.
 *
 * The app name and version are edited separately so the version can be bumped
 * with one click; the resulting folder name is shown before committing. Mount
 * with a `key` that changes on open so the draft always starts from the
 * source folder's current name.
 */
export function NewVersionDialog({
  open,
  onOpenChange,
  folder,
  projectCount,
  takenNames,
  baseName,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder;
  projectCount: number;
  takenNames: readonly string[];
  /**
   * App name to prefill, when it is known independently of the folder name.
   * A folder pulled into an app via `appName` may not carry it in its own name.
   * Defaults to the base parsed from the source folder.
   */
  baseName?: string;
  onSubmit: (name: string, options: FolderCopyOptions) => void;
}) {
  const [base, setBase] = useState(
    () => baseName ?? parseVersionedName(folder.name).base,
  );
  const [versionText, setVersionText] = useState(() =>
    formatVersion(suggestNextVersion(folder.name, "minor")),
  );
  const [keepImages, setKeepImages] = useState(true);
  const [keepCaptions, setKeepCaptions] = useState(true);

  const version = parseVersion(versionText);
  const name = version ? formatVersionedName(base, version) : "";
  const isDuplicate = name !== "" && takenNames.includes(name);
  const canSubmit = version !== null && name !== "" && !isDuplicate;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(name, { keepImages, keepCaptions });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New version</DialogTitle>
          <DialogDescription>
            Copies “{folder.name}” and its {projectCount}{" "}
            {projectCount === 1 ? "project" : "projects"} into a new folder. The
            original stays untouched.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="version-base">App name</Label>
            <Input
              id="version-base"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="version-number">Version</Label>
            <div className="flex items-center gap-2">
              <Input
                id="version-number"
                value={versionText}
                onChange={(e) => setVersionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                aria-invalid={version === null || undefined}
                className="w-28"
                inputMode="decimal"
              />
              <ToggleGroup
                variant="outline"
                size="sm"
                // Momentary buttons, not a selection: each click just fills the
                // version field from the source folder's name.
                value={[]}
                onValueChange={(v) => {
                  const kind = v[0] as BumpKind | undefined;
                  if (kind) {
                    setVersionText(
                      formatVersion(suggestNextVersion(folder.name, kind)),
                    );
                  }
                }}
                aria-label="Bump version"
              >
                {BUMPS.map(({ kind, label }) => (
                  <ToggleGroupItem key={kind} value={kind}>
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          <p className="text-muted-foreground text-sm">
            New folder:{" "}
            {version ? (
              <span className="text-foreground font-medium">{name}</span>
            ) : (
              <span className="text-destructive">
                enter a version like 1.3.0
              </span>
            )}
          </p>
          {isDuplicate && (
            <p className="text-destructive text-sm">
              A folder with that name already exists.
            </p>
          )}

          <div className="grid gap-3 rounded-lg border p-3">
            <Label className="gap-3">
              <Checkbox checked={keepImages} onCheckedChange={setKeepImages} />
              Keep screenshots
            </Label>
            <Label className="gap-3">
              <Checkbox
                checked={keepCaptions}
                onCheckedChange={setKeepCaptions}
              />
              Keep captions
            </Label>
            {!keepImages && (
              <p className="text-muted-foreground text-xs">
                The shots stay as empty placeholders, so the count, order and
                per-shot layout survive. Drop the new screenshots in.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={submit} disabled={!canSubmit}>
            Create version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
