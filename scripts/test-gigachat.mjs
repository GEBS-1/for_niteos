/**
 * Проверка GigaChat: OAuth + список моделей.
 * Запуск: npm run check:gigachat
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const root = process.cwd();
const envPath = path.join(root, ".env.gigachat");
if (!fs.existsSync(envPath)) {
  console.error("Нет файла .env.gigachat");
  process.exit(1);
}

for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const key = t.slice(0, eq).trim();
  let value = t.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (key) process.env[key] = value;
}

const credentials = process.env.GIGACHAT_CREDENTIALS?.trim();
const oauthUrl =
  process.env.GIGACHAT_OAUTH_URL?.trim() ||
  "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const apiUrl = (
  process.env.GIGACHAT_API_URL?.trim() ||
  "https://gigachat.devices.sberbank.ru/api/v1"
).replace(/\/+$/, "");
const scope = process.env.GIGACHAT_SCOPE?.trim() || "GIGACHAT_API_PERS";
function resolveModel() {
  const raw = process.env.GIGACHAT_MODEL?.trim() || "GigaChat-2";
  const aliases = {
    "gigachat-2-lite": "GigaChat-2-Pro",
    "gigachat-lite": "GigaChat-Pro",
  };
  return aliases[raw.toLowerCase()] ?? raw;
}
const modelEnv = process.env.GIGACHAT_MODEL?.trim() || "GigaChat-2";
const model = resolveModel();

if (process.env.GIGACHAT_VERIFY_SSL?.toLowerCase() === "false") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

if (!credentials) {
  console.error("GIGACHAT_CREDENTIALS пуст");
  process.exit(1);
}

console.log("OAuth…", oauthUrl);
const oauthRes = await fetch(oauthUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    Authorization: `Basic ${credentials}`,
    RqUID: randomUUID(),
  },
  body: new URLSearchParams({ scope }).toString(),
});
const oauthText = await oauthRes.text();
if (!oauthRes.ok) {
  console.error("OAuth failed", oauthRes.status, oauthText.slice(0, 300));
  process.exit(1);
}
const { access_token: token } = JSON.parse(oauthText);
console.log("OAuth OK");

const modelsRes = await fetch(`${apiUrl}/models`, {
  headers: { Authorization: `Bearer ${token}` },
});
const modelsText = await modelsRes.text();
if (!modelsRes.ok) {
  console.error("Models failed", modelsRes.status, modelsText.slice(0, 300));
  process.exit(1);
}
const modelsData = JSON.parse(modelsText);
const names = (modelsData.data ?? modelsData)
  .map((m) => m.id ?? m)
  .filter(Boolean);
console.log("Models OK, count:", names.length);
console.log("Available:", names.join(", "));
const match = names.find(
  (n) =>
    String(n).toLowerCase() === model.toLowerCase() ||
    String(n).toLowerCase().includes("lite")
);
console.log(
  "Configured:",
  modelEnv,
  "→ API:",
  model,
  names.includes(model) ? "✓" : match ? `→ try ${match}` : "(not in list)"
);

console.log("\nGigaChat ready. Start web: npm run dev:gigachat");
