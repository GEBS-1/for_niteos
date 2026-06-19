import "server-only";

import OpenAI from "openai";
import {
  getOpenAiApiKey,
  getOpenAiBaseUrl,
  isOpenAiConfigured,
  shouldAiAnalyzeFacade,
} from "@/config/ai.config";
import { normalizeFacadeDetection } from "@/lib/facadeGeometry";
import {
  buildArchitectureFromMountLines,
  buildDefaultForbiddenZones,
  ensureDetectionZones,
} from "@/lib/mountZoneGeometry";
import { getFixturePlacementProfile } from "@/lib/fixturePlacementProfile";
import { getMountZoneKey } from "@/lib/mountRules";
import { buildMockFacadeDetection } from "@/lib/mockFacadeDetection";
import type {
  FacadeArchitecture,
  FacadeDetection,
  Fixture,
  ForbiddenZones,
  LightingType,
  MountLine,
  MountTarget,
  NormalizedBox,
  RecommendedMountZones,
  ZoneBox,
  ZoneLine,
} from "@/lib/types";

function envString(name: string, defaultValue: string): string {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : defaultValue;
}

export function getVisionModel(): string {
  return envString("AI_VISION_MODEL", "google/gemini-2.5-flash");
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

function normalizeZoneLines(raw: unknown): ZoneLine[] {
  if (!Array.isArray(raw)) return [];
  const out: ZoneLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const x1 = Number(o.x1);
    const y1 = Number(o.y1);
    const x2 = Number(o.x2);
    const y2 = Number(o.y2);
    if (![x1, y1, x2, y2].every((n) => Number.isFinite(n))) continue;
    out.push({
      x1: clamp01(x1),
      y1: clamp01(y1),
      x2: clamp01(x2),
      y2: clamp01(y2),
      type: o.type != null ? String(o.type) : undefined,
      id: o.id != null ? String(o.id) : `line-${i}`,
      label: o.label != null ? String(o.label) : undefined,
    });
  }
  return out;
}

function normalizeZoneBoxes(raw: unknown): ZoneBox[] {
  if (!Array.isArray(raw)) return [];
  const out: ZoneBox[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, number>;
    const x = Number(o.x);
    const y = Number(o.y);
    const width = Number(o.width);
    const height = Number(o.height);
    if (![x, y, width, height].every((n) => Number.isFinite(n))) continue;
    out.push({
      x: clamp01(x),
      y: clamp01(y),
      width: clamp01(Math.min(width, 1 - x)),
      height: clamp01(Math.min(height, 1 - y)),
      type: (item as Record<string, unknown>).type != null
        ? String((item as Record<string, unknown>).type)
        : undefined,
    });
  }
  return out;
}

function normalizeArchitecture(raw: unknown): FacadeArchitecture | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  return {
    roofLine: normalizeZoneLines(o.roofLine),
    cornices: normalizeZoneLines(o.cornices),
    floorBelts: normalizeZoneLines(o.floorBelts),
    columns: normalizeZoneBoxes(o.columns),
    pilasters: normalizeZoneBoxes(o.pilasters ?? o.columns),
    windowRows: normalizeZoneBoxes(o.windowRows),
    entranceZone: normalizeZoneBoxes(o.entranceZone),
    groundLine: normalizeZoneLines(o.groundLine),
    sidewalk: normalizeZoneLines(o.sidewalk),
    grass: normalizeZoneLines(o.grass),
  };
}

function normalizeForbidden(raw: unknown): ForbiddenZones | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  return {
    sky: normalizeZoneBoxes(o.sky),
    road: normalizeZoneBoxes(o.road),
    windows: normalizeZoneBoxes(o.windows),
    doors: normalizeZoneBoxes(o.doors),
    trees: normalizeZoneBoxes(o.trees),
    cars: normalizeZoneBoxes(o.cars),
    people: normalizeZoneBoxes(o.people),
  };
}

function normalizeRecommended(raw: unknown): RecommendedMountZones | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  return {
    linear_facade: normalizeZoneLines(o.linear_facade ?? o.linear),
    accent_facade: normalizeZoneLines(o.accent_facade ?? o.accent),
    window_lighting: normalizeZoneLines(o.window_lighting ?? o.window),
    ground_projector: normalizeZoneLines(o.ground_projector ?? o.ground),
    pole_lighting: normalizeZoneLines(o.pole_lighting ?? o.pole),
  };
}

function zoneLineToMountLine(zl: ZoneLine, i: number): MountLine {
  return {
    id: zl.id ?? `ai-line-${i}`,
    x1: zl.x1,
    y1: zl.y1,
    x2: zl.x2,
    y2: zl.y2,
    label: zl.label ?? zl.type,
  };
}

function parseDetectionJson(text: string): FacadeDetection | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const facadeBox = normalizeBox(parsed.facadeBox);
    if (!facadeBox) return null;

    const architecture = normalizeArchitecture(parsed.architecture);
    const forbiddenZones =
      normalizeForbidden(parsed.forbiddenZones) ??
      buildDefaultForbiddenZones(facadeBox);
    const recommendedMountZones = normalizeRecommended(
      parsed.recommendedMountZones
    );

    const legacyLines = normalizeZoneLines(parsed.mountLines).map(zoneLineToMountLine);
    const mountLines =
      legacyLines.length > 0
        ? legacyLines
        : (recommendedMountZones?.linear_facade ?? []).map(zoneLineToMountLine);

    if (
      mountLines.length === 0 &&
      !architecture &&
      !recommendedMountZones
    ) {
      return null;
    }

    return {
      facadeBox,
      mountLines,
      architecture,
      forbiddenZones,
      recommendedMountZones,
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

const VISION_SYSTEM = `Analyze the building photo for architectural lighting placement.
Return ONLY valid JSON, no markdown, no explanation text.

Schema:
{
  "facadeBox": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1 },
  "architecture": {
    "roofLine": [{ "x1", "y1", "x2", "y2", "type" }],
    "cornices": [],
    "floorBelts": [],
    "columns": [{ "x", "y", "width", "height", "type" }],
    "pilasters": [],
    "windowRows": [],
    "entranceZone": [],
    "groundLine": [],
    "sidewalk": [],
    "grass": []
  },
  "forbiddenZones": {
    "sky": [],
    "road": [],
    "windows": [],
    "doors": [],
    "trees": [],
    "cars": [],
    "people": []
  },
  "recommendedMountZones": {
    "linear_facade": [],
    "accent_facade": [],
    "window_lighting": [],
    "ground_projector": [],
    "pole_lighting": []
  },
  "confidence": 0-1
}

All coordinates normalized 0-1 (fraction of image width/height).

facadeBox: tight box on building WALLS only — exclude sky above roof.

Detect architectural elements ON the facade:
- roofLine, cornices, horizontal floor belts between storeys
- columns, pilasters, window rows, entrance zone
- groundLine, sidewalk in front of building

forbiddenZones: mark sky (above building), road/pavement, each window glass area, doors, trees, cars, people.

recommendedMountZones:
- linear_facade: horizontal lines on cornices and floor belts ONLY (4-6 lines), all y inside facadeBox, NOT on windows
- accent_facade: short segments at columns/pilasters/entrance details
- window_lighting: short segments above/below windows
- ground_projector: lines on ground before facade
- pole_lighting: one horizontal line on sidewalk/ground in front of facade

Rules:
- Do NOT place linear_facade lines in sky or on road
- Horizontal mount lines: y1 must equal y2
- Do NOT calculate quantity, prices, or product names
- Return JSON only`;

export async function detectFacadeWithAi(
  imageDataUrl: string
): Promise<FacadeDetection | null> {
  if (!shouldAiAnalyzeFacade() || !isOpenAiConfigured()) return null;

  const apiKey = getOpenAiApiKey();
  if (!apiKey) return null;

  const client = new OpenAI({
    apiKey,
    baseURL: getOpenAiBaseUrl(),
  });

  const response = await client.chat.completions.create({
    model: getVisionModel(),
    max_tokens: 2800,
    messages: [
      { role: "system", content: VISION_SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this building facade for architectural lighting installation. Return only valid JSON.",
          },
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
  mountTarget: MountTarget,
  fixture?: Fixture
): FacadeDetection {
  const zoneKey = fixture
    ? getMountZoneKey(
        fixture,
        mountTarget,
        getFixturePlacementProfile(fixture, lightingType)
      )
    : "linear_facade";
  const withZones = ensureDetectionZones(raw, zoneKey);
  if (!withZones.architecture && withZones.mountLines.length > 0) {
    withZones.architecture = buildArchitectureFromMountLines(
      withZones.facadeBox,
      withZones.mountLines
    );
  }
  return normalizeFacadeDetection(withZones, { lightingType, mountTarget, fixture });
}

export async function resolveFacadeDetection(
  imageDataUrl: string | undefined,
  lightingType: LightingType,
  mountTarget: MountTarget,
  fixture?: Fixture
): Promise<{ detection: FacadeDetection; source: "ai" | "mock" }> {
  if (imageDataUrl) {
    try {
      const ai = await detectFacadeWithAi(imageDataUrl);
      if (ai) {
        const finalized = finalizeDetection(ai, lightingType, mountTarget, fixture);
        if (finalized.mountLines.length > 0) {
          return { detection: finalized, source: "ai" };
        }
      }
    } catch (e) {
      console.warn("facade vision fallback to mock:", e);
    }
  }
  return {
    detection: finalizeDetection(
      buildMockFacadeDetection(lightingType, mountTarget),
      lightingType,
      mountTarget,
      fixture
    ),
    source: "mock",
  };
}
