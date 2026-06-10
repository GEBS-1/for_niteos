#!/usr/bin/env node
/** Проверка расстановки без AI-генерации картинки */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "3000";
const base = `http://localhost:${port}`;

async function analyzeSample(file, dims, fixtureId, promptId, label) {
  const samplePath = path.join(root, "public", "samples", file);
  const imageBuffer = fs.readFileSync(samplePath);
  const meta = await sharp(imageBuffer).metadata();
  const dataUrl = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;

  const res = await fetch(`${base}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageWidth: meta.width,
      imageHeight: meta.height,
      dimensions: dims,
      imageDataUrl: dataUrl,
      fixtureId,
      promptId,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  const pl = data.placement?.fixtures?.[0];
  const lines = data.placement?.mountLines ?? [];
  console.log(`\n=== ${label} ===`);
  console.log("  detection:", data.pipeline?.detectionSource ?? data.analysis?.aiMode);
  console.log("  mountLines:", lines.length, lines.map((l) => l.label ?? l.id).join(", "));
  console.log("  quantity:", data.activeCalculation?.quantity);
  if (pl) {
    console.log("  first fixture y:", pl.y?.toFixed(3), "mountType:", pl.mountType);
  }
  return data;
}

const health = await fetch(`${base}/`);
if (!health.ok) {
  console.error("Dev server not running on", base);
  process.exit(1);
}

await analyzeSample(
  "demo-brick-day.jpg",
  { heightM: 8 },
  "magistral-v3-ai-70",
  "magistral-facade-175",
  "Кирпич + МАГИСТРАЛЬ"
);

const kazan = await analyzeSample(
  "meriya-kazani.jpg",
  { heightM: 18 },
  "magistral-v3-ai-70",
  "magistral-facade-175",
  "Казань + МАГИСТРАЛЬ"
);

const park = await analyzeSample(
  "meriya-kazani.jpg",
  { heightM: 18 },
  "nt-park-step",
  "nt-park-nearby-zone",
  "Казань + NT-park"
);

const parkY = park.placement?.fixtures?.[0]?.y ?? 0;
const kazanLines = kazan.placement?.mountLines ?? [];
const kazanBox = kazan.placement?.facadeBox;
const horizOnly = kazanLines.every(
  (l) => Math.abs(l.x2 - l.x1) > Math.abs(l.y2 - l.y1)
);
const kazanBandCount = kazanLines.length;
const linesInBox =
  kazanBox &&
  kazanLines.every((l) => {
    const y = (l.y1 + l.y2) / 2;
    const top = kazanBox.y + kazanBox.height * 0.03;
    const bottom = kazanBox.y + kazanBox.height * 0.97;
    return y >= top && y <= bottom;
  });

let ok = true;
if (!horizOnly) {
  console.error("\nFAIL: Магистраль — есть негоризонтальные линии");
  ok = false;
}
if (kazanBandCount < 4) {
  console.error("\nFAIL: Магистраль Казань — мало поясов:", kazanBandCount, "(нужно ≥4)");
  ok = false;
}
if (!linesInBox) {
  console.error("\nFAIL: линии выходят за facadeBox (линии в небе)");
  ok = false;
}
if (parkY < 0.82) {
  console.error("\nFAIL: NT-park — опоры слишком высоко (y=", parkY, ")");
  ok = false;
}
const parkQty = park.activeCalculation?.quantity ?? 0;
if (parkQty < 3 || parkQty > 12) {
  console.error("\nFAIL: NT-park Казань — нереалистичное кол-во:", parkQty, "(ожидается 3–12)");
  ok = false;
}
if (ok) console.log("\n=== placement OK ===");
else process.exit(1);
