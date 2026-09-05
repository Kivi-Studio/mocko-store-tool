import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewVersionDialog } from "@/components/gallery/NewVersionDialog";
import { makeFolder } from "@/lib/model/defaults";

function renderDialog(
  props: Partial<Parameters<typeof NewVersionDialog>[0]> = {},
) {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <NewVersionDialog
      open
      onOpenChange={onOpenChange}
      folder={makeFolder("Mocko 1.2.0")}
      projectCount={6}
      takenNames={["Mocko 1.2.0"]}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, onOpenChange };
}

const create = () => screen.getByRole("button", { name: /Create version/ });

describe("NewVersionDialog", () => {
  it("splits the folder name and offers the next minor version", () => {
    renderDialog();
    expect(screen.getByLabelText("App name")).toHaveValue("Mocko");
    expect(screen.getByLabelText("Version")).toHaveValue("1.3.0");
    expect(screen.getByText("Mocko 1.3.0")).toBeVisible();
  });

  it("bumps from the source version, not from the current field", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Patch" }));
    expect(screen.getByLabelText("Version")).toHaveValue("1.2.1");
    expect(screen.getByText("Mocko 1.2.1")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Major" }));
    expect(screen.getByLabelText("Version")).toHaveValue("2.0.0");
  });

  it("starts at 1.0.0 for a folder without a version", () => {
    renderDialog({ folder: makeFolder("Marketing"), takenNames: [] });
    expect(screen.getByLabelText("App name")).toHaveValue("Marketing");
    expect(screen.getByText("Marketing 1.0.0")).toBeVisible();
  });

  it("submits the composed name and the default options", async () => {
    const user = userEvent.setup();
    const { onSubmit, onOpenChange } = renderDialog();
    await user.click(create());
    expect(onSubmit).toHaveBeenCalledWith("Mocko 1.3.0", {
      keepImages: true,
      keepCaptions: true,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("can clear the screenshots and explains what stays", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();
    await user.click(screen.getByText("Keep screenshots"));
    expect(screen.getByText(/empty placeholders/i)).toBeVisible();
    await user.click(create());
    expect(onSubmit).toHaveBeenCalledWith("Mocko 1.3.0", {
      keepImages: false,
      keepCaptions: true,
    });
  });

  it("blocks an unparsable version", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();
    const version = screen.getByLabelText("Version");
    await user.clear(version);
    await user.type(version, "next");
    expect(screen.getByText(/enter a version like/i)).toBeVisible();
    expect(create()).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks a name that already exists", async () => {
    const user = userEvent.setup();
    renderDialog();
    const version = screen.getByLabelText("Version");
    await user.clear(version);
    await user.type(version, "1.2.0");
    expect(
      screen.getByText("A folder with that name already exists."),
    ).toBeVisible();
    expect(create()).toBeDisabled();
  });
});
