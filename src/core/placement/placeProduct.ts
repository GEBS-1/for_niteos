import type { PlacedItem, Product, UserReferenceSize } from "@/core/products/types";
import type { SceneAnalysis, Surface } from "@/core/scene/types";
import { clamp01, pointInBox } from "@/core/scene/geometry";
import { fallbackHorizontalBelts } from "@/core/scene/enrichScene";
import { filterScoredPlacements } from "./scorePlacement";

export interface PlaceProductInput {
  sceneAnalysis: SceneAnalysis;
  product: Product;
  userReferenceSize: UserReferenceSize;
}

export interface PlaceProductResult {
  placedItems: PlacedItem[];
  pxPerMeter: number;
  surfacesUsed: Surface[];
}

function computePxPerMeter(
  scene: SceneAnalysis,
  ref: UserReferenceSize
): number {
  const fb = scene.facadeBox;
  if (!fb) return 40;

  if (ref.facadeHeightM && ref.facadeHeightM > 0) {
    return (fb.height * scene.imageHeight) / ref.facadeHeightM;
  }
  if (ref.facadeWidthM && ref.facadeWidthM > 0) {
    return (fb.width * scene.imageWidth) / ref.facadeWidthM;
  }
  if (ref.lengthM && ref.lengthM > 0) {
    return Math.max(fb.width * scene.imageWidth, fb.height * scene.imageHeight) / ref.lengthM;
  }
  return 40;
}

function selectSurfaces(scene: SceneAnalysis, product: Product): Surface[] {
  const profile = product.placementProfile;
  let surfaces = scene.surfaces.filter((s) =>
    profile.surfaceTypes.includes(s.type)
  );

  if (profile.requiresGroundSurface) {
    surfaces = surfaces.filter(
      (s) => s.type === "ground" || s.type === "sidewalk" || s.type === "grass"
    );
  } else if (
    profile.placementMode === "repeated_line" ||
    profile.placementMode === "contour"
  ) {
    surfaces = surfaces.filter((s) => s.orientation === "horizontal");
    if (surfaces.length === 0) {
      surfaces = scene.surfaces.filter(
        (s) =>
          (s.type === "facade" || s.type === "roof") &&
          s.orientation === "horizontal"
      );
    }
  }

  surfaces.sort((a, b) => a.box.y - b.box.y);

  const max = profile.maxSurfaces ?? 6;
  return surfaces.slice(0, max);
}

function surfaceCenterLine(surface: Surface): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  const b = surface.box;
  if (surface.orientation === "horizontal") {
    const y = b.y + b.height / 2;
    return { x1: b.x, y1: y, x2: b.x + b.width, y2: y };
  }
  const x = b.x + b.width / 2;
  return { x1: x, y1: b.y, x2: x, y2: b.y + b.height };
}

function placeAlongLine(
  line: { x1: number; y1: number; x2: number; y2: number },
  product: Product,
  surfaceId: string,
  pxPerMeter: number,
  imageWidth: number,
  imageHeight: number,
  maxOnLine?: number
): PlacedItem[] {
  const profile = product.placementProfile;
  const stepM = profile.mountingStepMeters ?? 2;
  const boost = profile.visualScaleBoost ?? 1;
  const lenPx = Math.hypot(
    (line.x2 - line.x1) * imageWidth,
    (line.y2 - line.y1) * imageHeight
  );
  const stepPx = Math.max(stepM * pxPerMeter, 24);
  let count = Math.max(1, Math.floor(lenPx / stepPx));
  if (profile.onePerSurface) count = 1;
  if (maxOnLine != null) count = Math.min(count, maxOnLine);

  const widthPx = Math.max(
    (product.dimensionsMm.length / 1000) * pxPerMeter * boost,
    18
  );
  const heightPx = Math.max(
    (product.dimensionsMm.height / 1000) * pxPerMeter * boost,
    8
  );

  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const rotation =
    profile.placementMode === "repeated_line"
      ? Math.abs(angle) < 45 || Math.abs(angle) > 135
        ? 0
        : 90
      : Math.round(angle);

  const items: PlacedItem[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = clamp01(line.x1 + dx * t);
    const y = clamp01(line.y1 + dy * t);
    items.push({
      productId: product.id,
      x,
      y,
      xPx: x * imageWidth,
      yPx: y * imageHeight,
      widthPx,
      heightPx,
      rotation,
      surfaceId,
      score: 0,
    });
  }
  return items;
}

function placeGroundRow(
  surfaces: Surface[],
  product: Product,
  pxPerMeter: number,
  scene: SceneAnalysis
): PlacedItem[] {
  const ground =
    surfaces.find((s) => s.type === "sidewalk") ??
    surfaces.find((s) => s.type === "ground") ??
    surfaces[0];
  if (!ground) return [];
  const line = surfaceCenterLine(ground);
  return placeAlongLine(
    line,
    product,
    ground.id,
    pxPerMeter,
    scene.imageWidth,
    scene.imageHeight,
    product.placementProfile.maxItems
  );
}

function placeContour(
  surfaces: Surface[],
  product: Product,
  pxPerMeter: number,
  scene: SceneAnalysis
): PlacedItem[] {
  const horiz = surfaces.filter((s) => s.orientation === "horizontal");
  const vert = surfaces.filter((s) => s.orientation === "vertical");
  const picked = [...horiz.slice(0, 2), ...vert.slice(0, 2)].slice(0, 4);
  const items: PlacedItem[] = [];
  for (const s of picked) {
    items.push(
      ...placeAlongLine(
        surfaceCenterLine(s),
        product,
        s.id,
        pxPerMeter,
        scene.imageWidth,
        scene.imageHeight,
        product.placementProfile.maxItems
      )
    );
  }
  return items;
}

function placeSingleObject(
  surfaces: Surface[],
  product: Product,
  pxPerMeter: number,
  scene: SceneAnalysis
): PlacedItem[] {
  const facade =
    surfaces.find((s) => s.orientation === "horizontal") ?? surfaces[0];
  if (!facade) return [];
  return placeAlongLine(
    surfaceCenterLine(facade),
    product,
    facade.id,
    pxPerMeter,
    scene.imageWidth,
    scene.imageHeight,
    product.placementProfile.maxItems ?? 10
  );
}

/**
 * Universal placement — без сетки по facadeBox.
 */
export function placeProduct(input: PlaceProductInput): PlaceProductResult {
  const { sceneAnalysis, product, userReferenceSize } = input;
  const pxPerMeter = computePxPerMeter(sceneAnalysis, userReferenceSize);
  let surfaces = selectSurfaces(sceneAnalysis, product);
  const horiz = surfaces.filter((s) => s.orientation === "horizontal");
  if (
    product.placementProfile.placementMode === "repeated_line" &&
    horiz.length < 3 &&
    sceneAnalysis.facadeBox
  ) {
    surfaces = [
      ...surfaces,
      ...fallbackHorizontalBelts(sceneAnalysis.facadeBox),
    ];
  }

  const mode = product.placementProfile.placementMode;

  let candidates: PlacedItem[] = [];

  switch (mode) {
    case "ground_row":
      candidates = placeGroundRow(surfaces, product, pxPerMeter, sceneAnalysis);
      break;
    case "contour":
      candidates = placeContour(surfaces, product, pxPerMeter, sceneAnalysis);
      break;
    case "single_object":
    case "grid_surface":
      candidates = placeSingleObject(
        surfaces,
        product,
        pxPerMeter,
        sceneAnalysis
      );
      break;
    case "repeated_line":
    default:
      for (const surface of surfaces) {
        if (surface.orientation !== "horizontal") continue;
        candidates.push(
          ...placeAlongLine(
            surfaceCenterLine(surface),
            product,
            surface.id,
            pxPerMeter,
            sceneAnalysis.imageWidth,
            sceneAnalysis.imageHeight
          )
        );
      }
      break;
  }

  const maxItems = product.placementProfile.maxItems ?? 120;
  candidates = candidates.slice(0, maxItems * 3);

  const placedItems = filterScoredPlacements(
    candidates,
    {
      scene: sceneAnalysis,
      product,
      pxPerMeter,
      imageWidth: sceneAnalysis.imageWidth,
      imageHeight: sceneAnalysis.imageHeight,
    },
    -15
  ).slice(0, maxItems);

  const usedIds = new Set(placedItems.map((p) => p.surfaceId));
  const surfacesUsed = surfaces.filter((s) => usedIds.has(s.id));

  return { placedItems, pxPerMeter, surfacesUsed };
}
