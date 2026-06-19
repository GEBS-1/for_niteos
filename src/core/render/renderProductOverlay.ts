import type { PlacedItem, Product } from "@/core/products/types";
import type { SceneAnalysis } from "@/core/scene/types";
import { placedItemsToPlacementScheme } from "@/core/adapters/legacyAnalyze";
import {
  MVP_BODIES_AND_LIGHT,
  MVP_BODIES_ONLY,
} from "@/lib/displayOptions";
import type { Fixture } from "@/lib/types";
import { renderLocalVisualization } from "@/lib/visualizeLocal";
import { buildSceneDebugSvg } from "./sceneDebugOverlay";
import sharp from "sharp";

export interface RenderOverlayOptions {
  showBodies?: boolean;
  showGlow?: boolean;
  showDebug?: boolean;
  surfacesUsed?: { id: string }[];
}

/**
 * Локальный рендер через проверенный visualizeLocal (лента side.png + knockOut + glow).
 * Не дублирует упрощённую укладку плиток по точкам.
 */
export async function renderProductOverlay(
  imageBuffer: Buffer,
  scene: SceneAnalysis,
  product: Product,
  placedItems: PlacedItem[],
  fixture: Fixture,
  pxPerMeter: number,
  options: RenderOverlayOptions = {}
): Promise<{ bodiesDataUrl: string; lightDataUrl: string; debugDataUrl?: string }> {
  const { showDebug = false, surfacesUsed } = options;

  const placement = placedItemsToPlacementScheme(
    placedItems,
    scene,
    pxPerMeter,
    product
  );

  const bodies = await renderLocalVisualization(
    imageBuffer,
    placement,
    fixture,
    undefined,
    MVP_BODIES_ONLY
  );

  const light = await renderLocalVisualization(
    imageBuffer,
    placement,
    fixture,
    undefined,
    MVP_BODIES_AND_LIGHT
  );

  let debugDataUrl: string | undefined;
  if (showDebug) {
    const meta = await sharp(imageBuffer).metadata();
    const width = meta.width ?? scene.imageWidth;
    const height = meta.height ?? scene.imageHeight;
    const svg = buildSceneDebugSvg(
      scene,
      placedItems,
      surfacesUsed as SceneAnalysis["surfaces"]
    );
    const overlay = await sharp(Buffer.from(svg), { density: 144 })
      .resize(width, height)
      .png()
      .toBuffer();
    const dbg = await sharp(imageBuffer)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();
    debugDataUrl = `data:image/jpeg;base64,${dbg.toString("base64")}`;
  }

  return {
    bodiesDataUrl: bodies.dataUrl,
    lightDataUrl: light.dataUrl,
    debugDataUrl,
  };
}
