import {
  type ActiveImageProvider,
  getYandexFolderId,
  isAiConfigured,
  getOpenAiProxyLabel,
  usesChatCompletionsForImages,
  resolveImageProvider,
  shouldAllowLocalFallback,
  shouldAiEnhanceLight,
  shouldYandexKeepOriginalPhoto,
} from "@/config/ai.config";
import {
  MVP_BODIES_AND_LIGHT,
  MVP_BODIES_ONLY,
} from "@/lib/displayOptions";
import { buildEquipmentPricing } from "@/lib/equipmentPricing";
import { PipelineLogger } from "@/lib/pipelineLog";
import { renderLocalVisualization, dataUrlToBuffer } from "@/lib/visualizeLocal";
import type {
  BuildingDimensions,
  CalculationResult,
  FacadeAnalysis,
  Fixture,
  PlacementScheme,
  VisualizationResponse,
} from "@/lib/types";
import { buildLightOnlyPrompt } from "./buildCombinedPrompt";
import {
  generateImageWithGigaChat,
  GigaChatError,
} from "./gigachatVisualize";
import {
  enhanceLightWithOpenAI,
  OpenAiImageError,
  parseOpenAiError,
} from "./openaiVisualize";
import { YandexArtError, parseYandexError } from "./yandexArt";

export type VisualizeMode =
  | "local"
  | "openai"
  | "gigachat"
  | "yandex_photo"
  | "static_demo";

export interface VisualizePipelineOptions {
  imageDataUrl: string;
  imageBuffer: Buffer;
  placement: PlacementScheme;
  fixture: Fixture;
  specification: CalculationResult;
  promptId: string;
  dimensions?: BuildingDimensions;
  analysis?: FacadeAnalysis;
  provider?: ActiveImageProvider | null;
  logger?: PipelineLogger;
}

function syncSpecification(
  spec: CalculationResult,
  placement: PlacementScheme
): CalculationResult {
  const quantity = placement.fixtures.length;
  const pricing = buildEquipmentPricing(spec.fixture, quantity);
  return {
    ...spec,
    quantity,
    totalPower: pricing.totalPowerW,
    equipmentPrice: pricing.equipmentTotalRub,
    totalPrice: pricing.equipmentTotalRub,
  };
}

/**
 * MVP v2:
 * 1) Исходное фото
 * 2) Корпуса на фасаде (видимые PNG)
 * 3) Корпуса + локальный свет
 * 4) AI enhance — только усиление света, без добавления светильников
 */
export async function runVisualizationPipeline(
  options: VisualizePipelineOptions
): Promise<VisualizationResponse> {
  const logger = options.logger ?? new PipelineLogger();
  const log = logger.child("visualize");
  const lightPrompt = buildLightOnlyPrompt();
  const specification = syncSpecification(
    options.specification,
    options.placement
  );

  log.log("start", "MVP v2 visualization", {
    fixtureId: options.fixture.id,
    placements: options.placement.fixtures.length,
    quantity: specification.quantity,
  });

  const { dataUrl: fixturesVisualization, report: bodiesReport } =
    await renderLocalVisualization(
      options.imageBuffer,
      options.placement,
      options.fixture,
      logger,
      MVP_BODIES_ONLY
    );

  const { dataUrl: fixturesWithLightVisualization, report: lightReport } =
    await renderLocalVisualization(
      options.imageBuffer,
      options.placement,
      options.fixture,
      logger,
      MVP_BODIES_AND_LIGHT
    );

  log.log("local-render", "bodies + light stages", {
    bodiesPng: bodiesReport.pngComposited,
    lightPng: lightReport.pngComposited,
  });

  const base: VisualizationResponse = {
    originalImage: options.imageDataUrl,
    fixturesVisualization,
    fixturesWithLightVisualization,
    localVisualization: fixturesWithLightVisualization,
    placementScheme: options.placement,
    specification,
    mode: "local",
    lightPrompt,
    localRenderReport: lightReport,
    pipelineLog: logger.snapshot(),
    message:
      "Корпуса NITEOS размещены на фасаде. Локальный свет 3000K.",
  };

  if (!shouldAiEnhanceLight()) {
    log.log("ai-skip", "AI_ENHANCE_LIGHT disabled — local render only", {}, "info");
    return base;
  }

  if (!isAiConfigured()) {
    log.log("ai-skip", "AI not configured", {}, "warn");
    return base;
  }

  let provider: ActiveImageProvider;
  try {
    provider = resolveImageProvider(options.provider ?? null);
  } catch (e) {
    log.log("ai-skip", "provider resolve failed", {
      error: e instanceof Error ? e.message : String(e),
    }, "warn");
    return base;
  }

  const prepBuffer = dataUrlToBuffer(fixturesWithLightVisualization);
  log.log("ai-start", "light enhance only", { provider });

  try {
    if (provider === "gigachat") {
      const ai = await generateImageWithGigaChat(
        prepBuffer,
        "image/jpeg",
        lightPrompt
      );
      log.log("ai-done", "gigachat enhance ok", { model: ai.modelUsed });
      return {
        ...base,
        aiVisualization: ai.imageDataUrl,
        mode: "gigachat",
        provider: "gigachat",
        message: `Усиление света GigaChat (${ai.modelUsed}). Корпуса сохранены.`,
        pipelineLog: logger.snapshot(),
      };
    }

    if (provider === "yandex") {
      if (!getYandexFolderId() || shouldYandexKeepOriginalPhoto()) {
        return {
          ...base,
          mode: "yandex_photo",
          provider: "yandex",
          message: "Локальная визуализация (корпуса + свет).",
        };
      }
    }

    const ai = await enhanceLightWithOpenAI(
      fixturesWithLightVisualization,
      prepBuffer
    );
    log.log("ai-done", "openai light enhance ok");
    return {
      ...base,
      aiVisualization: ai.imageDataUrl,
      mode: "openai",
      provider: "openai",
      message: usesChatCompletionsForImages()
        ? `Свет усилен ${getOpenAiProxyLabel()}. Корпуса и геометрия фасада сохранены.`
        : "Свет усилен OpenAI. Корпуса сохранены.",
      lightPrompt: ai.promptUsed,
      pipelineLog: logger.snapshot(),
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    log.log("ai-error", "light enhance failed", { error: errMsg }, "warn");

    if (shouldAllowLocalFallback()) {
      return {
        ...base,
        message: `AI не сработал (${errMsg}). Показаны корпуса и локальный свет.`,
        pipelineLog: logger.snapshot(),
      };
    }

    if (e instanceof OpenAiImageError || e instanceof GigaChatError) {
      throw e;
    }
    throw new OpenAiImageError(parseOpenAiError(e), []);
  }
}

export function parseVisualizationError(error: unknown): {
  code: string;
  message: string;
  hint: string;
} {
  if (error instanceof OpenAiImageError) return error.parsed;
  if (error instanceof GigaChatError) return error.parsed;
  if (error instanceof YandexArtError) return error.parsed;
  return {
    code: "unknown",
    message: error instanceof Error ? error.message : "Ошибка визуализации",
    hint: "",
  };
}

/** @deprecated */
export async function generateVisualization(
  options: VisualizePipelineOptions
): Promise<{
  imageDataUrl: string;
  promptUsed: string;
  mode: VisualizeMode;
  provider: string;
  userMessage?: string;
}> {
  const result = await runVisualizationPipeline(options);
  return {
    imageDataUrl:
      result.aiVisualization ??
      result.fixturesWithLightVisualization ??
      result.localVisualization,
    promptUsed: result.lightPrompt ?? "",
    mode: (result.mode as VisualizeMode) ?? "local",
    provider: result.provider ?? "local",
    userMessage: result.message,
  };
}
