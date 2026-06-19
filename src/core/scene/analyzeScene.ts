import OpenAI from "openai";
import {
  getOpenAiApiKey,
  getOpenAiBaseUrl,
  isOpenAiConfigured,
  shouldAiAnalyzeFacade,
} from "@/config/ai.config";
import { getVisionModel } from "@/lib/ai/facadeVision";
import { resolveFacadeDetection } from "@/lib/ai/facadeVision";
import { buildMockFacadeDetection } from "@/lib/mockFacadeDetection";
import { normalizeFacadeDetection } from "@/lib/facadeGeometry";
import type { Fixture, LightingType, MountTarget } from "@/lib/types";
import { facadeDetectionToSceneAnalysis } from "./convertFromLegacy";
import { enrichSceneAnalysis } from "./enrichScene";
import type { AnalyzeSceneOptions, Point, SceneAnalysis } from "./types";

const SCENE_VISION_SYSTEM = `Analyze the photo for product placement on architecture.
Return ONLY valid JSON.

Schema:
{
  "sceneType": "building_facade" | "street" | "landscape" | "unknown",
  "facadeBox": { "x", "y", "width", "height" },
  "surfaces": [{
    "id": "string",
    "type": "vertical_wall" | "facade" | "roof" | "ground" | "sidewalk" | "grass",
    "box": { "x", "y", "width", "height" },
    "orientation": "vertical" | "horizontal" | "sloped",
    "label": "optional",
    "confidence": 0-1
  }],
  "forbiddenZones": [{
    "type": "sky" | "window" | "door" | "road" | "tree" | "car" | "person" | "water",
    "box": { "x", "y", "width", "height" },
    "confidence": 0-1
  }],
  "detectedObjects": [{ "id", "type", "box", "confidence" }],
  "confidence": 0-1
}

Rules:
- All coordinates normalized 0-1.
- Detect ALL windows on the facade as forbiddenZones type window.
- surfaces: horizontal belts at cornices and between floors (orientation horizontal).
- surfaces: vertical_wall for main facade area inside facadeBox.
- surfaces: sidewalk/ground lines in front of building.
- Do NOT place products. Do NOT count quantity. Do NOT recommend SKUs.
- Return JSON only.`;

function parseSceneVisionJson(
  raw: unknown,
  imageWidth: number,
  imageHeight: number
): SceneAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const surfaces = Array.isArray(o.surfaces)
    ? o.surfaces.map((s, i) => {
        const item = s as Record<string, unknown>;
        const box = item.box as Record<string, number>;
        return {
          id: String(item.id ?? `surface-${i}`),
          type: (item.type as SceneAnalysis["surfaces"][0]["type"]) ?? "facade",
          box: {
            x: Number(box?.x ?? 0),
            y: Number(box?.y ?? 0),
            width: Number(box?.width ?? 0),
            height: Number(box?.height ?? 0),
          },
          polygon: [] as Point[],
          orientation:
            (item.orientation as SceneAnalysis["surfaces"][0]["orientation"]) ??
            "horizontal",
          confidence: Number(item.confidence ?? 0.6),
          label: item.label ? String(item.label) : undefined,
        };
      })
    : [];

  for (const s of surfaces) {
    if (s.polygon.length === 0) {
      s.polygon = [
        { x: s.box.x, y: s.box.y },
        { x: s.box.x + s.box.width, y: s.box.y },
        { x: s.box.x + s.box.width, y: s.box.y + s.box.height },
        { x: s.box.x, y: s.box.y + s.box.height },
      ];
    }
  }

  const forbiddenZones = Array.isArray(o.forbiddenZones)
    ? o.forbiddenZones.map((z) => {
        const item = z as Record<string, unknown>;
        const box = item.box as Record<string, number>;
        return {
          type: item.type as SceneAnalysis["forbiddenZones"][0]["type"],
          box: {
            x: Number(box?.x ?? 0),
            y: Number(box?.y ?? 0),
            width: Number(box?.width ?? 0),
            height: Number(box?.height ?? 0),
          },
          confidence: Number(item.confidence ?? 0.6),
        };
      })
    : [];

  const fb = o.facadeBox as Record<string, number> | undefined;

  return {
    imageWidth,
    imageHeight,
    sceneType:
      (o.sceneType as SceneAnalysis["sceneType"]) ?? "building_facade",
    facadeBox: fb
      ? {
          x: Number(fb.x ?? 0),
          y: Number(fb.y ?? 0),
          width: Number(fb.width ?? 0),
          height: Number(fb.height ?? 0),
        }
      : undefined,
    surfaces,
    forbiddenZones,
    detectedObjects: [],
    confidence: Number(o.confidence ?? 0.65),
    source: "ai",
  };
}

async function detectSceneWithAi(
  imageDataUrl: string,
  imageWidth: number,
  imageHeight: number
): Promise<SceneAnalysis | null> {
  if (!shouldAiAnalyzeFacade() || !isOpenAiConfigured()) return null;
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey, baseURL: getOpenAiBaseUrl() });
  const response = await client.chat.completions.create({
    model: getVisionModel(),
    messages: [
      { role: "system", content: SCENE_VISION_SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this scene for architectural product placement. Return JSON only.",
          },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  });

  const text = response.choices[0]?.message?.content?.trim() ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return parseSceneVisionJson(
      JSON.parse(jsonMatch[0]),
      imageWidth,
      imageHeight
    );
  } catch {
    return null;
  }
}

export interface AnalyzeSceneResult {
  scene: SceneAnalysis;
  source: "ai" | "mock";
}

/**
 * Scene Understanding — AI возвращает сцену, не точки товаров.
 */
export async function analyzeScene(
  imageDataUrl: string | undefined,
  options: AnalyzeSceneOptions & {
    lightingType?: LightingType;
    mountTarget?: MountTarget;
    fixture?: Fixture;
  }
): Promise<AnalyzeSceneResult> {
  const { imageWidth, imageHeight, lightingType, mountTarget, fixture } =
    options;

  if (imageDataUrl) {
    try {
      const direct = await detectSceneWithAi(
        imageDataUrl,
        imageWidth,
        imageHeight
      );
      if (direct && direct.surfaces.length > 0) {
        const { detection, source: detSource } = await resolveFacadeDetection(
          imageDataUrl,
          lightingType ?? "линейная",
          mountTarget ?? "facade",
          fixture
        );
        const rich = facadeDetectionToSceneAnalysis(
          detection,
          imageWidth,
          imageHeight,
          detSource
        );
        return {
          scene: enrichSceneAnalysis(direct, rich),
          source: "ai",
        };
      }
    } catch (e) {
      console.warn("scene vision direct parse failed:", e);
    }

    const { detection, source } = await resolveFacadeDetection(
      imageDataUrl,
      lightingType ?? "линейная",
      mountTarget ?? "facade",
      fixture
    );
    return {
      scene: facadeDetectionToSceneAnalysis(
        detection,
        imageWidth,
        imageHeight,
        source
      ),
      source,
    };
  }

  const mockDetection = normalizeFacadeDetection(
    buildMockFacadeDetection(
      lightingType ?? "линейная",
      mountTarget ?? "facade"
    ),
    { lightingType, mountTarget, fixture }
  );
  return {
    scene: facadeDetectionToSceneAnalysis(
      mockDetection,
      imageWidth,
      imageHeight,
      "mock"
    ),
    source: "mock",
  };
}
