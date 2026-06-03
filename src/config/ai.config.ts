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

export function isGateLlmConfigured(): boolean {
  const base = process.env[AI_PROVIDER_CONFIG.openAiBaseUrlEnv]?.trim() ?? "";
  return base.includes("gatellm.ru");
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

export function resolveImageProvider(): "openai" | "yandex" | "gigachat" {
  ensureGigachatEnvPriority();
  const pref =
    process.env.AI_IMAGE_PROVIDER?.trim().toLowerCase() as ImageProvider | undefined;
  const resolvedPref: ImageProvider =
    pref === "openai" || pref === "yandex" || pref === "gigachat" || pref === "auto"
      ? pref
      : AI_PROVIDER_CONFIG.imageProvider;
  if (resolvedPref === "gigachat") {
    if (!isGigachatConfigured()) {
      throw new Error("AI_IMAGE_PROVIDER=gigachat, но GIGACHAT_CREDENTIALS не задан в .env.gigachat");
    }
    return "gigachat";
  }
  if (resolvedPref === "openai") {
    if (!isOpenAiConfigured()) {
      throw new Error("AI_IMAGE_PROVIDER=openai, но OPENAI_API_KEY не задан");
    }
    return "openai";
  }
  if (resolvedPref === "yandex") {
    if (!isYandexApiKeySet()) {
      throw new Error("AI_IMAGE_PROVIDER=yandex, но YANDEX_API_KEY не задан");
    }
    return "yandex";
  }
  if (isGigachatConfigured()) return "gigachat";
  if (isOpenAiConfigured()) return "openai";
  if (isYandexApiKeySet()) return "yandex";
  throw new Error(
    "Не настроен провайдер: .env.gigachat, YANDEX_API_KEY или OPENAI_API_KEY"
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

export function shouldYandexKeepOriginalPhoto(): boolean {
  return AI_PROVIDER_CONFIG.yandexKeepOriginalPhoto;
}

export function getEffectiveBaseUrlDisplay(): string {
  const url = getOpenAiBaseUrl();
  if (!url) return "https://api.openai.com/v1 (прямое подключение)";
  if (url.includes("gatellm.ru")) return `${url} (GateLLM)`;
  return url;
}
