"use client";

import { useState } from "react";
import { Star, Trash2 } from "lucide-react";
import type { Language, Project } from "@/lib/model/types";
import { LOCALES, isValidLangCode, labelForCode } from "@/lib/model/locales";
import { useProjectStore } from "@/store/useProjectStore";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Adds, removes and reorders the languages a project maintains.
 *
 * The first language is the default (the one the editor opens on), so
 * promoting one is expressed as "make default" rather than as a drag handle.
 * The last remaining language cannot be removed: a project without one could
 * hold no screenshots at all.
 */
export function ManageLanguagesDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}) {
  const addLanguage = useProjectStore((s) => s.addLanguage);
  const removeLanguage = useProjectStore((s) => s.removeLanguage);
  const setDefaultLanguage = useProjectStore((s) => s.setDefaultLanguage);

  const [pick, setPick] = useState("");
  const [customCode, setCustomCode] = useState("");

  const used = new Set(project.languages.map((l) => l.code));
  const available = LOCALES.filter((l) => !used.has(l.code));

  const addPicked = () => {
    const locale = LOCALES.find((l) => l.code === pick);
    if (!locale) return;
    addLanguage(project.id, { ...locale });
    setPick("");
  };

  const trimmedCustom = customCode.trim();
  const customValid =
    isValidLangCode(trimmedCustom) && !used.has(trimmedCustom);
  const addCustom = () => {
    if (!customValid) return;
    addLanguage(project.id, {
      code: trimmedCustom,
      label: labelForCode(trimmedCustom),
    });
    setCustomCode("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Languages</DialogTitle>
          <DialogDescription>
            Each language keeps its own screenshots and captions. Codes are used
            verbatim as export folder and file names.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {project.languages.map((language: Language, i) => (
            <div
              key={language.code}
              className="flex items-center gap-2 rounded-md border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{language.label}</p>
                <p className="text-muted-foreground text-xs">
                  {language.code}
                  {i === 0 && " · default"}
                </p>
              </div>
              {i !== 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDefaultLanguage(project.id, language.code)}
                >
                  <Star className="size-4" />
                  Make default
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${language.label}`}
                disabled={project.languages.length === 1}
                className="text-destructive hover:text-destructive"
                onClick={() => removeLanguage(project.id, language.code)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="grid gap-3 border-t pt-4">
          <div className="grid gap-2">
            <Label>Add a language</Label>
            <div className="flex gap-2">
              <Select value={pick} onValueChange={(v) => setPick(String(v))}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose a locale…" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label} ({l.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addPicked} disabled={!pick}>
                Add
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="custom-lang">Or a custom code</Label>
            <div className="flex gap-2">
              <Input
                id="custom-lang"
                value={customCode}
                placeholder="e.g. fr-CA"
                onChange={(e) => setCustomCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustom();
                }}
                aria-invalid={
                  (trimmedCustom !== "" && !customValid) || undefined
                }
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={addCustom}
                disabled={!customValid}
              >
                Add
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
