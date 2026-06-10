#!/usr/bin/env node
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(root, "assets", "samples");
const outDir = path.join(root, "public", "samples");

/** PNG/JPG в assets/samples → JPEG в public/samples */
const DEMOS = [
  { src: "demo-office-day.png", dest: "demo-office-day.jpg", name: "Офис (день)" },
  { src: "demo-brick-day.png", dest: "demo-brick-day.jpg", name: "Кирпич (день)" },
  {
    src: "meriya-kazani.jpg",
    dest: "meriya-kazani.jpg",
    name: "Мэрия Казани",
    copyJpeg: true,
  },
];

fs.mkdirSync(outDir, { recursive: true });

for (const d of DEMOS) {
  const src = path.join(assetsDir, d.src);
  const dest = path.join(outDir, d.dest);
  if (!fs.existsSync(src)) {
    console.warn(`skip (нет файла): ${src}`);
    continue;
  }
  if (d.copyJpeg) {
    fs.copyFileSync(src, dest);
    console.log(`✓ ${d.name} → public/samples/${d.dest}`);
    continue;
  }
  await sharp(src).jpeg({ quality: 88 }).toFile(dest);
  console.log(`✓ ${d.name} → public/samples/${d.dest}`);
}

console.log("Готово.");
