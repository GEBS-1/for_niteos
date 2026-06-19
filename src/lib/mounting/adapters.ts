import { getFixturePlacementProfile } from "@/lib/fixturePlacementProfile";
import { getMountZoneKey } from "@/lib/mountRules";
import { filterPlacementsByForbidden } from "@/lib/mountZoneGeometry";
import type {
  FacadeArchitecture,
  FacadeDetection,
  Fixture,
  FixtureMountType,
  FixturePlacement,
  LightingType,
  MountLine,
  MountTarget,
  MountZoneKey,
  RecommendedMountZones,
  ZoneBox,
  ZoneLine,
} from "@/lib/types";
import type {
  MountType,
  NormalizedBox,
  NormalizedLine,
  ProductForMounting,
  VisionResult,
} from "./types";

function zoneLineToNormalized(line: ZoneLine): NormalizedLine {
  return {
    x1: line.x1,
    y1: line.y1,
    x2: line.x2,
    y2: line.y2,
    type: line.type ?? line.label,
  };
}

function boxToVerticalLine(box: ZoneBox, type: string): NormalizedLine {
  const cx = box.x + box.width / 2;
  return {
    x1: cx,
    y1: box.y,
    x2: cx,
    y2: box.y + box.height,
    type,
  };
}

function verticalLinesFromMountLines(mountLines: MountLine[]): NormalizedLine[] {
  return mountLines
    .filter((ml) => {
      const dx = Math.abs(ml.x2 - ml.x1);
      const dy = Math.abs(ml.y2 - ml.y1);
      return dx < 0.025 && dy > 0.08;
    })
    .map((ml) => ({
      x1: ml.x1,
      y1: ml.y1,
      x2: ml.x2,
      y2: ml.y2,
      type: ml.label ?? "facade_edge",
    }));
}

function buildContourRecommended(
  detection: FacadeDetection,
  architecture?: FacadeArchitecture
): NormalizedLine[] {
  const roof = (architecture?.roofLine ?? []).map(zoneLineToNormalized);
  const vertical = verticalLinesFromMountLines(detection.mountLines);
  const cornices = (architecture?.cornices ?? []).map(zoneLineToNormalized);
  return [...roof, ...vertical, ...cornices];
}

function mapRecommendedZones(
  detection: FacadeDetection,
  rec?: RecommendedMountZones,
  architecture?: FacadeArchitecture
): VisionResult["recommendedMountZones"] {
  const windowLines = (rec?.window_lighting ?? []).map((line) =>
    zoneLineToNormalized({
      ...line,
      type: line.type ?? line.label ?? "window",
    })
  );

  return {
    linear_facade: (rec?.linear_facade ?? []).map(zoneLineToNormalized),
    accent_facade: [
      ...(rec?.accent_facade ?? []).map(zoneLineToNormalized),
      ...windowLines,
    ],
    contour: buildContourRecommended(detection, architecture),
    ground_projector: (rec?.ground_projector ?? []).map(zoneLineToNormalized),
    pole: (rec?.pole_lighting ?? []).map(zoneLineToNormalized),
  };
}

export function facadeDetectionToVisionResult(
  detection: FacadeDetection
): VisionResult {
  const a = detection.architecture;
  const pilasters = [
    ...(a?.pilasters ?? []).map((b) => boxToVerticalLine(b, "pilaster")),
    ...(a?.columns ?? []).map((b) => boxToVerticalLine(b, "column")),
  ];

  return {
    facadeBox: detection.facadeBox,
    architecture: a
      ? {
          horizontalBelts: a.floorBelts.map(zoneLineToNormalized),
          cornices: a.cornices.map(zoneLineToNormalized),
          roofEdges: a.roofLine.map(zoneLineToNormalized),
          facadeEdges: verticalLinesFromMountLines(detection.mountLines),
          verticalPilasters: pilasters,
          columns: a.columns as NormalizedBox[],
          windowRows: a.windowRows as NormalizedBox[],
          windowFrames: a.windowRows as NormalizedBox[],
          entranceZone: a.entranceZone as NormalizedBox[],
          groundEdges: [
            ...a.groundLine.map(zoneLineToNormalized),
            ...a.sidewalk.map(zoneLineToNormalized),
            ...a.grass.map(zoneLineToNormalized),
          ],
        }
      : undefined,
    forbiddenZones: detection.forbiddenZones,
    recommendedMountZones: mapRecommendedZones(
      detection,
      detection.recommendedMountZones,
      a
    ),
  };
}

export function resolveProductMountType(
  fixture: Fixture,
  mountTarget: MountTarget,
  lightingType?: LightingType
): MountType {
  const profile = getFixturePlacementProfile(fixture, lightingType);

  if (mountTarget === "nearby" || profile.placementMode === "pole_row") {
    return "pole";
  }
  if (
    profile.placementMode === "contour_perimeter" ||
    fixture.category === "contour"
  ) {
    return "contour";
  }
  if (
    profile.placementMode === "accent_points" ||
    profile.placementMode === "linear_accent"
  ) {
    return "accent_facade";
  }
  if (
    profile.placementMode === "window_reveal" ||
    profile.placementMode === "flood_wash"
  ) {
    return profile.placementMode === "window_reveal"
      ? "accent_facade"
      : "ground_projector";
  }
  return "linear_facade";
}

export function fixtureToProductForMounting(
  fixture: Fixture,
  mountTarget: MountTarget,
  lightingType?: LightingType
): ProductForMounting {
  return {
    id: fixture.id,
    name: fixture.name,
    mountType: resolveProductMountType(fixture, mountTarget, lightingType),
    lengthMm: fixture.lengthMm ?? 1000,
    widthMm: fixture.widthMm,
    heightMm: fixture.heightMm ?? 80,
    mountingStepMeters: fixture.mountingStepMeters,
    priceRub: fixture.priceRub ?? fixture.price,
    powerW: fixture.powerW ?? fixture.power,
    image: fixture.image,
  };
}

export function mountTypeToZoneKey(mountType: MountType): MountZoneKey {
  switch (mountType) {
    case "pole":
      return "pole_lighting";
    case "ground_projector":
      return "ground_projector";
    case "accent_facade":
      return "accent_facade";
    case "contour":
      return "accent_facade";
    default:
      return "linear_facade";
  }
}

export function normalizedLineToMountLine(
  line: NormalizedLine,
  index: number
): MountLine {
  return {
    id: line.type ? `${line.type}-${index}` : `zone-${index}`,
    x1: line.x1,
    y1: line.y1,
    x2: line.x2,
    y2: line.y2,
    label: line.type,
  };
}

export function placedFixtureToPlacement(
  placed: {
    productId: string;
    x: number;
    y: number;
    widthPx: number;
    heightPx: number;
    rotation: number;
  },
  mountType: FixtureMountType
): FixturePlacement {
  return {
    productId: placed.productId,
    x: placed.x,
    y: placed.y,
    rotation: placed.rotation,
    widthPx: placed.widthPx,
    heightPx: placed.heightPx,
    scale: placed.widthPx / 1200,
    mountType,
  };
}

export function filterPlacedFixturesByForbidden(
  fixtures: FixturePlacement[],
  detection: FacadeDetection,
  fixture: Fixture,
  mountTarget: MountTarget,
  lightingType?: LightingType
): FixturePlacement[] {
  const profile = getFixturePlacementProfile(fixture, lightingType);
  const zoneKey = getMountZoneKey(fixture, mountTarget, profile);
  return filterPlacementsByForbidden(
    fixtures,
    detection.forbiddenZones,
    zoneKey
  );
}
