import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProjectStore, undo } from "@/store/useProjectStore";
import { useUndoGroup } from "@/store/useUndoGroup";

const store = () => useProjectStore.getState();

function seed() {
  const projectId = store().createProject("Test");
  store().addShots(projectId, ["data:1"]);
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
          store().updateShot(projectId, shotId, { claim }),
        );
      }
      result.current.end();
    });

    expect(store().projects[projectId].shots[0].claim).toBe("abc");
    expect(useProjectStore.temporal.getState().pastStates.length).toBe(
      before + 1,
    );
    undo();
    expect(store().projects[projectId].shots[0].claim).toBe("");
  });

  it("resumes tracking on unmount mid-burst", () => {
    const { projectId, shotId } = seed();
    const { result, unmount } = renderHook(() => useUndoGroup());

    act(() => {
      result.current.group(() =>
        store().updateShot(projectId, shotId, { claim: "x" }),
      );
    });
    unmount();

    // After unmount the next change must be tracked again.
    const before = useProjectStore.temporal.getState().pastStates.length;
    store().updateShot(projectId, shotId, { claim: "y" });
    expect(useProjectStore.temporal.getState().pastStates.length).toBe(
      before + 1,
    );
  });
});
