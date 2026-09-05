"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { filesToImageIds } from "@/lib/storage/upload";
import { useProjectStore } from "@/store/useProjectStore";

/**
 * Returns a handler that validates and appends dropped/selected image files to
 * a project, surfacing how many were skipped.
 */
export function useAddShots(projectId: string) {
  const addShots = useProjectStore((s) => s.addShots);
  return useCallback(
    async (files: Iterable<File>) => {
      const { imageIds, failed } = await filesToImageIds(files);
      if (imageIds.length) addShots(projectId, imageIds);
      if (failed) {
        toast.error(
          `${failed} file${failed > 1 ? "s" : ""} skipped (unsupported type or too large)`,
        );
      }
    },
    [projectId, addShots],
  );
}
