import type {
  MountType,
  NormalizedBox,
  NormalizedLine,
  ProductForMounting,
  VisionResult,
} from "./types";
import {
  boxesIntersect,
  clampLineToFacade,
  isMostlyHorizontal,
  isMostlyVertical,
  lineLengthPx,
  lineToThinBox,
} from "./geometry";

/** Окна/двери не режут горизонтальные пояса — только точки монтажа */
const LINE_BLOCKING_BY_MOUNT: Record<
  MountType,
  Array<keyof NonNullable<VisionResult["forbiddenZones"]>>
> = {
  linear_facade: ["sky", "road", "trees"],
  accent_facade: ["sky", "road", "trees"],
  contour: ["sky", "road", "trees"],
  ground_projector: ["sky", "trees"],
  pole: ["sky", "trees"],
};

function forbiddenBoxesForLineScoring(
  result: VisionResult,
  mountType: MountType
): NormalizedBox[] {
  const f = result.forbiddenZones || {};
  return LINE_BLOCKING_BY_MOUNT[mountType].flatMap((key) => f[key] || []);
}

function lineKey(line: NormalizedLine): string {
  return [
    line.x1.toFixed(4),
    line.y1.toFixed(4),
    line.x2.toFixed(4),
    line.y2.toFixed(4),
  ].join(":");
}

function dedupeLines(lines: NormalizedLine[]): NormalizedLine[] {
  const seen = new Set<string>();
  const out: NormalizedLine[] = [];
  for (const line of lines) {
    const key = lineKey(line);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

function ensureContourZones(
  picked: NormalizedLine[],
  visionResult: VisionResult,
  imageWidth: number,
  imageHeight: number,
  maxZones: number
): NormalizedLine[] {
  if (picked.length >= 3) return picked.slice(0, maxZones);

  const fallback = lastFallbackFromFacade(visionResult, "contour")
    .map((line) => clampLineToFacade(line, visionResult.facadeBox))
    .filter((line) => lineLengthPx(line, imageWidth, imageHeight) > 60);

  return dedupeLines([...picked, ...fallback]).slice(0, maxZones);
}

function fallbackZonesFromArchitecture(
  result: VisionResult,
  mountType: MountType
) {
  const a = result.architecture || {};

  if (mountType === "linear_facade") {
    return [
      ...(a.cornices || []),
      ...(a.horizontalBelts || []),
      ...(a.roofEdges || []),
    ];
  }

  if (mountType === "contour") {
    return [
      ...(a.roofEdges || []),
      ...(a.facadeEdges || []),
      ...(a.cornices || []),
    ];
  }

  if (mountType === "accent_facade") {
    return [
      ...(a.verticalPilasters || []),
      ...(a.facadeEdges || []),
    ];
  }

  if (mountType === "ground_projector" || mountType === "pole") {
    return [...(a.groundEdges || [])];
  }

  return [];
}

function lastFallbackFromFacade(
  result: VisionResult,
  mountType: MountType
): NormalizedLine[] {
  const b = result.facadeBox;
  const left = b.x + b.width * 0.08;
  const right = b.x + b.width * 0.92;
  const top = b.y + b.height * 0.08;
  const bottom = b.y + b.height * 0.9;

  if (mountType === "linear_facade") {
    return [
      {
        x1: left,
        y1: b.y + b.height * 0.28,
        x2: right,
        y2: b.y + b.height * 0.28,
        type: "fallback_upper_belt",
      },
      {
        x1: left,
        y1: b.y + b.height * 0.55,
        x2: right,
        y2: b.y + b.height * 0.55,
        type: "fallback_middle_belt",
      },
    ];
  }

  if (mountType === "contour") {
    return [
      { x1: left, y1: top, x2: right, y2: top, type: "fallback_roof_edge" },
      {
        x1: left,
        y1: bottom,
        x2: right,
        y2: bottom,
        type: "fallback_bottom_edge",
      },
      { x1: left, y1: top, x2: left, y2: bottom, type: "fallback_left_edge" },
      {
        x1: right,
        y1: top,
        x2: right,
        y2: bottom,
        type: "fallback_right_edge",
      },
    ];
  }

  if (mountType === "accent_facade") {
    return [
      {
        x1: b.x + b.width * 0.22,
        y1: top,
        x2: b.x + b.width * 0.22,
        y2: bottom,
        type: "fallback_vertical_accent",
      },
      {
        x1: b.x + b.width * 0.5,
        y1: top,
        x2: b.x + b.width * 0.5,
        y2: bottom,
        type: "fallback_vertical_accent",
      },
      {
        x1: b.x + b.width * 0.78,
        y1: top,
        x2: b.x + b.width * 0.78,
        y2: bottom,
        type: "fallback_vertical_accent",
      },
    ];
  }

  return [
    { x1: left, y1: bottom, x2: right, y2: bottom, type: "fallback_ground_line" },
  ];
}

function zoneIntersectsForbidden(line: NormalizedLine, forbidden: NormalizedBox[]) {
  const thin = lineToThinBox(line, 0.025);
  return forbidden.some((box) => boxesIntersect(thin, box));
}

function scoreZone(
  line: NormalizedLine,
  mountType: MountType,
  imageWidth: number,
  imageHeight: number,
  forbidden: NormalizedBox[]
) {
  let score = 0;
  const type = line.type || "";
  const length = lineLengthPx(line, imageWidth, imageHeight);

  if (length < 80) score -= 50;
  if (length > 200) score += 10;

  if (type.includes("cornice")) score += 35;
  if (type.includes("belt")) score += 30;
  if (type.includes("roof")) score += 20;
  if (type.includes("edge")) score += 18;
  if (type.includes("pilaster")) score += 22;
  if (type.includes("ground")) score += 25;
  if (type.includes("window")) score += 28;

  if (mountType === "linear_facade") {
    if (isMostlyHorizontal(line)) score += 35;
    else score -= 80;
  }

  if (mountType === "accent_facade") {
    if (isMostlyVertical(line)) score += 30;
    else if (isMostlyHorizontal(line) && type.includes("window")) score += 25;
    else score -= 20;
  }

  if (mountType === "contour") {
    if (isMostlyHorizontal(line) || isMostlyVertical(line)) score += 20;
  }

  if (mountType === "ground_projector" || mountType === "pole") {
    if (type.includes("ground")) score += 35;
    if (isMostlyHorizontal(line)) score += 15;
  }

  if (zoneIntersectsForbidden(line, forbidden)) score -= 100;

  return score;
}

export function selectMountZones(params: {
  visionResult: VisionResult;
  product: ProductForMounting;
  imageWidth: number;
  imageHeight: number;
  maxZones?: number;
}): NormalizedLine[] {
  const { visionResult, product, imageWidth, imageHeight } = params;
  const mountType = product.mountType;
  const lineForbidden = forbiddenBoxesForLineScoring(visionResult, mountType);

  const direct = visionResult.recommendedMountZones?.[mountType] || [];

  const architectureFallback =
    direct.length > 0 ? [] : fallbackZonesFromArchitecture(visionResult, mountType);

  const finalFallback =
    direct.length === 0 && architectureFallback.length === 0
      ? lastFallbackFromFacade(visionResult, mountType)
      : [];

  const candidates = dedupeLines([...direct, ...architectureFallback, ...finalFallback])
    .map((line) => clampLineToFacade(line, visionResult.facadeBox))
    .filter((line) => {
      const length = lineLengthPx(line, imageWidth, imageHeight);
      return length > 60;
    })
    .map((line) => ({
      line,
      score: scoreZone(line, mountType, imageWidth, imageHeight, lineForbidden),
    }))
    .filter((item) => item.score > -20)
    .sort((a, b) => b.score - a.score);

  const defaultMaxZones =
    mountType === "linear_facade"
      ? 4
      : mountType === "accent_facade"
        ? 8
        : mountType === "contour"
          ? 4
          : 3;

  const maxZones = params.maxZones ?? defaultMaxZones;

  let picked = candidates.slice(0, maxZones).map((item) => item.line);

  if (mountType === "contour") {
    picked = ensureContourZones(
      picked,
      visionResult,
      imageWidth,
      imageHeight,
      maxZones
    );
  }

  if (picked.length > 0) return picked;

  return lastFallbackFromFacade(visionResult, mountType)
    .map((line) => clampLineToFacade(line, visionResult.facadeBox))
    .filter((line) => lineLengthPx(line, imageWidth, imageHeight) > 60)
    .slice(0, maxZones);
}
