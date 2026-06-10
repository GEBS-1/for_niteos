#!/usr/bin/env node
/** Сырой ответ RouterAI image-модели — для отладки формата */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const key = env.OPENAI_API_KEY;
const base = (env.OPENAI_BASE_URL || "https://routerai.ru/api/v1").replace(/\/+$/, "");
const model = process.env.PROBE_MODEL || env.OPENAI_IMAGE_MODEL || "google/gemini-2.5-flash-image";

const samplePath = path.join(root, "public", "samples", "demo-brick-day.jpg");
const jpeg = await sharp(samplePath)
  .resize(800, 450, { fit: "inside" })
  .jpeg({ quality: 85 })
  .toBuffer();
const imageDataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;

const prompt =
  "Edit this building photo: evening, warm 3000K architectural facade lighting only. Keep building shape.";

console.log("POST", `${base}/chat/completions`, "model:", model);

const res = await fetch(`${base}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    max_tokens: 4096,
  }),
});

const text = await res.text();
console.log("HTTP", res.status, "bytes", text.length);
if (!res.ok) {
  console.log(text.slice(0, 500));
  process.exit(1);
}

const data = JSON.parse(text);
const msg = data.choices?.[0]?.message;
console.log("message keys:", msg ? Object.keys(msg) : "none");
console.log("content type:", typeof msg?.content);
if (typeof msg?.content === "string") {
  console.log("content preview:", msg.content.slice(0, 300));
} else if (Array.isArray(msg?.content)) {
  for (const [i, p] of msg.content.entries()) {
    console.log(`part[${i}]:`, JSON.stringify(p).slice(0, 400));
  }
} else {
  console.log("raw message:", JSON.stringify(msg).slice(0, 800));
}

// images/edits probe
console.log("\n--- probe POST /images/edits ---");
const form = new FormData();
form.append("model", "openai/gpt-image-1");
form.append("prompt", prompt);
form.append("image", new Blob([jpeg], { type: "image/jpeg" }), "facade.jpg");

const editRes = await fetch(`${base}/images/edits`, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}` },
  body: form,
});
const editText = await editRes.text();
console.log("images/edits HTTP", editRes.status, editText.slice(0, 400));
