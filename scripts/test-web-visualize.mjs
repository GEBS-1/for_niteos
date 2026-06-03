/**
 * POST /api/visualize на локальном dev-сервере.
 * PORT=3001 node scripts/test-web-visualize.mjs
 */
const port = process.env.PORT || "3001";
const base = `http://localhost:${port}`;

const jpegB64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdA//Z";
const imageDataUrl = `data:image/jpeg;base64,${jpegB64}`;

const body = {
  imageDataUrl,
  promptId: "magistral-facade-175",
  fixtureId: "magistral-v3",
  dimensions: { widthM: 40, heightM: 25, lengthM: 15 },
  lightingType: "линейная",
  placement: { points: [], lines: [], zoneLabels: [] },
  calculation: {
    quantity: 12,
    totalPrice: 282000,
    fixture: {
      id: "magistral-v3",
      name: "МАГИСТРАЛЬ v 3.0 AI 70",
      price: 23500,
    },
    breakdown: [],
  },
  analysis: {
    facadeWidthM: 40,
    facadeHeightM: 25,
    stories: 5,
    notes: "test",
  },
};

console.log("POST", `${base}/api/visualize`, "(GigaChat, ~30–90s)…");
const t0 = Date.now();
const res = await fetch(`${base}/api/visualize`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const text = await res.text();
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
if (!res.ok) {
  console.error("FAIL", res.status, elapsed + "s", text.slice(0, 800));
  process.exit(1);
}
const data = JSON.parse(text);
console.log("OK", elapsed + "s");
console.log("  mode:", data.mode);
console.log("  provider:", data.provider);
console.log("  userMessage:", data.userMessage);
console.log("  image length:", data.imageDataUrl?.length ?? 0);
