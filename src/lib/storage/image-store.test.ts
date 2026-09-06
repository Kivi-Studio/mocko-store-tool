import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  clearImages,
  getImageBlob,
  hasImage,
  hashBytes,
  parseDataUrl,
  putImageBytes,
  putImageDataUrl,
  sweep,
} from "@/lib/storage/image-store";

const bytes = (...values: number[]) => new Uint8Array(values);

/** A 1×1 transparent PNG, as the editor would hand it over. */
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

describe("hashBytes", () => {
  it("is stable and content-dependent", async () => {
    const a = await hashBytes(bytes(1, 2, 3));
    expect(a).toBe(await hashBytes(bytes(1, 2, 3)));
    expect(a).not.toBe(await hashBytes(bytes(1, 2, 4)));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("parseDataUrl", () => {
  it("splits mime and bytes", () => {
    const parsed = parseDataUrl(PNG_DATA_URL);
    expect(parsed?.mime).toBe("image/png");
    expect(parsed!.bytes.length).toBeGreaterThan(0);
  });

  it("rejects anything that is not a base64 data URL", () => {
    expect(parseDataUrl("https://example.com/a.png")).toBeNull();
    expect(parseDataUrl("")).toBeNull();
  });
});

describe("putImage", () => {
  it("returns the content id and stores the bytes with their mime", async () => {
    const id = await putImageBytes(bytes(9, 8, 7), "image/png");
    expect(id).toBe(await hashBytes(bytes(9, 8, 7)));
    const blob = await getImageBlob(id);
    expect(blob?.type).toBe("image/png");
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(bytes(9, 8, 7));
  });

  it("collapses identical bytes onto one entry", async () => {
    const first = await putImageBytes(bytes(4, 4, 4), "image/png");
    const second = await putImageBytes(bytes(4, 4, 4), "image/png");
    expect(second).toBe(first);
  });

  it("stores a data URL and ignores an empty one", async () => {
    const id = await putImageDataUrl(PNG_DATA_URL);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(await hasImage(id!)).toBe(true);
    expect(await putImageDataUrl(null)).toBeNull();
    expect(await putImageDataUrl("not a data url")).toBeNull();
  });
});

describe("getImageBlob", () => {
  it("returns null for an unknown or empty id", async () => {
    expect(await getImageBlob(null)).toBeNull();
    expect(await getImageBlob("0".repeat(64))).toBeNull();
  });
});

describe("sweep", () => {
  it("keeps referenced images and drops the rest", async () => {
    const keep = await putImageBytes(bytes(1, 1), "image/png");
    const drop = await putImageBytes(bytes(2, 2), "image/png");

    const removed = await sweep([keep]);

    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await hasImage(keep)).toBe(true);
    expect(await hasImage(drop)).toBe(false);
  });

  it("keeps an image that only one of several references still holds", async () => {
    const shared = await putImageBytes(bytes(3, 3), "image/png");
    // Two releases referenced it; one is deleted, the other still points at it.
    await sweep([shared, shared]);
    expect(await hasImage(shared)).toBe(true);
  });
});

describe("clearImages", () => {
  it("drops every image, referenced or not", async () => {
    const a = await putImageBytes(bytes(5, 5), "image/png");
    const b = await putImageBytes(bytes(6, 6), "image/png");
    await clearImages();
    expect(await hasImage(a)).toBe(false);
    expect(await hasImage(b)).toBe(false);
    // The store keeps working afterwards.
    const c = await putImageBytes(bytes(7, 7), "image/png");
    expect(await hasImage(c)).toBe(true);
  });
});
