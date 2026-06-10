/**
 * Настройки AI-провайдеров для визуализации.
 * GigaChat: .env.gigachat (подгружается в gigachat.config.ts)
 */

import "server-only";

import {
  ensureGigachatEnvPriority,
  loadGigachatEnv,
} from "@/lib/env/loadGigachatEnv";
import { isGigachatConfigured } from "./gigachat.config";

loadGigachatEnv();
ensureGigachatEnvPriority();

export type ImageProvider = "openai" | "yandex" | "gigachat" | "auto";

export interface AiProviderConfig {
  enabled: boolean;
  useLocalRendererOnly: boolean;
  allowLocalFallback: boolean;
  imageProvider: ImageProvider;
  openAiApiKeyEnvs: string[];
  openAiBaseUrlEnv: string;
  openAiImageModelEnv: string;
  yandexApiKeyEnvs: string[];
  yandexFolderIdEnvs: string[];
  yandexModelUriEnv: string;
  yandexKeepOriginalPhoto: boolean;
  openAiImageModel: string;
  videoModel: string;
  openAiTimeoutMs: number;
  yandexPollIntervalMs: number;
  yandexPollMaxAttempts: number;
}

function envBool(name: string, defaultValue: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return defaultValue;
  return v === "1" || v.toLowerCase() === "true";
}

function envString(name: string, defaultValue: string): string {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : defaultValue;
}

export function normalizeOpenAiBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  if (!url.endsWith("/v1")) {
    url = `${url}/v1`;
  }
  return url;
}

function readFirstEnv(names: string[]): string | undefined {
  for (const name of names) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  return undefined;
}

function resolveImageProviderEnv(): ImageProvider {
  const raw = process.env.AI_IMAGE_PROVIDER?.trim().toLowerCase();
  if (raw === "openai" || raw === "yandex" || raw === "gigachat" || raw === "auto") {
    return raw;
  }
  return "auto";
}

export const AI_PROVIDER_CONFIG: AiProviderConfig = {
  enabled: true,
  useLocalRendererOnly: envBool("USE_LOCAL_RENDERER_ONLY", false),
  allowLocalFallback: envBool("ALLOW_LOCAL_FALLBACK", false),
  imageProvider: resolveImageProviderEnv(),
  openAiApiKeyEnvs: ["OPENAI_API_KEY", "API_KEY"],
  openAiBaseUrlEnv: "OPENAI_BASE_URL",
  openAiImageModelEnv: "OPENAI_IMAGE_MODEL",
  yandexApiKeyEnvs: ["YANDEX_API_KEY", "Yandex_API_KEY"],
  yandexFolderIdEnvs: ["YANDEX_FOLDER_ID", "Yandex_FOLDER_ID"],
  yandexModelUriEnv: "YANDEX_MODEL_URI",
  yandexKeepOriginalPhoto: envBool("YANDEX_KEEP_ORIGINAL_PHOTO", true),
  openAiImageModel: envString("OPENAI_IMAGE_MODEL", "gpt-image-1"),
  videoModel: "sora-2",
  openAiTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS) || 180_000,
  yandexPollIntervalMs: 2_000,
  yandexPollMaxAttempts: 45,
};

export function getOpenAiBaseUrl(): string | undefined {
  const fromEnv = process.env[AI_PROVIDER_CONFIG.openAiBaseUrlEnv]?.trim();
  if (!fromEnv) return undefined;
  return normalizeOpenAiBaseUrl(fromEnv);
}

export function getOpenAiApiKey(): string | undefined {
  return readFirstEnv(AI_PROVIDER_CONFIG.openAiApiKeyEnvs);
}

export type OpenAiProxyKind = "gatellm" | "routerai" | "custom" | "direct";

/** Какой OpenAI-совместимый прокси задан в OPENAI_BASE_URL */
export function getOpenAiProxyKind(): OpenAiProxyKind {
  const base = process.env[AI_PROVIDER_CONFIG.openAiBaseUrlEnv]?.trim().toLowerCase() ?? "";
  if (!base) return "direct";
  if (base.includes("gatellm.ru")) return "gatellm";
  if (base.includes("routerai.ru")) return "routerai";
  return "custom";
}

export function isGateLlmConfigured(): boolean {
  return getOpenAiProxyKind() === "gatellm";
}

export function isRouterAiConfigured(): boolean {
  return getOpenAiProxyKind() === "routerai";
}

/** GateLLM и RouterAI: генерация картинки через chat/completions, не images.edit */
export function usesChatCompletionsForImages(): boolean {
  const kind = getOpenAiProxyKind();
  return kind === "gatellm" || kind === "routerai";
}

export function getOpenAiProxyLabel(): string {
  switch (getOpenAiProxyKind()) {
    case "gatellm":
      return "GateLLM";
    case "routerai":
      return "RouterAI";
    case "custom":
      return "OpenAI proxy";
    default:
      return "OpenAI";
  }
}

/** Модели image-chat для перебора при сбое основной (OPENAI_IMAGE_MODEL) */
export function getProxyChatImageModels(): string[] {
  switch (getOpenAiProxyKind()) {
    case "routerai":
      return [
        "google/gemini-2.5-flash-image",
        "openai/gpt-5-image-mini",
        "openai/gpt-5.4-image-2",
        "openai/gpt-5-image",
        "google/gemini-3.1-flash-image-preview",
      ];
    case "gatellm":
      return [
        "openai/gpt-5-image",
        "openai/gpt-5.4-image-2",
        "openai/gpt-5-image-mini",
      ];
    default:
      return [
        "openai/gpt-5-image",
        "openai/gpt-5.4-image-2",
        "openai/gpt-5-image-mini",
        "gpt-image-1",
      ];
  }
}

export function getOpenAiProxyBillingHint(): string {
  switch (getOpenAiProxyKind()) {
    case "gatellm":
      return "Пополните баланс на gatellm.ru (личный кабинет).";
    case "routerai":
      return "Пополните баланс на routerai.ru (личный кабинет).";
    default:
      return "Проверьте баланс OpenAI или прокси-провайдера.";
  }
}

export function getOpenAiImageModel(): string {
  return envString(
    AI_PROVIDER_CONFIG.openAiImageModelEnv,
    AI_PROVIDER_CONFIG.openAiImageModel
  );
}

export function getYandexApiKey(): string | undefined {
  return readFirstEnv(AI_PROVIDER_CONFIG.yandexApiKeyEnvs);
}

export function getYandexFolderId(): string | undefined {
  return readFirstEnv(AI_PROVIDER_CONFIG.yandexFolderIdEnvs);
}

export function getYandexModelUri(): string {
  const custom = process.env[AI_PROVIDER_CONFIG.yandexModelUriEnv]?.trim();
  if (custom) return custom;
  const folderId = getYandexFolderId();
  if (!folderId) return "art://<folder_id>/yandex-art/latest";
  return `art://${folderId}/yandex-art/latest`;
}

export function isOpenAiConfigured(): boolean {
  return Boolean(getOpenAiApiKey());
}

export function isYandexApiKeySet(): boolean {
  return Boolean(getYandexApiKey());
}

/** Ключ + ID каталога — можно вызывать YandexART */
export function isYandexConfigured(): boolean {
  return isYandexApiKeySet() && Boolean(getYandexFolderId());
}

export function isAiConfigured(): boolean {
  if (!AI_PROVIDER_CONFIG.enabled) return false;
  return isOpenAiConfigured() || isYandexApiKeySet() || isGigachatConfigured();
}

export type ActiveImageProvider = "openai" | "yandex" | "gigachat";

/** Какие провайдеры можно выбрать на сайте (оба ключа могут быть заданы) */
export function getSelectableProviders(): Array<"openai" | "gigachat"> {
  const list: Array<"openai" | "gigachat"> = [];
  if (isOpenAiConfigured()) list.push("openai");
  if (isGigachatConfigured()) list.push("gigachat");
  return list;
}

export function getDefaultSelectableProvider(): "openai" | "gigachat" | null {
  const available = getSelectableProviders();
  if (available.length === 0) return null;
  const env = process.env.AI_IMAGE_PROVIDER?.trim().toLowerCase();
  if (env === "openai" && available.includes("openai")) return "openai";
  if (env === "gigachat" && available.includes("gigachat")) return "gigachat";
  return available[0];
}

/**
 * @param selected — выбор пользователя на сайте (openai | gigachat)
 */
export function resolveImageProvider(
  selected?: ActiveImageProvider | null
): ActiveImageProvider {
  ensureGigachatEnvPriority();

  if (selected === "openai") {
    if (!isOpenAiConfigured()) {
      throw new Error("OpenAI/GateLLM: задайте OPENAI_API_KEY в .env.local");
    }
    return "openai";
  }
  if (selected === "gigachat") {
    if (!isGigachatConfigured()) {
      throw new Error("GigaChat: задайте GIGACHAT_CREDENTIALS в .env.gigachat");
    }
    return "gigachat";
  }
  if (selected === "yandex") {
    if (!isYandexApiKeySet()) {
      throw new Error("Yandex: задайте YANDEX_API_KEY");
    }
    return "yandex";
  }

  const envPref = process.env.AI_IMAGE_PROVIDER?.trim().toLowerCase() as
    | ImageProvider
    | undefined;
  const resolvedPref: ImageProvider =
    envPref === "openai" ||
    envPref === "yandex" ||
    envPref === "gigachat" ||
    envPref === "auto"
      ? envPref
      : AI_PROVIDER_CONFIG.imageProvider;

  if (resolvedPref === "gigachat" && isGigachatConfigured()) return "gigachat";
  if (resolvedPref === "openai" && isOpenAiConfigured()) return "openai";
  if (resolvedPref === "yandex" && isYandexApiKeySet()) return "yandex";

  const def = getDefaultSelectableProvider();
  if (def) return def;
  if (isOpenAiConfigured()) return "openai";
  if (isGigachatConfigured()) return "gigachat";
  if (isYandexApiKeySet()) return "yandex";
  throw new Error(
    "Не настроен AI: добавьте OPENAI_API_KEY (.env.local) и/или .env.gigachat"
  );
}

export { isGigachatConfigured };

export function isProxyConfigured(): boolean {
  return Boolean(process.env[AI_PROVIDER_CONFIG.openAiBaseUrlEnv]?.trim());
}

export function shouldUseLocalRenderer(): boolean {
  return AI_PROVIDER_CONFIG.useLocalRendererOnly || !isAiConfigured();
}

export function shouldAllowLocalFallback(): boolean {
  return AI_PROVIDER_CONFIG.allowLocalFallback;
}

/** AI-детекция facadeBox + mountLines (этап 1) */
export function shouldAiAnalyzeFacade(): boolean {
  const v = process.env.AI_ANALYZE_FACADE?.trim().toLowerCase();
  if (v === "0" || v === "false") return false;
  if (v === "1" || v === "true") return true;
  return isOpenAiConfigured();
}

/** Опциональное AI-улучшение света поверх локальной визуализации */
export function shouldAiEnhanceLight(): boolean {
  const v = process.env.AI_ENHANCE_LIGHT?.trim().toLowerCase();
  if (v === "0" || v === "false") return false;
  if (v === "1" || v === "true") return true;
  return false;
}

export function shouldYandexKeepOriginalPhoto(): boolean {
  return AI_PROVIDER_CONFIG.yandexKeepOriginalPhoto;
}

export function getEffectiveBaseUrlDisplay(): string {
  const url = getOpenAiBaseUrl();
  if (!url) return "https://api.openai.com/v1 (прямое подключение)";
  const label = getOpenAiProxyLabel();
  if (getOpenAiProxyKind() !== "direct") return `${url} (${label})`;
  return url;
}
