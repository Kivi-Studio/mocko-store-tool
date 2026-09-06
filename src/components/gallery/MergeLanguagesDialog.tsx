"use client";

import { useState } from "react";
import { Merge } from "lucide-react";
import type { Language, Project } from "@/lib/model/types";
import { LOCALES, labelForCode } from "@/lib/model/locales";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Folds a release's per-language projects into one project per store format.
 *
 * Nothing is inferred from the project names: you tick the projects that are
 * the same listing and say which language each one is. Names from the
 * one-project-per-language era were written in whatever way suited at the time,
 * and a rule that reads them all correctly is a rule that will eventually read
 * one wrongly, so this asks instead.
 *
 * The dialog stays open after a merge and the list shrinks, so a folder is
 * worked through in one sitting.
 */
export function MergeLanguagesDialog({
  open,
  onOpenChange,
  projects,
  onMerge,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The folder's projects, live from the store, in gallery order. */
  projects: Project[];
  onMerge: (parts: { id: string; language: Language }[], name: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  // Only a project holding exactly one language can be reassigned; one that
  // already maintains several is a finished merge and has nothing to state.
  const candidates = projects.filter((p) => p.languages.length === 1);
  const done = projects.filter((p) => p.languages.length > 1);

  const codeOf = (p: Project) => codes[p.id] ?? p.languages[0].code;

  const toggle = (project: Project) => {
    const next = new Set(selected);
    if (next.has(project.id)) next.delete(project.id);
    else next.add(project.id);
    setSelected(next);
    if (!nameTouched) {
      const first = projects.find((p) => next.has(p.id));
      setName(first ? first.name : "");
    }
  };

  const parts = projects
    .filter((p) => selected.has(p.id))
    .map((p) => ({
      id: p.id,
      language: { code: codeOf(p), label: labelForCode(codeOf(p)) },
    }));

  const duplicateCode =
    new Set(parts.map((p) => p.language.code)).size !== parts.length;
  const canMerge = parts.length >= 2 && name.trim() !== "" && !duplicateCode;

  const submit = () => {
    if (!canMerge) return;
    onMerge(parts, name.trim());
    setSelected(new Set());
    setName("");
    setNameTouched(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge by language</DialogTitle>
          <DialogDescription>
            Tick the projects that are the same listing in different languages
            and say which language each one is. They become one project;
            positions are matched by order.
          </DialogDescription>
        </DialogHeader>

        {candidates.length < 2 ? (
          <p className="text-muted-foreground text-sm">
            This folder has nothing left to merge.
          </p>
        ) : (
          <div className="grid gap-4">
            <ScrollArea className="max-h-64 rounded-lg border">
              <div className="grid gap-1 p-2">
                {candidates.map((p) => (
                  <div
                    key={p.id}
                    className="hover:bg-muted/60 flex items-center gap-3 rounded-md p-2"
                  >
                    <Label className="min-w-0 flex-1 gap-3">
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggle(p)}
                      />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    </Label>
                    <Select
                      value={codeOf(p)}
                      onValueChange={(v) =>
                        setCodes((prev) => ({ ...prev, [p.id]: String(v) }))
                      }
                    >
                      <SelectTrigger
                        aria-label={`Language of ${p.name}`}
                        className="w-40"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCALES.map((l) => (
                          <SelectItem key={l.code} value={l.code}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="grid gap-2">
              <Label htmlFor="merged-name">Name of the merged project</Label>
              <Input
                id="merged-name"
                value={name}
                placeholder="e.g. Telly (iOS)"
                onChange={(e) => {
                  setName(e.target.value);
                  setNameTouched(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
              {duplicateCode && (
                <p className="text-destructive text-sm">
                  Two of the selected projects are set to the same language.
                </p>
              )}
            </div>

            {done.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Already merged:{" "}
                {done
                  .map(
                    (p) =>
                      `${p.name} (${p.languages.map((l) => l.code).join(", ")})`,
                  )
                  .join(" · ")}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          {candidates.length >= 2 && (
            <Button onClick={submit} disabled={!canMerge}>
              <Merge className="size-4" />
              Merge {parts.length} projects
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
