import { getFixturePlacementProfile } from "@/lib/fixturePlacementProfile";
import type { FacadeDetection, Fixture, FixtureMountType, LightingType, MountTarget } from "@/lib/types";
import {
  facadeDetectionToVisionResult,
  filterPlacedFixturesByForbidden,
  fixtureToProductForMounting,
  normalizedLineToMountLine,
  placedFixtureToPlacement,
  resolveProductMountType,
} from "./adapters";
import { buildSpecification } from "./buildSpecification";
import { lineLengthPx } from "./geometry";
import { placeFixturesOnMountZones } from "./placeFixtures";
import { selectMountZones } from "./selectMountZones";
import type { MountingPipelineResult } from "./types";

function resolveFixtureMountType(
  fixture: Fixture,
  mountTarget: MountTarget
): FixtureMountType {
  if (fixture.mountType) return fixture.mountType;
  if (mountTarget === "nearby") return "pole";
  if (fixture.category === "linear_facade" || fixture.category === "contour") {
    return "linear";
  }
  return "facade";
}

export function runMountingPipeline(params: {
  detection: FacadeDetection;
  fixture: Fixture;
  mountTarget: MountTarget;
  lightingType?: LightingType;
  imageWidth: number;
  imageHeight: number;
  pxPerMeter: number;
  visualBoost?: number;
}): MountingPipelineResult {
  const {
    detection,
    fixture,
    mountTarget,
    lightingType,
    imageWidth,
    imageHeight,
    pxPerMeter,
    visualBoost = 2.2,
  } = params;

  const profile = getFixturePlacementProfile(fixture, lightingType);
  const visionResult = facadeDetectionToVisionResult(detection);
  const product = fixtureToProductForMounting(fixture, mountTarget, lightingType);
  const mountType = resolveProductMountType(fixture, mountTarget, lightingType);

  const maxZones =
    profile.maxBands ??
    (mountType === "linear_facade"
      ? 4
      : mountType === "accent_facade"
        ? 8
        : mountType === "contour"
          ? 4
          : 3);

  const selectedZones = selectMountZones({
    visionResult,
    product,
    imageWidth,
    imageHeight,
    maxZones,
  });

  let placedFixtures = placeFixturesOnMountZones({
    zones: selectedZones,
    product,
    imageWidth,
    imageHeight,
    pxPerMeter,
    visualBoost,
    maxFixtures: profile.maxTotalFixtures ?? 120,
    stepMultiplier: profile.stepMultiplier ?? 1,
    maxFixturesPerLine: profile.onePerSegment
      ? 1
      : profile.maxFixturesPerLine,
  });

  const fixtureMountType = resolveFixtureMountType(fixture, mountTarget);
  const asPlacements = placedFixtures.map((pf) =>
    placedFixtureToPlacement(pf, fixtureMountType)
  );
  const filtered = filterPlacedFixturesByForbidden(
    asPlacements,
    detection,
    fixture,
    mountTarget,
    lightingType
  );
  const allowed = new Set(
    filtered.map((fp) => `${fp.x.toFixed(5)}:${fp.y.toFixed(5)}`)
  );
  placedFixtures = placedFixtures.filter((pf) =>
    allowed.has(`${pf.x.toFixed(5)}:${pf.y.toFixed(5)}`)
  );

  const specification = buildSpecification(product, placedFixtures);

  let zoneLengthM = 0;
  for (const zone of selectedZones) {
    zoneLengthM +=
      lineLengthPx(zone, imageWidth, imageHeight) / pxPerMeter;
  }

  return {
    visionResult,
    selectedZones,
    placedFixtures,
    specification,
    zoneLengthM: Math.round(zoneLengthM * 10) / 10,
  };
}

export function selectedZonesToMountLines(
  zones: MountingPipelineResult["selectedZones"]
) {
  return zones.map(normalizedLineToMountLine);
}

export { selectMountZones } from "./selectMountZones";
export { placeFixturesOnMountZones } from "./placeFixtures";
export { buildSpecification } from "./buildSpecification";
export * from "./types";
export * from "./geometry";
export * from "./adapters";
