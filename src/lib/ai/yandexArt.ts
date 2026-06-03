import {
  AI_PROVIDER_CONFIG,
  getYandexApiKey,
  getYandexFolderId,
  getYandexModelUri,
} from "@/config/ai.config";
import {
  buildYandexPrompt,
  YANDEX_PROMPT_SAFE_CHARS,
  type CombinedPromptInput,
} from "./buildCombinedPrompt";

const YANDEX_LLM_BASE = "https://llm.api.cloud.yandex.net";
const IMAGE_ASYNC_URL = `${YANDEX_LLM_BASE}/foundationModels/v1/imageGenerationAsync`;
const OPERATIONS_URL = `${YANDEX_LLM_BASE}/operations`;

const MAX_PROMPT_CHARS = YANDEX_PROMPT_SAFE_CHARS;

export type YandexParsedError = {
  code: string;
  message: string;
  hint: string;
};

export class YandexArtError extends Error {
  constructor(readonly parsed: YandexParsedError) {
    super(parsed.message);
    this.name = "YandexArtError";
  }
}

function authHeaders(): HeadersInit {
  const apiKey = getYandexApiKey();
  if (!apiKey) {
    throw new YandexArtError({
      code: "no_api_key",
      message: "YANDEX_API_KEY не задан",
      hint: "Добавьте YANDEX_API_KEY (или Yandex_API_KEY) в .env.local",
    });
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Api-Key ${apiKey}`,
  };
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function aspectRatioFromSize(
  width: number,
  height: number
): { widthRatio: string; heightRatio: string } {
  const g = gcd(width, height);
  return {
    widthRatio: String(Math.max(1, Math.round(width / g))),
    heightRatio: String(Math.max(1, Math.round(height / g))),
  };
}

/** ID каталога в Cloud начинается с b1…; ai-studio-… — другой идентификатор */
export function validateYandexFolderIdFormat(folderId: string): YandexParsedError | null {
  const id = folderId.trim();
  if (id.startsWith("ai-studio-")) {
    return {
      code: "invalid_folder_format",
      message: `«${id}» — ID AI Studio, не каталога Cloud`,
      hint:
        "В .env.local укажите YANDEX_FOLDER_ID из console.cloud.yandex.ru → Каталоги (формат b1g…). Ключ API привязан к одному каталогу.",
    };
  }
  if (!/^b1[a-z0-9]+$/.test(id)) {
    return {
      code: "invalid_folder_format",
      message: `«${id}» не похож на ID каталога Yandex Cloud`,
      hint: "Скопируйте ID каталога (b1g…) в cloud.yandex.ru, не slug из AI Studio.",
    };
  }
  return null;
}

export function parseYandexError(error: unknown): YandexParsedError {
  if (error instanceof YandexArtError) return error.parsed;

  const err = error as {
    message?: string;
    code?: string;
    status?: number;
  };
  const message = err.message ?? "Ошибка Yandex Cloud API";
  const status = err.status;

  const folderMismatch = message.match(
    /Specified folder ID '([^']+)' does not match with service account folder ID '([^']+)'/i
  );
  if (folderMismatch) {
    const wrong = folderMismatch[1];
    const correct = folderMismatch[2];
    return {
      code: "folder_id_mismatch",
      message: `YANDEX_FOLDER_ID не совпадает с каталогом API-ключа`,
      hint: `Замените в .env.local: YANDEX_FOLDER_ID=${correct} (сейчас указано «${wrong}» — это не ID каталога). Перезапустите npm run dev.`,
    };
  }

  if (
    message.includes("exceeds limit") ||
    message.includes("Prompt positive size")
  ) {
    return {
      code: "prompt_too_long",
      message: "Промпт длиннее 500 символов (лимит YandexART)",
      hint: "Перезапустите npm run dev — приложение сокращает промпт автоматически.",
    };
  }

  if (message.includes("folder") || message.includes("Folder")) {
    return {
      code: "invalid_folder",
      message: "Неверный YANDEX_FOLDER_ID",
      hint:
        "ID каталога: console.cloud.yandex.ru → Каталоги → b1g… (не ai-studio-… из AI Studio).",
    };
  }

  if (status === 401 || message.includes("Unauthorized")) {
    return {
      code: "unauthorized",
      message: "Неверный API-ключ Yandex",
      hint: "Проверьте YANDEX_API_KEY и права yc.ai.imageGeneration.execute",
    };
  }

  if (status === 403) {
    return {
      code: "forbidden",
      message: "Доступ к YandexART запрещён (403)",
      hint: "Включите Foundation Models / YandexART для каталога и проверьте роль сервисного аккаунта",
    };
  }

  return {
    code: err.code ?? "unknown",
    message,
    hint: "Проверьте YANDEX_FOLDER_ID, баланс Yandex Cloud и логи терминала",
  };
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: T & { message?: string; error?: { message?: string } };
  try {
    data = JSON.parse(text) as T & { message?: string; error?: { message?: string } };
  } catch {
    throw new YandexArtError({
      code: "invalid_response",
      message: `Yandex API: ${res.status}`,
      hint: text.slice(0, 200),
    });
  }

  if (!res.ok) {
    const msg = data.message ?? data.error?.message ?? text.slice(0, 300);
    throw new YandexArtError({
      code: `http_${res.status}`,
      message: msg,
      hint: "См. консоль сервера и документацию YandexART",
    });
  }

  return data as T;
}

interface YandexOperation {
  id: string;
  done?: boolean;
  error?: { code?: number; message?: string };
  response?: { image?: string };
}

function truncatePrompt(prompt: string): string {
  if (prompt.length <= MAX_PROMPT_CHARS) return prompt;
  return `${prompt.slice(0, MAX_PROMPT_CHARS)}…`;
}

async function pollOperation(operationId: string): Promise<string> {
  const headers = authHeaders();
  const { yandexPollIntervalMs, yandexPollMaxAttempts } = AI_PROVIDER_CONFIG;

  for (let i = 0; i < yandexPollMaxAttempts; i++) {
    await new Promise((r) => setTimeout(r, yandexPollIntervalMs));

    const res = await fetch(`${OPERATIONS_URL}/${operationId}`, {
      method: "GET",
      headers,
    });

    const op = await parseJsonResponse<YandexOperation>(res);

    if (op.error?.message) {
      throw new YandexArtError({
        code: "generation_failed",
        message: op.error.message,
        hint: "Ошибка генерации YandexART",
      });
    }

    if (op.done && op.response?.image) {
      const b64 = op.response.image;
      const mime = b64.startsWith("/9j/") ? "image/jpeg" : "image/png";
      return `data:${mime};base64,${b64}`;
    }

    if (op.done && !op.response?.image) {
      throw new YandexArtError({
        code: "empty_response",
        message: "YandexART не вернул изображение",
        hint: "Повторите запрос или смените промпт",
      });
    }
  }

  throw new YandexArtError({
    code: "timeout",
    message: "Превышено время ожидания YandexART",
    hint: `Операция ${operationId} не завершилась за ${(yandexPollIntervalMs * yandexPollMaxAttempts) / 1000} с`,
  });
}

/**
 * Генерация изображения через YandexART (текст → картинка, асинхронно).
 */
export async function generateImageWithYandex(
  input: CombinedPromptInput,
  imageWidth: number,
  imageHeight: number
): Promise<{ imageDataUrl: string; promptUsed: string }> {
  const folderId = getYandexFolderId();
  if (!folderId) {
    throw new YandexArtError({
      code: "no_folder_id",
      message: "YANDEX_FOLDER_ID не задан",
      hint:
        "В .env.local добавьте ID каталога Yandex Cloud: YANDEX_FOLDER_ID=b1gxxxxxxxxxx",
    });
  }

  const folderFormatError = validateYandexFolderIdFormat(folderId);
  if (folderFormatError) {
    throw new YandexArtError(folderFormatError);
  }

  const modelUri = getYandexModelUri();
  if (modelUri.includes("<folder_id>")) {
    throw new YandexArtError({
      code: "no_folder_id",
      message: "Некорректный modelUri — нужен YANDEX_FOLDER_ID",
      hint: "YANDEX_FOLDER_ID=ID вашего каталога в консоли cloud.yandex.ru",
    });
  }

  const prompt = truncatePrompt(buildYandexPrompt(input));
  const aspect = aspectRatioFromSize(
    imageWidth > 0 ? imageWidth : 16,
    imageHeight > 0 ? imageHeight : 9
  );

  const body = {
    modelUri,
    generationOptions: {
      aspectRatio: aspect,
    },
    messages: [
      {
        weight: "1",
        text: prompt,
      },
    ],
  };

  const createRes = await fetch(IMAGE_ASYNC_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  const created = await parseJsonResponse<{ id: string }>(createRes);
  if (!created.id) {
    throw new YandexArtError({
      code: "no_operation_id",
      message: "Yandex не вернул id операции",
      hint: "Проверьте формат запроса и права API-ключа",
    });
  }

  const imageDataUrl = await pollOperation(created.id);
  return { imageDataUrl, promptUsed: prompt };
}

/** Проверка ключей (без генерации изображения) */
export async function probeYandexConnection(): Promise<{
  ok: boolean;
  code?: string;
  message: string;
  hint?: string;
  folderIdSet: boolean;
  modelUri: string;
}> {
  const folderIdSet = Boolean(getYandexFolderId());
  const modelUri = getYandexModelUri();

  if (!getYandexApiKey()) {
    return {
      ok: false,
      code: "no_api_key",
      message: "YANDEX_API_KEY не задан",
      hint: "Добавьте ключ в .env.local",
      folderIdSet,
      modelUri,
    };
  }

  if (!folderIdSet) {
    return {
      ok: false,
      code: "no_folder_id",
      message: "YANDEX_FOLDER_ID не задан",
      hint: "ID каталога: cloud.yandex.ru → Каталоги → скопировать b1g… (не ai-studio-…)",
      folderIdSet: false,
      modelUri,
    };
  }

  const folderId = getYandexFolderId()!;
  const formatError = validateYandexFolderIdFormat(folderId);
  if (formatError) {
    return {
      ok: false,
      code: formatError.code,
      message: formatError.message,
      hint: formatError.hint,
      folderIdSet,
      modelUri,
    };
  }

  try {
    const res = await fetch(IMAGE_ASYNC_URL, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });

    const text = await res.text();

    if (res.status === 401) {
      return {
        ok: false,
        code: "unauthorized",
        message: "Неверный Yandex API-ключ",
        hint: "Проверьте YANDEX_API_KEY и scope yc.ai.imageGeneration.execute",
        folderIdSet,
        modelUri,
      };
    }

    if (res.status === 403) {
      return {
        ok: false,
        code: "forbidden",
        message: "Нет доступа к YandexART",
        hint: "Включите Foundation Models в каталоге и права сервисного аккаунта",
        folderIdSet,
        modelUri,
      };
    }

    // 400 = ключ принят, тело запроса невалидно (ожидаемо для probe)
    if (res.status === 400 || res.status === 200) {
      return {
        ok: true,
        message: "Ключ Yandex принят, каталог настроен",
        hint:
          "Для YandexART: YANDEX_KEEP_ORIGINAL_PHOTO=false. Сейчас можно подсветку на вашем фото.",
        folderIdSet,
        modelUri,
      };
    }

    return {
      ok: false,
      code: `http_${res.status}`,
      message: `Yandex API ответил: ${res.status}`,
      hint: text.slice(0, 180),
      folderIdSet,
      modelUri,
    };
  } catch (e) {
    const parsed = parseYandexError(e);
    return {
      ok: false,
      code: parsed.code,
      message: parsed.message,
      hint: parsed.hint,
      folderIdSet,
      modelUri,
    };
  }
}
