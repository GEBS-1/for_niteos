import "server-only";

import { resolveFacadeDetection } from "@/lib/ai/facadeVision";
import {
  MVP_BODIES_AND_LIGHT,
  MVP_BODIES_ONLY,
} from "@/lib/displayOptions";
import { PipelineLogger } from "@/lib/pipelineLog";
import {
  renderLocalVisualization,
  dataUrlToBuffer,
} from "@/lib/visualizeLocal";
import { renderVisionDebugOverlay } from "@/lib/visionDebugOverlay";
import {
  runAnalyzePipelineSync,
  type PipelineDetectionInput,
} from "@/lib/analyzePipeline";
import {
  buildFacadeAnalysisLegacy,
  recommendLightingType,
  validateDimensions,
} from "@/lib/calculation";
import { CATALOG } from "@/lib/catalog";
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

/**
 * Серверный пайплайн NITEOS:
 * 1) Gemini Vision — сегментация фасада, окна, линии монтажа
 * 2) Mounting — расстановка по линиям с реальными размерами товара
 * 3) Локальный рендер — side.png лента + glow (visualizeLocal)
 */
export async function runAnalyzePipelineAsync(
  params: AnalyzeRequest
): Promise<AnalyzeResponse> {
  const log = new PipelineLogger();
  log.log("pipeline", "niteos analyze start", {
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

  let detectionInput: PipelineDetectionInput | undefined;

  if (params.imageDataUrl) {
    const { detection, source } = await resolveFacadeDetection(
      params.imageDataUrl,
      lightingType,
      mountTarget,
      fixture
    );
    detectionInput = { detection, source };
    log.log("vision", `gemini source=${source}`, {
      mountLines: detection.mountLines.length,
      windows: detection.forbiddenZones?.windows?.length ?? 0,
      confidence: detection.confidence,
    });
  }

  const result = runAnalyzePipelineSync(params, detectionInput, log);

  if (params.imageDataUrl && result.pipeline) {
    const buffer = dataUrlToBuffer(params.imageDataUrl);
    const calcFixture = result.activeCalculation.fixture;
    const calcMount = result.activeCalculation.mountTarget;

    try {
      result.visionDebugImage = await renderVisionDebugOverlay(
        buffer,
        result.pipeline.detection,
        result.placement,
        calcFixture,
        calcMount,
        result.activeCalculation.lightingType
      );

      const { dataUrl: bodiesImage, report: bodiesReport } =
        await renderLocalVisualization(
          buffer,
          result.placement,
          calcFixture,
          log,
          MVP_BODIES_ONLY
        );

      const { dataUrl: localImage, report: lightReport } =
        await renderLocalVisualization(
          buffer,
          result.placement,
          calcFixture,
          log,
          MVP_BODIES_AND_LIGHT
        );

      result.engine = {
        bodiesImage,
        localImage,
        debug: {
          sceneDebugImage: result.visionDebugImage,
          pxPerMeter: result.pipeline.scale.pixelsPerMeter,
          source: result.pipeline.detectionSource,
        },
      };

      log.log("render", "analyze images ok", {
        bodiesPng: bodiesReport.pngComposited,
        lightPng: lightReport.pngComposited,
        placements: result.placement.fixtures.length,
      });
    } catch (e) {
      log.log(
        "render",
        "analyze render failed",
        { error: e instanceof Error ? e.message : String(e) },
        "warn"
      );
    }
  }

  result.pipelineLog = log.snapshot();
  return result;
}
