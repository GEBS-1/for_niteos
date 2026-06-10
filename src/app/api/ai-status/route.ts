import { NextRequest, NextResponse } from "next/server";
import {
  getDefaultSelectableProvider,
  getEffectiveBaseUrlDisplay,
  getOpenAiImageModel,
  getSelectableProviders,
  getYandexModelUri,
  getOpenAiProxyKind,
  getOpenAiProxyLabel,
  usesChatCompletionsForImages,
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
  const probeProvider = request.nextUrl.searchParams.get("provider");

  const selectable = getSelectableProviders();
  const defaultProvider = getDefaultSelectableProvider();

  let activeProvider: "openai" | "yandex" | "gigachat" | null = null;
  try {
    if (
      probeProvider === "openai" ||
      probeProvider === "gigachat" ||
      probeProvider === "yandex"
    ) {
      activeProvider = resolveImageProvider(probeProvider);
    } else if (defaultProvider) {
      activeProvider = resolveImageProvider(defaultProvider);
    }
  } catch {
    activeProvider = selectable[0] ?? null;
  }

  const base = {
    activeProvider,
    defaultProvider,
    selectable,
    imageProviderSetting: AI_PROVIDER_CONFIG.imageProvider,
    gigachatEnvFile: isGigachatEnvLoaded(),
    providers: {
      openai: {
        configured: isOpenAiConfigured(),
        gateLlm: getOpenAiProxyKind() === "gatellm",
        openAiProxy: getOpenAiProxyKind(),
        chatCompletionsImages: usesChatCompletionsForImages(),
        baseUrl: getEffectiveBaseUrlDisplay(),
        imageModel: getOpenAiImageModel(),
        label: getOpenAiProxyLabel(),
      },
      gigachat: {
        configured: isGigachatConfigured(),
        model: getGigachatModelDisplay(),
        modelApi: getGigachatModel(),
        label: "GigaChat",
      },
    },
    yandexConfigured: isYandexConfigured(),
    yandexKeepOriginalPhoto: shouldYandexKeepOriginalPhoto(),
    yandexModelUri: getYandexModelUri(),
    useLocalOnly: shouldUseLocalRenderer(),
    allowLocalFallback: shouldAllowLocalFallback(),
    pipeline:
      "Локальная расстановка → опционально AI-улучшение света (выбор провайдера на сайте)",
  };

  if (!probe) {
    return NextResponse.json(base);
  }

  const connections: Record<string, unknown> = {};

  if (probeProvider === "gigachat" || (!probeProvider && selectable.includes("gigachat"))) {
    if (isGigachatConfigured()) {
      connections.gigachat = await probeGigaChatConnection();
    }
  }
  if (probeProvider === "openai" || (!probeProvider && selectable.includes("openai"))) {
    if (isOpenAiConfigured()) {
      connections.openai = await probeOpenAiConnection();
    }
  }
  if (probeProvider === "yandex" && isYandexConfigured()) {
    connections.yandex = await probeYandexConnection();
  }

  const singleConnection =
    probeProvider === "gigachat"
      ? connections.gigachat
      : probeProvider === "openai"
        ? connections.openai
        : connections[activeProvider ?? ""] ?? connections.openai ?? connections.gigachat;

  return NextResponse.json({
    ...base,
    connections,
    connection: singleConnection,
  });
}
