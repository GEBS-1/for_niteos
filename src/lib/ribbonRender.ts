import sharp from "sharp";
import type { DisplayOptions } from "./displayOptions";
import { getFixtureWidthBounds } from "./displayOptions";
import { isMostlyHorizontal } from "./facadeGeometry";
import type { FixtureMountType, MountLine } from "./types";

export interface RibbonComposite {
  input: Buffer;
  left: number;
  top: number;
}

function lineLengthPx(ml: MountLine, w: number, h: number): number {
  const dx = (ml.x2 - ml.x1) * w;
  const dy = (ml.y2 - ml.y1) * h;
  return Math.sqrt(dx * dx + dy * dy);
}

function isMostlyVertical(ml: MountLine): boolean {
  return Math.abs(ml.y2 - ml.y1) > Math.abs(ml.x2 - ml.x1) * 1.2;
}

async function applyBodyOpacity(buffer: Buffer, opacity: number): Promise<Buffer> {
  if (opacity >= 0.99) return buffer;
  const meta = await sharp(buffer).metadata();
  const rw = meta.width ?? 1;
  const rh = meta.height ?? 1;
  const mask = Buffer.from(
    `<svg width="${rw}" height="${rh}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white" opacity="${opacity}"/>
    </svg>`
  );
  return sharp(buffer)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

/** SVG: световая лента вдоль линий монтажа */
export function ribbonGlowSvg(
  width: number,
  height: number,
  mountLines: MountLine[],
  intensity: number
): string {
  const glowW = Math.max(4, 8 * intensity);
  const coreW = Math.max(1.5, 2.5 * intensity);
  const lineOpacity = Math.min(0.55, 0.38 * intensity);
  const lines = mountLines
    .map((ml) => {
      const x1 = ml.x1 * width;
      const y1 = ml.y1 * height;
      const x2 = ml.x2 * width;
      const y2 = ml.y2 * height;
      return `<g>
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
          stroke="rgba(255,190,100,0.55)" stroke-width="${glowW}" stroke-linecap="round"
          filter="url(#ribbonSoft)" opacity="${lineOpacity * 0.7}"/>
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
          stroke="rgba(255,220,150,0.95)" stroke-width="${coreW}" stroke-linecap="round"
          opacity="${lineOpacity}"/>
      </g>`;
    })
    .join("");

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="ribbonSoft"><feGaussianBlur stdDeviation="2.5"/></filter>
    </defs>
    ${lines}
  </svg>`;
}

/**
 * Укладка модулей вдоль mountLines (лента, как на референсах).
 */
export async function buildRibbonComposites(
  mountLines: MountLine[],
  moduleBuffer: Buffer,
  moduleW: number,
  moduleH: number,
  imageWidth: number,
  imageHeight: number,
  mountType: FixtureMountType,
  display: DisplayOptions
): Promise<RibbonComposite[]> {
  const isDemo = display.scale === "demo";
  const bodyOpacity = isDemo ? 0.55 : 0.22;
  const bounds = getFixtureWidthBounds(display.scale, imageWidth);
  const tileW = Math.max(bounds.min * 0.5, Math.min(moduleW, bounds.max * 0.6));
  const tileH = Math.max(isDemo ? 22 : 12, Math.round(moduleH * (tileW / moduleW)));

  let tile = await sharp(moduleBuffer)
    .resize(Math.round(tileW), tileH, { fit: "inside" })
    .ensureAlpha()
    .png()
    .toBuffer();
  tile = await applyBodyOpacity(tile, bodyOpacity);

  const tMeta = await sharp(tile).metadata();
  const tw = tMeta.width ?? tileW;
  const th = tMeta.height ?? tileH;

  const out: RibbonComposite[] = [];

  const lines =
    mountType === "linear"
      ? mountLines.filter(isMostlyHorizontal)
      : mountLines;

  for (const ml of lines) {
    const lenPx = lineLengthPx(ml, imageWidth, imageHeight);
    if (lenPx < tw * 0.5) continue;

    const vertical = isMostlyVertical(ml);
    const horizontal = isMostlyHorizontal(ml);

    let segTile = tile;
    let segW = tw;
    let segH = th;
    if (vertical && horizontal === false && mountType === "linear") {
      segTile = await sharp(tile)
        .rotate(90, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      const sm = await sharp(segTile).metadata();
      segW = sm.width ?? th;
      segH = sm.height ?? tw;
    }

    const step = Math.max(segW * 0.38, segW * 0.35);
    const count = Math.max(1, Math.ceil(lenPx / step));
    const x1 = ml.x1 * imageWidth;
    const y1 = ml.y1 * imageHeight;
    const x2 = ml.x2 * imageWidth;
    const y2 = ml.y2 * imageHeight;

    for (let i = 0; i <= count; i++) {
      const t = count <= 0 ? 0.5 : i / count;
      const cx = x1 + (x2 - x1) * t;
      const cy = y1 + (y2 - y1) * t;
      const left = Math.round(cx - segW / 2);
      const top = Math.round(cy - segH / 2);
      out.push({
        input: segTile,
        left: Math.max(0, Math.min(imageWidth - segW, left)),
        top: Math.max(0, Math.min(imageHeight - segH, top)),
      });
    }
  }

  return out;
}
