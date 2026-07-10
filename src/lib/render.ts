import type {
  Background,
  DeviceKind,
  DeviceStyle,
  Preset,
  TextStyle,
} from "@/lib/types";

/**
 * Canvas rendering for a single store image.
 *
 * Everything is drawn at the preset's full pixel resolution onto a 2D canvas —
 * the same code path feeds both the (CSS-scaled) live preview and the exported
 * file, so what you see is exactly what you get. Rendering is synchronous, so
 * images must be decoded beforehand and passed in.
 */

/** Screen aspect ratio (height / width) per device, in portrait. */
const SCREEN_ASPECT: Record<Exclude<DeviceKind, "none">, number> = {
  iphone: 19.5 / 9,
  ipad: 4 / 3,
  "android-phone": 16 / 9,
  "android-tablet": 16 / 10,
};

/** Bezel thickness as a fraction of device width, per device. */
const BEZEL_RATIO: Record<Exclude<DeviceKind, "none">, number> = {
  iphone: 0.026,
  ipad: 0.02,
  "android-phone": 0.028,
  "android-tablet": 0.022,
};

/** Outer corner radius as a fraction of device width, per device. */
const OUTER_RADIUS_RATIO: Record<Exclude<DeviceKind, "none">, number> = {
  iphone: 0.14,
  ipad: 0.055,
  "android-phone": 0.11,
  "android-tablet": 0.05,
};

type PathContext = Pick<
  CanvasRenderingContext2D,
  "beginPath" | "moveTo" | "arcTo" | "closePath"
>;

type TextMeasurer = Pick<CanvasRenderingContext2D, "measureText">;

/** Traces a rounded rectangle path (does not fill or stroke). */
export function roundRect(
  ctx: PathContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Greedily wraps `text` into lines no wider than `maxWidth`, measured with the
 * context's current font. A single word wider than `maxWidth` stays on its own
 * (over-long) line rather than being dropped.
 */
export function wrapText(
  ctx: TextMeasurer,
  text: string,
  maxWidth: number,
): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${line} ${words[i]}`;
    if (ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = words[i];
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  return lines;
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  bg: Background,
  image: HTMLImageElement | null,
): void {
  if (bg.type === "solid") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  if (bg.type === "gradient") {
    const a = (bg.angle * Math.PI) / 180;
    const cx = W / 2;
    const cy = H / 2;
    const len = Math.max(W, H);
    const dx = (Math.cos(a) * len) / 2;
    const dy = (Math.sin(a) * len) / 2;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    g.addColorStop(0, bg.from);
    g.addColorStop(1, bg.to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  // image
  if (image) {
    const r = Math.max(W / image.width, H / image.height);
    const iw = image.width * r;
    const ih = image.height * r;
    ctx.drawImage(image, (W - iw) / 2, (H - ih) / 2, iw, ih);
  } else {
    ctx.fillStyle = "#222222";
    ctx.fillRect(0, 0, W, H);
  }
}

function paintText(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  text: TextStyle,
  device: DeviceStyle,
  deviceKind: DeviceKind,
  claim: string,
  sub: string,
): number {
  const pad = W * 0.09;
  // Frameless formats center the text over the whole canvas.
  const frameless = deviceKind === "none";
  const topH = frameless ? H : H * device.topSpace;

  ctx.textAlign = text.align;
  const ax =
    text.align === "left" ? pad : text.align === "right" ? W - pad : W / 2;
  ctx.fillStyle = text.color;
  ctx.textBaseline = "top";

  const claimPx = W * text.claimSize;
  const subPx = W * text.subSize;
  const maxTextW = W - pad * 2;

  ctx.font = `700 ${claimPx}px ${text.font}`;
  const claimLines = wrapText(ctx, claim, maxTextW);
  ctx.font = `400 ${subPx}px ${text.font}`;
  const subLines = wrapText(ctx, sub, maxTextW);

  const claimLH = claimPx * 1.12;
  const subLH = subPx * 1.3;
  const blockH =
    claimLines.length * claimLH +
    (subLines.length ? subLines.length * subLH + claimPx * 0.5 : 0);

  let ty = frameless ? H / 2 - blockH / 2 : topH * 0.5 - blockH / 2 + H * 0.03;
  if (ty < H * 0.03) ty = H * 0.03;

  ctx.font = `700 ${claimPx}px ${text.font}`;
  for (const line of claimLines) {
    ctx.fillText(line, ax, ty);
    ty += claimLH;
  }
  if (subLines.length) {
    ty += claimPx * 0.5;
    ctx.font = `400 ${subPx}px ${text.font}`;
    ctx.globalAlpha = 0.88;
    for (const line of subLines) {
      ctx.fillText(line, ax, ty);
      ty += subLH;
    }
    ctx.globalAlpha = 1;
  }

  return topH;
}

function paintDevice(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  areaTop: number,
  areaH: number,
  img: HTMLImageElement | null,
  device: DeviceStyle,
  kind: Exclude<DeviceKind, "none">,
): void {
  const screenAspect = SCREEN_ASPECT[kind];
  const maxDeviceW = W * device.scale;
  const bezel = maxDeviceW * BEZEL_RATIO[kind];

  let deviceW = maxDeviceW;
  let screenW = deviceW - 2 * bezel;
  let screenH = screenW * screenAspect;
  let deviceH = screenH + 2 * bezel;

  // Constrain the height to the device area (allow a small bleed).
  const maxH = areaH * 1.02;
  if (deviceH > maxH) {
    deviceH = maxH;
    screenH = deviceH - 2 * bezel;
    screenW = screenH / screenAspect;
    deviceW = screenW + 2 * bezel;
  }

  const dx = (W - deviceW) / 2;
  const dy = areaTop + (areaH - deviceH) / 2;
  const outerR = deviceW * OUTER_RADIUS_RATIO[kind];
  const screenR = Math.max(outerR - bezel, 4);

  // Frame body with a soft drop shadow.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = deviceW * 0.06;
  ctx.shadowOffsetY = deviceW * 0.02;
  ctx.fillStyle = device.frameColor;
  roundRect(ctx, dx, dy, deviceW, deviceH, outerR);
  ctx.fill();
  ctx.restore();

  // Optional contour so the frame stays visible on same-color backgrounds.
  if (device.edge) {
    ctx.save();
    roundRect(ctx, dx, dy, deviceW, deviceH, outerR);
    ctx.lineWidth = Math.max(deviceW * 0.004, 2);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.stroke();
    ctx.restore();
  }

  // Screen: clip to the rounded screen and draw the screenshot (cover).
  const sx = dx + bezel;
  const sy = dy + bezel;
  ctx.save();
  roundRect(ctx, sx, sy, screenW, screenH, screenR);
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(sx, sy, screenW, screenH);
  if (img) {
    const r = Math.max(screenW / img.width, screenH / img.height);
    const iw = img.width * r;
    const ih = img.height * r;
    ctx.drawImage(
      img,
      sx + (screenW - iw) / 2,
      sy + (screenH - ih) / 2,
      iw,
      ih,
    );
  } else {
    ctx.fillStyle = "#d7dae0";
    ctx.fillRect(sx, sy, screenW, screenH);
    ctx.fillStyle = "#9aa3b2";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${screenW * 0.06}px sans-serif`;
    ctx.fillText("Screenshot", sx + screenW / 2, sy + screenH / 2);
  }
  ctx.restore();
}

export type RenderInput = {
  preset: Preset;
  background: Background;
  text: TextStyle;
  device: DeviceStyle;
  claim: string;
  sub: string;
  /** Decoded screenshot for this shot, or null for the placeholder. */
  screenshot: HTMLImageElement | null;
  /** Decoded background image (only used when the background is an image). */
  backgroundImage: HTMLImageElement | null;
};

/**
 * Renders one store image onto `canvas`, sizing it to the preset. All images
 * passed in must already be decoded (`HTMLImageElement.complete`).
 */
export function drawShot(canvas: HTMLCanvasElement, input: RenderInput): void {
  const { preset } = input;
  const W = preset.w;
  const H = preset.h;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.clearRect(0, 0, W, H);

  paintBackground(ctx, W, H, input.background, input.backgroundImage);

  const topH = paintText(
    ctx,
    W,
    H,
    input.text,
    input.device,
    preset.device,
    input.claim,
    input.sub,
  );

  if (preset.device !== "none") {
    paintDevice(
      ctx,
      W,
      H,
      topH,
      H - topH,
      input.screenshot,
      input.device,
      preset.device,
    );
  }
}
