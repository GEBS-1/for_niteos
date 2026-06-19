#!/usr/bin/env npx tsx
/**
 * Тест ядра mounting: selectedZones → placedFixtures → specification.
 * Сначала смотрим зелёные линии (selectedZones), потом количество.
 *
 * npm run test:mounting
 */
import { CATALOG } from "../src/lib/catalog";
import { buildMockFacadeDetection } from "../src/lib/mockFacadeDetection";
import { normalizeFacadeDetection } from "../src/lib/facadeGeometry";
import { runMountingPipeline } from "../src/lib/mounting/pipeline";

const imageWidth = 1200;
const imageHeight = 800;
const pxPerMeter = 45;

const fixtureId = process.argv[2] ?? "magistral-v3-ai-70";
const fixture = CATALOG.find((f) => f.id === fixtureId);

if (!fixture) {
  console.error(`Нет товара: ${fixtureId}`);
  process.exit(1);
}

const usage = fixture.usagePrompts[0];
const lightingType = usage.lightingType;
const mountTarget = usage.mountTarget;

const raw = buildMockFacadeDetection(lightingType, mountTarget);
const detection = normalizeFacadeDetection(raw, {
  lightingType,
  mountTarget,
  fixture,
});

const result = runMountingPipeline({
  detection,
  fixture,
  mountTarget,
  lightingType,
  imageWidth,
  imageHeight,
  pxPerMeter,
});

console.log(`\n=== ${fixture.id} (${result.specification.productName}) ===`);
console.log(`mountType: ${result.specification.productId}`);
console.log(`selectedZones: ${result.selectedZones.length}`);
for (const [i, z] of result.selectedZones.entries()) {
  console.log(
    `  [${i}] type=${z.type ?? "?"} (${z.x1.toFixed(3)},${z.y1.toFixed(3)}) → (${z.x2.toFixed(3)},${z.y2.toFixed(3)})`
  );
}
console.log(`placedFixtures: ${result.placedFixtures.length}`);
console.log(`zoneLengthM: ${result.zoneLengthM}`);
console.log(`specification:`);
console.log(`  quantity: ${result.specification.quantity}`);
console.log(`  equipment: ${result.specification.equipmentTotalRub} ₽`);
console.log(`  work: ${result.specification.workPriceRub} ₽`);
console.log(`  total: ${result.specification.totalPriceRub} ₽`);
console.log(`  power: ${result.specification.totalPowerW} W`);

if (result.selectedZones.length === 0) {
  console.error("\nFAIL: нет selectedZones");
  process.exit(1);
}
if (result.placedFixtures.length === 0) {
  console.error("\nFAIL: нет placedFixtures");
  process.exit(1);
}
if (result.specification.quantity !== result.placedFixtures.length) {
  console.error("\nFAIL: quantity != placedFixtures.length");
  process.exit(1);
}

console.log("\nOK");
