/**
 * Проверка: PNG светильника реально накладывается на фото (не SVG-заглушки).
 * npm run test:render
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { CATALOG } from "../src/lib/catalog";
import { runAnalyzePipelineSync } from "../src/lib/analyzePipeline";
import {
  MVP_BODIES_AND_LIGHT,
  MVP_BODIES_ONLY,
} from "../src/lib/displayOptions";
import {
  getFixtureImagePath,
  resolvePlacementImageRole,
} from "../src/lib/fixtureAssets";
import { renderLocalVisualization } from "../src/lib/visualizeLocal";

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const samplePath = path.join(root, "public", "samples", "meriya-kazani.jpg");

  if (!fs.existsSync(samplePath)) {
    console.error("Нет public/samples/meriya-kazani.jpg");
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(samplePath);
  const meta = await sharp(imageBuffer).metadata();
  const imageW = meta.width ?? 1200;
  const imageH = meta.height ?? 800;

  const fixture = CATALOG.find((f) => f.id === "magistral-v3-ai-70")!;
  const role = resolvePlacementImageRole(fixture, "linear");
  const fixturePath = getFixtureImagePath(fixture, role);

  console.log(
    "fixture PNG:",
    fixturePath,
    fs.existsSync(fixturePath) ? "OK" : "MISSING"
  );
  if (!fs.existsSync(fixturePath)) {
    console.error("Запустите: npm run sync:fixtures");
    process.exit(1);
  }

  const analyze = runAnalyzePipelineSync({
    imageWidth: imageW,
    imageHeight: imageH,
    dimensions: { heightM: 18 },
    fixtureId: fixture.id,
    promptId: "magistral-facade-175",
  });

  const placement = analyze.placement;
  console.log(
    "placements:",
    placement.fixtures.length,
    "lines:",
    placement.mountLines?.length ?? 0
  );

  const outDir = path.join(root, "scripts", "output");
  fs.mkdirSync(outDir, { recursive: true });

  for (const [label, opts] of [
    ["bodies", MVP_BODIES_ONLY],
    ["light", MVP_BODIES_AND_LIGHT],
  ] as const) {
    const { dataUrl, report } = await renderLocalVisualization(
      imageBuffer,
      placement,
      fixture,
      undefined,
      opts
    );
    const outPath = path.join(outDir, `magistral-${label}.jpg`);
    fs.writeFileSync(outPath, Buffer.from(dataUrl.split(",")[1], "base64"));
    console.log(
      `${label}: pngComposited=${report.pngComposited} skipped=${report.pngSkipped} role=${role} -> ${outPath}`
    );
    if (report.pngComposited < 10) {
      console.error(`FAIL: слишком мало PNG-плиток (${report.pngComposited})`);
      process.exit(1);
    }
  }

  console.log("\n=== local render OK (real fixture PNG, no marker stubs) ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
