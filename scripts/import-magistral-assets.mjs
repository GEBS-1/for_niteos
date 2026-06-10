#!/usr/bin/env node
/**
 * Подготовка PNG МАГИСТРАЛЬ: trim фона, alpha, side → горизонтально для фасада.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "assets", "fixtures", "magistral-v3-ai-70");
const sourceDir = path.join(outDir, "source");

const SRC_FRONT = process.argv[2];
const SRC_SIDE = process.argv[3];

if (!SRC_FRONT || !SRC_SIDE) {
  console.error("Usage: node scripts/import-magistral-assets.mjs <front-src> <side-src>");
  process.exit(1);
}

fs.mkdirSync(sourceDir, { recursive: true });

async function prepareFront(input, dest, sourceCopy) {
  fs.copyFileSync(input, sourceCopy);
  await sharp(input)
    .trim({ threshold: 18 })
    .ensureAlpha()
    .resize(1400, 1400, { fit: "inside", withoutEnlargement: false })
    .png()
    .toFile(dest);
  const m = await sharp(dest).metadata();
  console.log(`front: ${m.width}x${m.height} → ${path.relative(root, dest)}`);
}

async function prepareSide(input, dest, sourceCopy) {
  fs.copyFileSync(input, sourceCopy);
  let img = sharp(input).trim({ threshold: 18 }).ensureAlpha();
  const meta = await img.metadata();
  let w = meta.width ?? 100;
  let h = meta.height ?? 100;
  if (h >= w) {
    img = img.rotate(-90, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  }
  await img
    .resize(1600, 400, { fit: "inside", withoutEnlargement: false })
    .png()
    .toFile(dest);
  const m = await sharp(dest).metadata();
  console.log(`side (horizontal): ${m.width}x${m.height} → ${path.relative(root, dest)}`);
}

await prepareFront(
  SRC_FRONT,
  path.join(outDir, "front.png"),
  path.join(sourceDir, "prom-front-original.png")
);
await prepareSide(
  SRC_SIDE,
  path.join(outDir, "side.png"),
  path.join(sourceDir, "prom-side-original.png")
);

// top = front для превью
fs.copyFileSync(path.join(outDir, "front.png"), path.join(outDir, "top.png"));
console.log("top.png ← копия front.png");
