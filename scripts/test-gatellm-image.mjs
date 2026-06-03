import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const key = env.OPENAI_API_KEY;
const base = "https://gatellm.ru/v1";

// tiny 1x1 png
const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function post(pathSuffix, body) {
  const res = await fetch(`${base}${pathSuffix}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log("\n===", pathSuffix, res.status, "===");
  console.log(text.slice(0, 800));
  return res.status;
}

await post("/images/edits", { model: "gpt-image-1", prompt: "test" }).catch(() => {});
await post("/images/generations", {
  model: "openai/gpt-5-image",
  prompt: "small red square",
  size: "1024x1024",
});
await post("/chat/completions", {
  model: "openai/gpt-5-image",
  messages: [{ role: "user", content: "red square icon" }],
  max_tokens: 1024,
});
await post("/chat/completions", {
  model: "openai/gpt-4o-mini",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "describe this image in one word" },
        { type: "image_url", image_url: { url: tinyPng } },
      ],
    },
  ],
  max_tokens: 100,
});
