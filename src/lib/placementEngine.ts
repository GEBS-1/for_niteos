import { getFixturePlacementProfile } from "@/lib/fixturePlacementProfile";
import {
  runMountingPipeline,
  selectedZonesToMountLines,
} from "@/lib/mounting/pipeline";
import { facadeDetectionToVisionResult, fixtureToProductForMounting } from "@/lib/mounting/adapters";
import { selectMountZones } from "@/lib/mounting/selectMountZones";

import type {
  BuildingDimensions,
  FacadeDetection,
  Fixture,
  FixtureMountType,
  LightingType,
  MountLine,
  MountTarget,
  PlacementScheme,
  ScaleInfo,
} from "./types";

function resolveMountType(fixture: Fixture, mountTarget: MountTarget): FixtureMountType {
  if (fixture.mountType) return fixture.mountType;
  if (mountTarget === "nearby") return "pole";
  if (fixture.category === "linear_facade" || fixture.category === "contour") {
    return "linear";
  }
  return "facade";
}

export function fixturePixelSize(
  fixture: Fixture,
  pxPerMeter: number,
  mountType: FixtureMountType
): { widthPx: number; heightPx: number } {
  const lengthMm = fixture.lengthMm ?? 1000;
  const widthMm = fixture.widthMm ?? lengthMm;
  const heightMm = fixture.heightMm ?? 80;

  if (mountType === "pole") {
    const widthPx = Math.max(36, Math.round((widthMm / 1000) * pxPerMeter));
    const heightPx = Math.max(60, Math.round((heightMm / 1000) * pxPerMeter));
    return { widthPx, heightPx };
  }

  const widthPx = Math.max(48, Math.round((lengthMm / 1000) * pxPerMeter));
  const heightPx = Math.max(12, Math.round((heightMm / 1000) * pxPerMeter));
  return { widthPx, heightPx };
}

export { isMostlyHorizontal } from "@/lib/facadeGeometry";

/**
 * Линии для расстановки — результат selectMountZones (ядро mounting).
 */
export function resolvePlacementMountLines(
  detection: FacadeDetection,
  fixture: Fixture,
  mountTarget: MountTarget,
  lightingType?: LightingType,
  imageWidth = 1200,
  imageHeight = 800
): MountLine[] {
  const visionResult = facadeDetectionToVisionResult(detection);
  const product = fixtureToProductForMounting(fixture, mountTarget, lightingType);
  const profile = getFixturePlacementProfile(fixture, lightingType);
  const zones = selectMountZones({
    visionResult,
    product,
    imageWidth,
    imageHeight,
    maxZones: profile.maxBands,
  });
  return selectedZonesToMountLines(zones);
}

export interface PlaceFixturesInput {
  detection: FacadeDetection;
  scale: ScaleInfo;
  fixture: Fixture;
  mountTarget: MountTarget;
  lightingType?: LightingType;
  imageWidth: number;
  imageHeight: number;
  dimensions?: BuildingDimensions;
}

export function placeFixturesAlongMountLines(input: PlaceFixturesInput): {
  placement: PlacementScheme;
  zoneLengthM: number;
} {
  const { detection, scale, fixture, mountTarget, imageWidth, imageHeight } =
    input;

  const result = runMountingPipeline({
    detection,
    fixture,
    mountTarget,
    lightingType: input.lightingType,
    imageWidth,
    imageHeight,
    pxPerMeter: scale.pixelsPerMeter,
  });

  const mountType = resolveMountType(fixture, mountTarget);
  const fixtures = result.placedFixtures.map((pf) => ({
    productId: pf.productId,
    x: pf.x,
    y: pf.y,
    rotation: pf.rotation,
    widthPx: pf.widthPx,
    heightPx: pf.heightPx,
    scale: pf.widthPx / 1200,
    mountType,
  }));

  const mountLines = selectedZonesToMountLines(result.selectedZones);

  const widthM =
    Math.round(
      ((detection.facadeBox.width * imageWidth) / scale.pixelsPerMeter) * 10
    ) / 10;
  const heightM =
    Math.round(
      ((detection.facadeBox.height * imageHeight) / scale.pixelsPerMeter) * 10
    ) / 10;

  return {
    placement: {
      fixtures,
      facadeBox: detection.facadeBox,
      mountLines,
      pixelsPerMeter: Math.round(scale.pixelsPerMeter * 10) / 10,
      estimatedWidthM: widthM,
      estimatedHeightM: heightM,
    },
    zoneLengthM: result.zoneLengthM,
  };
}
