#!/usr/bin/env node
/**
 * Импорт фото из catalog/{серия}/ в public/fixtures/{id}/
 * Маппинг: data/catalog-photo-map.json
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mapPath = path.join(root, "data", "catalog-photo-map.json");
const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));

let ok = 0;
let skip = 0;

for (const entry of map) {
  const destDir = path.join(root, "public", "fixtures", entry.fixtureId);
  fs.mkdirSync(destDir, { recursive: true });

  for (const file of entry.files ?? []) {
    const src = path.join(root, file.src);
    const dest = path.join(destDir, file.dest.replace(/\.(webp|jpg|jpeg)$/i, ".png"));
    if (!fs.existsSync(src)) {
      console.warn("SKIP missing:", file.src);
      skip++;
      continue;
    }
    await sharp(src).png().toFile(dest);
    console.log(`✓ ${entry.fixtureId}/${path.basename(dest)}`);
    ok++;
  }
}

console.log(`\nГотово: ${ok} файлов, пропущено: ${skip}`);
