"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FileDown,
  Layers,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Design } from "@/lib/types";
import { useDesignStore } from "@/store/useDesignStore";
import { exportDesignFile } from "@/lib/project-file";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CanvasThumbnail } from "./CanvasThumbnail";
import { ConfirmDeleteDialog, RenameDialog } from "./dialogs";

export function DesignCard({
  design,
  index,
  total,
}: {
  design: Design;
  index: number;
  total: number;
}) {
  const router = useRouter();
  const renameDesign = useDesignStore((s) => s.renameDesign);
  const duplicateDesign = useDesignStore((s) => s.duplicateDesign);
  const deleteDesign = useDesignStore((s) => s.deleteDesign);
  const moveDesign = useDesignStore((s) => s.moveDesign);
  // Only the cover is rendered — subscribing to the whole storebilder map
  // would re-render every card (and its full-res thumbnail) on any edit.
  const cover = useDesignStore((s) =>
    design.storebildIds.map((id) => s.storebilder[id]).find(Boolean),
  );

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const count = design.storebildIds.length;

  const handleExport = async () => {
    // Read the full list lazily; the card itself only subscribes to the cover.
    const { storebilder } = useDesignStore.getState();
    const items = design.storebildIds
      .map((id) => storebilder[id])
      .filter(Boolean);
    try {
      await exportDesignFile(items, design.name);
      toast.success("Design exportiert");
    } catch (error) {
      console.error(error);
      toast.error("Export fehlgeschlagen");
    }
  };

  return (
    <div className="group bg-card overflow-hidden rounded-xl border transition-shadow hover:shadow-md">
      <Link
        href={`/design/${design.id}`}
        className="bg-muted/40 flex h-[280px] items-center justify-center p-4"
        aria-label={`${design.name} öffnen`}
      >
        {cover ? (
          <CanvasThumbnail storebild={cover} height={240} />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2">
            <Layers className="size-8" />
            <span className="text-xs">Leeres Design</span>
          </div>
        )}
      </Link>

      <div className="flex items-center justify-between gap-2 border-t p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{design.name}</p>
          <p className="text-muted-foreground text-xs">
            {count} {count === 1 ? "Storebild" : "Storebilder"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Nach vorne verschieben"
            disabled={index === 0}
            onClick={() => moveDesign(design.id, -1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Nach hinten verschieben"
            disabled={index === total - 1}
            onClick={() => moveDesign(design.id, 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Aktionen"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
              )}
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push(`/design/${design.id}`)}
              >
                <Pencil className="size-4" />
                Öffnen
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const newId = duplicateDesign(design.id);
                  if (newId) router.push(`/design/${newId}`);
                }}
              >
                <Copy className="size-4" />
                Duplizieren
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <Pencil className="size-4" />
                Umbenennen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                <FileDown className="size-4" />
                Exportieren
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Design umbenennen"
        initialName={design.name}
        onSubmit={(name) => renameDesign(design.id, name)}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Design löschen?"
        description={`„${design.name}“ und alle ${count} Storebilder darin werden dauerhaft entfernt.`}
        onConfirm={() => deleteDesign(design.id)}
      />
    </div>
  );
}
