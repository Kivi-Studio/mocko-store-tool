import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { set } from "idb-keyval";
import { createIdbStorage, flushPendingWrites } from "@/lib/storage/idb-storage";

describe("idb storage", () => {
  const storage = createIdbStorage<{ n: number }>();

  it("round-trips a persisted value through the debounced write", async () => {
    storage.setItem("k1", { state: { n: 1 }, version: 5 });
    await flushPendingWrites();
    expect(await storage.getItem("k1")).toEqual({
      state: { n: 1 },
      version: 5,
    });
  });

  it("coalesces rapid writes into the latest value", async () => {
    storage.setItem("k2", { state: { n: 1 }, version: 5 });
    storage.setItem("k2", { state: { n: 2 }, version: 5 });
    storage.setItem("k2", { state: { n: 3 }, version: 5 });
    await flushPendingWrites();
    expect(await storage.getItem("k2")).toEqual({
      state: { n: 3 },
      version: 5,
    });
  });

  it("still reads legacy JSON-string values", async () => {
    await set("legacy", JSON.stringify({ state: { n: 7 }, version: 4 }));
    expect(await storage.getItem("legacy")).toEqual({
      state: { n: 7 },
      version: 4,
    });
  });

  it("removeItem drops both pending and stored values", async () => {
    storage.setItem("k3", { state: { n: 1 }, version: 5 });
    await flushPendingWrites();
    storage.setItem("k3", { state: { n: 2 }, version: 5 });
    await storage.removeItem("k3");
    await flushPendingWrites();
    expect(await storage.getItem("k3")).toBeNull();
  });
});
