import { getFixturePlacementProfile } from "@/lib/fixturePlacementProfile";
import {
  linesFromArchitecture,
  MOUNT_RULES,
  type ArchitectureBoxSource,
  type ArchitectureLineSource,
  type ForbiddenZoneKey,
  getMountZoneKey,
} from "@/lib/mountRules";
import {
  clampMountLineToBox,
  isMostlyHorizontal,
  lineCenterY,
} from "@/lib/facadeGeometry";
import type {
  FacadeArchitecture,
  FacadeDetection,
  Fixture,
  FixturePlacement,
  ForbiddenZones,
  LightingType,
  MountLine,
  MountTarget,
  MountZoneKey,
  NormalizedBox,
  ZoneBox,
  ZoneLine,
} from "./types";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function zoneLineToMountLine(zl: ZoneLine, index: number): MountLine {
  return {
    id: zl.id ?? `zone-line-${index}`,
    x1: clamp01(zl.x1),
    y1: clamp01(zl.y1),
    x2: clamp01(zl.x2),
    y2: clamp01(zl.y2),
    label: zl.label ?? zl.type,
  };
}

export function pointInBox(x: number, y: number, box: ZoneBox): boolean {
  return (
    x >= box.x &&
    x <= box.x + box.width &&
    y >= box.y &&
    y <= box.y + box.height
  );
}

export function pointInAnyForbidden(
  x: number,
  y: number,
  forbidden?: ForbiddenZones
): boolean {
  if (!forbidden) return false;
  for (const boxes of Object.values(forbidden)) {
    for (const box of boxes) {
      if (pointInBox(x, y, box)) return true;
    }
  }
  return false;
}

function lineSamplePoints(ml: MountLine, samples = 7): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < samples; i++) {
    const t = samples <= 1 ? 0.5 : i / (samples - 1);
    pts.push({
      x: ml.x1 + (ml.x2 - ml.x1) * t,
      y: ml.y1 + (ml.y2 - ml.y1) * t,
    });
  }
  return pts;
}

export function lineHitsForbidden(
  ml: MountLine,
  forbidden?: ForbiddenZones,
  threshold = 0.34
): boolean {
  if (!forbidden) return false;
  const pts = lineSamplePoints(ml);
  const bad = pts.filter((p) => pointInAnyForbidden(p.x, p.y, forbidden)).length;
  return bad / pts.length > threshold;
}

const LINE_BLOCKING_BY_ZONE: Record<MountZoneKey, ForbiddenZoneKey[]> = {
  linear_facade: ["sky", "road", "trees"],
  accent_facade: ["sky", "road", "trees"],
  window_lighting: ["sky", "road", "trees"],
  ground_projector: ["sky", "trees"],
  pole_lighting: ["sky", "trees"],
};

const POINT_BLOCKING_BY_ZONE: Record<MountZoneKey, ForbiddenZoneKey[]> = {
  linear_facade: ["sky", "road", "windows", "doors", "trees", "cars", "people"],
  accent_facade: ["sky", "road", "trees", "cars", "people"],
  window_lighting: ["sky", "road", "trees", "cars", "people"],
  ground_projector: ["sky", "trees", "cars", "people"],
  pole_lighting: ["sky", "windows", "doors", "trees"],
};

const LINE_BLOCKING_FORBIDDEN: ForbiddenZoneKey[] = [
  "sky",
  "road",
  "trees",
];

function forbiddenSubset(
  forbidden: ForbiddenZones | undefined,
  keys: ForbiddenZoneKey[]
): ForbiddenZones | undefined {
  if (!forbidden) return undefined;
  const out = {} as ForbiddenZones;
  for (const key of keys) {
    out[key] = forbidden[key];
  }
  return out;
}

export function filterMountLinesByForbidden(
  lines: MountLine[],
  forbidden?: ForbiddenZones,
  zoneKey?: MountZoneKey
): MountLine[] {
  const keys = zoneKey ? LINE_BLOCKING_BY_ZONE[zoneKey] : LINE_BLOCKING_FORBIDDEN;
  const lineForbidden = forbiddenSubset(forbidden, keys);
  return lines.filter((ml) => !lineHitsForbidden(ml, lineForbidden, 0.45));
}

export function filterPlacementsByForbidden(
  fixtures: FixturePlacement[],
  forbidden?: ForbiddenZones,
  zoneKey?: MountZoneKey
): FixturePlacement[] {
  const keys = zoneKey
    ? POINT_BLOCKING_BY_ZONE[zoneKey]
    : (Object.keys(forbidden ?? {}) as ForbiddenZoneKey[]);
  const pointForbidden = forbiddenSubset(forbidden, keys);
  return fixtures.filter((fp) => !pointInAnyForbidden(fp.x, fp.y, pointForbidden));
}

function boxesToAccentLines(
  boxes: ZoneBox[],
  facadeBox: NormalizedBox,
  prefix: string
): MountLine[] {
  const lines: MountLine[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height * 0.35;
    const span = Math.max(facadeBox.width * 0.06, b.width * 0.9);
    lines.push({
      id: `${prefix}-${i}`,
      x1: clamp01(cx - span / 2),
      y1: clamp01(cy),
      x2: clamp01(cx + span / 2),
      y2: clamp01(cy),
      label: b.type ?? prefix,
    });
  }
  return lines;
}

function windowBoxesToLines(
  boxes: ZoneBox[],
  facadeBox: NormalizedBox
): MountLine[] {
  const lines: MountLine[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const insetX = b.width * 0.1;
    const x1 = b.x + insetX;
    const x2 = b.x + b.width - insetX;
    lines.push({
      id: `win-top-${i}`,
      x1: clamp01(x1),
      y1: clamp01(b.y + b.height * 0.12),
      x2: clamp01(x2),
      y2: clamp01(b.y + b.height * 0.12),
      label: "window top",
    });
    lines.push({
      id: `win-bot-${i}`,
      x1: clamp01(x1),
      y1: clamp01(b.y + b.height * 0.88),
      x2: clamp01(x2),
      y2: clamp01(b.y + b.height * 0.88),
      label: "window bottom",
    });
  }
  return lines.filter((ml) => horizontalSpan(ml) <= facadeBox.width * 0.25);
}

function horizontalSpan(ml: MountLine): number {
  return Math.abs(ml.x2 - ml.x1);
}

function dedupeLines(lines: MountLine[], yThreshold: number): MountLine[] {
  const sorted = [...lines].sort((a, b) => lineCenterY(a) - lineCenterY(b));
  const out: MountLine[] = [];
  for (const ml of sorted) {
    const dup = out.some(
      (m) =>
        Math.abs(lineCenterY(m) - lineCenterY(ml)) < yThreshold &&
        Math.abs(m.x1 - ml.x1) < 0.04
    );
    if (!dup) out.push(ml);
  }
  return out;
}

function collectArchitectureLines(
  architecture: FacadeArchitecture,
  lineSources: ArchitectureLineSource[],
  boxSources: ArchitectureBoxSource[],
  facadeBox: NormalizedBox,
  zoneKey: MountZoneKey
): MountLine[] {
  const lines = linesFromArchitecture(architecture, lineSources).map(zoneLineToMountLine);
  if (boxSources.includes("columns")) {
    lines.push(...boxesToAccentLines(architecture.columns, facadeBox, "column"));
  }
  if (boxSources.includes("pilasters")) {
    lines.push(...boxesToAccentLines(architecture.pilasters, facadeBox, "pilaster"));
  }
  if (boxSources.includes("entranceZone")) {
    lines.push(...boxesToAccentLines(architecture.entranceZone, facadeBox, "entrance"));
  }
  if (boxSources.includes("windowRows") || zoneKey === "window_lighting") {
    lines.push(...windowBoxesToLines(architecture.windowRows, facadeBox));
  }
  return lines;
}

export function buildDefaultForbiddenZones(box: NormalizedBox): ForbiddenZones {
  const top = box.y;
  const bottom = box.y + box.height;
  return {
    sky: [
      {
        x: 0,
        y: 0,
        width: 1,
        height: clamp01(Math.max(0.04, top - 0.01)),
        type: "sky",
      },
    ],
    road: [
      {
        x: 0,
        y: clamp01(bottom + 0.01),
        width: 1,
        height: clamp01(1 - bottom - 0.01),
        type: "road",
      },
    ],
    windows: [],
    doors: [],
    trees: [],
    cars: [],
    people: [],
  };
}

export function buildArchitectureFromMountLines(
  box: NormalizedBox,
  mountLines: MountLine[]
): FacadeArchitecture {
  const horiz = mountLines
    .filter(isMostlyHorizontal)
    .sort((a, b) => lineCenterY(a) - lineCenterY(b));
  const cornices = horiz.length > 0 ? [horiz[0]] : [];
  const floorBelts = horiz.length > 1 ? horiz.slice(1) : horiz;
  const groundY = Math.min(0.97, box.y + box.height + 0.03);
  return {
    roofLine: cornices,
    cornices,
    floorBelts,
    columns: [],
    pilasters: [],
    windowRows: [],
    entranceZone: [],
    groundLine: [
      {
        x1: box.x + 0.04,
        y1: groundY,
        x2: box.x + box.width - 0.04,
        y2: groundY,
        type: "groundLine",
      },
    ],
    sidewalk: [],
    grass: [],
  };
}

export function ensureDetectionZones(
  detection: FacadeDetection,
  zoneKey: MountZoneKey
): FacadeDetection {
  const box = detection.facadeBox;
  const architecture =
    detection.architecture ??
    buildArchitectureFromMountLines(box, detection.mountLines);
  const forbiddenZones =
    detection.forbiddenZones ?? buildDefaultForbiddenZones(box);

  const recommended = detection.recommendedMountZones ?? {
    linear_facade: [],
    accent_facade: [],
    window_lighting: [],
    ground_projector: [],
    pole_lighting: [],
  };

  const archLines = collectArchitectureLines(
    architecture,
    MOUNT_RULES[zoneKey].allowedLineSources,
    MOUNT_RULES[zoneKey].allowedBoxSources,
    box,
    zoneKey
  );

  const existingRecommended = (recommended[zoneKey] ?? []).map(zoneLineToMountLine);
  const mergedRecommended =
    existingRecommended.length > 0 ? existingRecommended : archLines;

  return {
    ...detection,
    architecture,
    forbiddenZones,
    recommendedMountZones: {
      ...recommended,
      [zoneKey]: mergedRecommended.map((ml, i) => ({
        x1: ml.x1,
        y1: ml.y1,
        x2: ml.x2,
        y2: ml.y2,
        type: ml.label,
        id: ml.id ?? `rec-${i}`,
        label: ml.label,
      })),
    },
  };
}

export function resolveAllowedMountLines(
  detection: FacadeDetection,
  zoneKey: MountZoneKey,
  fixture?: Fixture,
  lightingType?: LightingType,
  mountTarget?: MountTarget
): MountLine[] {
  const rules = MOUNT_RULES[zoneKey];
  const enriched = ensureDetectionZones(detection, zoneKey);
  const box = enriched.facadeBox;
  const forbidden = enriched.forbiddenZones;

  const recommended = (enriched.recommendedMountZones?.[zoneKey] ?? []).map(
    zoneLineToMountLine
  );
  const fromArchitecture = collectArchitectureLines(
    enriched.architecture!,
    rules.allowedLineSources,
    rules.allowedBoxSources,
    box,
    zoneKey
  );

  const profile = fixture
    ? getFixturePlacementProfile(fixture, lightingType)
    : null;

  let lines =
    recommended.length > 0
      ? recommended
      : fromArchitecture.length > 0
        ? fromArchitecture
        : detection.mountLines;

  if (zoneKey === "pole_lighting" || zoneKey === "ground_projector") {
    const groundMin = box.y + box.height * 0.72;
    lines = lines.filter((ml) => lineCenterY(ml) >= groundMin);
  } else if (profile?.placementMode === "contour_perimeter") {
    lines = lines
      .map((ml) => clampMountLineToBox(ml, box))
      .filter((ml) => horizontalSpan(ml) > 0.02 || !isMostlyHorizontal(ml));
  } else if (zoneKey === "accent_facade" || zoneKey === "window_lighting") {
    const top = box.y + box.height * 0.04;
    const bottom = box.y + box.height * 0.96;
    const minSpan =
      zoneKey === "window_lighting" ? box.width * 0.04 : box.width * 0.05;
    lines = lines
      .filter(isMostlyHorizontal)
      .filter((ml) => {
        const y = lineCenterY(ml);
        return y >= top && y <= bottom;
      })
      .filter((ml) => horizontalSpan(ml) >= minSpan);
  } else {
    const top = box.y + box.height * 0.04;
    const bottom = box.y + box.height * 0.96;
    lines = lines
      .filter(isMostlyHorizontal)
      .filter((ml) => {
        const y = lineCenterY(ml);
        return y >= top && y <= bottom;
      })
      .filter((ml) => horizontalSpan(ml) >= box.width * 0.15);
  }

  lines = lines
    .map((ml) => clampMountLineToBox(ml, box))
    .filter((ml) => horizontalSpan(ml) > 0.02 || !isMostlyHorizontal(ml));

  lines = filterMountLinesByForbidden(lines, forbidden, zoneKey);
  lines = dedupeLines(lines, box.height * 0.055);

  const maxBands = profile?.maxBands ?? 6;
  if (zoneKey === "linear_facade" && lines.length > maxBands) {
    lines = lines.slice(0, maxBands);
  }

  return lines;
}

export function resolveMountLinesForFixture(
  detection: FacadeDetection,
  fixture: Fixture,
  mountTarget: MountTarget,
  lightingType?: LightingType
): MountLine[] {
  const profile = getFixturePlacementProfile(fixture, lightingType);
  const zoneKey = getMountZoneKey(fixture, mountTarget, profile);
  return resolveAllowedMountLines(
    detection,
    zoneKey,
    fixture,
    lightingType,
    mountTarget
  );
}
