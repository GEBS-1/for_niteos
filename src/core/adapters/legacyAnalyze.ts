import type { PlacedItem, Product } from "@/core/products/types";
import type { Quote } from "@/core/quote/buildQuote";
import type { SceneAnalysis } from "@/core/scene/types";
import type {
  AnalyzeResponse,
  BuildingDimensions,
  CalculationResult,
  FacadeAnalysis,
  FacadeDetection,
  Fixture,
  FixtureMountType,
  FixturePlacement,
  LightingType,
  MountLine,
  MountTarget,
  PlacementScheme,
  PipelineStages,
  ScaleInfo,
  UsagePrompt,
} from "@/lib/types";
import { facadeDetectionToSceneAnalysis } from "@/core/scene/convertFromLegacy";
import type { PipelineLogEntry } from "@/lib/types";

export interface EngineResult {
  sceneAnalysis: SceneAnalysis;
  placedItems: PlacedItem[];
  quote: Quote;
  bodiesImage?: string;
  localImage?: string;
  enhancedImage?: string;
  debug?: {
    sceneDebugImage?: string;
    pxPerMeter: number;
    source: "ai" | "mock";
  };
}

function inferMountType(product: Product): FixtureMountType {
  if (product.category === "park_pole") return "pole";
  if (product.category === "linear_facade" || product.category === "contour") {
    return "linear";
  }
  return "facade";
}

export function placedItemsToPlacementScheme(
  placedItems: PlacedItem[],
  scene: SceneAnalysis,
  pxPerMeter: number,
  product: Product
): PlacementScheme {
  const mountType = inferMountType(product);
  const fixtures: FixturePlacement[] = placedItems.map((p) => ({
    productId: p.productId,
    x: p.x,
    y: p.y,
    rotation: p.rotation,
    widthPx: p.widthPx,
    heightPx: p.heightPx,
    scale: p.widthPx / 1200,
    mountType,
  }));

  let mountLines: MountLine[] = scene.surfaces
    .filter((s) => s.orientation === "horizontal")
    .filter((s) => placedItems.some((p) => p.surfaceId === s.id))
    .map((s) => {
      const y = s.box.y + s.box.height / 2;
      return {
        id: s.id,
        x1: s.box.x,
        y1: y,
        x2: s.box.x + s.box.width,
        y2: y,
        label: s.label ?? s.type,
      };
    });

  if (mountLines.length === 0 && placedItems.length > 0) {
    const byY = new Map<number, PlacedItem[]>();
    for (const p of placedItems) {
      const key = Math.round(p.y * 500);
      const list = byY.get(key) ?? [];
      list.push(p);
      byY.set(key, list);
    }
    mountLines = [...byY.entries()].map(([key, items]) => {
      const xs = items.map((i) => i.x);
      const y = items[0].y;
      return {
        id: `placement-line-${key}`,
        x1: Math.min(...xs),
        y1: y,
        x2: Math.max(...xs),
        y2: y,
        label: "placement",
      };
    });
  }

  const fb = scene.facadeBox ?? { x: 0.1, y: 0.1, width: 0.8, height: 0.75 };
  const widthM =
    Math.round(((fb.width * scene.imageWidth) / pxPerMeter) * 10) / 10;
  const heightM =
    Math.round(((fb.height * scene.imageHeight) / pxPerMeter) * 10) / 10;

  return {
    fixtures,
    facadeBox: fb,
    mountLines,
    pixelsPerMeter: Math.round(pxPerMeter * 10) / 10,
    estimatedWidthM: widthM,
    estimatedHeightM: heightM,
  };
}

function sceneToFacadeDetection(scene: SceneAnalysis): FacadeDetection {
  const forbiddenZones = {
    sky: scene.forbiddenZones.filter((z) => z.type === "sky").map((z) => z.box),
    road: scene.forbiddenZones.filter((z) => z.type === "road").map((z) => z.box),
    windows: scene.forbiddenZones.filter((z) => z.type === "window").map((z) => z.box),
    doors: scene.forbiddenZones.filter((z) => z.type === "door").map((z) => z.box),
    trees: scene.forbiddenZones.filter((z) => z.type === "tree").map((z) => z.box),
    cars: scene.forbiddenZones.filter((z) => z.type === "car").map((z) => z.box),
    people: scene.forbiddenZones.filter((z) => z.type === "person").map((z) => z.box),
  };

  const mountLines: MountLine[] = scene.surfaces
    .filter((s) => s.orientation === "horizontal")
    .map((s, i) => {
      const y = s.box.y + s.box.height / 2;
      return {
        id: s.id,
        x1: s.box.x,
        y1: y,
        x2: s.box.x + s.box.width,
        y2: y,
        label: s.label,
      };
    });

  return {
    facadeBox: scene.facadeBox ?? { x: 0.1, y: 0.1, width: 0.8, height: 0.75 },
    mountLines,
    forbiddenZones,
    confidence: scene.confidence,
    notes: scene.notes,
  };
}

export function buildCalculationFromEngine(
  fixture: Fixture,
  lightingType: LightingType,
  mountTarget: MountTarget,
  selectedPrompt: UsagePrompt | undefined,
  quote: Quote,
  zoneLengthM: number
): CalculationResult {
  return {
    fixture,
    matchingFixtures: [],
    lightingType,
    mountTarget,
    zoneLengthM,
    quantity: quote.quantity,
    totalPower: quote.totalPowerW,
    equipmentPrice: quote.equipmentTotalRub,
    workPrice: quote.workPriceRub,
    totalPrice: quote.totalPriceRub,
    selectedPrompt,
  };
}

export interface ToAnalyzeResponseParams {
  engine: EngineResult;
  fixture: Fixture;
  lightingType: LightingType;
  mountTarget: MountTarget;
  selectedPrompt: UsagePrompt | undefined;
  analysis: FacadeAnalysis;
  calculations: Record<LightingType, CalculationResult>;
  recommendedLightingType: LightingType;
  pxPerMeter: number;
  pipelineLog?: PipelineLogEntry[];
}

export function toAnalyzeResponse(params: ToAnalyzeResponseParams): AnalyzeResponse {
  const {
    engine,
    fixture,
    lightingType,
    mountTarget,
    selectedPrompt,
    analysis,
    calculations,
    recommendedLightingType,
    pxPerMeter,
    pipelineLog,
  } = params;

  const placement = placedItemsToPlacementScheme(
    engine.placedItems,
    engine.sceneAnalysis,
    pxPerMeter,
    {
      id: fixture.id,
      companyId: "niteos",
      name: fixture.name,
      category: fixture.category ?? "linear_facade",
      priceRub: fixture.priceRub ?? fixture.price,
      powerW: fixture.powerW ?? fixture.power,
      dimensionsMm: {
        length: fixture.lengthMm ?? 1000,
        width: fixture.widthMm ?? 100,
        height: fixture.heightMm ?? 80,
      },
      assets: {
        frontPng: fixture.image,
        sidePng: fixture.imageSide,
      },
      placementProfile: {
        surfaceTypes: ["facade"],
        forbiddenZoneTypes: ["sky"],
        placementMode: "repeated_line",
      },
    }
  );

  const activeCalculation = buildCalculationFromEngine(
    fixture,
    lightingType,
    mountTarget,
    selectedPrompt,
    engine.quote,
    placement.estimatedHeightM ?? 0
  );

  const detection = sceneToFacadeDetection(engine.sceneAnalysis);
  const pipeline: PipelineStages = {
    detection,
    detectionSource: engine.debug?.source ?? engine.sceneAnalysis.source,
    scale: {
      pixelsPerMeter: pxPerMeter,
      anchor: "height",
      userMeters: analysis.facadeHeightM ?? 18,
      facadePxExtent: engine.sceneAnalysis.facadeBox
        ? engine.sceneAnalysis.facadeBox.height * engine.sceneAnalysis.imageHeight
        : 0,
    } as ScaleInfo,
    placementCount: engine.placedItems.length,
  };

  const mergedCalculations = {
    ...calculations,
    [lightingType]: activeCalculation,
  } as Record<LightingType, CalculationResult>;

  return {
    analysis: {
      ...analysis,
      facadeDetection: detection,
      aiMode: engine.sceneAnalysis.source === "ai" ? "ai" : "mock",
    },
    calculations: mergedCalculations,
    recommendedLightingType,
    placement,
    activeCalculation,
    pipeline,
    pipelineLog,
    visionDebugImage: engine.debug?.sceneDebugImage,
    engine: {
      sceneAnalysis: engine.sceneAnalysis,
      placedItems: engine.placedItems,
      quote: engine.quote,
      bodiesImage: engine.bodiesImage,
      localImage: engine.localImage,
      enhancedImage: engine.enhancedImage,
      debug: engine.debug,
    },
  };
}

/** Обратная совместимость: FacadeDetection → SceneAnalysis */
export { facadeDetectionToSceneAnalysis };
