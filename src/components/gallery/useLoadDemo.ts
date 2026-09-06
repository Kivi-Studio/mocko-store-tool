"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/store/useProjectStore";
import {
  fetchDemoWorkspace,
  isDemoPresent,
  type DemoLanguage,
} from "@/lib/storage/demo-workspace";

/**
 * Adds the sample workspace to the library, with `primary` as the default
 * language of its projects. Loading it twice only says that it is already
 * there. Resolves to whether anything was added.
 */
export function useLoadDemo() {
  const importWorkspace = useProjectStore((s) => s.importWorkspace);
  return useCallback(
    async (primary: DemoLanguage): Promise<boolean> => {
      if (isDemoPresent(Object.values(useProjectStore.getState().folders))) {
        toast.info("The sample workspace is already here");
        return false;
      }
      const id = toast.loading("Loading the sample workspace…");
      try {
        importWorkspace(await fetchDemoWorkspace(primary), "add");
        toast.success("Sample workspace loaded", { id });
        return true;
      } catch (error) {
        console.error(error);
        toast.error("Could not load the sample workspace", { id });
        return false;
      }
    },
    [importWorkspace],
  );
}
