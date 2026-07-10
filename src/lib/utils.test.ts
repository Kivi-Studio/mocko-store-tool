import { describe, it, expect } from "vitest";
import { clamp, createId, slugify, uniqueName } from "@/lib/utils";

describe("clamp", () => {
  it("returns min when value is below the range", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("returns the value when within the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("returns max when value is above the range", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("returns the boundary values unchanged", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe("slugify", () => {
  it("lowercases the input", () => {
    expect(slugify("Hello")).toBe("hello");
  });

  it("replaces runs of non-alphanumerics with a single dash", () => {
    expect(slugify("Hello   World")).toBe("hello-world");
    expect(slugify("a@@@b")).toBe("a-b");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world");
    expect(slugify("!!Hello!!")).toBe("hello");
  });

  it('returns "design" for empty input', () => {
    expect(slugify("")).toBe("design");
  });

  it('returns "design" for all-symbol input', () => {
    expect(slugify("!!!")).toBe("design");
    expect(slugify("   ")).toBe("design");
  });
});

describe("uniqueName", () => {
  it("returns the name unchanged when it is free", () => {
    expect(uniqueName("Projekt 1", [])).toBe("Projekt 1");
    expect(uniqueName("Projekt 1", ["Anderes"])).toBe("Projekt 1");
  });

  it('appends " (2)" on the first collision', () => {
    expect(uniqueName("Projekt", ["Projekt"])).toBe("Projekt (2)");
  });

  it("skips suffixes that are already taken", () => {
    expect(uniqueName("X", ["X", "X (2)"])).toBe("X (3)");
    expect(uniqueName("X", ["X", "X (2)", "X (3)"])).toBe("X (4)");
  });

  it("accepts any iterable of taken names", () => {
    expect(uniqueName("X", new Set(["X"]))).toBe("X (2)");
  });
});

describe("createId", () => {
  it("returns a non-empty string", () => {
    const id = createId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns distinct ids on consecutive calls", () => {
    expect(createId()).not.toBe(createId());
  });
});
