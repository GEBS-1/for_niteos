import type {
  AnalyzeRequest,
  BuildingDimensions,
  CalculationResult,
  FacadeAnalysis,
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

export function buildFacadeAnalysis(params: AnalyzeRequest): FacadeAnalysis {
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
    aiMode: "mock",
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

export function buildPlacementScheme(
  imageWidth: number,
  imageHeight: number,
  lightingType: LightingType,
  quantity: number,
  mountTarget: MountTarget = "facade"
): PlacementScheme {
  const marginX = imageWidth * 0.08;
  const marginY = imageHeight * 0.1;
  const w = imageWidth - marginX * 2;
  const h = imageHeight - marginY * 2;
  const left = marginX;
  const top = marginY;
  const right = left + w;
  const bottom = top + h;

  const points: PlacementScheme["points"] = [];
  const lines: PlacementScheme["lines"] = [];
  const zoneLabels: PlacementScheme["zoneLabels"] = [];

  if (mountTarget === "nearby") {
    const baseY = bottom + h * 0.06;
    const span = w * 0.9;
    const startX = left + (w - span) / 2;
    const rows = Math.max(1, Math.ceil(quantity / 6));
    const perRow = Math.max(2, Math.ceil(quantity / rows));

    for (let r = 0; r < rows; r++) {
      const y = baseY + r * (h * 0.12);
      for (let i = 0; i < perRow; i++) {
        if (points.length >= quantity) break;
        const t = perRow === 1 ? 0.5 : i / (perRow - 1);
        points.push({ x: startX + span * t, y });
      }
      lines.push({ x1: startX, y1: y, x2: startX + span, y2: y });
    }
    zoneLabels.push({
      x: startX + span / 2,
      y: baseY - 12,
      label: "Опоры рядом с фасадом",
    });
    return { points: points.slice(0, quantity), lines, zoneLabels };
  }

  const placeAlongLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    count: number
  ) => {
    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0.5 : i / (count - 1);
      points.push({
        x: x1 + (x2 - x1) * t,
        y: y1 + (y2 - y1) * t,
      });
    }
  };

  switch (lightingType) {
    case "контурная": {
      lines.push(
        { x1: left, y1: top, x2: right, y2: top },
        { x1: right, y1: top, x2: right, y2: bottom },
        { x1: right, y1: bottom, x2: left, y2: bottom },
        { x1: left, y1: bottom, x2: left, y2: top }
      );
      const perSide = Math.max(1, Math.floor(quantity / 4));
      placeAlongLine(left, top, right, top, perSide);
      placeAlongLine(right, top, right, bottom, perSide);
      placeAlongLine(right, bottom, left, bottom, perSide);
      placeAlongLine(left, bottom, left, top, perSide);
      zoneLabels.push({ x: left + w / 2, y: top + 15, label: "Контур NITEOS" });
      break;
    }
    case "линейная": {
      const rows = 3;
      for (let r = 0; r < rows; r++) {
        const y = top + (h * (r + 1)) / (rows + 1);
        lines.push({ x1: left, y1: y, x2: right, y2: y });
        const perRow = Math.max(1, Math.floor(quantity / rows));
        placeAlongLine(left, y, right, y, perRow);
      }
      zoneLabels.push({ x: left + w / 2, y: top + h * 0.35, label: "Линейные зоны" });
      break;
    }
    case "оконная": {
      const cols = 4;
      const rows = Math.max(2, Math.ceil(quantity / cols));
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (points.length >= quantity) break;
          points.push({
            x: left + (w * (col + 0.5)) / cols,
            y: top + (h * (row + 1)) / (rows + 1),
          });
        }
      }
      zoneLabels.push({ x: left + w / 2, y: top + h * 0.5, label: "Оконные зоны" });
      break;
    }
    case "заливная": {
      const cols = Math.max(3, Math.ceil(Math.sqrt(quantity)));
      for (let i = 0; i < quantity; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        points.push({
          x: left + (w * (col + 0.5)) / cols,
          y: top + (h * (row + 0.5)) / Math.ceil(quantity / cols),
        });
      }
      lines.push({ x1: left, y1: bottom - h * 0.05, x2: right, y2: bottom - h * 0.05 });
      zoneLabels.push({ x: left + w / 2, y: bottom - 30, label: "Заливка фасада" });
      break;
    }
    case "акцентная":
    default: {
      const accents = [
        { x: left, y: top },
        { x: right, y: top },
        { x: left, y: bottom },
        { x: right, y: bottom },
        { x: left + w / 2, y: top + h * 0.3 },
      ];
      const used = accents.slice(0, Math.min(quantity, accents.length));
      points.push(...used);
      let remaining = quantity - used.length;
      let idx = 0;
      while (remaining > 0) {
        const t = (idx % 5) / 5;
        points.push({
          x: left + w * (0.15 + t * 0.7),
          y: top + h * (0.25 + ((idx * 0.17) % 1) * 0.45),
        });
        remaining--;
        idx++;
      }
      zoneLabels.push({ x: left + 20, y: top + 20, label: "Акценты" });
      break;
    }
  }

  return { points: points.slice(0, quantity), lines, zoneLabels };
}

export function buildFullAnalyzeResult(
  params: AnalyzeRequest
): {
  analysis: FacadeAnalysis;
  calculations: Record<LightingType, CalculationResult>;
  recommendedLightingType: LightingType;
  placement: PlacementScheme;
  activeCalculation: CalculationResult;
} {
  const analysisBase = buildFacadeAnalysis({ ...params, lightingType: undefined });

  let selectedPrompt: UsagePrompt | undefined;
  if (params.fixtureId || params.promptId) {
    const fixture = params.fixtureId
      ? CATALOG.find((f) => f.id === params.fixtureId)
      : undefined;
    const inFixture = fixture?.usagePrompts.find((p) => p.id === params.promptId);
    const inCatalog = CATALOG.flatMap((f) => f.usagePrompts).find(
      (p) => p.id === params.promptId
    );
    selectedPrompt =
      inFixture ??
      inCatalog ??
      fixture?.usagePrompts[0];
  }

  const lightingType =
    params.lightingType ??
    selectedPrompt?.lightingType ??
    recommendLightingType(analysisBase);
  const analysis = buildFacadeAnalysis({ ...params, lightingType });
  const calculations = calculateAllLightingTypes(params, analysis);

  const activeCalculation = calculateProject(
    params,
    analysis,
    lightingType,
    params.fixtureId,
    selectedPrompt
  );

  const placement = buildPlacementScheme(
    params.imageWidth,
    params.imageHeight,
    lightingType,
    activeCalculation.quantity,
    activeCalculation.mountTarget
  );

  return {
    analysis,
    calculations,
    recommendedLightingType: recommendLightingType(analysis),
    placement,
    activeCalculation,
  };
}
