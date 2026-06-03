import { NextRequest, NextResponse } from "next/server";
import {
  getEffectiveBaseUrlDisplay,
  getOpenAiImageModel,
  getYandexModelUri,
  isGateLlmConfigured,
  isGigachatConfigured,
  isOpenAiConfigured,
  isProxyConfigured,
  isYandexConfigured,
  resolveImageProvider,
  shouldAllowLocalFallback,
  shouldUseLocalRenderer,
  shouldYandexKeepOriginalPhoto,
  getYandexApiKey,
  getYandexFolderId,
  AI_PROVIDER_CONFIG,
} from "@/config/ai.config";
import {
  getGigachatModel,
  getGigachatModelDisplay,
} from "@/config/gigachat.config";
import { probeGigaChatConnection } from "@/lib/ai/gigachatVisualize";
import { probeOpenAiConnection } from "@/lib/ai/openaiVisualize";
import { probeYandexConnection } from "@/lib/ai/yandexArt";
import { isGigachatEnvLoaded } from "@/lib/env/loadGigachatEnv";

export async function GET(request: NextRequest) {
  const probe = request.nextUrl.searchParams.get("probe") === "1";

  let activeProvider: "openai" | "yandex" | "gigachat" | null = null;
  try {
    activeProvider = resolveImageProvider();
  } catch {
    activeProvider = null;
  }

  const pipeline =
    activeProvider === "gigachat"
      ? "GigaChat: фото → upload → chat (Lite) + text2image → результат"
      : activeProvider === "yandex"
        ? "Yandex: фото + расчёт → YandexART (или подсветка на фото)"
        : isGateLlmConfigured()
          ? "GateLLM: фото + промпт → chat/completions → результат"
          : "OpenAI: фото + промпт → images.edit → результат";

  const base = {
    activeProvider,
    imageProviderSetting: AI_PROVIDER_CONFIG.imageProvider,
    gigachatEnvFile: isGigachatEnvLoaded(),
    gigachatConfigured: isGigachatConfigured(),
    gigachatModel: getGigachatModelDisplay(),
    gigachatModelApi: getGigachatModel(),
    openAiKeySet: isOpenAiConfigured(),
    yandexKeySet: Boolean(getYandexApiKey()),
    yandexFolderSet: Boolean(getYandexFolderId()),
    yandexConfigured: isYandexConfigured(),
    yandexKeepOriginalPhoto: shouldYandexKeepOriginalPhoto(),
    baseUrl: getEffectiveBaseUrlDisplay(),
    gateLlm: isGateLlmConfigured(),
    proxyConfigured: isProxyConfigured(),
    imageModel: getOpenAiImageModel(),
    yandexModelUri: getYandexModelUri(),
    useLocalOnly: shouldUseLocalRenderer(),
    allowLocalFallback: shouldAllowLocalFallback(),
    pipeline,
  };

  if (!probe) {
    return NextResponse.json(base);
  }

  let connection;
  if (activeProvider === "gigachat") {
    connection = await probeGigaChatConnection();
  } else if (activeProvider === "yandex") {
    connection = await probeYandexConnection();
  } else if (isOpenAiConfigured()) {
    connection = await probeOpenAiConnection();
  } else {
    connection = await probeYandexConnection();
  }

  return NextResponse.json({ ...base, connection });
}
