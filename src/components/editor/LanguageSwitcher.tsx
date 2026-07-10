"use client";

import { useState } from "react";
import { Languages, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Language, Project } from "@/lib/types";
import { LOCALES, isValidLangCode } from "@/lib/locales";
import { MAX_LANGUAGES } from "@/lib/limits";
import { useProjectStore } from "@/store/useProjectStore";
import { useLanguage } from "./LanguageContext";
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

const CUSTOM = "custom";

/** Active-language picker + a button opening the manage-languages dialog. */
export function LanguageSwitcher({ project }: { project: Project }) {
  const { language, setLanguage } = useLanguage();
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={language}
        onValueChange={(v) => setLanguage(String(v))}
        items={project.languages.map((l) => ({
          value: l.code,
          label: l.label,
        }))}
      >
        <SelectTrigger className="h-8 w-44" aria-label="Active language">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {project.languages.map((l) => (
            <SelectItem key={l.code} value={l.code}>
              {l.label}
              {l.code === project.defaultLanguage ? " · default" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Manage languages"
        onClick={() => setManageOpen(true)}
      >
        <Languages className="size-4" />
      </Button>
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          {/* Mounted only while open so the add-form state resets each time. */}
          {manageOpen && <ManageLanguages project={project} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ManageLanguages({ project }: { project: Project }) {
  const addLanguage = useProjectStore((s) => s.addLanguage);
  const removeLanguage = useProjectStore((s) => s.removeLanguage);
  const setDefaultLanguage = useProjectStore((s) => s.setDefaultLanguage);
  const { setLanguage } = useLanguage();

  const usedCodes = new Set(project.languages.map((l) => l.code));
  const available = LOCALES.filter((l) => !usedCodes.has(l.code));
  const atMax = project.languages.length >= MAX_LANGUAGES;

  // Start on the first available locale (or the custom option when none left).
  const [choice, setChoice] = useState<string>(available[0]?.code ?? CUSTOM);
  const [customCode, setCustomCode] = useState("");
  const [customLabel, setCustomLabel] = useState("");

  const handleAdd = () => {
    if (atMax) {
      toast.error(`At most ${MAX_LANGUAGES} languages`);
      return;
    }
    let lang: Language | null = null;
    if (choice === CUSTOM) {
      const code = customCode.trim();
      const label = customLabel.trim() || code;
      if (!isValidLangCode(code)) {
        toast.error("Enter a valid language code (e.g. sv, pt-BR)");
        return;
      }
      if (usedCodes.has(code)) {
        toast.error("That language is already added");
        return;
      }
      lang = { code, label };
    } else {
      const found = LOCALES.find((l) => l.code === choice);
      if (found) lang = { ...found };
    }
    if (!lang) {
      toast.error("Choose a language to add");
      return;
    }
    addLanguage(project.id, lang);
    setLanguage(lang.code);
    // Move the picker to the next still-available locale.
    const remaining = available.filter((l) => l.code !== lang!.code);
    setChoice(remaining[0]?.code ?? CUSTOM);
    setCustomCode("");
    setCustomLabel("");
  };

  const addItems = [
    ...available.map((l) => ({
      value: l.code,
      label: `${l.label} (${l.code})`,
    })),
    { value: CUSTOM, label: "Custom…" },
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle>Languages</DialogTitle>
        <DialogDescription>
          Each language keeps its own claim &amp; subtext per screenshot.
        </DialogDescription>
      </DialogHeader>

      <ul className="space-y-1">
        {project.languages.map((l) => {
          const isDefault = l.code === project.defaultLanguage;
          return (
            <li
              key={l.code}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5"
            >
              <span className="flex-1 truncate text-sm">
                {l.label}{" "}
                <span className="text-muted-foreground text-xs">
                  ({l.code})
                </span>
              </span>
              <Button
                variant={isDefault ? "secondary" : "ghost"}
                size="sm"
                disabled={isDefault}
                onClick={() => setDefaultLanguage(project.id, l.code)}
              >
                <Star className="size-3.5" />
                {isDefault ? "Default" : "Set default"}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${l.label}`}
                disabled={project.languages.length <= 1}
                onClick={() => removeLanguage(project.id, l.code)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2 border-t pt-3">
        <Label className="text-muted-foreground text-xs">Add language</Label>
        <div className="flex gap-2">
          <Select
            value={choice}
            onValueChange={(v) => setChoice(String(v))}
            items={addItems}
          >
            <SelectTrigger className="w-full" aria-label="Language to add">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {addItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={atMax}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
        {choice === CUSTOM && (
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              placeholder="Code (e.g. sv)"
              aria-label="Custom language code"
              spellCheck={false}
            />
            <Input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Label (e.g. Swedish)"
              aria-label="Custom language label"
            />
          </div>
        )}
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Done</DialogClose>
      </DialogFooter>
    </>
  );
}
