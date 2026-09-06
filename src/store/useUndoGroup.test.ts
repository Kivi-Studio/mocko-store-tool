import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProjectStore, undo } from "@/store/useProjectStore";
import { useUndoGroup } from "@/store/useUndoGroup";
import { captionFor } from "@/lib/model/caption";

const LANG = "en";

const store = () => useProjectStore.getState();

function seed() {
  const projectId = store().createProject("Test");
  store().addShots(projectId, LANG, ["data:1"]);
  const shotId = store().projects[projectId].shots[0].id;
  return { projectId, shotId };
}

beforeEach(() => {
  useProjectStore.setState({ projects: {}, projectOrder: [] });
  useProjectStore.temporal.getState().clear();
});

describe("useUndoGroup", () => {
  it("groups a burst of updates into a single undo step", () => {
    const { projectId, shotId } = seed();
    const { result } = renderHook(() => useUndoGroup());

    const before = useProjectStore.temporal.getState().pastStates.length;
    act(() => {
      for (const claim of ["a", "ab", "abc"]) {
        result.current.group(() =>
          store().updateShotText(projectId, shotId, LANG, { claim }),
        );
      }
      result.current.end();
    });

    expect(captionFor(store().projects[projectId].shots[0], LANG).claim).toBe(
      "abc",
    );
    expect(useProjectStore.temporal.getState().pastStates.length).toBe(
      before + 1,
    );
    undo();
    expect(captionFor(store().projects[projectId].shots[0], LANG).claim).toBe(
      "",
    );
  });

  it("resumes tracking on unmount mid-burst", () => {
    const { projectId, shotId } = seed();
    const { result, unmount } = renderHook(() => useUndoGroup());

    act(() => {
      result.current.group(() =>
        store().updateShotText(projectId, shotId, LANG, { claim: "x" }),
      );
    });
    unmount();

    // After unmount the next change must be tracked again.
    const before = useProjectStore.temporal.getState().pastStates.length;
    store().updateShotText(projectId, shotId, LANG, { claim: "y" });
    expect(useProjectStore.temporal.getState().pastStates.length).toBe(
      before + 1,
    );
  });
});
