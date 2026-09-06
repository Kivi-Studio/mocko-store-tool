import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { useShallow } from "zustand/react/shallow";
import userEvent from "@testing-library/user-event";
import { CaptionsScreen } from "@/components/captions/CaptionsScreen";
import { useProjectStore } from "@/store/useProjectStore";
import { makeFolder, makeProject, makeShot } from "@/lib/model/defaults";
import { captionFor } from "@/lib/model/caption";
import type { Folder, Project } from "@/lib/model/types";

const LANG = "en";

const folder: Folder = makeFolder("Telly 1.3.0");

/** A project with `n` empty shots, captioned "<name> n". */
function withShots(name: string, n: number): Project {
  const p = makeProject(name, folder.id);
  p.shots = Array.from({ length: n }, (_, i) => ({
    ...makeShot(null, LANG),
    captions: { [LANG]: { claim: `${name} ${i + 1}`, sub: "" } },
  }));
  return p;
}

/**
 * Renders the screen the way the route does: projects come from the store, so
 * an edit flows back into the grid instead of the inputs freezing on a stale
 * snapshot.
 */
function Harness() {
  const projects = useProjectStore(
    useShallow((s) =>
      s.projectOrder
        .map((id) => s.projects[id])
        .filter((p) => p && p.folderId === folder.id),
    ),
  );
  return <CaptionsScreen folder={folder} projects={projects} />;
}

/** Puts the projects into the store so the cells can write through to it. */
function seed(projects: Project[]) {
  useProjectStore.setState({
    folders: { [folder.id]: folder },
    folderOrder: [folder.id],
    projects: Object.fromEntries(projects.map((p) => [p.id, p])),
    projectOrder: projects.map((p) => p.id),
  });
}

beforeEach(() => {
  useProjectStore.setState({
    projects: {},
    projectOrder: [],
    folders: {},
    folderOrder: [],
  });
  useProjectStore.temporal.getState().clear();
});

describe("CaptionsScreen", () => {
  it("lays out a column per project and a row per shot position", () => {
    const projects = [withShots("iPhone (de)", 3), withShots("iPad (de)", 2)];
    seed(projects);
    render(<Harness />);

    // The header carries the project and, beneath it, the language.
    expect(
      screen.getByRole("columnheader", { name: /iPhone \(de\)/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: /iPad \(de\)/ }),
    ).toBeVisible();
    // Three rows — the longest project decides.
    expect(screen.getByText("Shot 3")).toBeVisible();
    expect(screen.queryByText("Shot 4")).toBeNull();
  });

  it("gives a project with several languages one column each", () => {
    const project = withShots("iPhone", 1);
    project.languages = [
      { code: "de", label: "German" },
      { code: "en", label: "English" },
    ];
    seed([project]);
    render(<Harness />);

    // "Shot" plus one per language.
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.getByLabelText("Claim, iPhone de, shot 1")).toBeVisible();
    expect(screen.getByLabelText("Claim, iPhone en, shot 1")).toBeVisible();
  });

  it("shows each project's existing captions", () => {
    const projects = [withShots("iPhone (de)", 1)];
    seed(projects);
    render(<Harness />);

    expect(
      screen.getByLabelText(`Claim, iPhone (de) ${LANG}, shot 1`),
    ).toHaveValue("iPhone (de) 1");
  });

  it("writes an edit through to the right project and shot", async () => {
    const user = userEvent.setup();
    const projects = [withShots("iPhone (de)", 1), withShots("iPad (de)", 1)];
    seed(projects);
    render(<Harness />);

    const field = screen.getByLabelText(`Claim, iPad (de) ${LANG}, shot 1`);
    await user.clear(field);
    await user.type(field, "Alle Serien");

    const state = useProjectStore.getState();
    const edited = state.projects[projects[1].id].shots[0];
    expect(captionFor(edited, LANG).claim).toBe("Alle Serien");
    // The neighbouring project is untouched.
    const neighbour = state.projects[projects[0].id].shots[0];
    expect(captionFor(neighbour, LANG).claim).toBe("iPhone (de) 1");
  });

  it("edits the subtext independently of the claim", async () => {
    const user = userEvent.setup();
    const projects = [withShots("iPhone (de)", 1)];
    seed(projects);
    render(<Harness />);

    await user.type(
      screen.getByLabelText(`Subtext, iPhone (de) ${LANG}, shot 1`),
      "Nie wieder suchen",
    );

    const shot = useProjectStore.getState().projects[projects[0].id].shots[0];
    expect(captionFor(shot, LANG)).toEqual({
      claim: "iPhone (de) 1",
      sub: "Nie wieder suchen",
    });
  });

  it("marks positions a shorter project does not have, without inventing a shot", () => {
    const projects = [withShots("iPhone (de)", 2), withShots("iPad (de)", 1)];
    seed(projects);
    render(<Harness />);

    // Row 2 has a cell for the longer project and a placeholder for the shorter.
    expect(
      screen.getByLabelText(`Claim, iPhone (de) ${LANG}, shot 2`),
    ).toBeVisible();
    expect(
      screen.queryByLabelText(`Claim, iPad (de) ${LANG}, shot 2`),
    ).toBeNull();
    expect(screen.getByText("no shot")).toBeVisible();
    // Nothing was added to the store just by looking at it.
    expect(
      useProjectStore.getState().projects[projects[1].id].shots,
    ).toHaveLength(1);
  });

  it("collapses a burst of typing into one undo step", async () => {
    const user = userEvent.setup();
    const projects = [withShots("iPhone (de)", 1)];
    seed(projects);
    // Seeding is itself a store write — discard it so only the typing counts.
    useProjectStore.temporal.getState().clear();
    render(<Harness />);

    await user.type(
      screen.getByLabelText(`Claim, iPhone (de) ${LANG}, shot 1`),
      "abc",
    );

    expect(useProjectStore.temporal.getState().pastStates.length).toBe(1);
  });

  it("says so when there is nothing to caption", () => {
    render(<CaptionsScreen folder={folder} projects={[]} />);
    expect(screen.getByText(/Nothing to caption yet/)).toBeVisible();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("counts projects and captions in the header", () => {
    const projects = [withShots("iPhone (de)", 3), withShots("iPad (de)", 2)];
    seed(projects);
    render(<Harness />);
    const header = screen.getByRole("banner");
    expect(
      within(header).getByText(/2 projects · 2 columns · 5 captions/),
    ).toBeVisible();
  });
});
