import sharp from "sharp";
import type { LightingType, MountTarget, PlacementScheme } from "./types";

function svgOverlay(
  width: number,
  height: number,
  placement: PlacementScheme,
  mountTarget: MountTarget
): string {
  const lineEls = placement.lines
    .map((line) => {
      const stroke =
        mountTarget === "facade"
          ? "rgba(255,220,160,0.85)"
          : "rgba(255,200,120,0.75)";
      return `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${stroke}" stroke-width="${Math.max(3, width / 400)}" stroke-linecap="round" filter="url(#glow)"/>`;
    })
    .join("");

  const pointEls = placement.points
    .map((p) => {
      const r = Math.max(6, width / 120);
      const fill =
        mountTarget === "facade"
          ? "rgba(255,235,200,0.95)"
          : "rgba(255,210,150,0.9)";
      return `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${fill}" filter="url(#glowStrong)"/>`;
    })
    .join("");

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="glowStrong" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="12" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(5,15,40,0.15)"/>
        <stop offset="100%" stop-color="rgba(5,15,40,0.55)"/>
      </linearGradient>
      <linearGradient id="uplight" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="rgba(255,180,80,0.35)"/>
        <stop offset="60%" stop-color="rgba(255,200,120,0.08)"/>
        <stop offset="100%" stop-color="rgba(255,200,120,0)"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#vignette)"/>
    <rect x="${width * 0.06}" y="${height * 0.08}" width="${width * 0.88}" height="${height * 0.88}" fill="url(#uplight)" opacity="0.7"/>
    ${lineEls}
    ${pointEls}
  </svg>`;
}

export async function renderLocalVisualization(
  imageBuffer: Buffer,
  placement: PlacementScheme,
  lightingType: LightingType,
  mountTarget: MountTarget = "facade"
): Promise<string> {
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? 1200;
  const height = meta.height ?? 800;

  const eveningBase = await sharp(imageBuffer)
    .modulate({ brightness: 0.72, saturation: 1.05 })
    .linear(1.05, -8)
    .toBuffer();

  const overlaySvg = Buffer.from(
    svgOverlay(width, height, placement, mountTarget)
  );

  const composed = await sharp(eveningBase)
    .composite([{ input: overlaySvg, top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();

  return `data:image/jpeg;base64,${composed.toString("base64")}`;
}

export function dataUrlToBuffer(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) throw new Error("Некорректный формат изображения");
  return Buffer.from(match[1], "base64");
}
