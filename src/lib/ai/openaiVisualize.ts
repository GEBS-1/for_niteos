import OpenAI, { toFile } from "openai";

import {

  AI_PROVIDER_CONFIG,

  getEffectiveBaseUrlDisplay,

  getOpenAiApiKey,

  getOpenAiBaseUrl,

  getOpenAiImageModel,

  getOpenAiProxyBillingHint,
  getOpenAiProxyLabel,
  isProxyConfigured,
  usesChatCompletionsForImages,
} from "@/config/ai.config";

import {
  buildCombinedPrompt,
  buildLightOnlyPrompt,
  type CombinedPromptInput,
} from "./buildCombinedPrompt";
import { generateImageViaOpenAiProxyChat } from "./gateLlmVisualize";

import sharp from "sharp";



const MAX_PROMPT_CHARS = 3200;



function dataUrlToBuffer(dataUrl: string): Buffer {

  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);

  if (!match) throw new Error("Некорректный формат изображения");

  return Buffer.from(match[2], "base64");

}



const AI_ENHANCE_MAX_SIDE = 1536;

async function prepareImageForOpenAI(buffer: Buffer): Promise<{

  file: Awaited<ReturnType<typeof toFile>>;

}> {

  const resized = await sharp(buffer)

    .resize(AI_ENHANCE_MAX_SIDE, AI_ENHANCE_MAX_SIDE, { fit: "inside", withoutEnlargement: true })

    .png()

    .toBuffer();

  return {

    file: await toFile(resized, "facade.png", { type: "image/png" }),

  };

}



export function createOpenAIClient(): OpenAI {

  const apiKey = getOpenAiApiKey();

  if (!apiKey) {

    throw new Error("OPENAI_API_KEY не задан в .env.local");

  }

  return new OpenAI({

    apiKey,

    baseURL: getOpenAiBaseUrl(),

    timeout: AI_PROVIDER_CONFIG.openAiTimeoutMs,

    maxRetries: 0,

  });

}



type ParsedError = {

  code: string;

  message: string;

  hint: string;

  httpStatus?: number;

};



function extractErrorPayload(error: unknown): {

  code: string;

  message: string;

  httpStatus?: number;

} {

  const err = error as {

    status?: number;

    code?: string;

    message?: string;

    error?: { code?: string; message?: string; type?: string };

  };



  const code = String(err?.code ?? err?.error?.code ?? "unknown");

  const message = String(

    err?.message ?? err?.error?.message ?? "Ошибка OpenAI API"

  );



  return { code, message, httpStatus: err?.status };

}



/** Не повторять запрос при этих кодах */

function isNonRetryableError(code: string, message: string, httpStatus?: number): boolean {

  if (httpStatus === 403) return true;

  const codes = [

    "unsupported_country_region_territory",

    "billing_hard_limit_reached",

    "insufficient_quota",

    "invalid_api_key",

    "authentication_error",

    "account_deactivated",

  ];

  if (codes.includes(code)) return true;

  if (message.includes("Billing hard limit")) return true;

  if (message.includes("Country, region, or territory not supported")) return true;

  return false;

}



export function parseOpenAiError(error: unknown): ParsedError {

  const { code, message, httpStatus } = extractErrorPayload(error);



  if (

    code === "unsupported_country_region_territory" ||

    httpStatus === 403 ||

    message.includes("Country, region, or territory not supported")

  ) {

    const proxyHint = isProxyConfigured()

      ? "Прокси задан, но запрос всё равно заблокирован — проверьте URL прокси (должен вести на OpenAI) и перезапустите dev-сервер."

      : "Добавьте в .env.local: OPENAI_BASE_URL=https://ваш-прокси.example/v1 и перезапустите npm run dev.";

    return {

      code: "region_blocked",

      message: "OpenAI недоступен из вашего региона (403).",

      hint: proxyHint,

      httpStatus,

    };

  }



  if (

    code === "billing_hard_limit_reached" ||

    message.includes("Billing hard limit")

  ) {

    return {

      code: "billing_hard_limit_reached",

      message: "Исчерпан лимит оплаты OpenAI (billing hard limit).",

      hint:

        "Пополните баланс или поднимите лимит на platform.openai.com → Settings → Billing. Прокси здесь не поможет — API уже отвечает.",

      httpStatus,

    };

  }



  if (
    code === "insufficient_quota" ||
    message.includes("insufficient_quota") ||
    httpStatus === 402 ||
    message.includes("Недостаточно средств")
  ) {

    return {

      code: "insufficient_quota",

      message: httpStatus === 402 ? "Недостаточно средств на балансе (402)" : "Недостаточно квоты API.",

      hint: isProxyConfigured()
        ? getOpenAiProxyBillingHint()
        : "Проверьте баланс OpenAI.",

      httpStatus,

    };

  }



  if (

    code === "invalid_api_key" ||

    message.includes("Incorrect API key") ||

    message.includes("invalid_api_key")

  ) {

    return {

      code: "invalid_api_key",

      message: "Неверный OPENAI_API_KEY.",

      hint: "Скопируйте ключ заново в .env.local и перезапустите npm run dev.",

      httpStatus,

    };

  }



  if (httpStatus === 404 && usesChatCompletionsForImages()) {
    return {
      code: "endpoint_not_found",
      message: `${getOpenAiProxyLabel()} не поддерживает images.edit (404).`,
      hint: "Должен использоваться chat/completions — перезапустите dev-сервер.",
      httpStatus,
    };
  }

  if (message.includes("timed out") || message.includes("timeout")) {

    return {

      code: "timeout",

      message: "Превышено время ожидания ответа OpenAI.",

      hint: usesChatCompletionsForImages()
        ? `${getOpenAiProxyLabel()} chat может занять 1–2 минуты. Увеличьте OPENAI_TIMEOUT_MS=180000.`
        : "Попробуйте снова или уменьшите размер фото.",

      httpStatus,

    };

  }



  if (message.includes("does not exist") && message.includes("model")) {

    return {

      code: "invalid_model",

      message: `Модель недоступна: ${message}`,

      hint: `Задайте OPENAI_IMAGE_MODEL=gpt-image-1 в .env.local (сейчас: ${getOpenAiImageModel()}).`,

      httpStatus,

    };

  }



  return {

    code,

    message,

    hint: `Шлюз: ${getEffectiveBaseUrlDisplay()}. Проверьте ключ, баланс и логи терминала (npm run dev).`,

    httpStatus,

  };

}



function truncatePrompt(prompt: string): string {

  if (prompt.length <= MAX_PROMPT_CHARS) return prompt;

  return `${prompt.slice(0, MAX_PROMPT_CHARS)}\n[...]`;

}



export function buildLightingPrompt(input: CombinedPromptInput): string {

  return buildCombinedPrompt(input, "openai_edit");

}



export class OpenAiImageError extends Error {

  constructor(

    readonly parsed: ParsedError,

    readonly attempts: ParsedError[]

  ) {

    super(parsed.message);

    this.name = "OpenAiImageError";

  }

}



/**

 * Редактирование исходного фото через OpenAI Images API (gpt-image-1).

 */

/** AI только улучшает свет на уже подготовленной локальной картинке */
export async function enhanceLightWithOpenAI(
  localImageDataUrl: string,
  localBuffer: Buffer
): Promise<{ imageDataUrl: string; promptUsed: string }> {
  const openai = createOpenAIClient();
  const prompt = truncatePrompt(buildLightOnlyPrompt());

  if (usesChatCompletionsForImages()) {
    const jpeg = await sharp(localBuffer)
      .resize(AI_ENHANCE_MAX_SIDE, AI_ENHANCE_MAX_SIDE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88 })
      .toBuffer();
    const optimizedUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    const result = await generateImageViaOpenAiProxyChat(openai, optimizedUrl, prompt);
    return {
      imageDataUrl: result.imageDataUrl,
      promptUsed: prompt,
    };
  }

  const { file } = await prepareImageForOpenAI(localBuffer);

  const primaryModel = getOpenAiImageModel();
  const models = [
    ...new Set([
      primaryModel,
      "openai/gpt-5-image",
      "openai/gpt-5.4-image-2",
      "gpt-image-1",
      "openai/gpt-image-1",
    ]),
  ];

  const attempts: ParsedError[] = [];

  for (const model of models) {
    try {
      const result = await openai.images.edit({
        model,
        image: file,
        prompt,
        size: "auto",
      });

      const b64 = result.data?.[0]?.b64_json;
      if (b64) {
        return {
          imageDataUrl: `data:image/png;base64,${b64}`,
          promptUsed: prompt,
        };
      }

      attempts.push({
        code: "empty_response",
        message: `Модель ${model}: пустой ответ`,
        hint: "Проверьте OPENAI_IMAGE_MODEL в .env.local (список: GET /v1/models)",
      });
    } catch (e) {
      const parsed = parseOpenAiError(e);
      attempts.push(parsed);
      console.error(`images.edit failed (${model}):`, e);

      if (isNonRetryableError(parsed.code, parsed.message, parsed.httpStatus)) {
        throw new OpenAiImageError(parsed, attempts);
      }
    }
  }



  const best = attempts[0] ?? {

    code: "unknown",

    message: "OpenAI не вернул изображение",

    hint: "",

  };

  throw new OpenAiImageError(best, attempts);
}

/** Редактирование фото: полный промпт (светильник, кол-во, вечер, видимые корпуса) */
export async function generateImageWithOpenAI(
  imageDataUrl: string,
  input: CombinedPromptInput
): Promise<{ imageDataUrl: string; promptUsed: string }> {
  const buffer = dataUrlToBuffer(imageDataUrl);
  const openai = createOpenAIClient();
  const prompt = truncatePrompt(buildCombinedPrompt(input, "openai_edit"));

  if (usesChatCompletionsForImages()) {
    const jpeg = await sharp(buffer)
      .resize(AI_ENHANCE_MAX_SIDE, AI_ENHANCE_MAX_SIDE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88 })
      .toBuffer();
    const optimizedUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    const result = await generateImageViaOpenAiProxyChat(openai, optimizedUrl, prompt);
    return {
      imageDataUrl: result.imageDataUrl,
      promptUsed: prompt,
    };
  }

  const { file } = await prepareImageForOpenAI(buffer);
  const primaryModel = getOpenAiImageModel();
  const models = [
    ...new Set([
      primaryModel,
      "openai/gpt-5-image",
      "openai/gpt-5.4-image-2",
      "gpt-image-1",
      "openai/gpt-image-1",
    ]),
  ];

  const attempts: ParsedError[] = [];
  for (const model of models) {
    try {
      const result = await openai.images.edit({
        model,
        image: file,
        prompt,
        size: "auto",
      });
      const b64 = result.data?.[0]?.b64_json;
      if (b64) {
        return {
          imageDataUrl: `data:image/png;base64,${b64}`,
          promptUsed: prompt,
        };
      }
      attempts.push({
        code: "empty_response",
        message: `Модель ${model}: пустой ответ`,
        hint: "Проверьте OPENAI_IMAGE_MODEL в .env.local",
      });
    } catch (e) {
      const parsed = parseOpenAiError(e);
      attempts.push(parsed);
      if (isNonRetryableError(parsed.code, parsed.message, parsed.httpStatus)) {
        throw new OpenAiImageError(parsed, attempts);
      }
    }
  }

  const best = attempts[0] ?? {
    code: "unknown",
    message: "OpenAI не вернул изображение",
    hint: "",
  };
  throw new OpenAiImageError(best, attempts);
}

/** Проверка подключения к API (без генерации изображения) */

export async function probeOpenAiConnection(): Promise<{

  ok: boolean;

  code?: string;

  message: string;

  hint?: string;

  baseUrl: string;

  proxyConfigured: boolean;

  imageModel: string;

}> {

  const baseUrl = getEffectiveBaseUrlDisplay();

  const proxyConfigured = isProxyConfigured();



  if (!getOpenAiApiKey()) {

    return {

      ok: false,

      code: "no_api_key",

      message: "OPENAI_API_KEY не задан",

      hint: "Добавьте ключ в .env.local",

      baseUrl,

      proxyConfigured,

      imageModel: getOpenAiImageModel(),

    };

  }



  try {

    const openai = createOpenAIClient();

    await openai.models.list();

    return {

      ok: true,

      message: "Подключение к OpenAI API успешно",

      baseUrl,

      proxyConfigured,

      imageModel: getOpenAiImageModel(),

    };

  } catch (e) {

    const parsed = parseOpenAiError(e);

    return {

      ok: false,

      code: parsed.code,

      message: parsed.message,

      hint: parsed.hint,

      baseUrl,

      proxyConfigured,

      imageModel: getOpenAiImageModel(),

    };

  }

}



export async function generateVideoWithOpenAI(

  imageDataUrl: string,

  input: CombinedPromptInput

): Promise<{ videoUrl?: string; jobId?: string; message: string }> {

  const openai = createOpenAIClient();

  const prompt = truncatePrompt(buildCombinedPrompt(input, "openai_edit"));

  const buffer = dataUrlToBuffer(imageDataUrl);

  const { file } = await prepareImageForOpenAI(buffer);



  try {

    const video = await openai.videos.create({

      model: AI_PROVIDER_CONFIG.videoModel,

      prompt: `${prompt}\nПлавная анимация включения подсветки.`,

      input_reference: file,

      size: "1280x720",

      seconds: "4",

    });



    const jobId = (video as { id?: string }).id;

    return {

      jobId,

      message: jobId

        ? "Видео поставлено в очередь OpenAI (Sora)."

        : "Запрос видео отправлен.",

    };

  } catch (e) {

    const parsed = parseOpenAiError(e);

    return { message: `${parsed.message} ${parsed.hint}` };

  }

}



