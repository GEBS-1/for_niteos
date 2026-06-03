import type OpenAI from "openai";
import { getOpenAiImageModel } from "@/config/ai.config";
type AttemptError = { code: string; message: string; hint: string };

export type GateLlmImageResult = {
  imageDataUrl: string;
  promptUsed: string;
  modelUsed: string;
};

/** Извлекает data URL из ответа chat/completions (GateLLM + gpt-5-image) */
export function extractImageFromChatCompletion(
  response: OpenAI.Chat.Completions.ChatCompletion
): string | null {
  const content = response.choices[0]?.message?.content;

  if (!content) return null;

  if (typeof content === "string") {
    const match = content.match(/data:image\/[a-zA-Z0-9+.]+;base64,[A-Za-z0-9+/=]+/);
    return match?.[0] ?? null;
  }

  if (Array.isArray(content)) {
    for (const part of content as unknown[]) {
      if (typeof part !== "object" || part === null) continue;
      const p = part as { type?: string; image_url?: { url?: string } };
      if (p.type === "image_url" && p.image_url?.url?.startsWith("data:image")) {
        return p.image_url.url;
      }
    }
  }

  return null;
}

const GATE_LLM_CHAT_MODELS = [
  "openai/gpt-5-image",
  "openai/gpt-5.4-image-2",
  "openai/gpt-5-image-mini",
];

/**
 * GateLLM: POST /v1/chat/completions с фото + промпт → image_url в ответе.
 * /v1/images/edits на gatellm.ru не существует (404).
 */
export async function generateImageViaGateLLMChat(
  openai: OpenAI,
  imageDataUrl: string,
  prompt: string
): Promise<GateLlmImageResult> {
  const primary = getOpenAiImageModel();
  const models = [...new Set([primary, ...GATE_LLM_CHAT_MODELS])];

  const userText = [
    prompt,
    "",
    "Отредактируй это фото: добавь архитектурную подсветку вечером на том же здании.",
    "Сохрани форму здания, окна и пропорции. Верни итоговое изображение.",
  ].join("\n");

  const attempts: AttemptError[] = [];

  for (const model of models) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        max_tokens: 4096,
      });

      const extracted = extractImageFromChatCompletion(response);
      if (extracted) {
        return {
          imageDataUrl: extracted,
          promptUsed: userText,
          modelUsed: model,
        };
      }

      attempts.push({
        code: "empty_response",
        message: `Модель ${model}: нет изображения в ответе chat`,
        hint: "Попробуйте другую модель или повторите запрос",
      });
    } catch (e) {
      const err = e as { status?: number; message?: string };
      attempts.push({
        code: err.status === 402 ? "insufficient_quota" : `http_${err.status ?? "error"}`,
        message: err.message ?? String(e),
        hint: "Проверьте баланс на gatellm.ru",
      });
      console.error(`GateLLM chat failed (${model}):`, e);
    }
  }

  throw new Error(
    attempts[0]?.message ??
      "GateLLM не вернул изображение. Проверьте баланс и модель OPENAI_IMAGE_MODEL."
  );
}
