import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplyToSiblingsDialog } from "@/components/editor/ApplyToSiblingsDialog";
import { makeProject, makeShot } from "@/lib/model/defaults";
import type { Project } from "@/lib/model/types";

/** A project with `n` filled shots. */
function withShots(name: string, n: number): Project {
  return {
    ...makeProject(name),
    shots: Array.from({ length: n }, (_, i) => makeShot(`data:${name}-${i}`)),
  };
}

function renderDialog(
  props: Partial<Parameters<typeof ApplyToSiblingsDialog>[0]> = {},
) {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  const project = withShots("iPhone (de)", 3);
  const siblings = [withShots("iPad (de)", 1), withShots("Play (de)", 4)];
  render(
    <ApplyToSiblingsDialog
      open
      onOpenChange={onOpenChange}
      project={project}
      siblings={siblings}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, onOpenChange, project, siblings };
}

const apply = () => screen.getByRole("button", { name: /^Apply to/ });

describe("ApplyToSiblingsDialog", () => {
  it("preselects every sibling and applies the design by default", async () => {
    const user = userEvent.setup();
    const { onSubmit, siblings } = renderDialog();
    expect(apply()).toHaveAccessibleName("Apply to 2 projects");

    await user.click(apply());
    expect(onSubmit).toHaveBeenCalledWith(
      siblings.map((p) => p.id),
      { design: true, captions: false },
    );
  });

  it("shows shot counts until captions are turned on", async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.getByText("1 shot")).toBeVisible();
    expect(screen.getByText("4 shots")).toBeVisible();

    await user.click(screen.getByText(/^Captions/));
    // 3-shot source onto a 1-shot target: 1 overwritten, 2 appended.
    expect(screen.getByText("1 updated · 2 added")).toBeVisible();
    // …and onto a 4-shot target: the surplus shot is left alone.
    expect(screen.getByText("3 updated · 1 left as is")).toBeVisible();
  });

  it("drops a deselected target from the payload", async () => {
    const user = userEvent.setup();
    const { onSubmit, siblings } = renderDialog();
    await user.click(screen.getByText("iPad (de)"));
    expect(apply()).toHaveAccessibleName("Apply to 1 project");

    await user.click(apply());
    expect(onSubmit).toHaveBeenCalledWith([siblings[1].id], {
      design: true,
      captions: false,
    });
  });

  it("blocks submitting with nothing selected or nothing to copy", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByText(/^Design/));
    expect(apply()).toBeDisabled();

    await user.click(screen.getByText(/^Captions/));
    expect(apply()).toBeEnabled();

    await user.click(screen.getByText("iPad (de)"));
    await user.click(screen.getByText("Play (de)"));
    expect(apply()).toBeDisabled();
  });
});
