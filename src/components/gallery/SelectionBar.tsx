"use client";

import { Download, FolderInput, Home, Trash2, X } from "lucide-react";
import type { Folder } from "@/lib/model/types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Sticky action bar shown while projects are multi-selected. */
export function SelectionBar({
  count,
  folders,
  onExport,
  onMove,
  onDelete,
  onClear,
}: {
  count: number;
  folders: Folder[];
  onExport: () => void;
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="bg-popover text-popover-foreground pointer-events-auto flex items-center gap-2 rounded-full border py-2 pr-2 pl-4 shadow-lg">
        <span className="text-sm font-medium">
          {count} selected
        </span>
        <span className="bg-border mx-1 h-5 w-px" />

        <Button variant="ghost" size="sm" onClick={onExport} disabled={count === 0}>
          <Download className="size-4" />
          Export
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={count === 0}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <FolderInput className="size-4" />
            Move to
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuItem onClick={() => onMove(null)}>
              <Home className="size-4" />
              All projects (root)
            </DropdownMenuItem>
            {folders.length > 0 && <DropdownMenuSeparator />}
            {folders.map((f) => (
              <DropdownMenuItem key={f.id} onClick={() => onMove(f.id)}>
                <FolderInput className="size-4" />
                {f.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={count === 0}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
          Delete
        </Button>

        <span className="bg-border mx-1 h-5 w-px" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClear}
          aria-label="Cancel selection"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
