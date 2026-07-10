import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RenameDialog } from "@/components/gallery/dialogs";

function renderDialog(props: Partial<Parameters<typeof RenameDialog>[0]> = {}) {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <RenameDialog
      open
      onOpenChange={onOpenChange}
      title="New project"
      initialName="Project 2"
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, onOpenChange };
}

describe("RenameDialog", () => {
  it("submits the trimmed name and closes", async () => {
    const user = userEvent.setup();
    const { onSubmit, onOpenChange } = renderDialog();

    const input = screen.getByLabelText("Name");
    await user.clear(input);
    await user.type(input, "  New name  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith("New name");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("blocks a name already in takenNames", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({
      initialName: "Project 1",
      takenNames: ["Project 1"],
    });

    expect(screen.getByText("That name already exists.")).toBeVisible();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    // Enter must not submit a duplicate either.
    await user.type(screen.getByLabelText("Name"), "{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();

    // Editing to a free name re-enables submission.
    const input = screen.getByLabelText("Name");
    await user.clear(input);
    await user.type(input, "Project 9");
    expect(save).toBeEnabled();
    await user.click(save);
    expect(onSubmit).toHaveBeenCalledWith("Project 9");
  });

  it("ignores blank names", () => {
    renderDialog({ initialName: "   " });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
