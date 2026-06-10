import type {
  AnalyzeRequest,
  AnalyzeResponse,
  CalculationResult,
  FacadeAnalysis,
  LightingType,
  PipelineStages,
  PlacementScheme,
  UsagePrompt,
} from "./types";
import { CATALOG, getFixturesForLightingType, LIGHTING_OPTIONS } from "./catalog";
import {
  buildFacadeAnalysisLegacy,
  recommendLightingType,
  validateDimensions,
} from "./calculation";
import { normalizeFacadeDetection } from "./facadeGeometry";
import { buildMockFacadeDetection } from "./mockFacadeDetection";
import { placeFixturesAlongMountLines } from "./placementEngine";
import { computePxPerMeter } from "./scale";
import { PipelineLogger } from "./pipelineLog";
import { STUB_UNIT_PRICE_RUB } from "./pricingStub";

function resolveSelectedPrompt(params: AnalyzeRequest): UsagePrompt | undefined {
  if (!params.fixtureId && !params.promptId) return undefined;
  const fixture = params.fixtureId
    ? CATALOG.find((f) => f.id === params.fixtureId)
    : undefined;
  const inFixture = fixture?.usagePrompts.find((p) => p.id === params.promptId);
  const inCatalog = CATALOG.flatMap((f) => f.usagePrompts).find(
    (p) => p.id === params.promptId
  );
  return inFixture ?? inCatalog ?? fixture?.usagePrompts[0];
}

function buildCalculationFromPlacement(
  fixture: (typeof CATALOG)[0],
  lightingType: LightingType,
  mountTarget: UsagePrompt["mountTarget"],
  selectedPrompt: UsagePrompt | undefined,
  quantity: number,
  zoneLengthM: number
): CalculationResult {
  const matchingFixtures = getFixturesForLightingType(lightingType);
  const equipmentPrice = quantity * STUB_UNIT_PRICE_RUB;
  return {
    fixture,
    matchingFixtures,
    lightingType,
    mountTarget,
    zoneLengthM,
    quantity,
    totalPower: quantity * fixture.power,
    equipmentPrice,
    workPrice: 0,
    totalPrice: equipmentPrice,
    selectedPrompt,
  };
}

function enrichAnalysis(
  base: FacadeAnalysis,
  pipeline: PipelineStages,
  detectionSource: "ai" | "mock"
): FacadeAnalysis {
  const mode: FacadeAnalysis["aiMode"] =
    detectionSource === "ai" ? "ai" : "mock";
  return {
    ...base,
    pixelsPerMeter: Math.round(pipeline.scale.pixelsPerMeter * 10) / 10,
    facadeWidthM: pipeline.scale.anchor === "width"
      ? pipeline.scale.userMeters
      : base.facadeWidthM,
    facadeHeightM: pipeline.scale.anchor === "height"
      ? pipeline.scale.userMeters
      : base.facadeHeightM,
    facadeDetection: pipeline.detection,
    scale: pipeline.scale,
    aiMode: mode,
    aiTasks: base.aiTasks.map((t) =>
      t.task.includes("Детекция") || t.task.includes("Зоны монтажа")
        ? {
            ...t,
            status: detectionSource === "ai" ? "done" : "mock",
            detail:
              detectionSource === "ai"
                ? "Vision API: facadeBox и mountLines"
                : t.detail,
          }
        : t.task.includes("масштаб")
          ? {
              ...t,
              status: "done",
              detail: `pxPerMeter=${pipeline.scale.pixelsPerMeter.toFixed(1)} по оси ${pipeline.scale.anchor}`,
            }
          : t
    ),
  };
}

export interface PipelineDetectionInput {
  detection: import("./types").FacadeDetection;
  source: "ai" | "mock";
}

/** Синхронный пайплайн (mock-детекция) — GitHub Pages и fallback */
export function runAnalyzePipelineSync(
  params: AnalyzeRequest,
  detectionInput?: PipelineDetectionInput,
  logger?: PipelineLogger
): AnalyzeResponse {
  const log = logger ?? new PipelineLogger();
  log.log("analyze", "pipeline start", {
    imageWidth: params.imageWidth,
    imageHeight: params.imageHeight,
    dimensions: params.dimensions,
    fixtureId: params.fixtureId,
    hasImageDataUrl: Boolean(params.imageDataUrl),
  });

  const dimError = validateDimensions(params.dimensions);
  if (dimError) throw new Error(dimError);

  const selectedPrompt = resolveSelectedPrompt(params);
  const lightingType =
    params.lightingType ??
    selectedPrompt?.lightingType ??
    recommendLightingType(
      buildFacadeAnalysisLegacy({ ...params, lightingType: undefined })
    );
  const mountTarget = selectedPrompt?.mountTarget ?? "facade";

  const fixture =
    (params.fixtureId
      ? CATALOG.find((f) => f.id === params.fixtureId)
      : undefined) ?? CATALOG[0];

  const { detection, source } = detectionInput ?? {
    detection: normalizeFacadeDetection(
      buildMockFacadeDetection(lightingType, mountTarget),
      { lightingType, mountTarget }
    ),
    source: "mock" as const,
  };

  log.log("detection", `source=${source}`, {
    mountLines: detection.mountLines.length,
    facadeBox: detection.facadeBox,
    notes: detection.notes,
  });

  const scale = computePxPerMeter(
    params.dimensions,
    detection.facadeBox,
    params.imageWidth,
    params.imageHeight
  );

  log.log("scale", "pxPerMeter computed", { ...scale });

  const { placement, zoneLengthM } = placeFixturesAlongMountLines({
    detection,
    scale,
    fixture,
    mountTarget,
    lightingType,
    imageWidth: params.imageWidth,
    imageHeight: params.imageHeight,
    dimensions: params.dimensions,
  });

  const quantity = placement.fixtures.length;
  const samplePlacement = placement.fixtures.slice(0, 3).map((f) => ({
    x: f.x,
    y: f.y,
    widthPx: f.widthPx,
    heightPx: f.heightPx,
  }));
  log.log("placement", "fixtures placed", {
    quantity,
    zoneLengthM,
    fixtureImage: fixture.image,
    lengthMm: fixture.lengthMm,
    samplePlacement,
  });
  const activeCalculation = buildCalculationFromPlacement(
    fixture,
    lightingType,
    mountTarget,
    selectedPrompt,
    quantity,
    zoneLengthM
  );

  const pipeline: PipelineStages = {
    detection,
    detectionSource: source,
    scale,
    placementCount: quantity,
  };

  const analysisBase = buildFacadeAnalysisLegacy({
    ...params,
    lightingType,
  });
  const analysis = enrichAnalysis(analysisBase, pipeline, source);

  const calculations = {} as Record<LightingType, CalculationResult>;
  for (const opt of LIGHTING_OPTIONS) {
    const det = normalizeFacadeDetection(
      buildMockFacadeDetection(opt.value, mountTarget),
      { lightingType: opt.value, mountTarget }
    );
    const sc = computePxPerMeter(
      params.dimensions,
      det.facadeBox,
      params.imageWidth,
      params.imageHeight
    );
    const { placement: pl, zoneLengthM: zl } = placeFixturesAlongMountLines({
      detection: det,
      scale: sc,
      fixture: CATALOG.find((f) => f.type.includes(opt.value)) ?? fixture,
      mountTarget,
      lightingType: opt.value,
      imageWidth: params.imageWidth,
      imageHeight: params.imageHeight,
      dimensions: params.dimensions,
    });
    const f =
      CATALOG.find((x) => x.type.includes(opt.value)) ?? fixture;
    calculations[opt.value] = buildCalculationFromPlacement(
      f,
      opt.value,
      mountTarget,
      undefined,
      pl.fixtures.length,
      zl
    );
  }

  log.log("analyze", "pipeline done", {
    quantity,
    totalPrice: activeCalculation.totalPrice,
    detectionSource: source,
  });

  return {
    analysis,
    calculations,
    recommendedLightingType: recommendLightingType(analysis),
    placement,
    activeCalculation,
    pipeline,
    pipelineLog: log.snapshot(),
  };
}

export function buildFullAnalyzeResult(params: AnalyzeRequest): AnalyzeResponse {
  return runAnalyzePipelineSync(params);
}
