import type {
  AnalyzeRequest,
  BuildingDimensions,
  CalculationResult,
  FacadeAnalysis,
  Fixture,
  FixtureMountType,
  FixturePlacement,
  LightingType,
  MountTarget,
  PlacementScheme,
  UsagePrompt,
} from "./types";
import { CATALOG, getFixturesForLightingType, LIGHTING_OPTIONS, pickPrimaryFixture } from "./catalog";

export function validateDimensions(dimensions: BuildingDimensions): string | null {
  const { widthM, lengthM, heightM } = dimensions;
  const hasAny =
    (widthM != null && widthM > 0) ||
    (lengthM != null && lengthM > 0) ||
    (heightM != null && heightM > 0);
  if (!hasAny) {
    return "Укажите хотя бы один размер: ширину, длину или высоту (в метрах)";
  }
  return null;
}

function resolveFacadeDimensions(
  imageWidth: number,
  imageHeight: number,
  dimensions: BuildingDimensions
): { facadeWidthM: number; facadeHeightM: number; facadeLengthM: number; pixelsPerMeter: number } {
  const aspect = imageWidth / imageHeight;
  let facadeWidthM = dimensions.widthM;
  let facadeHeightM = dimensions.heightM;
  const facadeLengthM = dimensions.lengthM ?? dimensions.widthM ?? 10;

  if (facadeWidthM && facadeHeightM) {
    // оба заданы
  } else if (facadeWidthM) {
    facadeHeightM = Math.round((facadeWidthM / aspect) * 10) / 10;
  } else if (facadeHeightM) {
    facadeWidthM = Math.round(facadeHeightM * aspect * 10) / 10;
  } else if (dimensions.lengthM) {
    facadeWidthM = dimensions.lengthM;
    facadeHeightM = Math.round((facadeWidthM / aspect) * 10) / 10;
  } else {
    facadeWidthM = 10;
    facadeHeightM = Math.round((10 / aspect) * 10) / 10;
  }

  const pixelsPerMeter = imageWidth / facadeWidthM;
  return { facadeWidthM, facadeHeightM, facadeLengthM, pixelsPerMeter };
}

function getAiTasks(): FacadeAnalysis["aiTasks"] {
  return [
    {
      task: "Проверка качества фото",
      status: "mock",
      detail: "Оценка разрешения и резкости по метаданным изображения (без Vision API)",
    },
    {
      task: "Определение масштаба",
      status: "mock",
      detail: "Масштаб из введённых размеров здания (ширина / длина / высота), не по пикселям на фото",
    },
    {
      task: "Детекция окон и углов",
      status: "mock",
      detail: "Оценочные значения по формулам; для реального распознавания нужен Vision API",
    },
    {
      task: "Зоны монтажа",
      status: "mock",
      detail: "Геометрические зоны по типу подсветки; не анализ контуров здания на фото",
    },
    {
      task: "Визуализация подсветки",
      status: "mock",
      detail: "Canvas-наложение точек/линий каталога NITEOS; здание не изменяется",
    },
    {
      task: "Генерация через AI API",
      status: "pending_api",
      detail: "Требует OPENAI_API_KEY или аналог — сейчас не подключено",
    },
  ];
}

export function buildFacadeAnalysisLegacy(params: AnalyzeRequest): FacadeAnalysis {
  const { imageWidth, imageHeight, dimensions, lightingType } = params;
  const { facadeWidthM, facadeHeightM, facadeLengthM, pixelsPerMeter } =
    resolveFacadeDimensions(imageWidth, imageHeight, dimensions);

  const facadeAreaM2 = Math.round(facadeWidthM * facadeHeightM * 10) / 10;
  const minDim = Math.min(imageWidth, imageHeight);
  let imageQuality: FacadeAnalysis["imageQuality"] = "good";
  const qualityNotes: string[] = [];

  if (minDim < 600) {
    imageQuality = "low";
    qualityNotes.push("Низкое разрешение — загрузите фото от 1200 px по короткой стороне.");
  } else if (minDim < 1000) {
    imageQuality = "acceptable";
    qualityNotes.push("Среднее качество — для финальной визуализации желательно 1920 px и выше.");
  } else {
    qualityNotes.push("Качество фото достаточное для расчёта.");
  }

  const windowsDetected = Math.max(2, Math.floor(facadeWidthM / 2.5));
  const cornersDetected = 4;
  const mountingZones = lightingType
    ? getMountingZones(lightingType)
    : [
        "Углы здания",
        "Оконные проёмы",
        "Карниз и периметр",
        "Архитектурные пояса",
      ];

  return {
    windowsDetected,
    cornersDetected,
    facadeWidthM,
    facadeHeightM,
    facadeLengthM,
    facadeAreaM2,
    mountingZones,
    pixelsPerMeter: Math.round(pixelsPerMeter * 10) / 10,
    imageQuality,
    qualityNotes,
    aiMode: "mock" as const,
    aiTasks: getAiTasks(),
  };
}

function getMountingZones(lightingType: LightingType): string[] {
  const base = ["Верхний карниз фасада", "Боковые грани здания"];
  switch (lightingType) {
    case "оконная":
      return ["Проёмы окон (нижняя кромка)", "Межоконные простенки"];
    case "контурная":
      return [...base, "Контур по периметру кровли", "Вертикальные рёбра"];
    case "заливная":
      return ["Равномерная заливка по ширине фасада", "Нижняя зона подсветки"];
    case "линейная":
      return ["Горизонтальные архитектурные пояса", "Линии этажей"];
    case "акцентная":
    default:
      return ["Углы здания", "Архитектурные выступы", "Центральная ось фасада"];
  }
}

function zoneLengthForType(
  lightingType: LightingType,
  facadeWidthM: number,
  facadeHeightM: number,
  facadeLengthM: number
): number {
  switch (lightingType) {
    case "контурная":
      return facadeWidthM * 2 + facadeHeightM * 2;
    case "линейная":
      return facadeWidthM * 1.2;
    case "оконная":
      return facadeWidthM * 0.85;
    case "заливная":
      return facadeWidthM * 1.5;
    case "акцентная":
    default:
      return facadeWidthM + facadeHeightM * 0.6 + facadeLengthM * 0.2;
  }
}

export function recommendLightingType(analysis: FacadeAnalysis): LightingType {
  if (analysis.windowsDetected >= 4) return "оконная";
  if (analysis.facadeWidthM > 20) return "заливная";
  if (analysis.facadeHeightM > 15) return "линейная";
  return "контурная";
}

export function calculateProject(
  params: AnalyzeRequest,
  analysis: FacadeAnalysis,
  lightingType: LightingType,
  fixtureId?: string,
  selectedPrompt?: UsagePrompt
): CalculationResult {
  const matchingFixtures = getFixturesForLightingType(lightingType);
  let fixture = fixtureId
    ? CATALOG.find((f) => f.id === fixtureId) ?? pickPrimaryFixture(lightingType)
    : pickPrimaryFixture(lightingType);

  if (selectedPrompt) {
    const fromPrompt = CATALOG.find((f) =>
      f.usagePrompts.some((p) => p.id === selectedPrompt.id)
    );
    if (fromPrompt) fixture = fromPrompt;
  }
  const mountTarget: MountTarget = selectedPrompt?.mountTarget ?? "facade";

  const zoneLengthM = zoneLengthForType(
    lightingType,
    analysis.facadeWidthM,
    analysis.facadeHeightM,
    analysis.facadeLengthM
  );

  const quantity = Math.ceil(zoneLengthM / fixture.mountingStepMeters);
  const totalPower = quantity * fixture.power;
  const equipmentPrice = quantity * fixture.price;
  const workPrice = Math.round(equipmentPrice * 0.3);
  const totalPrice = equipmentPrice + workPrice;

  return {
    fixture,
    matchingFixtures,
    lightingType,
    mountTarget,
    zoneLengthM: Math.round(zoneLengthM * 10) / 10,
    quantity,
    totalPower,
    equipmentPrice,
    workPrice,
    totalPrice,
    selectedPrompt,
  };
}

export function calculateAllLightingTypes(
  params: AnalyzeRequest,
  analysis: FacadeAnalysis
): Record<LightingType, CalculationResult> {
  const result = {} as Record<LightingType, CalculationResult>;
  for (const opt of LIGHTING_OPTIONS) {
    result[opt.value] = calculateProject(params, analysis, opt.value);
  }
  return result;
}

export interface BuildPlacementParams {
  quantity: number;
  fixture: Fixture;
  lightingType: LightingType;
  mountTarget: MountTarget;
  analysis: FacadeAnalysis;
}

function resolveMountType(fixture: Fixture, mountTarget: MountTarget): FixtureMountType {
  if (fixture.mountType) return fixture.mountType;
  if (mountTarget === "nearby") return "pole";
  if (fixture.category === "linear_facade") return "linear";
  return "facade";
}

function placeAlongNormalized(
  fixtures: FixturePlacement[],
  productId: string,
  mountType: FixtureMountType,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  count: number,
  rotation: number,
  scale: number
) {
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    fixtures.push({
      x: x1 + (x2 - x1) * t,
      y: y1 + (y2 - y1) * t,
      rotation,
      scale,
      productId,
      mountType,
    });
  }
}

/** Нормализованная расстановка светильников (0–1), без участия AI */
export function buildPlacementScheme(params: BuildPlacementParams): PlacementScheme {
  const { quantity, fixture, lightingType, mountTarget, analysis } = params;
  const productId = fixture.id;
  const mountType = resolveMountType(fixture, mountTarget);

  const facadeBox = { x: 0.08, y: 0.1, width: 0.84, height: 0.78 };
  const bx = facadeBox.x;
  const by = facadeBox.y;
  const bw = facadeBox.width;
  const bh = facadeBox.height;
  const left = bx;
  const right = bx + bw;
  const top = by;
  const bottom = by + bh;

  const fixtures: FixturePlacement[] = [];
  const isLinear = mountType === "linear" || lightingType === "линейная";
  const isPole = mountType === "pole" || mountTarget === "nearby";
  const baseScale = isLinear ? 0.11 : isPole ? 0.14 : 0.1;
  const rotation = isPole ? 0 : isLinear ? 0 : 0;

  if (isPole) {
    const groundY = Math.min(0.96, bottom + 0.04);
    const perRow = Math.max(2, Math.min(quantity, 8));
    for (let i = 0; i < quantity; i++) {
      const t = quantity <= 1 ? 0.5 : i / (quantity - 1);
      fixtures.push({
        x: left + bw * (0.06 + t * 0.88),
        y: groundY,
        rotation: 0,
        scale: baseScale,
        productId,
        mountType: "pole",
      });
    }
  } else if (isLinear) {
    const rows = Math.min(3, Math.max(1, Math.ceil(quantity / 6)));
    let placed = 0;
    for (let r = 0; r < rows && placed < quantity; r++) {
      const y = top + (bh * (r + 1)) / (rows + 1);
      const rowCount = Math.min(
        quantity - placed,
        Math.max(1, Math.ceil(quantity / rows))
      );
      placeAlongNormalized(
        fixtures,
        productId,
        "linear",
        left + bw * 0.04,
        y,
        right - bw * 0.04,
        y,
        rowCount,
        0,
        baseScale
      );
      placed += rowCount;
    }
  } else if (lightingType === "оконная") {
    const cols = 4;
    const rows = Math.max(2, Math.ceil(quantity / cols));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (fixtures.length >= quantity) break;
        fixtures.push({
          x: left + (bw * (col + 0.5)) / cols,
          y: top + (bh * (row + 1)) / (rows + 1),
          rotation: 0,
          scale: baseScale * 0.85,
          productId,
          mountType: "facade",
        });
      }
    }
  } else if (lightingType === "контурная") {
    const perSide = Math.max(1, Math.floor(quantity / 4));
    placeAlongNormalized(fixtures, productId, "facade", left, top, right, top, perSide, 0, baseScale);
    placeAlongNormalized(fixtures, productId, "facade", right, top, right, bottom, perSide, 90, baseScale);
    placeAlongNormalized(fixtures, productId, "facade", right, bottom, left, bottom, perSide, 0, baseScale);
    placeAlongNormalized(fixtures, productId, "facade", left, bottom, left, top, perSide, 90, baseScale);
  } else {
    const cols = Math.max(3, Math.ceil(Math.sqrt(quantity)));
    for (let i = 0; i < quantity; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      fixtures.push({
        x: left + (bw * (col + 0.5)) / cols,
        y: top + (bh * (row + 0.5)) / Math.ceil(quantity / cols),
        rotation: 0,
        scale: baseScale,
        productId,
        mountType: "facade",
      });
    }
  }

  return {
    fixtures: fixtures.slice(0, quantity),
    facadeBox,
    estimatedWidthM: analysis.facadeWidthM,
    estimatedHeightM: analysis.facadeHeightM,
  };
}

export function buildFacadeAnalysis(params: AnalyzeRequest): FacadeAnalysis {
  return buildFacadeAnalysisLegacy(params);
}
