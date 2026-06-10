import "server-only";
import fs from "fs";
import path from "path";

let loaded = false;

const GIGACHAT_ENV_KEYS = [
  "GIGACHAT_CREDENTIALS",
  "GIGACHAT_CLIENT_ID",
  "GIGACHAT_SCOPE",
  "GIGACHAT_API_URL",
  "GIGACHAT_OAUTH_URL",
  "GIGACHAT_MODEL",
  "GIGACHAT_VERIFY_SSL",
  "GIGACHAT_TIMEOUT_MS",
  "ALLOW_LOCAL_FALLBACK",
] as const;

/** Подгружает .env.gigachat в process.env (приоритет над .env.local для ключей GigaChat) */
export function loadGigachatEnv(): boolean {
  if (loaded) return fs.existsSync(path.join(process.cwd(), ".env.gigachat"));

  const filePath = path.join(process.cwd(), ".env.gigachat");
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && (GIGACHAT_ENV_KEYS as readonly string[]).includes(key)) {
      process.env[key] = value;
    }
  }

  loaded = true;
  return true;
}

/** Повторно применить .env.gigachat (после загрузки .env.local в Next.js) */
export function ensureGigachatEnvPriority(): void {
  loaded = false;
  loadGigachatEnv();
}

export function isGigachatEnvLoaded(): boolean {
  return loaded || fs.existsSync(path.join(process.cwd(), ".env.gigachat"));
}
