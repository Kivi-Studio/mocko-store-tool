import { describe, it, expect } from "vitest";
import { exportFileName } from "@/lib/export";

describe("exportFileName", () => {
  it("builds <slug>_<preset>_<lang>_<NN>.<ext> with a 1-based index", () => {
    expect(exportFileName("My App", "ios-6-9", "png", "en", 0)).toBe(
      "my-app_ios-6-9_en_01.png",
    );
  });

  it("uses a .jpg extension for jpeg and keeps the locale code verbatim", () => {
    expect(exportFileName("My App", "play-phone", "jpeg", "pt-BR", 0)).toBe(
      "my-app_play-phone_pt-BR_01.jpg",
    );
  });

  it("zero-pads to two digits and stays two digits past 9", () => {
    expect(exportFileName("X", "ipad-13", "png", "de", 4)).toBe(
      "x_ipad-13_de_05.png",
    );
    expect(exportFileName("X", "ipad-13", "png", "de", 11)).toBe(
      "x_ipad-13_de_12.png",
    );
  });

  it("slugifies the project name", () => {
    expect(exportFileName("Hello WORLD!!", "ios-6-9", "png", "en", 0)).toBe(
      "hello-world_ios-6-9_en_01.png",
    );
  });
});
