import "server-only";

import { toAnalyzeResponse } from "@/core/adapters/legacyAnalyze";
import { placeProduct } from "@/core/placement/placeProduct";
import { buildQuote } from "@/core/quote/buildQuote";
import { enhanceLight } from "@/core/render/enhanceLight";
import {
  renderProductOverlay,
} from "@/core/render/renderProductOverlay";
import { renderSceneDebugOnly } from "@/core/render/sceneDebugOverlayOnly";
import { analyzeScene } from "@/core/scene/analyzeScene";
import { getLightingProductById } from "@/verticals/lighting/products";
import {
  buildFacadeAnalysisLegacy,
  recommendLightingType,
  validateDimensions,
} from "@/lib/calculation";
import { CATALOG } from "@/lib/catalog";
import { PipelineLogger } from "@/lib/pipelineLog";
import type { AnalyzeRequest, AnalyzeResponse, BuildingDimensions } from "@/lib/types";
import { dataUrlToBuffer } from "@/lib/visualizeLocal";

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

function referenceSizeFromDimensions(
  dimensions: BuildingDimensions
): {
  facadeHeightM?: number;
  facadeWidthM?: number;
  lengthM?: number;
} {
  return {
    facadeHeightM: dimensions.heightM,
    facadeWidthM: dimensions.widthM,
    lengthM: dimensions.lengthM,
  };
}

/**
 * Visual Product Placement Engine — основной пайплайн.
 */
export async function runVisualPlacementPipeline(
  params: AnalyzeRequest,
  logger?: PipelineLogger
): Promise<AnalyzeResponse> {
  const log = logger ?? new PipelineLogger();
  log.log("engine", "visual placement pipeline start", {
    fixtureId: params.fixtureId,
    imageWidth: params.imageWidth,
    imageHeight: params.imageHeight,
  });

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

  const product = getLightingProductById(
    fixture.id,
    CATALOG,
    mountTarget
  );
  if (!product) throw new Error(`Product not found: ${fixture.id}`);

  const { scene, source } = await analyzeScene(params.imageDataUrl, {
    imageWidth: params.imageWidth,
    imageHeight: params.imageHeight,
    lightingType,
    mountTarget,
    fixture,
  });

  log.log("scene", `source=${source}`, {
    surfaces: scene.surfaces.length,
    forbidden: scene.forbiddenZones.length,
    confidence: scene.confidence,
  });

  const { placedItems, pxPerMeter, surfacesUsed } = placeProduct({
    sceneAnalysis: scene,
    product,
    userReferenceSize: referenceSizeFromDimensions(params.dimensions),
  });

  log.log("placement", "items placed", {
    quantity: placedItems.length,
    pxPerMeter,
  });

  const quote = buildQuote(product, placedItems);

  let localImage: string | undefined;
  let bodiesImage: string | undefined;
  let enhancedImage: string | undefined;
  let sceneDebugImage: string | undefined;

  if (params.imageDataUrl) {
    const buffer = dataUrlToBuffer(params.imageDataUrl);
    try {
      const rendered = await renderProductOverlay(
        buffer,
        scene,
        product,
        placedItems,
        fixture,
        pxPerMeter,
        { showBodies: true, showGlow: true, surfacesUsed }
      );
      localImage = rendered.lightDataUrl;
      bodiesImage = rendered.bodiesDataUrl;

      sceneDebugImage = await renderSceneDebugOnly(
        buffer,
        scene,
        placedItems,
        surfacesUsed
      );

      const lightBuffer = Buffer.from(
        rendered.lightDataUrl.replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );
      const enhanced = await enhanceLight(rendered.lightDataUrl, lightBuffer);
      if (enhanced) {
        enhancedImage = enhanced;
      }
      log.log("render", "overlay ok", {
        bodiesLen: bodiesImage?.length ?? 0,
        lightLen: localImage?.length ?? 0,
        debugLen: sceneDebugImage?.length ?? 0,
      });
    } catch (e) {
      log.log(
        "render",
        "overlay failed",
        { error: e instanceof Error ? e.message : String(e) },
        "warn"
      );
    }
  }

  const baseAnalysis = buildFacadeAnalysisLegacy({
    ...params,
    lightingType,
    fixtureId: fixture.id,
    promptId: selectedPrompt?.id,
  });

  return toAnalyzeResponse({
    engine: {
      sceneAnalysis: scene,
      placedItems,
      quote,
      bodiesImage,
      localImage,
      enhancedImage,
      debug: {
        sceneDebugImage,
        pxPerMeter,
        source,
      },
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
