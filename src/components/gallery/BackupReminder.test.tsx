import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackupReminder } from "@/components/gallery/BackupReminder";

describe("BackupReminder", () => {
  it("explains that data is local only and offers an export", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<BackupReminder onExport={onExport} />);

    expect(screen.getByRole("note", { name: "Backup reminder" })).toBeVisible();
    expect(
      screen.getByText("Your projects live in this browser only."),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Export backup" }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});
