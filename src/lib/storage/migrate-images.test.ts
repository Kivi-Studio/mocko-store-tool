import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  migrateProjectToImageStore,
  referencedImageIds,
} from "@/lib/storage/migrate-images";
import { getImageBlob } from "@/lib/storage/image-store";
import { makeProject } from "@/lib/model/defaults";
import type { Project } from "@/lib/model/types";

const PNG_A = "data:image/png;base64,iVBORw0KGgo=";
const PNG_B = "data:image/png;base64,AAAAAAAA";

/** A project in the pre-migration shape: screenshots inline as data URLs. */
const legacy = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  name: "Telly (iOS) (DE)",
  createdAt: 1,
  updatedAt: 2,
  presetId: "ios-6-9",
  background: { type: "solid", color: "#000000" },
  text: {},
  device: {},
  shots: [
    {
      id: "s1",
      image: PNG_A,
      claim: "Hi",
      sub: "",
      offX: 0,
      offY: 0,
      scale: null,
    },
  ],
  ...overrides,
});

describe("migrateProjectToImageStore", () => {
  it("replaces an inline screenshot with its content id and stores the bytes", async () => {
    const project = await migrateProjectToImageStore(legacy());
    const shot = project.shots[0];

    expect(shot.imageId).toMatch(/^[0-9a-f]{64}$/);
    expect(await getImageBlob(shot.imageId)).not.toBeNull();
    // The rest of the shot survives untouched.
    expect(shot).toMatchObject({ id: "s1", claim: "Hi" });
    // The legacy key is gone, not merely ignored.
    expect("image" in shot).toBe(false);
  });

  it("collapses the same screenshot across projects onto one id", async () => {
    const a = await migrateProjectToImageStore(legacy());
    const b = await migrateProjectToImageStore(legacy({ id: "p2" }));
    expect(b.shots[0].imageId).toBe(a.shots[0].imageId);
  });

  it("gives different screenshots different ids", async () => {
    const a = await migrateProjectToImageStore(legacy());
    const b = await migrateProjectToImageStore(
      legacy({
        shots: [
          {
            id: "s1",
            image: PNG_B,
            claim: "",
            sub: "",
            offX: 0,
            offY: 0,
            scale: null,
          },
        ],
      }),
    );
    expect(b.shots[0].imageId).not.toBe(a.shots[0].imageId);
  });

  it("migrates an image background and leaves other backgrounds alone", async () => {
    const withImage = await migrateProjectToImageStore(
      legacy({ background: { type: "image", image: PNG_A } }),
    );
    expect(withImage.background).toEqual({
      type: "image",
      imageId: withImage.shots[0].imageId,
    });

    const gradient = { type: "gradient", from: "#000", to: "#fff", angle: 90 };
    const withGradient = await migrateProjectToImageStore(
      legacy({ background: gradient }),
    );
    expect(withGradient.background).toEqual(gradient);
  });

  it("keeps an empty shot empty and survives a missing image key", async () => {
    const project = await migrateProjectToImageStore(
      legacy({
        shots: [
          {
            id: "s1",
            image: null,
            claim: "",
            sub: "",
            offX: 0,
            offY: 0,
            scale: null,
          },
          { id: "s2", claim: "", sub: "", offX: 0, offY: 0, scale: null },
        ],
      }),
    );
    expect(project.shots[0].imageId).toBeNull();
    expect(project.shots[1].imageId).toBeNull();
  });

  it("defaults folderId for a v4 project that predates folders", async () => {
    const project = await migrateProjectToImageStore(legacy());
    expect(project.folderId).toBeNull();
  });

  it("keeps an existing folder membership", async () => {
    const project = await migrateProjectToImageStore(
      legacy({ folderId: "f1" }),
    );
    expect(project.folderId).toBe("f1");
  });
});

describe("referencedImageIds", () => {
  const withShots = (ids: (string | null)[], bg?: string | null): Project => {
    const p = makeProject("P");
    p.shots = ids.map((imageId, i) => ({
      id: `s${i}`,
      imageId,
      claim: "",
      sub: "",
      offX: 0,
      offY: 0,
      scale: null,
    }));
    if (bg !== undefined) p.background = { type: "image", imageId: bg };
    return p;
  };

  it("collects shot and background ids, skipping empty ones", () => {
    const ids = referencedImageIds({
      a: withShots(["one", null, "two"], "bg"),
      b: withShots(["two"]),
    });
    expect([...ids].sort()).toEqual(["bg", "one", "two"]);
  });

  it("ignores an image background with no image chosen", () => {
    expect(referencedImageIds({ a: withShots([], null) }).size).toBe(0);
  });

  it("returns nothing for an empty library", () => {
    expect(referencedImageIds({}).size).toBe(0);
  });
});
