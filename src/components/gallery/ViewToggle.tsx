"use client";

import { LayoutGrid, List } from "lucide-react";
import type { ViewMode } from "@/lib/model/types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Segmented control switching the gallery between grid and list layout. */
export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      value={[value]}
      // Single-select: clicking the active item yields an empty array, which we
      // ignore so a mode always stays selected.
      onValueChange={(v) => {
        const next = v[0] as ViewMode | undefined;
        if (next) onChange(next);
      }}
      aria-label="View mode"
    >
      <ToggleGroupItem value="grid" aria-label="Grid view">
        <LayoutGrid className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List view">
        <List className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
