import { toAnalyzeResponse } from "@/core/adapters/legacyAnalyze";
import { placeProduct } from "@/core/placement/placeProduct";
import { buildQuote } from "@/core/quote/buildQuote";
import { facadeDetectionToSceneAnalysis } from "@/core/scene/convertFromLegacy";
import { getLightingProductById } from "@/verticals/lighting/products";
import {
  buildFacadeAnalysisLegacy,
  recommendLightingType,
  validateDimensions,
} from "@/lib/calculation";
import { CATALOG } from "@/lib/catalog";
import { normalizeFacadeDetection } from "@/lib/facadeGeometry";
import { buildMockFacadeDetection } from "@/lib/mockFacadeDetection";
import { PipelineLogger } from "@/lib/pipelineLog";
import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/types";

function resolveSelectedPrompt(params: AnalyzeRequest) {
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

/** Синхронный пайплайн (mock scene, без Vision API) */
export function runVisualPlacementPipelineSync(
  params: AnalyzeRequest,
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
  const mountTarget = selectedPrompt?.mountTarget ?? "facade";

  const product = getLightingProductById(fixture.id, CATALOG, mountTarget);
  if (!product) throw new Error(`Product not found: ${fixture.id}`);

  const mockDetection = normalizeFacadeDetection(
    buildMockFacadeDetection(lightingType, mountTarget),
    { lightingType, mountTarget, fixture }
  );
  const scene = facadeDetectionToSceneAnalysis(
    mockDetection,
    params.imageWidth,
    params.imageHeight,
    "mock"
  );

  const { placedItems, pxPerMeter } = placeProduct({
    sceneAnalysis: scene,
    product,
    userReferenceSize: {
      facadeHeightM: params.dimensions.heightM,
      facadeWidthM: params.dimensions.widthM,
      lengthM: params.dimensions.lengthM,
    },
  });

  const quote = buildQuote(product, placedItems);
  const baseAnalysis = buildFacadeAnalysisLegacy({
    ...params,
    lightingType,
    fixtureId: fixture.id,
    promptId: selectedPrompt?.id,
  });

  log.log("engine", "sync placement done", {
    quantity: quote.quantity,
    pxPerMeter,
  });

  return toAnalyzeResponse({
    engine: {
      sceneAnalysis: scene,
      placedItems,
      quote,
      debug: { pxPerMeter, source: "mock" },
    },
    fixture,
    lightingType,
    mountTarget,
    selectedPrompt,
    analysis: baseAnalysis,
    calculations: {} as AnalyzeResponse["calculations"],
    recommendedLightingType: lightingType,
    pxPerMeter,
    pipelineLog: log.snapshot(),
  });
}
