import sharp from "sharp";
import { getMountZoneKey } from "@/lib/mountRules";
import { getFixturePlacementProfile } from "@/lib/fixturePlacementProfile";
import { resolveAllowedMountLines } from "@/lib/mountZoneGeometry";
import type {
  FacadeDetection,
  Fixture,
  LightingType,
  MountTarget,
  MountZoneKey,
  PlacementScheme,
  ZoneBox,
} from "./types";

function boxSvg(
  box: ZoneBox,
  width: number,
  height: number,
  stroke: string,
  fill: string
): string {
  const x = box.x * width;
  const y = box.y * height;
  const w = box.width * width;
  const h = box.height * height;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}"
    fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}

function mountLineSvg(
  ml: { x1: number; y1: number; x2: number; y2: number },
  width: number,
  height: number,
  stroke: string,
  strokeWidth: number
): string {
  return `<line x1="${ml.x1 * width}" y1="${ml.y1 * height}" x2="${ml.x2 * width}" y2="${ml.y2 * height}"
    stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

export function buildVisionDebugSvg(
  width: number,
  height: number,
  detection: FacadeDetection,
  placement: PlacementScheme,
  zoneKey: MountZoneKey
): string {
  const fb = detection.facadeBox;
  const forbidden = detection.forbiddenZones;
  const allowed = resolveAllowedMountLines(detection, zoneKey);

  const forbiddenRects = forbidden
    ? Object.values(forbidden)
        .flat()
        .map((b) =>
          boxSvg(b, width, height, "rgba(255,60,60,0.9)", "rgba(255,40,40,0.22)")
        )
        .join("")
    : "";

  const allowedLines = allowed
    .map((ml) =>
      mountLineSvg(ml, width, height, "rgba(60,255,140,0.95)", 3)
    )
    .join("");

  const fixtureDots = placement.fixtures
    .map(
      (fp) =>
        `<circle cx="${fp.x * width}" cy="${fp.y * height}" r="6"
          fill="rgba(255,230,60,0.95)" stroke="rgba(180,120,0,0.9)" stroke-width="2"/>`
    )
    .join("");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${forbiddenRects}
    <rect x="${fb.x * width}" y="${fb.y * height}" width="${fb.width * width}" height="${fb.height * height}"
      fill="none" stroke="rgba(255,50,50,0.95)" stroke-width="3"/>
    ${allowedLines}
    ${fixtureDots}
  </svg>`;
}

export async function renderVisionDebugOverlay(
  imageBuffer: Buffer,
  detection: FacadeDetection,
  placement: PlacementScheme,
  fixture: Fixture,
  mountTarget: MountTarget,
  lightingType?: LightingType
): Promise<string> {
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? 1200;
  const height = meta.height ?? 800;
  const zoneKey = getMountZoneKey(
    fixture,
    mountTarget,
    getFixturePlacementProfile(fixture, lightingType)
  );
  const svg = buildVisionDebugSvg(width, height, detection, placement, zoneKey);
  const overlay = await sharp(Buffer.from(svg), { density: 144 })
    .resize(width, height)
    .png()
    .toBuffer();
  const composed = await sharp(imageBuffer)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
  return `data:image/jpeg;base64,${composed.toString("base64")}`;
}
