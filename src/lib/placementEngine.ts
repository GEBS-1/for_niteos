import {
  buildGroundFrontLine,
  resolveAccentMountLines,
  resolveLinearMountLines,
} from "@/lib/facadeGeometry";
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
  if (fixture.category === "linear_facade") return "linear";
  return "facade";
}

function fixturePixelSize(
  fixture: Fixture,
  pxPerMeter: number,
  mountType: FixtureMountType
): { widthPx: number; heightPx: number } {
  const lengthMm = fixture.lengthMm ?? 1000;
  const widthMm = fixture.widthMm ?? lengthMm;
  const heightMm = fixture.heightMm ?? 80;

  if (mountType === "pole") {
    const widthPx = Math.max(40, Math.round((widthMm / 1000) * pxPerMeter));
    const heightPx = Math.max(80, Math.round((heightMm / 1000) * pxPerMeter));
    return { widthPx, heightPx };
  }

  const widthPx = Math.max(56, Math.round((lengthMm / 1000) * pxPerMeter));
  const heightPx = Math.max(14, Math.round((heightMm / 1000) * pxPerMeter));
  return { widthPx, heightPx };
}

/**
 * Линии для расстановки (детекция уже нормализована в facadeGeometry).
 */
export function resolvePlacementMountLines(
  detection: FacadeDetection,
  fixture: Fixture,
  mountTarget: MountTarget,
  lightingType?: LightingType
): MountLine[] {
  const mountType = resolveMountType(fixture, mountTarget);

  if (mountType === "pole" || mountTarget === "nearby") {
    return [buildGroundFrontLine(detection.facadeBox)];
  }

  const isLinear =
    mountType === "linear" ||
    fixture.category === "linear_facade" ||
    lightingType === "линейная";

  if (isLinear) {
    return resolveLinearMountLines(detection.facadeBox, detection.mountLines);
  }

  if (lightingType === "акцентная") {
    return resolveAccentMountLines(detection.facadeBox, detection.mountLines);
  }

  if (lightingType === "заливная") {
    return resolveLinearMountLines(detection.facadeBox, detection.mountLines, 2, 4);
  }

  return detection.mountLines.length > 0
    ? detection.mountLines
    : resolveLinearMountLines(detection.facadeBox, []);
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
      const count = Math.max(1, Math.ceil(lenM / stepM));
      fixtures.push(
        ...placeAlongLine(ml, count, productId, mountType, widthPx, heightPx)
      );
    }
  }

  const widthM = Math.round(
    ((detection.facadeBox.width * imageWidth) / scale.pixelsPerMeter) * 10
  ) / 10;
  const heightM = Math.round(
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
    zoneLengthM: Math.round(zoneLengthM * 10) / 10,
  };
}
