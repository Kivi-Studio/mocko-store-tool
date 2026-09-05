import type {
  DeviceStyle,
  Folder,
  GradientBackground,
  Project,
  Shot,
  TextStyle,
} from "@/lib/model/types";
import { DEFAULT_PRESET_ID } from "@/lib/model/presets";
import { DEFAULT_FONT } from "@/lib/model/fonts";
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
  // 0.82 = the previous fixed 9% side padding, preserved as the default.
  textWidth: 0.82,
};

export const DEFAULT_DEVICE: DeviceStyle = {
  frameColor: "#0B0B0D",
  edge: false,
  scale: 0.76,
  topSpace: 0.26,
};

export function makeShot(image: string | null): Shot {
  return {
    id: createId(),
    image,
    claim: "",
    sub: "",
    offX: 0,
    offY: 0,
    scale: null,
  };
}

export function makeProject(
  name: string,
  folderId: string | null = null,
): Project {
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
    folderId,
  };
}

export function makeFolder(name: string): Folder {
  const now = Date.now();
  return {
    id: createId(),
    name,
    createdAt: now,
    updatedAt: now,
    appName: null,
  };
}
