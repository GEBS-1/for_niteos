/**
 * Тест полного цикла: Мэрия Казани, высота 18 м, МАГИСТРАЛЬ линейная.
 * Запуск: node scripts/test-kazan.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const samplePath = path.join(root, "public", "samples", "meriya-kazani.jpg");
if (!fs.existsSync(samplePath)) {
  console.error("Нет файла:", samplePath);
  process.exit(1);
}

const imageBuffer = fs.readFileSync(samplePath);
const meta = await sharp(imageBuffer).metadata();
const imageW = meta.width;
const imageH = meta.height;

const dimensions = { heightM: 18 };
const fixtureId = "magistral-v3";
const promptId = "magistral-facade-175";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

const analyzeRes = await fetch(`${baseUrl}/api/analyze`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    imageWidth: imageW,
    imageHeight: imageH,
    dimensions,
    fixtureId,
    promptId,
  }),
});

const analyze = await analyzeRes.json();
if (!analyzeRes.ok) {
  console.error("analyze failed:", analyze);
  process.exit(1);
}

console.log("Analyze OK:", {
  fixture: analyze.activeCalculation.fixture.name,
  quantity: analyze.activeCalculation.quantity,
  total: analyze.activeCalculation.totalPrice,
});

const b64 = imageBuffer.toString("base64");
const mime = samplePath.endsWith(".png") ? "image/png" : "image/jpeg";
const dataUrl = `data:${mime};base64,${b64}`;

const visRes = await fetch(`${baseUrl}/api/visualize`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    imageDataUrl: dataUrl,
    promptId,
    fixtureId,
    lightingType: analyze.activeCalculation.lightingType,
    placement: analyze.placement,
  }),
});

const vis = await visRes.json();
if (!visRes.ok || !vis.imageDataUrl) {
  console.error("visualize failed:", vis);
  process.exit(1);
}

const outPath = path.join(root, "public", "samples", "meriya-kazani-result.jpg");
const outB64 = vis.imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
fs.writeFileSync(outPath, Buffer.from(outB64, "base64"));

console.log("Visualize OK:", vis.mode, vis.message);
console.log("Saved:", outPath);
