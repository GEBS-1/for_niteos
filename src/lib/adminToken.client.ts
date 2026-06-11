"use client";

export const ADMIN_TOKEN_KEY = "niteos_admin_token";
export const DEV_TOKEN = "local-dev-token";

function isLocalHost(): boolean {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

/** Токен из ?token=, localStorage; на сервере без токена — пусто (не local-dev-token). */
export function resolveAdminToken(): string {
  const fromUrl = new URLSearchParams(window.location.search).get("token")?.trim();
  if (fromUrl) {
    localStorage.setItem(ADMIN_TOKEN_KEY, fromUrl);
    return fromUrl;
  }
  const stored = localStorage.getItem(ADMIN_TOKEN_KEY)?.trim();
  if (stored) return stored;
  if (isLocalHost()) return DEV_TOKEN;
  return "";
}

export function adminTokenHint(): string {
  if (isLocalHost()) return "";
  return "На сервере откройте админку с ?token=ВАШ_ТОКЕН (из .env.production, LEADS_VIEW_TOKEN).";
}
