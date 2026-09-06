import { describe, it, expect } from "vitest";
import {
  FIRST_VERSION,
  bumpVersion,
  compareVersions,
  folderGroupKey,
  formatVersion,
  formatVersionedName,
  groupFolders,
  parseVersion,
  parseVersionedName,
  suggestNextVersion,
  versionLabel,
} from "@/lib/model/version";

describe("parseVersionedName", () => {
  it("splits a name with a trailing version", () => {
    expect(parseVersionedName("Mocko 1.2.0")).toEqual({
      base: "Mocko",
      version: { major: 1, minor: 2, patch: 0 },
    });
  });

  it("accepts a v prefix, two segments and multi-word names", () => {
    expect(parseVersionedName("My Great App v2.10")).toEqual({
      base: "My Great App",
      version: { major: 2, minor: 10, patch: 0 },
    });
  });

  it("accepts a bare version, leaving the base empty", () => {
    expect(parseVersionedName("1.4.2")).toEqual({
      base: "",
      version: { major: 1, minor: 4, patch: 2 },
    });
  });

  it("keeps a plain name intact", () => {
    expect(parseVersionedName("Marketing")).toEqual({
      base: "Marketing",
      version: null,
    });
  });

  it("does not read a single trailing number as a version", () => {
    // "Angry Birds 2" is a name, not version 2.0.0: a dot is required.
    expect(parseVersionedName("Angry Birds 2")).toEqual({
      base: "Angry Birds 2",
      version: null,
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseVersionedName("  Mocko 1.0.0  ").base).toBe("Mocko");
  });
});

describe("parseVersion", () => {
  it("fills missing segments with zero", () => {
    expect(parseVersion("3")).toEqual({ major: 3, minor: 0, patch: 0 });
    expect(parseVersion("3.1")).toEqual({ major: 3, minor: 1, patch: 0 });
    expect(parseVersion(" v3.1.4 ")).toEqual({ major: 3, minor: 1, patch: 4 });
  });

  it("rejects anything that is not a version", () => {
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("1.2.3-beta")).toBeNull();
    expect(parseVersion("abc")).toBeNull();
  });
});

describe("bumpVersion", () => {
  const v = { major: 1, minor: 2, patch: 3 };

  it("zeroes the lower segments", () => {
    expect(bumpVersion(v, "major")).toEqual({ major: 2, minor: 0, patch: 0 });
    expect(bumpVersion(v, "minor")).toEqual({ major: 1, minor: 3, patch: 0 });
    expect(bumpVersion(v, "patch")).toEqual({ major: 1, minor: 2, patch: 4 });
  });
});

describe("formatting", () => {
  it("always renders three segments", () => {
    expect(formatVersion({ major: 2, minor: 0, patch: 0 })).toBe("2.0.0");
  });

  it("recombines base and version", () => {
    expect(formatVersionedName("Mocko", { major: 1, minor: 3, patch: 0 })).toBe(
      "Mocko 1.3.0",
    );
  });

  it("drops the separator when the base is blank", () => {
    expect(formatVersionedName("  ", { major: 1, minor: 0, patch: 0 })).toBe(
      "1.0.0",
    );
  });
});

describe("suggestNextVersion", () => {
  it("bumps an existing version", () => {
    expect(suggestNextVersion("Mocko 1.2.0", "minor")).toEqual({
      major: 1,
      minor: 3,
      patch: 0,
    });
  });

  it("starts at 1.0.0 when the name carries no version", () => {
    expect(suggestNextVersion("Marketing", "patch")).toEqual(FIRST_VERSION);
  });
});

describe("round trip", () => {
  it("re-parses what it formatted", () => {
    const name = formatVersionedName(
      "Mocko",
      suggestNextVersion("Mocko 1.2.9", "patch"),
    );
    expect(name).toBe("Mocko 1.2.10");
    expect(parseVersionedName(name)).toEqual({
      base: "Mocko",
      version: { major: 1, minor: 2, patch: 10 },
    });
  });
});

describe("compareVersions", () => {
  it("orders oldest first across all segments", () => {
    const v = (major: number, minor: number, patch: number) => ({
      major,
      minor,
      patch,
    });
    expect(compareVersions(v(1, 2, 0), v(1, 10, 0))).toBeLessThan(0);
    expect(compareVersions(v(2, 0, 0), v(1, 9, 9))).toBeGreaterThan(0);
    expect(compareVersions(v(1, 2, 3), v(1, 2, 3))).toBe(0);
  });
});

describe("folderGroupKey", () => {
  it("derives the app from the folder name", () => {
    expect(folderGroupKey({ name: "Telly 1.3.0" })).toBe("Telly");
  });

  it("uses the whole name when there is no version", () => {
    expect(folderGroupKey({ name: "Marketing" })).toBe("Marketing");
  });

  it("lets an explicit appName win", () => {
    expect(folderGroupKey({ name: "Telly Rebrand", appName: "Telly" })).toBe(
      "Telly",
    );
    // Blank overrides fall back to the name, they do not create an empty app.
    expect(folderGroupKey({ name: "Telly 1.0.0", appName: "  " })).toBe(
      "Telly",
    );
  });
});

describe("versionLabel", () => {
  it("shows the version, or the name when there is none", () => {
    expect(versionLabel({ name: "Telly 1.3.0" })).toBe("1.3.0");
    expect(versionLabel({ name: "Marketing" })).toBe("Marketing");
  });
});

describe("groupFolders", () => {
  const f = (name: string, appName?: string) => ({ name, appName });

  it("groups releases of one app, newest first", () => {
    const { groups, ungrouped } = groupFolders([
      f("Telly 1.2.0"),
      f("Telly 1.10.0"),
      f("Telly 1.3.0"),
    ]);
    expect(ungrouped).toEqual([]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("Telly");
    expect(groups[0].folders.map((x) => x.name)).toEqual([
      "Telly 1.10.0",
      "Telly 1.3.0",
      "Telly 1.2.0",
    ]);
  });

  it("leaves a lone folder ungrouped rather than making a one-member app", () => {
    const { groups, ungrouped } = groupFolders([
      f("Telly 1.0.0"),
      f("Marketing"),
    ]);
    expect(groups).toEqual([]);
    expect(ungrouped.map((x) => x.name)).toEqual(["Telly 1.0.0", "Marketing"]);
  });

  it("keeps unrelated folders out of a group", () => {
    const { groups, ungrouped } = groupFolders([
      f("Telly 1.0.0"),
      f("Telly 1.1.0"),
      f("Marketing"),
      f("Kivi Dice 2.0.0"),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["Telly"]);
    expect(ungrouped.map((x) => x.name)).toEqual([
      "Marketing",
      "Kivi Dice 2.0.0",
    ]);
  });

  it("pulls an off-convention folder in via appName", () => {
    const { groups } = groupFolders([
      f("Telly 1.1.0"),
      f("Telly 1.0.0"),
      f("Telly Rebrand Draft", "Telly"),
    ]);
    expect(groups).toHaveLength(1);
    // Versionless members sort to the end.
    expect(groups[0].folders.map((x) => x.name)).toEqual([
      "Telly 1.1.0",
      "Telly 1.0.0",
      "Telly Rebrand Draft",
    ]);
  });

  it("groups a versionless folder with the app it shares a base with", () => {
    const { groups } = groupFolders([f("Telly"), f("Telly 1.0.0")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].folders.map((x) => x.name)).toEqual([
      "Telly 1.0.0",
      "Telly",
    ]);
  });

  it("keeps groups in the order their first member appeared", () => {
    const { groups } = groupFolders([
      f("Kivi 1.0.0"),
      f("Telly 1.0.0"),
      f("Kivi 1.1.0"),
      f("Telly 1.1.0"),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["Kivi", "Telly"]);
  });

  it("handles an empty list", () => {
    expect(groupFolders([])).toEqual({ groups: [], ungrouped: [] });
  });
});
