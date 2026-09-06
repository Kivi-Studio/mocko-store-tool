"use client";

import { Download, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A standing reminder that the library exists only in this browser. It is not
 * dismissible on purpose: there is no server copy, and a change to how
 * projects are stored can wipe them, so the way back is always a `.studio`
 * file the user exported earlier.
 */
export function BackupReminder({ onExport }: { onExport: () => void }) {
  return (
    <aside
      role="note"
      aria-label="Backup reminder"
      className="bg-muted/40 mt-10 flex flex-wrap items-center gap-4 rounded-xl border p-4"
    >
      <HardDrive className="text-muted-foreground size-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Your projects live in this browser only.</p>
        <p className="text-muted-foreground">
          There is no account and no server copy. Clearing site data, switching
          browsers, or an update that changes how projects are stored can wipe
          the library. Export a backup every now and then. A{" "}
          <span className="font-medium">.studio</span> file can always be
          imported again.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className="size-4" />
        Export backup
      </Button>
    </aside>
  );
}
