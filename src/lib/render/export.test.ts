import { describe, it, expect } from "vitest";
import { exportFileName } from "@/lib/render/export";

describe("exportFileName", () => {
  it("builds <slug>_<preset>_<lang>_<NN>.<ext> with a 1-based index", () => {
    expect(exportFileName("My App", "ios-6-9", "de", "png", 0)).toBe(
      "my-app_ios-6-9_de_01.png",
    );
  });

  it("uses a .jpg extension for jpeg", () => {
    expect(exportFileName("My App", "play-phone", "en", "jpeg", 0)).toBe(
      "my-app_play-phone_en_01.jpg",
    );
  });

  it("zero-pads to two digits and stays two digits past 9", () => {
    expect(exportFileName("X", "ipad-13", "de", "png", 4)).toBe(
      "x_ipad-13_de_05.png",
    );
    expect(exportFileName("X", "ipad-13", "de", "png", 11)).toBe(
      "x_ipad-13_de_12.png",
    );
  });

  it("slugifies the project name and the locale code", () => {
    expect(exportFileName("Hello WORLD!!", "ios-6-9", "pt-BR", "png", 0)).toBe(
      "hello-world_ios-6-9_pt-br_01.png",
    );
  });
});
