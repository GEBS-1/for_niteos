/**
 * Проверка ключа OpenAI / GateLLM / RouterAI.
 * Читает .env.local из корня проекта.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    console.error("Нет файла .env.local — скопируйте .env.example");
    process.exit(1);
  }
  const text = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
const key = env.OPENAI_API_KEY || env.API_KEY;
const base = (env.OPENAI_BASE_URL || "https://routerai.ru/api/v1").replace(/\/+$/, "");
const url = base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`;

if (!key) {
  console.error("Задайте OPENAI_API_KEY в .env.local");
  process.exit(1);
}

console.log("Проверка:", url);

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${key}` },
});

const body = await res.text();
if (!res.ok) {
  console.error("Ошибка", res.status, body.slice(0, 300));
  process.exit(1);
}

let data;
try {
  data = JSON.parse(body);
} catch {
  console.log("OK (не JSON):", body.slice(0, 200));
  process.exit(0);
}

const models = data.data?.map((m) => m.id).filter(Boolean) ?? [];
console.log("OK. Моделей:", models.length);
const imageLike = models.filter(
  (id) =>
    /image|dall|gpt-5-image|gpt-image/i.test(id)
);
if (imageLike.length) {
  console.log("Image-модели:", imageLike.slice(0, 10).join(", "));
  console.log("Подсказка: OPENAI_IMAGE_MODEL=" + imageLike[0]);
} else {
  console.log("Первые модели:", models.slice(0, 5).join(", "));
}
