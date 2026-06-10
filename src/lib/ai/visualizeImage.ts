import {
  type ActiveImageProvider,
  getYandexFolderId,
  isAiConfigured,
  getOpenAiProxyLabel,
  usesChatCompletionsForImages,
  resolveImageProvider,
  shouldAllowLocalFallback,
  shouldYandexKeepOriginalPhoto,
} from "@/config/ai.config";
import { PREP_FOR_AI_DISPLAY_OPTIONS } from "@/lib/displayOptions";
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
import {
  buildCombinedPrompt,
  type CombinedPromptInput,
} from "./buildCombinedPrompt";
import {
  generateImageWithGigaChat,
  GigaChatError,
} from "./gigachatVisualize";
import {
  generateImageWithOpenAI,
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

/**
 * 1) Локально: вечер + корпуса светильников на линиях (подсказка для AI).
 * 2) AI: редактирование кадра по полному промпту (товар, кол-во, вечер, 3000K).
 * 3) Fallback: локальный кадр, если AI недоступен.
 */
export async function runVisualizationPipeline(
  options: VisualizePipelineOptions
): Promise<VisualizationResponse> {
  const logger = options.logger ?? new PipelineLogger();
  const log = logger.child("visualize");

  const promptInput: CombinedPromptInput = {
    promptId: options.promptId,
    fixtureId: options.fixture.id,
    dimensions: options.dimensions,
    analysis: options.analysis,
    calculation: options.specification,
  };
  const combinedPrompt = buildCombinedPrompt(promptInput, "openai_edit");

  log.log("start", "visualization pipeline", {
    fixtureId: options.fixture.id,
    placements: options.placement.fixtures.length,
    quantity: options.specification.quantity,
  });

  const { dataUrl: localVisualization, report: localRenderReport } =
    await renderLocalVisualization(
      options.imageBuffer,
      options.placement,
      options.fixture,
      logger,
      PREP_FOR_AI_DISPLAY_OPTIONS
    );

  log.log("local-prep", "fixture prep for AI", {
    pngComposited: localRenderReport.pngComposited,
    fixtureFileExists: localRenderReport.fixtureFileExists,
  });

  const base: VisualizationResponse = {
    originalImage: options.imageDataUrl,
    localVisualization,
    placementScheme: options.placement,
    specification: options.specification,
    mode: "local",
    lightPrompt: combinedPrompt,
    localRenderReport,
    pipelineLog: logger.snapshot(),
  };

  if (!isAiConfigured()) {
    log.log("ai-skip", "AI not configured", {}, "warn");
    return {
      ...base,
      message:
        "AI не настроен. Показана локальная визуализация с корпусами светильников.",
    };
  }

  let provider: ActiveImageProvider;
  try {
    provider = resolveImageProvider(options.provider ?? null);
  } catch (e) {
    log.log("ai-skip", "provider resolve failed", {
      error: e instanceof Error ? e.message : String(e),
    }, "warn");
    return {
      ...base,
      message: "AI не настроен. Локальная визуализация с корпусами.",
    };
  }

  const prepDataUrl = localVisualization;
  const prepBuffer = dataUrlToBuffer(localVisualization);

  log.log("ai-start", "primary AI generation", { provider });

  try {
    if (provider === "gigachat") {
      const ai = await generateImageWithGigaChat(
        prepBuffer,
        "image/jpeg",
        combinedPrompt
      );
      log.log("ai-done", "gigachat ok", { model: ai.modelUsed });
      return {
        ...base,
        aiVisualization: ai.imageDataUrl,
        mode: "gigachat",
        provider: "gigachat",
        message: `Сгенерировано GigaChat (${ai.modelUsed}): вечерняя подсветка с видимыми светильниками.`,
        pipelineLog: logger.snapshot(),
      };
    }

    if (provider === "yandex") {
      if (!getYandexFolderId() || shouldYandexKeepOriginalPhoto()) {
        log.log("ai-skip", "yandex photo-only mode");
        return {
          ...base,
          mode: "yandex_photo",
          provider: "yandex",
          message:
            "Подсветка на вашем фото (локально). Для YandexART укажите YANDEX_FOLDER_ID.",
        };
      }
    }

    const ai = await generateImageWithOpenAI(prepDataUrl, promptInput);
    log.log("ai-done", "openai/gatellm ok");
    return {
      ...base,
      aiVisualization: ai.imageDataUrl,
      mode: "openai",
      provider: "openai",
      message: usesChatCompletionsForImages()
        ? `Фото обработано ${getOpenAiProxyLabel()}: вечер, тёплый свет 3000K, видимые светильники NITEOS.`
        : "Фото обработано OpenAI: вечерняя архитектурная подсветка.",
      lightPrompt: ai.promptUsed,
      pipelineLog: logger.snapshot(),
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    log.log("ai-error", "AI generation failed", { error: errMsg }, "warn");

    if (shouldAllowLocalFallback()) {
      return {
        ...base,
        message: `AI не сработал (${errMsg}). Локальная визуализация с корпусами светильников.`,
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
    imageDataUrl: result.aiVisualization ?? result.localVisualization,
    promptUsed: result.lightPrompt ?? "",
    mode: (result.mode as VisualizeMode) ?? "local",
    provider: result.provider ?? "local",
    userMessage: result.message,
  };
}
