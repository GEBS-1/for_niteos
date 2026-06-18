import type { Fixture, LightingType } from "./types";

/** Как расставлять корпуса на схеме */
export type PlacementMode =
  | "linear_ribbon"
  | "linear_accent"
  | "contour_perimeter"
  | "flood_wash"
  | "accent_points"
  | "window_reveal"
  | "pole_row";

/** Как рисовать свечение в локальной подготовке */
export type GlowMode =
  | "ribbon"
  | "wide_wash"
  | "tight_spot"
  | "contour_ribbon"
  | "window_soft"
  | "pole_uplight";

export interface FixturePlacementProfile {
  placementMode: PlacementMode;
  glowMode: GlowMode;
  /** Лента из PNG-модулей вдоль линий */
  useRibbonBodies: boolean;
  useRibbonGlow: boolean;
  minBands?: number;
  maxBands?: number;
  /** Макс. корпусов на одну линию (прожекторы, акценты) */
  maxFixturesPerLine?: number;
  /** Общий потолок количества */
  maxTotalFixtures?: number;
  /** Увеличить шаг монтажа (меньше точек на длинной линии) */
  stepMultiplier?: number;
  /** Акцент: один корпус в центре короткого сегмента */
  onePerSegment?: boolean;
  /** Опора: полная высота heightMm от земли */
  poleFullHeight?: boolean;
}

const LINEAR_RIBBON: FixturePlacementProfile = {
  placementMode: "linear_ribbon",
  glowMode: "ribbon",
  useRibbonBodies: true,
  useRibbonGlow: true,
  minBands: 4,
  maxBands: 6,
};

const LINEAR_ACCENT: FixturePlacementProfile = {
  placementMode: "linear_accent",
  glowMode: "ribbon",
  useRibbonBodies: true,
  useRibbonGlow: true,
  minBands: 2,
  maxBands: 4,
  maxFixturesPerLine: 4,
  maxTotalFixtures: 16,
};

const CONTOUR: FixturePlacementProfile = {
  placementMode: "contour_perimeter",
  glowMode: "contour_ribbon",
  useRibbonBodies: true,
  useRibbonGlow: true,
  maxFixturesPerLine: 12,
};

const FLOOD: FixturePlacementProfile = {
  placementMode: "flood_wash",
  glowMode: "wide_wash",
  useRibbonBodies: false,
  useRibbonGlow: false,
  minBands: 2,
  maxBands: 3,
  maxFixturesPerLine: 3,
  maxTotalFixtures: 10,
  stepMultiplier: 2.2,
};

const ACCENT: FixturePlacementProfile = {
  placementMode: "accent_points",
  glowMode: "tight_spot",
  useRibbonBodies: false,
  useRibbonGlow: false,
  maxTotalFixtures: 12,
  onePerSegment: true,
};

const WINDOW: FixturePlacementProfile = {
  placementMode: "window_reveal",
  glowMode: "window_soft",
  useRibbonBodies: false,
  useRibbonGlow: false,
  onePerSegment: true,
};

const POLE: FixturePlacementProfile = {
  placementMode: "pole_row",
  glowMode: "pole_uplight",
  useRibbonBodies: false,
  useRibbonGlow: false,
  poleFullHeight: true,
};

/** Переопределения по артикулу (точнее категории) */
const BY_ID: Record<string, Partial<FixturePlacementProfile>> = {
  "magistral-v3-ai-70": { minBands: 4, maxBands: 6 },
  "nt-slim": { minBands: 4, maxBands: 6 },
  "nt-rainbow-24": {
    minBands: 3,
    maxBands: 5,
    glowMode: "wide_wash",
    useRibbonGlow: true,
  },
  "nt-uno-line": {},
  "nt-horizon": {
    maxFixturesPerLine: 2,
    maxTotalFixtures: 8,
    stepMultiplier: 2.5,
  },
  "x-ray": {
    maxFixturesPerLine: 3,
    maxTotalFixtures: 9,
    stepMultiplier: 2,
  },
  "nt-uno": { maxTotalFixtures: 10 },
  "nt-liga-window": { maxTotalFixtures: 40 },
  "nt-lace": { maxFixturesPerLine: 8 },
  "nt-contour": { maxFixturesPerLine: 10 },
  "nt-slim-contour-mini": { maxFixturesPerLine: 12 },
};

function baseProfileForCategory(
  fixture: Fixture,
  lightingType: LightingType
): FixturePlacementProfile {
  if (fixture.category === "park_pole" || fixture.mountType === "pole") {
    return { ...POLE };
  }

  switch (fixture.category) {
    case "linear_facade":
      return fixture.id === "nt-uno-line"
        ? { ...LINEAR_ACCENT }
        : { ...LINEAR_RIBBON };
    case "contour":
      return { ...CONTOUR };
    case "flood":
      return lightingType === "акцентная" ? { ...ACCENT } : { ...FLOOD };
    case "window_accent":
      return { ...WINDOW };
    default:
      if (lightingType === "линейная") return { ...LINEAR_RIBBON };
      if (lightingType === "контурная") return { ...CONTOUR };
      if (lightingType === "оконная") return { ...WINDOW };
      if (lightingType === "акцентная") return { ...ACCENT };
      if (lightingType === "заливная") return { ...FLOOD };
      return { ...LINEAR_RIBBON };
  }
}

export function getFixturePlacementProfile(
  fixture: Fixture,
  lightingType?: LightingType
): FixturePlacementProfile {
  const lt =
    lightingType ??
    fixture.usagePrompts[0]?.lightingType ??
    ("линейная" as LightingType);
  const base = baseProfileForCategory(fixture, lt);
  const override = BY_ID[fixture.id];
  if (!override) return base;
  return { ...base, ...override };
}

/** Строка размеров для AI-промпта */
export function buildFixtureSizePrompt(fixture: Fixture): string {
  const l = fixture.lengthMm;
  const w = fixture.widthMm;
  const h = fixture.heightMm;
  const temp = fixture.lightTemperatureK ?? 3000;
  const parts: string[] = [];
  if (l && w && h) {
    parts.push(`габариты корпуса ~${l}×${w}×${h} мм`);
  } else if (l) {
    parts.push(`длина модуля ~${l} мм`);
  }
  if (fixture.mountType === "pole" && h) {
    parts.push(`высота опоры с головкой ~${(h / 1000).toFixed(2)} м от земли`);
  }
  parts.push(`цветовая температура ${temp}K`);
  if (fixture.promptDescription) {
    parts.push(fixture.promptDescription);
  }
  return parts.join("; ");
}

/** Краткое описание характера света для промпта */
export function buildLightCharacterPrompt(
  profile: FixturePlacementProfile,
  fixture: Fixture
): string {
  switch (profile.placementMode) {
    case "linear_ribbon":
      return `Непрерывные горизонтальные пояса света от видимых линейных модулей ${fixture.series ?? "NITEOS"}; сплошная лента, не отдельные пятна.`;
    case "linear_accent":
      return `Короткие линейные акценты на выбранных карнизах/ярусах; видимые корпуса ${fixture.series ?? "NITEOS"}, не сплошная заливка всего фасада.`;
    case "contour_perimeter":
      return `Контур по карнизу, вертикалям углов и цоколю; тонкая непрерывная линия света по краям силуэта.`;
    case "flood_wash":
      return `Широкий пучок прожектора, мягкая равномерная заливка стены; видимые корпуса прожекторов на точках схемы, БЕЗ сплошных горизонтальных LED-полос.`;
    case "accent_points":
      return `Узкие акцентные пучки только на архитектурных деталях (колонны, ниши, вход); между акцентами фасад темнее; ЗАПРЕЩЕНЫ сплошные горизонтальные пояса.`;
    case "window_reveal":
      return `Мягкая подсветка верхней и нижней части оконных проёмов; короткие модули по периметру каждого окна.`;
    case "pole_row":
      return `Высокие опоры на тротуаре, свет снизу вверх на фасад; реальная высота опоры ~${((fixture.heightMm ?? 1450) / 1000).toFixed(2)} м.`;
    default:
      return "";
  }
}
