import type { Preset } from "@/lib/types";

/**
 * Export targets for the App Store and Google Play.
 *
 * Dimensions follow the current store requirements:
 * - App Store iPhone 6.9″/6.7″/6.5″ and iPad 13″ (PNG).
 * - Google Play phone and 10″ tablet screenshots plus the 1024×500 feature
 *   graphic (JPEG — Play recommends JPEG/24-bit PNG without alpha).
 */
export const PRESETS: readonly Preset[] = [
  {
    id: "ios-6-9",
    name: "App Store · iPhone 6.9″ (1320×2868)",
    w: 1320,
    h: 2868,
    device: "iphone",
    fileType: "png",
  },
  {
    id: "ios-6-7",
    name: "App Store · iPhone 6.7″ (1290×2796)",
    w: 1290,
    h: 2796,
    device: "iphone",
    fileType: "png",
  },
  {
    id: "ios-6-5",
    name: "App Store · iPhone 6.5″ (1242×2688)",
    w: 1242,
    h: 2688,
    device: "iphone",
    fileType: "png",
  },
  {
    id: "ipad-13",
    name: "App Store · iPad 13″ (2064×2752)",
    w: 2064,
    h: 2752,
    device: "ipad",
    fileType: "png",
  },
  {
    id: "play-phone",
    name: "Google Play · Phone (1080×1920)",
    w: 1080,
    h: 1920,
    device: "android-phone",
    fileType: "jpeg",
  },
  {
    id: "play-tablet-10",
    name: "Google Play · Tablet 10″ (1200×1920)",
    w: 1200,
    h: 1920,
    device: "android-tablet",
    fileType: "jpeg",
  },
  {
    id: "play-feature",
    name: "Google Play · Feature Graphic (1024×500)",
    w: 1024,
    h: 500,
    device: "none",
    fileType: "jpeg",
  },
] as const;

export const DEFAULT_PRESET_ID = "ios-6-9";

/** Returns the preset for an id, falling back to the first preset. */
export function getPreset(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** True when `id` is a known preset id. */
export function isPresetId(id: unknown): id is string {
  return typeof id === "string" && PRESETS.some((p) => p.id === id);
}
