import type {
  DeviceStyle,
  GradientBackground,
  Project,
  Shot,
  TextStyle,
} from "@/lib/types";
import { DEFAULT_PRESET_ID } from "@/lib/presets";
import { DEFAULT_FONT } from "@/lib/fonts";
import { createId } from "@/lib/utils";

export const DEFAULT_BACKGROUND: GradientBackground = {
  type: "gradient",
  from: "#6C8CFF",
  to: "#3A1D8A",
  angle: 135,
};

export const DEFAULT_TEXT: TextStyle = {
  color: "#FFFFFF",
  align: "center",
  font: DEFAULT_FONT,
  claimSize: 0.055,
  subSize: 0.032,
};

export const DEFAULT_DEVICE: DeviceStyle = {
  frameColor: "#0B0B0D",
  edge: false,
  scale: 0.76,
  topSpace: 0.26,
};

export function makeShot(image: string | null): Shot {
  return { id: createId(), image, claim: "", sub: "" };
}

export function makeProject(name: string): Project {
  const now = Date.now();
  return {
    id: createId(),
    name,
    createdAt: now,
    updatedAt: now,
    presetId: DEFAULT_PRESET_ID,
    background: { ...DEFAULT_BACKGROUND },
    text: { ...DEFAULT_TEXT },
    device: { ...DEFAULT_DEVICE },
    shots: [],
  };
}
