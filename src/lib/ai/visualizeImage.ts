import {
  getYandexFolderId,
  isGateLlmConfigured,
  resolveImageProvider,
  shouldAllowLocalFallback,
  shouldYandexKeepOriginalPhoto,
} from "@/config/ai.config";
import {
  generateImageWithGigaChat,
  GigaChatError,
} from "./gigachatVisualize";
import { buildYandexPrompt, type CombinedPromptInput } from "./buildCombinedPrompt";
import {
  generateImageWithOpenAI,
  OpenAiImageError,
  parseOpenAiError,
} from "./openaiVisualize";
import {
  generateImageWithYandex,
  YandexArtError,
  parseYandexError,
} from "./yandexArt";
import { renderLocalVisualization } from "@/lib/visualizeLocal";
import type { LightingType, MountTarget, PlacementScheme } from "@/lib/types";
import sharp from "sharp";

export type VisualizeMode =
  | "openai"
  | "yandex"
  | "yandex_photo"
  | "gigachat"
  | "gigachat_photo"
  | "local_fallback";

export interface VisualizeImageResult {
  imageDataUrl: string;
  promptUsed: string;
  mode: VisualizeMode;
  provider: "openai" | "yandex" | "gigachat";
  userMessage?: string;
}

export interface VisualizeImageOptions {
  imageDataUrl: string;
  imageBuffer: Buffer;
  input: CombinedPromptInput;
  placement: PlacementScheme;
  lightingType: LightingType;
  mountTarget: MountTarget;
  imageWidth?: number;
  imageHeight?: number;
}

async function getImageSize(
  buffer: Buffer,
  fallbackW?: number,
  fallbackH?: number
): Promise<{ width: number; height: number }> {
  if (fallbackW && fallbackH) {
    return { width: fallbackW, height: fallbackH };
  }
  const meta = await sharp(buffer).metadata();
  return {
    width: meta.width ?? 1024,
    height: meta.height ?? 768,
  };
}

async function renderOnOriginalPhoto(
  options: VisualizeImageOptions,
  provider: "yandex"
): Promise<VisualizeImageResult> {
  const imageDataUrl = await renderLocalVisualization(
    options.imageBuffer,
    options.placement,
    options.lightingType,
    options.mountTarget
  );
  return {
    imageDataUrl,
    promptUsed: buildYandexPrompt(options.input),
    mode: "yandex_photo",
    provider,
    userMessage:
      "Подсветка на вашем фото (расчётная схема). Для генерации через YandexART добавьте YANDEX_FOLDER_ID или отключите YANDEX_KEEP_ORIGINAL_PHOTO=false.",
  };
}

export async function generateVisualization(
  options: VisualizeImageOptions
): Promise<VisualizeImageResult> {
  const provider = resolveImageProvider();

  if (provider === "gigachat") {
    const mimeMatch = options.imageDataUrl.match(/^data:(image\/\w+);/);
    const mime = mimeMatch?.[1] ?? "image/jpeg";
    try {
      const result = await generateImageWithGigaChat(
        options.imageBuffer,
        mime,
        options.input
      );
      return {
        imageDataUrl: result.imageDataUrl,
        promptUsed: result.promptUsed,
        mode: "gigachat",
        provider: "gigachat",
        userMessage: `Сгенерировано GigaChat (${result.modelUsed}): подсветка по вашему фото.`,
      };
    } catch (e) {
      if (e instanceof GigaChatError && shouldAllowLocalFallback()) {
        const imageDataUrl = await renderLocalVisualization(
          options.imageBuffer,
          options.placement,
          options.lightingType,
          options.mountTarget
        );
        const { buildCombinedPrompt } = await import("./buildCombinedPrompt");
        return {
          imageDataUrl,
          promptUsed: buildCombinedPrompt(options.input, "openai_edit"),
          mode: "gigachat_photo",
          provider: "gigachat",
          userMessage:
            "GigaChat не сгенерировал картинку — подсветка на вашем фото (запасной режим).",
        };
      }
      throw e instanceof GigaChatError
        ? e
        : new GigaChatError({
            code: "unknown",
            message: e instanceof Error ? e.message : "Ошибка GigaChat",
            hint: "",
          });
    }
  }

  if (provider === "yandex") {
    const folderId = getYandexFolderId();

    if (!folderId || shouldYandexKeepOriginalPhoto()) {
      const result = await renderOnOriginalPhoto(options, "yandex");
      if (!folderId) {
        result.userMessage =
          "Подсветка на вашем фото. Чтобы вызывать YandexART, укажите YANDEX_FOLDER_ID в .env.local (ID каталога в Yandex Cloud).";
      } else {
        result.userMessage =
          "Подсветка на вашем фото (YANDEX_KEEP_ORIGINAL_PHOTO=true). Для YandexART установите YANDEX_KEEP_ORIGINAL_PHOTO=false.";
      }
      return result;
    }

    const { width, height } = await getImageSize(
      options.imageBuffer,
      options.imageWidth,
      options.imageHeight
    );

    try {
      const result = await generateImageWithYandex(options.input, width, height);
      return {
        ...result,
        mode: "yandex",
        provider: "yandex",
        userMessage:
          "Сгенерировано YandexART по промпту (новое изображение; для точного совпадения с вашим фасадом нужен режим редактирования фото).",
      };
    } catch (e) {
      throw e instanceof YandexArtError ? e : new YandexArtError(parseYandexError(e));
    }
  }

  try {
    const result = await generateImageWithOpenAI(options.imageDataUrl, options.input);
    return {
      imageDataUrl: result.imageDataUrl,
      promptUsed: result.promptUsed,
      mode: "openai",
      provider: "openai",
      userMessage: isGateLlmConfigured()
        ? "Фото обработано через GateLLM (chat + image): подсветка на вашем здании."
        : "Фото обработано OpenAI: подсветка добавлена на исходное изображение.",
    };
  } catch (e) {
    if (e instanceof OpenAiImageError) throw e;
    throw new OpenAiImageError(parseOpenAiError(e), []);
  }
}

export function parseVisualizationError(error: unknown): {
  code: string;
  message: string;
  hint: string;
} {
  if (error instanceof YandexArtError) return error.parsed;
  if (error instanceof OpenAiImageError) return error.parsed;
  if (error instanceof GigaChatError) return error.parsed;
  return {
    code: "unknown",
    message: error instanceof Error ? error.message : "Ошибка визуализации",
    hint: "",
  };
}
