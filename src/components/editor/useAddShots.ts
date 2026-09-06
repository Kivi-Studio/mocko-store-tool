"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { filesToImageIds } from "@/lib/storage/upload";
import { useProjectStore } from "@/store/useProjectStore";
import { useLanguage } from "./LanguageContext";

/**
 * Returns a handler that validates dropped/selected image files and files them
 * under the active language, surfacing how many were skipped.
 *
 * The store fills that language's gaps before appending, so dropping the
 * English set into a project that already has the German one completes the
 * existing positions rather than starting a second run of them.
 */
export function useAddShots(projectId: string) {
  const addShots = useProjectStore((s) => s.addShots);
  const { language } = useLanguage();
  return useCallback(
    async (files: Iterable<File>) => {
      const { imageIds, failed } = await filesToImageIds(files);
      if (imageIds.length) addShots(projectId, language, imageIds);
      if (failed) {
        toast.error(
          `${failed} file${failed > 1 ? "s" : ""} skipped (unsupported type or too large)`,
        );
      }
    },
    [projectId, addShots, language],
  );
}
