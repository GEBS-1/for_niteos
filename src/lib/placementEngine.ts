import {

  buildGroundFrontLine,

  resolveAccentMountLines,

  resolveContourMountLines,

  resolveFloodMountLines,

  resolveLinearMountLines,

  resolveWindowMountLines,

} from "@/lib/facadeGeometry";

import {

  getFixturePlacementProfile,

  type FixturePlacementProfile,

} from "@/lib/fixturePlacementProfile";

import { estimatePoleZoneLengthM, isParkPoleFixture } from "@/lib/fixtureMount";

import type {

  BuildingDimensions,

  FacadeDetection,

  Fixture,

  FixtureMountType,

  FixturePlacement,

  LightingType,

  MountLine,

  MountTarget,

  PlacementScheme,

  ScaleInfo,

} from "./types";



function clamp01(v: number): number {

  return Math.max(0, Math.min(1, v));

}



function lineLengthPx(ml: MountLine, imageWidth: number, imageHeight: number): number {

  const dx = (ml.x2 - ml.x1) * imageWidth;

  const dy = (ml.y2 - ml.y1) * imageHeight;

  return Math.sqrt(dx * dx + dy * dy);

}



function lineLengthM(lengthPx: number, pxPerMeter: number): number {

  return lengthPx / pxPerMeter;

}



function lineAngleDeg(ml: MountLine): number {

  const dx = ml.x2 - ml.x1;

  const dy = ml.y2 - ml.y1;

  return (Math.atan2(dy, dx) * 180) / Math.PI;

}



export { isMostlyHorizontal } from "@/lib/facadeGeometry";



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



function countForLine(
  lenPx: number,
  lenM: number,
  stepM: number,
  pxPerMeter: number,
  profile: FixturePlacementProfile
): number {
  const mountingStepPx = Math.max(8, stepM * pxPerMeter);
  const effectiveStepPx = mountingStepPx * (profile.stepMultiplier ?? 1);
  let count = Math.max(1, Math.floor(lenPx / effectiveStepPx));

  if (profile.onePerSegment) {
    return 1;
  }
  if (profile.maxFixturesPerLine != null) {
    count = Math.min(count, profile.maxFixturesPerLine);
  }
  if (profile.placementMode === "linear_accent") {
    count = Math.min(count, profile.maxFixturesPerLine ?? 4);
  }
  // fallback если линия очень короткая
  if (count < 1 && lenM > 0) {
    count = Math.max(1, Math.floor(lenM / (stepM * (profile.stepMultiplier ?? 1))));
  }
  return count;
}



/**

 * Линии для расстановки по профилю светильника.

 */

export function resolvePlacementMountLines(

  detection: FacadeDetection,

  fixture: Fixture,

  mountTarget: MountTarget,

  lightingType?: LightingType

): MountLine[] {

  const profile = getFixturePlacementProfile(fixture, lightingType);

  const mountType = resolveMountType(fixture, mountTarget);



  if (mountType === "pole" || mountTarget === "nearby") {

    return [buildGroundFrontLine(detection.facadeBox)];

  }



  const box = detection.facadeBox;

  const detected = detection.mountLines;



  switch (profile.placementMode) {

    case "linear_ribbon":

      return resolveLinearMountLines(

        box,

        detected,

        profile.minBands ?? 4,

        profile.maxBands ?? 6

      );

    case "linear_accent":

      return resolveLinearMountLines(

        box,

        detected,

        profile.minBands ?? 2,

        profile.maxBands ?? 4

      );

    case "contour_perimeter":

      return resolveContourMountLines(box, detected);

    case "flood_wash":

      return resolveFloodMountLines(

        box,

        detected,

        profile.minBands ?? 2,

        profile.maxBands ?? 3

      );

    case "accent_points":

      return resolveAccentMountLines(box, detected);

    case "window_reveal":

      return resolveWindowMountLines(box, detected, profile.maxTotalFixtures ?? 40);

    case "pole_row":

      return [buildGroundFrontLine(box)];

    default:

      return detected.length > 0

        ? detected

        : resolveLinearMountLines(box, []);

  }

}



function placeAlongLine(

  ml: MountLine,

  count: number,

  productId: string,

  mountType: FixtureMountType,

  widthPx: number,

  heightPx: number

): FixturePlacement[] {

  const angle = lineAngleDeg(ml);

  const rotation =

    mountType === "linear"

      ? Math.abs(angle) < 45 || Math.abs(angle) > 135

        ? 0

        : 90

      : mountType === "pole"

        ? 0

        : rotationFromAngle(angle);



  const out: FixturePlacement[] = [];

  for (let i = 0; i < count; i++) {

    const t = count <= 1 ? 0.5 : i / (count - 1);

    out.push({

      x: clamp01(ml.x1 + (ml.x2 - ml.x1) * t),

      y: clamp01(ml.y1 + (ml.y2 - ml.y1) * t),

      rotation,

      widthPx,

      heightPx,

      scale: widthPx / 1200,

      productId,

      mountType,

    });

  }

  return out;

}



function rotationFromAngle(angle: number): number {

  if (Math.abs(angle) < 25) return 0;

  if (Math.abs(angle - 90) < 25 || Math.abs(angle + 90) < 25) return 90;

  return Math.round(angle);

}



function capTotalFixtures(

  fixtures: FixturePlacement[],

  profile: FixturePlacementProfile

): FixturePlacement[] {

  if (profile.maxTotalFixtures == null) return fixtures;

  return fixtures.slice(0, profile.maxTotalFixtures);

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

  const { detection, scale, fixture, mountTarget, imageWidth, imageHeight } = input;

  const productId = fixture.id;

  const profile = getFixturePlacementProfile(fixture, input.lightingType);

  const mountType = resolveMountType(fixture, mountTarget);

  const stepM = fixture.mountingStepMeters;

  const { widthPx, heightPx } = fixturePixelSize(

    fixture,

    scale.pixelsPerMeter,

    mountType

  );



  const mountLines = resolvePlacementMountLines(

    detection,

    fixture,

    mountTarget,

    input.lightingType

  );



  const fixtures: FixturePlacement[] = [];

  let zoneLengthM = 0;



  const usePoleZone =

    mountType === "pole" ||

    mountTarget === "nearby" ||

    isParkPoleFixture(fixture);



  if (usePoleZone) {

    zoneLengthM = estimatePoleZoneLengthM(

      detection.facadeBox,

      scale,

      input.dimensions,

      imageWidth,

      imageHeight

    );

    const ml = mountLines[0] ?? buildGroundFrontLine(detection.facadeBox);

    const count = Math.max(1, Math.ceil(zoneLengthM / stepM));

    fixtures.push(

      ...placeAlongLine(ml, count, productId, mountType, widthPx, heightPx)

    );

  } else {

    for (const ml of mountLines) {

      const lenPx = lineLengthPx(ml, imageWidth, imageHeight);

      const lenM = lineLengthM(lenPx, scale.pixelsPerMeter);

      zoneLengthM += lenM;

      const count = countForLine(
        lenPx,
        lenM,
        stepM,
        scale.pixelsPerMeter,
        profile
      );

      fixtures.push(

        ...placeAlongLine(ml, count, productId, mountType, widthPx, heightPx)

      );

    }

  }



  const capped = capTotalFixtures(fixtures, profile);



  const widthM = Math.round(

    ((detection.facadeBox.width * imageWidth) / scale.pixelsPerMeter) * 10

  ) / 10;

  const heightM = Math.round(

    ((detection.facadeBox.height * imageHeight) / scale.pixelsPerMeter) * 10

  ) / 10;



  return {

    placement: {

      fixtures: capped,

      facadeBox: detection.facadeBox,

      mountLines,

      pixelsPerMeter: Math.round(scale.pixelsPerMeter * 10) / 10,

      estimatedWidthM: widthM,

      estimatedHeightM: heightM,

    },

    zoneLengthM: Math.round(zoneLengthM * 10) / 10,

  };

}


