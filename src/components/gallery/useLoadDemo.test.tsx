import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { useProjectStore } from "@/store/useProjectStore";
import { makeFolder, makeProject } from "@/lib/model/defaults";
import { fetchDemoWorkspace } from "@/lib/storage/demo-workspace";
import { useLoadDemo } from "@/components/gallery/useLoadDemo";

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/storage/demo-workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage/demo-workspace")>()),
  fetchDemoWorkspace: vi.fn(),
}));

const fetchDemo = vi.mocked(fetchDemoWorkspace);

/** What the file would yield: one release of the sample app with a project. */
const samplePayload = () => {
  const folder = makeFolder("Ridgeline 2.1.0");
  return {
    folders: [folder],
    projects: [makeProject("iPhone 6.9″", folder.id)],
  };
};

beforeEach(() => {
  useProjectStore.setState({
    projects: {},
    projectOrder: [],
    folders: {},
    folderOrder: [],
  });
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("useLoadDemo", () => {
  it("fetches the sample in the requested language and adds it", async () => {
    fetchDemo.mockResolvedValueOnce(samplePayload());
    const { result } = renderHook(() => useLoadDemo());

    await expect(result.current("de")).resolves.toBe(true);

    expect(fetchDemo).toHaveBeenCalledWith("de");
    const { folders, projectOrder } = useProjectStore.getState();
    expect(Object.values(folders).map((f) => f.name)).toEqual([
      "Ridgeline 2.1.0",
    ]);
    expect(projectOrder).toHaveLength(1);
    expect(toast.success).toHaveBeenCalledWith("Sample workspace loaded", {
      id: "toast-id",
    });
  });

  it("does not load it a second time", async () => {
    fetchDemo.mockResolvedValueOnce(samplePayload());
    const { result } = renderHook(() => useLoadDemo());
    await result.current("en");

    await expect(result.current("en")).resolves.toBe(false);

    expect(fetchDemo).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith(
      "The sample workspace is already here",
    );
    expect(useProjectStore.getState().folderOrder).toHaveLength(1);
  });

  it("reports a failed fetch and leaves the workspace alone", async () => {
    fetchDemo.mockRejectedValueOnce(new Error("404"));
    const { result } = renderHook(() => useLoadDemo());

    await expect(result.current("en")).resolves.toBe(false);

    expect(toast.error).toHaveBeenCalledWith(
      "Could not load the sample workspace",
      { id: "toast-id" },
    );
    expect(useProjectStore.getState().folderOrder).toEqual([]);
  });
});
