#!/usr/bin/env npx tsx
/**
 * Проверка профилей расстановки для всех товаров каталога (без AI).
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CATALOG } from "../src/lib/catalog";
import { buildMockFacadeDetection } from "../src/lib/mockFacadeDetection";
import { normalizeFacadeDetection } from "../src/lib/facadeGeometry";
import { placeFixturesAlongMountLines } from "../src/lib/placementEngine";
import { getFixturePlacementProfile } from "../src/lib/fixturePlacementProfile";

const imageWidth = 1200;
const imageHeight = 800;
const pxPerMeter = 45;

let ok = true;

for (const fixture of CATALOG) {
  const usage = fixture.usagePrompts[0];
  const lightingType = usage.lightingType;
  const mountTarget = usage.mountTarget;
  const profile = getFixturePlacementProfile(fixture, lightingType);

  const raw = buildMockFacadeDetection(lightingType, mountTarget);
  const detection = normalizeFacadeDetection(raw, {
    lightingType,
    mountTarget,
    fixture,
  });
  const { placement } = placeFixturesAlongMountLines({
    detection,
    scale: {
      pixelsPerMeter: pxPerMeter,
      anchor: "height",
      userMeters: 18,
      facadePxExtent: imageHeight * detection.facadeBox.height,
    },
    fixture,
    mountTarget,
    lightingType,
    imageWidth,
    imageHeight,
    dimensions: { heightM: 18 },
  });

  const qty = placement.fixtures.length;
  const lines = placement.mountLines?.length ?? 0;
  const mode = profile.placementMode;

  console.log(
    `\n${fixture.id} [${mode}] qty=${qty} lines=${lines} glow=${profile.glowMode}`
  );

  if (mode === "flood_wash" && qty > (profile.maxTotalFixtures ?? 12)) {
    console.error(`  FAIL: слишком много прожекторов (${qty})`);
    ok = false;
  }
  if (mode === "accent_points" && qty > (profile.maxTotalFixtures ?? 12)) {
    console.error(`  FAIL: слишком много акцентов (${qty})`);
    ok = false;
  }
  if (mode === "linear_ribbon" && lines < 4) {
    console.error(`  FAIL: мало поясов для линейного (${lines})`);
    ok = false;
  }
  if (mode === "flood_wash" && lines > 4) {
    console.error(`  FAIL: слишком много линий для заливки (${lines})`);
    ok = false;
  }
  if (mode === "pole_row") {
    const y = placement.fixtures[0]?.y ?? 0;
    if (y < 0.82) {
      console.error(`  FAIL: опора слишком высоко y=${y}`);
      ok = false;
    }
    const hPx = placement.fixtures[0]?.heightPx ?? 0;
    const expectedMin = Math.round(
      ((fixture.heightMm ?? 1450) / 1000) * pxPerMeter * 0.7
    );
    if (hPx < expectedMin) {
      console.error(`  FAIL: опора слишком низкая ${hPx}px < ${expectedMin}px`);
      ok = false;
    }
  }
  if (mode === "contour_perimeter" && lines < 3) {
    console.error(`  FAIL: мало контурных линий (${lines})`);
    ok = false;
  }
}

if (ok) console.log("\n=== fixture profiles OK ===");
else process.exit(1);
