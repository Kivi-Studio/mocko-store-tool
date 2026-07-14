"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { filesToDataUrls } from "@/lib/storage/upload";
import { useProjectStore } from "@/store/useProjectStore";

/**
 * Returns a handler that validates and appends dropped/selected image files to
 * a project, surfacing how many were skipped.
 */
export function useAddShots(projectId: string) {
  const addShots = useProjectStore((s) => s.addShots);
  return useCallback(
    async (files: Iterable<File>) => {
      const { images, failed } = await filesToDataUrls(files);
      if (images.length) addShots(projectId, images);
      if (failed) {
        toast.error(
          `${failed} file${failed > 1 ? "s" : ""} skipped (unsupported type or too large)`,
        );
      }
    },
    [projectId, addShots],
  );
}
