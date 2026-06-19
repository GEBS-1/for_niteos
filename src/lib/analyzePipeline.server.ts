import "server-only";

import { resolveFacadeDetection } from "@/lib/ai/facadeVision";
import {
  runAnalyzePipelineSync,
  type PipelineDetectionInput,
} from "@/lib/analyzePipeline";
import { buildFacadeAnalysisLegacy, recommendLightingType, validateDimensions } from "@/lib/calculation";
import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/types";
import { CATALOG } from "@/lib/catalog";
import { PipelineLogger } from "@/lib/pipelineLog";
import { dataUrlToBuffer } from "@/lib/visualizeLocal";
import { renderVisionDebugOverlay } from "@/lib/visionDebugOverlay";

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

/** Серверный пайплайн с опциональной AI-детекцией фасада */
export async function runAnalyzePipelineAsync(
  params: AnalyzeRequest
): Promise<AnalyzeResponse> {
  const logger = new PipelineLogger();
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

  let detectionInput: PipelineDetectionInput | undefined;

  if (params.imageDataUrl) {
    logger.log("vision", "calling facade detection API");
    const { detection, source } = await resolveFacadeDetection(
      params.imageDataUrl,
      lightingType,
      mountTarget,
      fixture
    );
    detectionInput = { detection, source };
    logger.log("vision", `detection result: ${source}`, {
      lines: detection.mountLines.length,
      hasArchitecture: Boolean(detection.architecture),
      hasForbidden: Boolean(detection.forbiddenZones),
    });
  } else {
    logger.log("vision", "no imageDataUrl — mock only", {}, "warn");
  }

  const result = runAnalyzePipelineSync(params, detectionInput, logger);

  if (params.imageDataUrl && result.pipeline) {
    try {
      const buffer = dataUrlToBuffer(params.imageDataUrl);
      result.visionDebugImage = await renderVisionDebugOverlay(
        buffer,
        result.pipeline.detection,
        result.placement,
        fixture,
        mountTarget,
        result.activeCalculation.lightingType
      );
    } catch (e) {
      logger.log("vision-debug", "overlay failed", {
        error: e instanceof Error ? e.message : String(e),
      }, "warn");
    }
  }

  return result;
}
