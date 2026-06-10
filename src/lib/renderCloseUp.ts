import sharp from "sharp";
import { getFixtureImagePath, resolvePlacementImageRole } from "./fixtureAssets";
import type { Fixture, FixturePlacement, PlacementScheme } from "./types";
import fs from "fs";

const CLOSEUP_WIDTH = 720;

async function loadFixtureForCloseUp(
  fixturePath: string,
  targetW: number
): Promise<Buffer> {
  let buf = await sharp(fixturePath).trim({ threshold: 12 }).ensureAlpha().toBuffer();
  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 100;
  const h = meta.height ?? 40;
  if (h > w * 1.15) {
    buf = await sharp(buf)
      .rotate(-90, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
  }
  return sharp(buf)
    .resize(targetW, Math.round(targetW * 0.35), { fit: "inside" })
    .ensureAlpha()
    .png()
    .toBuffer();
}

/** Крупный план участка фасада с одним светильником */
export async function renderCloseUpVisualization(
  imageBuffer: Buffer,
  placement: PlacementScheme,
  fixture: Fixture,
  anchorPlacement?: FixturePlacement
): Promise<string | null> {
  const meta = await sharp(imageBuffer).metadata();
  const imgW = meta.width ?? 1200;
  const imgH = meta.height ?? 800;

  const fp = anchorPlacement ?? placement.fixtures[0];
  if (!fp) return null;

  const box = placement.facadeBox;
  const pad = 0.06;
  const cx = fp.x * imgW;
  const cy = fp.y * imgH;
  const cropW = Math.min(imgW, Math.max(imgW * (box.width + pad * 2), imgW * 0.35));
  const cropH = Math.min(imgH, Math.max(imgH * (box.height * 0.45 + pad), imgH * 0.35));
  let left = Math.round(cx - cropW / 2);
  let top = Math.round(cy - cropH / 2);
  left = Math.max(0, Math.min(imgW - cropW, left));
  top = Math.max(0, Math.min(imgH - cropH, top));
  const cw = Math.round(Math.min(cropW, imgW - left));
  const ch = Math.round(Math.min(cropH, imgH - top));

  const cropped = await sharp(imageBuffer)
    .extract({ left, top, width: cw, height: ch })
    .modulate({ brightness: 0.75 })
    .toBuffer();

  const scaled = await sharp(cropped)
    .resize(CLOSEUP_WIDTH, Math.round((ch / cw) * CLOSEUP_WIDTH), { fit: "inside" })
    .toBuffer();

  const sMeta = await sharp(scaled).metadata();
  const sw = sMeta.width ?? CLOSEUP_WIDTH;
  const sh = sMeta.height ?? 400;

  const relX = (fp.x * imgW - left) / cw;
  const relY = (fp.y * imgH - top) / ch;
  const px = Math.round(relX * sw);
  const py = Math.round(relY * sh);

  const role = resolvePlacementImageRole(fixture, fp.mountType);
  const fixturePath = getFixtureImagePath(fixture, role);
  if (!fs.existsSync(fixturePath)) {
    const jpegOnly = await sharp(scaled).jpeg({ quality: 92 }).toBuffer();
    return `data:image/jpeg;base64,${jpegOnly.toString("base64")}`;
  }

  const fixtureW = Math.round(sw * 0.55);
  let fixtureBuf: Buffer;
  try {
    fixtureBuf = await loadFixtureForCloseUp(fixturePath, fixtureW);
  } catch {
    return `data:image/jpeg;base64,${(await sharp(scaled).jpeg({ quality: 92 }).toBuffer()).toString("base64")}`;
  }

  const fMeta = await sharp(fixtureBuf).metadata();
  const fw = fMeta.width ?? fixtureW;
  const fh = fMeta.height ?? 40;
  const fl = Math.max(0, Math.min(sw - fw, px - fw / 2));
  const ft = Math.max(0, Math.min(sh - fh, py - fh / 2));

  const highlight = Buffer.from(
    `<svg width="${sw}" height="${sh}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${px}" cy="${py}" r="${Math.max(50, fw)}" fill="rgba(255,180,80,0.25)"/>
      <rect x="${fl - 4}" y="${ft - 4}" width="${fw + 8}" height="${fh + 8}" fill="none" stroke="rgba(255,220,120,0.9)" stroke-width="3" rx="4"/>
    </svg>`
  );

  const out = await sharp(scaled)
    .composite([
      { input: fixtureBuf, left: fl, top: ft },
      { input: highlight, left: 0, top: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  return `data:image/jpeg;base64,${out.toString("base64")}`;
}
