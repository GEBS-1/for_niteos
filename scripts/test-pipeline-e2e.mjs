#!/usr/bin/env node
/**
 * E2E: этапы 1–3 (analyze + local visualize) на демо-фото.
 * PORT=3000 node scripts/test-pipeline-e2e.mjs
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "3000";
const base = `http://localhost:${port}`;

const samplePath = path.join(root, "public", "samples", "demo-brick-day.jpg");
if (!fs.existsSync(samplePath)) {
  console.error("Нет demo-brick-day.jpg — npm run import:samples");
  process.exit(1);
}

const imageBuffer = fs.readFileSync(samplePath);
const meta = await sharp(imageBuffer).metadata();
const imageW = meta.width;
const imageH = meta.height;
const dataUrl = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;

const fixtureId = "magistral-v3-ai-70";
const promptId = "magistral-facade-175";
const dimensions = { heightM: 8 };

console.log("=== Этап 0: health ===");
const health = await fetch(`${base}/`);
if (!health.ok) {
  console.error(`FAIL GET / → ${health.status}. Запустите: npm run dev:clean`);
  process.exit(1);
}
console.log("OK GET /", health.status);

console.log("\n=== Этап 1–3: /api/analyze (детекция + масштаб + размещение) ===");
const analyzeRes = await fetch(`${base}/api/analyze`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    imageWidth: imageW,
    imageHeight: imageH,
    dimensions,
    imageDataUrl: dataUrl,
    fixtureId,
    promptId,
  }),
});
const analyze = await analyzeRes.json();
if (!analyzeRes.ok) {
  console.error("FAIL analyze:", analyze);
  process.exit(1);
}

const pipeline = analyze.pipeline;
console.log("OK analyze");
console.log("  detection:", pipeline?.detection?.source ?? analyze.analysis?.aiMode);
console.log("  mountLines:", analyze.placement?.mountLines?.length ?? 0);
console.log("  pxPerMeter:", pipeline?.scale?.pixelsPerMeter?.toFixed?.(1));
console.log("  quantity:", analyze.activeCalculation?.quantity);
console.log("  fixture:", analyze.activeCalculation?.fixture?.name);

console.log("\n=== Этап 3–4: /api/visualize (локальная подготовка + AI) ===");
const visRes = await fetch(`${base}/api/visualize`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    imageDataUrl: dataUrl,
    imageWidth: imageW,
    imageHeight: imageH,
    promptId,
    fixtureId,
    dimensions,
    analysis: analyze.analysis,
    calculation: analyze.activeCalculation,
    lightingType: analyze.activeCalculation.lightingType,
    placement: analyze.placement,
    provider: "openai",
  }),
});
const vis = await visRes.json();
const primary = vis.imageDataUrl ?? vis.aiVisualization ?? vis.localVisualization;
if (!visRes.ok || !primary) {
  console.error("FAIL visualize:", vis);
  process.exit(1);
}

const outPath = path.join(root, "public", "samples", "test-pipeline-result.jpg");
const outB64 = primary.replace(/^data:image\/\w+;base64,/, "");
const outBuf = Buffer.from(outB64, "base64");
fs.writeFileSync(outPath, outBuf);

const inStats = fs.statSync(samplePath);
const outStats = fs.statSync(outPath);
const report = vis.localRenderReport ?? {};

const aiOk = Boolean(vis.aiVisualization);
console.log("OK visualize");
console.log("  mode:", vis.mode);
console.log("  provider:", vis.provider ?? "—");
console.log("  ai:", aiOk);
console.log("  message:", vis.message ?? "—");
if (!aiOk) {
  console.warn("  ⚠ AI не сгенерировал кадр — сохранён локальный fallback");
}
console.log("  pngComposited:", report.pngComposited);
console.log("  input bytes:", inStats.size);
console.log("  output bytes:", outStats.size);
console.log("  saved:", outPath);

if (outStats.size < 5000) {
  console.error("FAIL: output слишком маленький");
  process.exit(1);
}

console.log("\n=== ИТОГ: все этапы прошли ===");
