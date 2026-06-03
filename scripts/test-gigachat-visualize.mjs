/**
 * E2E: upload demo photo + chat (may take 30–90s).
 * npm run check:gigachat:visual  (add to package.json)
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.gigachat");
  if (!fs.existsSync(envPath)) throw new Error("Нет .env.gigachat");
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
}

function resolveModel() {
  const raw = process.env.GIGACHAT_MODEL?.trim() || "GigaChat-2";
  const aliases = {
    "gigachat-2-lite": "GigaChat-2-Pro",
    "gigachat-lite": "GigaChat-Pro",
  };
  return aliases[raw.toLowerCase()] ?? raw;
}

loadEnv();
if (process.env.GIGACHAT_VERIFY_SSL?.toLowerCase() === "false") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
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
const clientId = process.env.GIGACHAT_CLIENT_ID?.trim();
const model = resolveModel();

const demoCandidates = [
  path.join(process.cwd(), "public", "samples", "meriya-kazani.jpg"),
  path.join(process.cwd(), "public", "samples", "meriya-kazani.jpeg"),
];
let demoPath = demoCandidates.find((p) => fs.existsSync(p));
let imageBuffer;
if (demoPath) {
  imageBuffer = fs.readFileSync(demoPath);
} else {
  // minimal valid JPEG 1×1
  imageBuffer = Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdA//Z",
    "base64"
  );
  console.log("   (нет samples/meriya-kazani.jpg — тестовый 1×1 JPEG)");
}

console.log("1. OAuth…");
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
if (!oauthRes.ok) {
  console.error("OAuth", oauthRes.status, await oauthRes.text());
  process.exit(1);
}
const { access_token: token } = await oauthRes.json();
console.log("   OK");

const authHeaders = { Authorization: `Bearer ${token}` };
if (clientId) authHeaders["X-Client-ID"] = clientId;

console.log("2. Upload photo…");
const form = new FormData();
form.append("file", new Blob([imageBuffer], { type: "image/jpeg" }), "facade.jpg");
form.append("purpose", "general");
const upRes = await fetch(`${apiUrl}/files`, {
  method: "POST",
  headers: authHeaders,
  body: form,
});
const upText = await upRes.text();
if (!upRes.ok) {
  console.error("Upload", upRes.status, upText.slice(0, 400));
  process.exit(1);
}
const { id: fileId } = JSON.parse(upText);
console.log("   fileId:", fileId);

const prompt =
  "По приложенному фото здания: вечер, архитектурная подсветка фасада LED, сохрани форму здания. Сгенерируй изображение.";

console.log("3. Chat completions, model:", model, "(может занять до 90с)…");
const chatRes = await fetch(`${apiUrl}/chat/completions`, {
  method: "POST",
  headers: { ...authHeaders, "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "user",
        content: prompt,
        attachments: [fileId],
      },
    ],
    function_call: "auto",
    stream: false,
  }),
});
const chatText = await chatRes.text();
if (!chatRes.ok) {
  console.error("Chat", chatRes.status, chatText.slice(0, 500));
  process.exit(1);
}
const chat = JSON.parse(chatText);
const content = chat.choices?.[0]?.message?.content ?? "";
console.log("   finish:", chat.choices?.[0]?.finish_reason);
console.log("   content preview:", content.slice(0, 200));

const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
const uuidMatch = content.match(
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
);
const imageFileId = imgMatch?.[1] ?? uuidMatch?.[0];
if (!imageFileId) {
  console.log("\nНет изображения в ответе (Lite/2 без text2image?). ALLOW_LOCAL_FALLBACK на вебе.");
  process.exit(2);
}

console.log("4. Download", imageFileId);
const dlRes = await fetch(`${apiUrl}/files/${imageFileId}/content`, {
  headers: authHeaders,
});
if (!dlRes.ok) {
  console.error("Download", dlRes.status, await dlRes.text());
  process.exit(1);
}
const out = Buffer.from(await dlRes.arrayBuffer());
const outPath = path.join(process.cwd(), "scripts", "gigachat-test-out.jpg");
fs.writeFileSync(outPath, out);
console.log("   Saved", outPath, out.length, "bytes");
console.log("\nOK — GigaChat visualization works");
