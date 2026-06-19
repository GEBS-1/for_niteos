import {
  buildFacadeAnalysisLegacy,
  calculateAllLightingTypes,
  recommendLightingType,
  validateDimensions,
} from "@/lib/calculation";
import { CATALOG } from "@/lib/catalog";
import { normalizeFacadeDetection } from "@/lib/facadeGeometry";
import { buildEquipmentPricing } from "@/lib/equipmentPricing";
import { buildMockFacadeDetection } from "@/lib/mockFacadeDetection";
import { placeFixturesAlongMountLines } from "@/lib/placementEngine";
import { PipelineLogger } from "@/lib/pipelineLog";
import { computePxPerMeter } from "@/lib/scale";
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  CalculationResult,
  FacadeDetection,
  LightingType,
  MountTarget,
  PipelineLogEntry,
  UsagePrompt,
} from "@/lib/types";
import type { Fixture } from "@/lib/types";

export interface PipelineDetectionInput {
  detection: FacadeDetection;
  source: "ai" | "mock";
}

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

function buildActiveCalculation(
  fixture: Fixture,
  lightingType: LightingType,
  mountTarget: MountTarget,
  selectedPrompt: UsagePrompt | undefined,
  quantity: number,
  zoneLengthM: number
): CalculationResult {
  const pricing = buildEquipmentPricing(fixture, quantity);
  const workPrice = Math.round(pricing.equipmentTotalRub * 0.3);
  return {
    fixture,
    matchingFixtures: [],
    lightingType,
    mountTarget,
    zoneLengthM,
    quantity: pricing.quantity,
    totalPower: pricing.totalPowerW,
    equipmentPrice: pricing.equipmentTotalRub,
    workPrice,
    totalPrice: pricing.equipmentTotalRub + workPrice,
    selectedPrompt,
  };
}

/**
 * Синхронный расчёт: mock/готовая детекция → mounting → placement → спецификация.
 */
export function runAnalyzePipelineSync(
  params: AnalyzeRequest,
  detectionInput?: PipelineDetectionInput,
  logger?: PipelineLogger
): AnalyzeResponse {
  const log = logger ?? new PipelineLogger();
  const dimError = validateDimensions(params.dimensions);
  if (dimError) throw new Error(dimError);

  const selectedPrompt = resolveSelectedPrompt(params);
  const fixture =
    (params.fixtureId
      ? CATALOG.find((f) => f.id === params.fixtureId)
      : undefined) ?? CATALOG[0];
  const lightingType =
    params.lightingType ??
    selectedPrompt?.lightingType ??
    recommendLightingType(
      buildFacadeAnalysisLegacy({ ...params, lightingType: undefined })
    );
  const mountTarget: MountTarget = selectedPrompt?.mountTarget ?? "facade";

  const detection =
    detectionInput?.detection ??
    normalizeFacadeDetection(
      buildMockFacadeDetection(lightingType, mountTarget),
      { lightingType, mountTarget, fixture }
    );
  const detectionSource = detectionInput?.source ?? "mock";

  const scale = computePxPerMeter(
    params.dimensions,
    detection.facadeBox,
    params.imageWidth,
    params.imageHeight
  );

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

  const activeCalculation = buildActiveCalculation(
    fixture,
    lightingType,
    mountTarget,
    selectedPrompt,
    placement.fixtures.length,
    zoneLengthM
  );

  const baseAnalysis = buildFacadeAnalysisLegacy({
    ...params,
    lightingType,
    fixtureId: fixture.id,
    promptId: selectedPrompt?.id,
  });

  const calculations = calculateAllLightingTypes(
    { ...params, lightingType, fixtureId: fixture.id, promptId: selectedPrompt?.id },
    baseAnalysis
  );
  calculations[lightingType] = activeCalculation;

  log.log("placement", "mounting done", {
    source: detectionSource,
    mountLines: placement.mountLines?.length ?? 0,
    fixtures: placement.fixtures.length,
    zoneLengthM,
  });

  return {
    analysis: {
      ...baseAnalysis,
      facadeDetection: detection,
      aiMode: detectionSource === "ai" ? "ai" : "mock",
      pixelsPerMeter: Math.round(scale.pixelsPerMeter * 10) / 10,
    },
    calculations,
    recommendedLightingType: lightingType,
    placement,
    activeCalculation,
    pipeline: {
      detection,
      detectionSource,
      scale,
      placementCount: placement.fixtures.length,
    },
    pipelineLog: log.snapshot(),
  };
}

export type { PipelineLogEntry };
