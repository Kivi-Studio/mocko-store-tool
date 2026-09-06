import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { toast } from "sonner";
import { BackupDropZone } from "@/components/gallery/BackupDropZone";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const studio = (name: string) =>
  new File(["zip"], name, { type: "application/zip" });

/** What the browser hands over while files are dragged in from the desktop. */
const fileDrag = (...files: File[]) => ({
  dataTransfer: { types: ["Files"], files },
});

/** What a project card being moved onto a folder looks like. */
const cardDrag = { dataTransfer: { types: ["text/plain"], files: [] } };

const overlay = () => screen.queryByText("Drop to import backup");

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
});

describe("BackupDropZone", () => {
  it("shows the overlay while a file is over the page and hands the drop over", () => {
    const onFile = vi.fn();
    render(<BackupDropZone onFile={onFile} />);
    const file = studio("backup.studio");

    expect(overlay()).not.toBeInTheDocument();
    fireEvent.dragEnter(document.body, fileDrag(file));
    expect(overlay()).toBeVisible();

    fireEvent.drop(document.body, fileDrag(file));
    expect(onFile).toHaveBeenCalledWith(file);
    expect(overlay()).not.toBeInTheDocument();
  });

  it("keeps the overlay while crossing nested elements and hides it on leaving", () => {
    render(<BackupDropZone onFile={vi.fn()} />);
    const drag = fileDrag(studio("a.studio"));

    fireEvent.dragEnter(document.body, drag);
    fireEvent.dragEnter(document.body, drag);
    fireEvent.dragLeave(document.body, drag);
    expect(overlay()).toBeVisible();

    fireEvent.dragLeave(document.body, drag);
    expect(overlay()).not.toBeInTheDocument();
  });

  it("ignores drags that carry no files, like a project card being moved", () => {
    const onFile = vi.fn();
    render(<BackupDropZone onFile={onFile} />);

    fireEvent.dragEnter(document.body, cardDrag);
    expect(overlay()).not.toBeInTheDocument();
    fireEvent.drop(document.body, cardDrag);
    expect(onFile).not.toHaveBeenCalled();
  });

  it("takes one backup at a time", () => {
    const onFile = vi.fn();
    render(<BackupDropZone onFile={onFile} />);

    fireEvent.drop(
      document.body,
      fileDrag(studio("a.studio"), studio("b.studio")),
    );
    expect(onFile).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Drop one backup at a time");
  });

  it("stops listening once unmounted", () => {
    const onFile = vi.fn();
    const { unmount } = render(<BackupDropZone onFile={onFile} />);
    unmount();
    fireEvent.drop(document.body, fileDrag(studio("a.studio")));
    expect(onFile).not.toHaveBeenCalled();
  });
});
