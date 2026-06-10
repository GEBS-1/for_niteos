import "server-only";

import OpenAI from "openai";
import {
  getOpenAiApiKey,
  getOpenAiBaseUrl,
  isOpenAiConfigured,
  shouldAiAnalyzeFacade,
} from "@/config/ai.config";
import { normalizeFacadeDetection } from "@/lib/facadeGeometry";
import { buildMockFacadeDetection } from "@/lib/mockFacadeDetection";
import type {
  FacadeDetection,
  LightingType,
  MountLine,
  MountTarget,
  NormalizedBox,
} from "@/lib/types";

function envString(name: string, defaultValue: string): string {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : defaultValue;
}

export function getVisionModel(): string {
  return envString("AI_VISION_MODEL", "gpt-4o-mini");
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function normalizeBox(raw: unknown): NormalizedBox | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, number>;
  const x = Number(o.x);
  const y = Number(o.y);
  const width = Number(o.width);
  const height = Number(o.height);
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
  return {
    x: clamp01(x),
    y: clamp01(y),
    width: clamp01(Math.min(width, 1 - x)),
    height: clamp01(Math.min(height, 1 - y)),
  };
}

function normalizeMountLines(raw: unknown): MountLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: MountLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const x1 = Number(o.x1);
    const y1 = Number(o.y1);
    const x2 = Number(o.x2);
    const y2 = Number(o.y2);
    if (![x1, y1, x2, y2].every((n) => Number.isFinite(n))) continue;
    lines.push({
      id: String(o.id ?? `line-${i}`),
      x1: clamp01(x1),
      y1: clamp01(y1),
      x2: clamp01(x2),
      y2: clamp01(y2),
      label: o.label != null ? String(o.label) : undefined,
    });
  }
  return lines;
}

function parseDetectionJson(text: string): FacadeDetection | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const facadeBox = normalizeBox(parsed.facadeBox);
    const mountLines = normalizeMountLines(parsed.mountLines);
    if (!facadeBox || mountLines.length === 0) return null;
    return {
      facadeBox,
      mountLines,
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : undefined,
      notes: Array.isArray(parsed.notes)
        ? parsed.notes.map(String)
        : undefined,
    };
  } catch {
    return null;
  }
}

const VISION_SYSTEM_FACADE = `You analyze building facade photos for LINEAR architectural LED mounting (NITEOS MAGISTRAL).
Return ONLY valid JSON, no markdown.
Schema:
{
  "facadeBox": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1 },
  "mountLines": [{ "id": "string", "x1": 0-1, "y1": 0-1, "x2": 0-1, "y2": 0-1, "label": "optional" }],
  "confidence": 0-1,
  "notes": ["string"]
}
Coordinates normalized 0-1 (image width/height).
facadeBox: TIGHT box around building WALLS ONLY — exclude sky above the roof/cornice.
mountLines: ONLY HORIZONTAL lines ON the facade surface:
- one per visible floor / cornice (4-6 lines from top cornice to ground floor)
- all y coordinates MUST lie inside facadeBox (between box top and bottom)
- span at least 70% of facade width
Rules:
- Each line: y1 equals y2.
- NO lines in the sky, NO vertical lines, NO sidewalk, NO per-window dots, NO uplights between columns.`;

const VISION_SYSTEM_FLOOD = `You analyze building facade photos for FLOOD wash lighting (NITEOS X-RAY Lira, NT-RAINBOW).
Return ONLY valid JSON, no markdown.
Schema: same as facade linear.
facadeBox: tight box on building walls only, exclude sky.
mountLines: 2-4 horizontal lines where flood fixtures mount (plinth, mid tiers, cornice). Span at least 60% facade width.
Each line: same y1 and y2, inside facadeBox. For wide uniform wash, fewer lines than linear belt systems.`;

const VISION_SYSTEM_ACCENT = `You analyze building facade photos for ACCENT spot lighting (NITEOS X-RAY SPOT, ARCH, Double).
Return ONLY valid JSON, no markdown.
Schema: same as facade linear.
facadeBox: tight box on building walls only.
mountLines: 4-10 SHORT horizontal segments at architectural accent features (column capitals, arch keystones, niches, sculptures, bay windows).
Each segment span 8-25% of facade width (NOT full-width belts). y inside facadeBox. Place at distinct accent features, not every window.`;

const VISION_SYSTEM_NEARBY = `You analyze building photos for POLE luminaires in front of the facade (NITEOS NT-park).
Return ONLY valid JSON, no markdown.
Schema:
{
  "facadeBox": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1 },
  "mountLines": [{ "id": "ground-front", "x1": 0-1, "y1": 0-1, "x2": 0-1, "y2": 0-1 }],
  "confidence": 0-1,
  "notes": ["string"]
}
facadeBox: main building facade.
mountLines: exactly ONE horizontal line on the GROUND / sidewalk IN FRONT of the building (not on the wall).
- y1 and y2 must be equal and near bottom of image (0.88-0.97).
- x spans the paved area in front of the facade (not on the building).
- This is where pole fixtures stand, NOT facade architectural lines.`;

export async function detectFacadeWithAi(
  imageDataUrl: string,
  lightingType: LightingType,
  mountTarget: MountTarget
): Promise<FacadeDetection | null> {
  if (!shouldAiAnalyzeFacade() || !isOpenAiConfigured()) return null;

  const apiKey = getOpenAiApiKey();
  if (!apiKey) return null;

  const client = new OpenAI({
    apiKey,
    baseURL: getOpenAiBaseUrl(),
  });

  const isNearby = mountTarget === "nearby";
  const isAccent = lightingType === "акцентная";
  const isFlood = lightingType === "заливная";
  const system = isNearby
    ? VISION_SYSTEM_NEARBY
    : isAccent
      ? VISION_SYSTEM_ACCENT
      : isFlood
        ? VISION_SYSTEM_FLOOD
        : VISION_SYSTEM_FACADE;
  const userText = isNearby
    ? "Pole luminaires on sidewalk before the building. Return facadeBox and one ground mountLine."
    : isAccent
      ? `Accent spot lighting (${lightingType}). Short mount segments on architectural details only.`
      : isFlood
        ? `Flood wash lighting (${lightingType}). Few horizontal mount zones for wide-beam projectors.`
        : `Linear facade lighting (${lightingType}). Horizontal mount lines on cornices and floor belts only.`;

  const response = await client.chat.completions.create({
    model: getVisionModel(),
    max_tokens: 1200,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseDetectionJson(content);
}

function finalizeDetection(
  raw: FacadeDetection,
  lightingType: LightingType,
  mountTarget: MountTarget
): FacadeDetection {
  return normalizeFacadeDetection(raw, { lightingType, mountTarget });
}

export async function resolveFacadeDetection(
  imageDataUrl: string | undefined,
  lightingType: LightingType,
  mountTarget: MountTarget
): Promise<{ detection: FacadeDetection; source: "ai" | "mock" }> {
  if (imageDataUrl) {
    try {
      const ai = await detectFacadeWithAi(imageDataUrl, lightingType, mountTarget);
      if (ai && ai.mountLines.length > 0) {
        return {
          detection: finalizeDetection(ai, lightingType, mountTarget),
          source: "ai",
        };
      }
    } catch (e) {
      console.warn("facade vision fallback to mock:", e);
    }
  }
  return {
    detection: finalizeDetection(
      buildMockFacadeDetection(lightingType, mountTarget),
      lightingType,
      mountTarget
    ),
    source: "mock",
  };
}
