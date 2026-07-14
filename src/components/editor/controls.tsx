"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { HexColorPicker } from "react-colorful";
import { isHexColor } from "@/lib/model/color";
import { cn } from "@/lib/utils";
import { useUndoGroup } from "@/store/useUndoGroup";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * A color swatch that opens a hex color picker in a popover. Free-text input is
 * kept locally while typing and only committed once it is a valid hex color —
 * values land in inline CSS and on the canvas, so anything else must never
 * reach the store.
 */
export function ColorField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}) {
  const { group } = useUndoGroup();
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  // Sync the draft when the committed value changes from outside.
  if (prevValue !== value) {
    setPrevValue(value);
    setDraft(value);
  }

  const commitDraft = (raw: string) => {
    setDraft(raw);
    const candidate = raw.trim();
    if (isHexColor(candidate)) {
      group(() => onChange(candidate));
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        aria-label={label ?? "Pick color"}
        className="border-input hover:bg-accent flex h-9 w-full items-center gap-2 rounded-md border bg-transparent px-2 transition-colors"
      >
        <span
          className="size-5 shrink-0 rounded border border-black/10"
          style={{ background: value }}
        />
        <span className="text-muted-foreground font-mono text-xs">{value}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto items-stretch gap-2 p-3">
        <HexColorPicker
          color={value}
          onChange={(color) => group(() => onChange(color))}
        />
        <Input
          value={draft}
          onChange={(e) => commitDraft(e.target.value)}
          aria-label={label ? `${label} (hex)` : "Color (hex)"}
          aria-invalid={!isHexColor(draft.trim())}
          className="h-8 font-mono text-xs"
          spellCheck={false}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * A labeled slider with a live value readout. Single-value only. A whole drag
 * is grouped into a single undo step.
 */
export function LabeledSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
}) {
  const { group, end } = useUndoGroup();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-xs">{label}</Label>
        <span className="text-muted-foreground text-xs tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={label}
        onValueChange={(v) =>
          group(() => onChange(Array.isArray(v) ? v[0] : v))
        }
        onValueCommitted={() => end()}
      />
    </div>
  );
}

/** A generic single-choice segmented control backed by a toggle group. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(v) => {
        const next = v[0] as T | undefined;
        if (next) onChange(next);
      }}
      variant="outline"
      className="w-full"
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="flex-1">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** A row of preset color swatches; the active one is ringed. */
export function SwatchRow({
  value,
  colors,
  onChange,
}: {
  value: string;
  colors: readonly string[];
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn(
            "size-7 rounded-md border-2 transition-shadow",
            value.toLowerCase() === c.toLowerCase()
              ? "border-ring ring-ring/40 ring-2"
              : "border-border",
          )}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

/** A titled section used to group related controls inside a panel. */
export function PanelSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground/70 text-xs font-semibold tracking-wide uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
