import { randomUUID } from "crypto";
import { buildLightOnlyPrompt } from "./buildCombinedPrompt";
import {
  getGigachatApiUrl,
  getGigachatClientId,
  getGigachatCredentials,
  getGigachatModel,
  getGigachatOauthUrl,
  getGigachatScope,
  getGigachatTimeoutMs,
  shouldGigachatVerifySsl,
} from "@/config/gigachat.config";

export type GigaChatParsedError = {
  code: string;
  message: string;
  hint: string;
};

export class GigaChatError extends Error {
  constructor(readonly parsed: GigaChatParsedError) {
    super(parsed.message);
    this.name = "GigaChatError";
  }
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function httpsAgent() {
  if (shouldGigachatVerifySsl()) return undefined;
  // Node fetch: disable TLS verify for GigaChat on Windows without NUC cert
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  return undefined;
}

async function fetchGiga(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? getGigachatTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function getGigaChatAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const credentials = getGigachatCredentials();
  if (!credentials) {
    throw new GigaChatError({
      code: "no_credentials",
      message: "GIGACHAT_CREDENTIALS не задан",
      hint: "Заполните .env.gigachat",
    });
  }

  const res = await fetchGiga(getGigachatOauthUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${credentials}`,
      RqUID: randomUUID(),
    },
    body: new URLSearchParams({ scope: getGigachatScope() }).toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new GigaChatError({
      code: `oauth_${res.status}`,
      message: `OAuth GigaChat: ${text.slice(0, 200)}`,
      hint: "Проверьте GIGACHAT_CREDENTIALS и GIGACHAT_SCOPE в .env.gigachat",
    });
  }

  const data = JSON.parse(text) as { access_token: string; expires_at?: number };
  const expiresAt = data.expires_at
    ? data.expires_at * 1000
    : Date.now() + 29 * 60 * 1000;
  cachedToken = { token: data.access_token, expiresAt };
  return data.access_token;
}

export async function uploadGigaChatImage(
  buffer: Buffer,
  mime: string,
  filename: string
): Promise<string> {
  const token = await getGigaChatAccessToken();
  const clientId = getGigachatClientId();

  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mime });
  form.append("file", blob, filename);
  form.append("purpose", "general");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (clientId) headers["X-Client-ID"] = clientId;

  const res = await fetchGiga(`${getGigachatApiUrl()}/files`, {
    method: "POST",
    headers,
    body: form,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new GigaChatError({
      code: `upload_${res.status}`,
      message: `Загрузка фото: ${text.slice(0, 300)}`,
      hint: "Проверьте GIGACHAT_CLIENT_ID и формат изображения (JPEG/PNG)",
    });
  }

  const data = JSON.parse(text) as { id?: string };
  if (!data.id) {
    throw new GigaChatError({
      code: "no_file_id",
      message: "GigaChat не вернул id файла",
      hint: "",
    });
  }
  return data.id;
}

function extractImageFileIdFromContent(content: string): string | null {
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) return imgMatch[1];
  const uuidMatch = content.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  return uuidMatch?.[0] ?? null;
}

export async function downloadGigaChatFile(fileId: string): Promise<Buffer> {
  const token = await getGigaChatAccessToken();
  const clientId = getGigachatClientId();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (clientId) headers["X-Client-ID"] = clientId;

  const res = await fetchGiga(`${getGigachatApiUrl()}/files/${fileId}/content`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new GigaChatError({
      code: `download_${res.status}`,
      message: `Скачивание изображения: ${text.slice(0, 200)}`,
      hint: "",
    });
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

interface ChatMessage {
  role: string;
  content?: string;
  attachments?: string[];
}

async function chatCompletions(body: Record<string, unknown>): Promise<{
  content: string;
  finishReason?: string;
}> {
  const token = await getGigaChatAccessToken();
  const clientId = getGigachatClientId();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (clientId) headers["X-Client-ID"] = clientId;

  const res = await fetchGiga(`${getGigachatApiUrl()}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new GigaChatError({
      code: `chat_${res.status}`,
      message: `Chat GigaChat: ${text.slice(0, 400)}`,
      hint: "Проверьте GIGACHAT_MODEL (GigaChat-2-Lite) и баланс API",
    });
  }

  const data = JSON.parse(text) as {
    choices?: Array<{
      message?: { content?: string };
      finish_reason?: string;
    }>;
  };

  const choice = data.choices?.[0];
  return {
    content: choice?.message?.content ?? "",
    finishReason: choice?.finish_reason,
  };
}

/**
 * Улучшение света на локально подготовленном изображении (светильники уже на фото).
 */
export async function enhanceLightWithGigaChat(
  localImageBuffer: Buffer
): Promise<{ imageDataUrl: string; promptUsed: string; modelUsed: string }> {
  return generateImageWithGigaChat(localImageBuffer, "image/jpeg");
}

export async function generateImageWithGigaChat(
  imageBuffer: Buffer,
  mime: string,
  customPrompt?: string
): Promise<{ imageDataUrl: string; promptUsed: string; modelUsed: string }> {
  httpsAgent();

  const ext = mime.includes("png") ? "png" : "jpg";
  const fileId = await uploadGigaChatImage(
    imageBuffer,
    mime,
    `facade-prepared.${ext}`
  );

  const userPrompt = customPrompt ?? buildLightOnlyPrompt();

  const model = getGigachatModel();
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: userPrompt,
      attachments: [fileId],
    },
  ];

  const { content, finishReason } = await chatCompletions({
    model,
    messages,
    function_call: "auto",
    stream: false,
  });

  let imageFileId = extractImageFileIdFromContent(content);

  if (!imageFileId && finishReason !== "stop") {
    const retry = await chatCompletions({
      model,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      function_call: "auto",
      stream: false,
    });
    imageFileId = extractImageFileIdFromContent(retry.content);
  }

  if (imageFileId) {
    const imgBuffer = await downloadGigaChatFile(imageFileId);
    const outMime = "image/jpeg";
    const b64 = imgBuffer.toString("base64");
    return {
      imageDataUrl: `data:${outMime};base64,${b64}`,
      promptUsed: userPrompt,
      modelUsed: model,
    };
  }

  throw new GigaChatError({
    code: "no_image_in_response",
    message:
      "GigaChat не вернул изображение (модель Lite может не поддерживать text2image).",
    hint:
      "Попробуйте GigaChat-2-Pro или GigaChat-2-Max в .env.gigachat, либо включите ALLOW_LOCAL_FALLBACK=true",
  });
}

export async function probeGigaChatConnection(): Promise<{
  ok: boolean;
  code?: string;
  message: string;
  hint?: string;
  model: string;
}> {
  const model = getGigachatModel();
  try {
    httpsAgent();
    const token = await getGigaChatAccessToken();
    const res = await fetchGiga(`${getGigachatApiUrl()}/models`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        code: `http_${res.status}`,
        message: `Модели API: ${res.status}`,
        hint: text.slice(0, 150),
        model,
      };
    }
    return {
      ok: true,
      message: `OAuth OK, модель ${model}`,
      hint: "Генерация может занять 30–90 с",
      model,
    };
  } catch (e) {
    if (e instanceof GigaChatError) {
      return { ok: false, ...e.parsed, model };
    }
    return {
      ok: false,
      code: "unknown",
      message: e instanceof Error ? e.message : "Ошибка GigaChat",
      hint: "Проверьте .env.gigachat и интернет",
      model,
    };
  }
}
