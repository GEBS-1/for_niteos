import type OpenAI from "openai";
import {
  getOpenAiImageModel,
  getOpenAiProxyBillingHint,
  getOpenAiProxyLabel,
  getProxyChatImageModels,
} from "@/config/ai.config";

type AttemptError = { code: string; message: string; hint: string };

export type GateLlmImageResult = {
  imageDataUrl: string;
  promptUsed: string;
  modelUsed: string;
};

async function urlToDataUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:image")) return url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "image/png";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function readImageUrlFromPart(part: unknown): string | null {
  if (typeof part !== "object" || part === null) return null;
  const p = part as {
    type?: string;
    image_url?: { url?: string };
    url?: string;
  };
  if (p.image_url?.url) return p.image_url.url;
  if (p.type === "image" && p.url) return p.url;
  return null;
}

/** Извлекает data URL из ответа chat/completions (GateLLM, RouterAI, Gemini image) */
export async function extractImageFromChatCompletion(
  response: OpenAI.Chat.Completions.ChatCompletion
): Promise<string | null> {
  const message = response.choices[0]?.message as
    | (OpenAI.Chat.Completions.ChatCompletionMessage & {
        images?: unknown[];
      })
    | undefined;

  if (!message) return null;

  // RouterAI + Gemini: картинка в message.images[], content может быть null
  if (Array.isArray(message.images)) {
    for (const part of message.images) {
      const url = readImageUrlFromPart(part);
      if (url) {
        const resolved = await urlToDataUrl(url);
        if (resolved) return resolved;
      }
    }
  }

  const content = message.content;
  if (!content) return null;

  if (typeof content === "string") {
    const dataMatch = content.match(
      /data:image\/[a-zA-Z0-9+.]+;base64,[A-Za-z0-9+/=]+/
    );
    if (dataMatch?.[0]) return dataMatch[0];

    const urlMatch = content.match(
      /https?:\/\/[^\s"'<>)]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s"'<>)]*)?/i
    );
    if (urlMatch?.[0]) return urlToDataUrl(urlMatch[0]);

    const mdMatch = content.match(/!\[[^\]]*]\((https?:\/\/[^)]+)\)/);
    if (mdMatch?.[1]) return urlToDataUrl(mdMatch[1]);
  }

  if (Array.isArray(content)) {
    for (const part of content) {
      const url = readImageUrlFromPart(part);
      if (url) {
        const resolved = await urlToDataUrl(url);
        if (resolved) return resolved;
      }
    }
  }

  return null;
}

/**
 * OpenAI-совместимые прокси (GateLLM, RouterAI):
 * POST /v1/chat/completions с фото + промпт → image в ответе.
 */
export async function generateImageViaOpenAiProxyChat(
  openai: OpenAI,
  imageDataUrl: string,
  prompt: string
): Promise<GateLlmImageResult> {
  const primary = getOpenAiImageModel();
  const fallbacks = getProxyChatImageModels();
  const models = [...new Set([primary, ...fallbacks])];
  const proxyLabel = getOpenAiProxyLabel();
  const billingHint = getOpenAiProxyBillingHint();

  const attempts: AttemptError[] = [];

  for (const model of models) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        max_tokens: 4096,
      });

      const extracted = await extractImageFromChatCompletion(response);
      if (extracted) {
        return {
          imageDataUrl: extracted,
          promptUsed: prompt,
          modelUsed: model,
        };
      }

      const preview =
        typeof response.choices[0]?.message?.content === "string"
          ? response.choices[0].message.content.slice(0, 120)
          : "multipart";
      attempts.push({
        code: "empty_response",
        message: `Модель ${model}: нет изображения в ответе chat`,
        hint: `Ответ начинается с: ${preview}`,
      });
      console.warn(`${proxyLabel}: ${model} — текст без картинки`);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      const isMissingModel =
        err.status === 400 && String(err.message ?? "").includes("not found");
      attempts.push({
        code: err.status === 402 ? "insufficient_quota" : `http_${err.status ?? "error"}`,
        message: err.message ?? String(e),
        hint: billingHint,
      });
      if (!isMissingModel) {
        console.error(`${proxyLabel} chat failed (${model}):`, e);
      }
    }
  }

  throw new Error(
    attempts[0]?.message ??
      `${proxyLabel} не вернул изображение. Проверьте баланс и модель OPENAI_IMAGE_MODEL.`
  );
}

/** @deprecated Используйте generateImageViaOpenAiProxyChat */
export const generateImageViaGateLLMChat = generateImageViaOpenAiProxyChat;
