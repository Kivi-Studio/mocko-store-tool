import { describe, it, expect } from "vitest";
import { planImport } from "@/components/gallery/import-plan";
import { makeFolder, makeProject } from "@/lib/model/defaults";

const project = () => makeProject("Project");
const folder = () => makeFolder("Release");

describe("planImport", () => {
  it("opens a single loose project straight away, empty workspace or not", () => {
    const payload = { projects: [project()], folders: [] };
    expect(planImport(payload, true)).toBe("open");
    expect(planImport(payload, false)).toBe("open");
  });

  it("imports a backup outright when there is nothing to merge with or replace", () => {
    expect(
      planImport({ projects: [project(), project()], folders: [] }, true),
    ).toBe("add");
    expect(
      planImport({ projects: [project()], folders: [folder()] }, true),
    ).toBe("add");
  });

  it("asks how to import a backup into a workspace that already has content", () => {
    expect(
      planImport({ projects: [project(), project()], folders: [] }, false),
    ).toBe("ask");
    expect(
      planImport({ projects: [project()], folders: [folder()] }, false),
    ).toBe("ask");
  });

  it("never treats an empty archive as a project to open", () => {
    const payload = { projects: [], folders: [] };
    expect(planImport(payload, true)).toBe("add");
    expect(planImport(payload, false)).toBe("ask");
  });
});
