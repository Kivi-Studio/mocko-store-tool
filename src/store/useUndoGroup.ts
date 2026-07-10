"use client";

import { useCallback, useEffect, useRef } from "react";
import { useProjectStore } from "./useProjectStore";

/**
 * Groups rapid successive store updates into a single undo step.
 *
 * Continuous inputs — slider drags, color-picker drags, typing — fire one
 * store update per tick. Without grouping, a single gesture floods the undo
 * history (limit 100) and undo then walks back tick by tick.
 *
 * The first update of a burst is recorded normally (zundo snapshots the
 * pre-change state), then history tracking is paused. It resumes after
 * `idleMs` without updates, on an explicit `end()` (e.g. slider commit), or
 * on unmount — so one gesture equals one undo step.
 */
export function useUndoGroup(idleMs = 800) {
  const activeRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const end = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (activeRef.current) {
      activeRef.current = false;
      useProjectStore.temporal.getState().resume();
    }
  }, []);

  // Resume tracking if the component unmounts mid-burst.
  useEffect(() => end, [end]);

  const group = useCallback(
    (apply: () => void) => {
      apply();
      if (!activeRef.current) {
        activeRef.current = true;
        useProjectStore.temporal.getState().pause();
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(end, idleMs);
    },
    [end, idleMs],
  );

  return { group, end };
}
