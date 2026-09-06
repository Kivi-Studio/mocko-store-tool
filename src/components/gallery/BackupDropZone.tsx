"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

/**
 * Makes the whole gallery page a drop target for a `.studio` backup.
 *
 * It listens on the window instead of wrapping the content: a file dropped on
 * the page margin counts too, and a stray drop anywhere no longer makes the
 * browser open the file and leave the app. Only drags that carry files are
 * handled, so dragging a project card onto a folder neither shows the overlay
 * nor reaches `onFile`. What the file contains is checked by the import.
 */
export function BackupDropZone({ onFile }: { onFile: (file: File) => void }) {
  const [active, setActive] = useState(false);
  // Enter and leave fire for every element the cursor crosses. The drag is
  // still over the page as long as more elements were entered than left.
  const depth = useRef(0);
  const handleFile = useEffectEvent((file: File) => onFile(file));

  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      e.dataTransfer?.types.includes("Files") ?? false;

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setActive(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      // Without this the browser refuses the drop and opens the file instead.
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setActive(false);
      const files = e.dataTransfer ? [...e.dataTransfer.files] : [];
      if (files.length === 0) return;
      // The order of a multi-file drop is up to the OS, so picking "the first"
      // would import an arbitrary one. Better to take none and say so.
      if (files.length > 1) {
        toast.error("Drop one backup at a time");
        return;
      }
      handleFile(files[0]);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  if (!active) return null;
  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="border-primary/60 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-12 py-10 text-center">
        <Upload className="text-primary size-10" />
        <p className="text-lg font-medium">Drop to import backup</p>
        <p className="text-muted-foreground text-sm">
          A <span className="font-medium">.studio</span> file, one at a time
        </p>
      </div>
    </div>
  );
}
