import "server-only";
import { loadGigachatEnv } from "@/lib/env/loadGigachatEnv";

loadGigachatEnv();

export function getGigachatCredentials(): string | undefined {
  return process.env.GIGACHAT_CREDENTIALS?.trim() || undefined;
}

export function getGigachatClientId(): string | undefined {
  return process.env.GIGACHAT_CLIENT_ID?.trim() || undefined;
}

export function getGigachatScope(): string {
  return process.env.GIGACHAT_SCOPE?.trim() || "GIGACHAT_API_PERS";
}

export function getGigachatApiUrl(): string {
  const raw = process.env.GIGACHAT_API_URL?.trim() || "https://gigachat.devices.sberbank.ru/api/v1";
  return raw.replace(/\/+$/, "");
}

export function getGigachatOauthUrl(): string {
  return (
    process.env.GIGACHAT_OAUTH_URL?.trim() ||
    "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
  );
}

/** Имена из .env → id модели в API (Lite в документации = GigaChat-2 в списке /models) */
/** Lite в .env — в API нет; для фото + text2image нужен Pro (или Max). */
const MODEL_ALIASES: Record<string, string> = {
  "gigachat-2-lite": "GigaChat-2-Pro",
  "gigachat-lite": "GigaChat-Pro",
};

export function getGigachatModel(): string {
  const raw = process.env.GIGACHAT_MODEL?.trim() || "GigaChat-2";
  const key = raw.toLowerCase();
  return MODEL_ALIASES[key] ?? raw;
}

export function getGigachatModelDisplay(): string {
  return process.env.GIGACHAT_MODEL?.trim() || "GigaChat-2";
}

export function shouldGigachatVerifySsl(): boolean {
  const v = process.env.GIGACHAT_VERIFY_SSL?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  return true;
}

export function getGigachatTimeoutMs(): number {
  const n = Number(process.env.GIGACHAT_TIMEOUT_MS);
  return n > 0 ? n : 180_000;
}

export function isGigachatConfigured(): boolean {
  return Boolean(getGigachatCredentials());
}
