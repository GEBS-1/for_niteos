import type { NormalizedLine, PlacedFixture, ProductForMounting } from "./types";
import { lineAngleDeg, lineLengthPx } from "./geometry";

export function placeFixturesOnMountZones(params: {
  zones: NormalizedLine[];
  product: ProductForMounting;
  imageWidth: number;
  imageHeight: number;
  pxPerMeter: number;
  visualBoost?: number;
  maxFixtures?: number;
  stepMultiplier?: number;
  maxFixturesPerLine?: number;
}): PlacedFixture[] {
  const {
    zones,
    product,
    imageWidth,
    imageHeight,
    pxPerMeter,
    visualBoost = 2.2,
    maxFixtures = 120,
    stepMultiplier = 1,
    maxFixturesPerLine,
  } = params;

  const stepPx = Math.max(
    product.mountingStepMeters * pxPerMeter * stepMultiplier,
    24
  );

  const fixtureWidthPx = Math.max(
    (product.lengthMm / 1000) * pxPerMeter * visualBoost,
    18
  );

  const fixtureHeightPx = Math.max(
    (product.heightMm / 1000) * pxPerMeter * visualBoost,
    8
  );

  const placed: PlacedFixture[] = [];

  for (const zone of zones) {
    const lengthPx = lineLengthPx(zone, imageWidth, imageHeight);
    let count = Math.max(1, Math.floor(lengthPx / stepPx));
    if (maxFixturesPerLine != null) {
      count = Math.min(count, maxFixturesPerLine);
    }
    const angle = lineAngleDeg(zone);
    const rotation =
      product.mountType === "linear_facade"
        ? Math.abs(angle) < 45 || Math.abs(angle) > 135
          ? 0
          : 90
        : Math.round(angle);

    for (let i = 0; i < count; i++) {
      if (placed.length >= maxFixtures) return placed;

      const t = count === 1 ? 0.5 : i / (count - 1);

      const x = zone.x1 + (zone.x2 - zone.x1) * t;
      const y = zone.y1 + (zone.y2 - zone.y1) * t;

      placed.push({
        productId: product.id,
        x,
        y,
        xPx: x * imageWidth,
        yPx: y * imageHeight,
        widthPx: fixtureWidthPx,
        heightPx: fixtureHeightPx,
        rotation,
        mountLineType: zone.type,
      });
    }
  }

  return placed;
}
