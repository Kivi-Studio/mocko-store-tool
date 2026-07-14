import { describe, it, expect } from "vitest";
import { exportFileName } from "@/lib/render/export";

describe("exportFileName", () => {
  it("builds <slug>_<preset>_<NN>.<ext> with a 1-based index", () => {
    expect(exportFileName("My App", "ios-6-9", "png", 0)).toBe(
      "my-app_ios-6-9_01.png",
    );
  });

  it("uses a .jpg extension for jpeg", () => {
    expect(exportFileName("My App", "play-phone", "jpeg", 0)).toBe(
      "my-app_play-phone_01.jpg",
    );
  });

  it("zero-pads to two digits and stays two digits past 9", () => {
    expect(exportFileName("X", "ipad-13", "png", 4)).toBe("x_ipad-13_05.png");
    expect(exportFileName("X", "ipad-13", "png", 11)).toBe("x_ipad-13_12.png");
  });

  it("slugifies the project name", () => {
    expect(exportFileName("Hello WORLD!!", "ios-6-9", "png", 0)).toBe(
      "hello-world_ios-6-9_01.png",
    );
  });
});
