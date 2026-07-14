import { describe, it, expect } from "vitest";
import {
  PRESETS,
  DEFAULT_PRESET_ID,
  getPreset,
  isPresetId,
} from "@/lib/model/presets";
import { FONT_OPTIONS, DEFAULT_FONT, safeFont } from "@/lib/model/fonts";

describe("presets", () => {
  it("has a unique id for every preset", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exposes both App Store and Play Store targets", () => {
    expect(PRESETS.some((p) => p.id.startsWith("ios"))).toBe(true);
    expect(PRESETS.some((p) => p.id.startsWith("play"))).toBe(true);
  });

  it("uses jpeg for the Play feature graphic and marks it frameless", () => {
    const fg = getPreset("play-feature");
    expect(fg.fileType).toBe("jpeg");
    expect(fg.device).toBe("none");
    expect(fg).toMatchObject({ w: 1024, h: 500 });
  });

  it("DEFAULT_PRESET_ID resolves to a real preset", () => {
    expect(getPreset(DEFAULT_PRESET_ID).id).toBe(DEFAULT_PRESET_ID);
  });

  it("getPreset falls back to the first preset for unknown ids", () => {
    expect(getPreset("nope")).toBe(PRESETS[0]);
  });

  it("isPresetId validates ids", () => {
    expect(isPresetId("ios-6-9")).toBe(true);
    expect(isPresetId("nope")).toBe(false);
    expect(isPresetId(42)).toBe(false);
  });
});

describe("safeFont", () => {
  it("accepts known font stacks", () => {
    expect(safeFont(FONT_OPTIONS[1].value)).toBe(FONT_OPTIONS[1].value);
  });

  it("falls back to the default for unknown or non-string values", () => {
    expect(safeFont("Comic Sans")).toBe(DEFAULT_FONT);
    expect(safeFont(null)).toBe(DEFAULT_FONT);
  });
});
