import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WipeDialog } from "@/components/gallery/WipeDialog";

function renderDialog(props: Partial<Parameters<typeof WipeDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onExport = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <WipeDialog
      open
      onOpenChange={onOpenChange}
      projectCount={3}
      folderCount={2}
      onExport={onExport}
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onConfirm, onExport, onOpenChange };
}

describe("WipeDialog", () => {
  it("names what goes and offers a backup before deleting", async () => {
    const user = userEvent.setup();
    const { onConfirm, onExport, onOpenChange } = renderDialog();

    expect(screen.getByText(/removes 3 projects and 2 folders/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Export backup" }));
    expect(onExport).toHaveBeenCalledTimes(1);
    // Exporting does not close the dialog; the user still has to decide.
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete everything" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cancels without deleting", async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    // The close button hands the dialog's event details along as well.
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("skips the export shortcut when there is nothing to export", () => {
    renderDialog({ projectCount: 0, folderCount: 0 });
    expect(screen.getByText(/workspace is empty/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Export backup" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete everything" }),
    ).toBeEnabled();
  });
});
