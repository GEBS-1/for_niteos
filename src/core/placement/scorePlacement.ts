import type { PlacedItem, Product } from "@/core/products/types";
import type { SceneAnalysis, Surface } from "@/core/scene/types";
import { boxesIntersect, pointInBox } from "@/core/scene/geometry";

export interface ScoreContext {
  scene: SceneAnalysis;
  product: Product;
  pxPerMeter: number;
  imageWidth: number;
  imageHeight: number;
  surface?: Surface;
}

function normalizedItemBox(
  item: PlacedItem,
  imageWidth: number,
  imageHeight: number
) {
  const halfW = item.widthPx / 2 / imageWidth;
  const halfH = item.heightPx / 2 / imageHeight;
  return {
    x: item.x - halfW,
    y: item.y - halfH,
    width: halfW * 2,
    height: halfH * 2,
  };
}

function hitsForbidden(
  x: number,
  y: number,
  forbidden: SceneAnalysis["forbiddenZones"],
  types: string[]
): boolean {
  const relevant = forbidden.filter((z) => types.includes(z.type));
  return relevant.some((z) => pointInBox(x, y, z.box));
}

export function scorePlacement(item: PlacedItem, ctx: ScoreContext): number {
  const { scene, product, pxPerMeter, imageWidth, imageHeight, surface } = ctx;
  let score = 0;
  const profile = product.placementProfile;

  if (surface && profile.surfaceTypes.includes(surface.type)) {
    score += 40;
  }

  if (pointInBox(item.x, item.y, surface?.box ?? scene.facadeBox ?? { x: 0, y: 0, width: 1, height: 1 })) {
    score += 25;
  } else {
    score -= 50;
  }

  const forbiddenHit = hitsForbidden(
    item.x,
    item.y,
    scene.forbiddenZones,
    profile.forbiddenZoneTypes
  );
  if (forbiddenHit) score -= 120;
  else score += 20;

  const nBox = normalizedItemBox(item, imageWidth, imageHeight);
  const windowOverlap = scene.forbiddenZones
    .filter((z) => z.type === "window" || z.type === "door")
    .some((z) => boxesIntersect(nBox, z.box));
  if (windowOverlap) score -= 80;

  const lengthM = product.dimensionsMm.length / 1000;
  const expectedW = lengthM * pxPerMeter * (profile.visualScaleBoost ?? 1);
  const ratio = item.widthPx / Math.max(expectedW, 1);
  if (ratio >= 0.35 && ratio <= 2.8) score += 15;
  else if (ratio < 0.2) score -= 40;
  else if (ratio > 4) score -= 50;

  if (item.x < 0 || item.y < 0 || item.x > 1 || item.y > 1) score -= 100;
  if (nBox.x < -0.02 || nBox.y < -0.02 || nBox.x + nBox.width > 1.02) score -= 30;

  return score;
}

export function filterScoredPlacements(
  items: PlacedItem[],
  ctx: Omit<ScoreContext, "surface">,
  minScore = -15
): PlacedItem[] {
  const surfaceMap = new Map(ctx.scene.surfaces.map((s) => [s.id, s]));
  return items
    .map((item) => {
      const surface = surfaceMap.get(item.surfaceId);
      const score = scorePlacement(item, { ...ctx, surface });
      return { ...item, score };
    })
    .filter((item) => item.score >= minScore);
}
