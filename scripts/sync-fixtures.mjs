#!/usr/bin/env node
/**
 * Копирует готовые PNG из assets/fixtures/{id}/ в public/fixtures/{id}/
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot = path.join(root, "assets", "fixtures");
const publicRoot = path.join(root, "public", "fixtures");
const ROLES = ["front.png", "side.png", "top.png"];

if (!fs.existsSync(assetsRoot)) {
  console.error("Нет папки assets/fixtures");
  process.exit(1);
}

const ids = fs.readdirSync(assetsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

let copied = 0;
for (const id of ids) {
  const srcDir = path.join(assetsRoot, id);
  const destDir = path.join(publicRoot, id);
  fs.mkdirSync(destDir, { recursive: true });

  for (const file of ROLES) {
    const src = path.join(srcDir, file);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(destDir, file);
    fs.copyFileSync(src, dest);
    console.log(`✓ ${id}/${file}`);
    copied++;
  }
}

console.log(copied > 0 ? `\nГотово: ${copied} файл(ов).` : "\nНет PNG в assets/fixtures/*/front|side|top.png");
