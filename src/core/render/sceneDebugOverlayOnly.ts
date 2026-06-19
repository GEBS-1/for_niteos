import sharp from "sharp";
import type { PlacedItem } from "@/core/products/types";
import type { SceneAnalysis } from "@/core/scene/types";
import { buildSceneDebugSvg } from "./sceneDebugOverlay";

export async function renderSceneDebugOnly(
  imageBuffer: Buffer,
  scene: SceneAnalysis,
  placedItems: PlacedItem[],
  surfacesUsed?: SceneAnalysis["surfaces"]
): Promise<string> {
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? scene.imageWidth;
  const height = meta.height ?? scene.imageHeight;
  const svg = buildSceneDebugSvg(scene, placedItems, surfacesUsed);
  const overlay = await sharp(Buffer.from(svg), { density: 144 })
    .resize(width, height)
    .png()
    .toBuffer();
  const composed = await sharp(imageBuffer)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
  return `data:image/jpeg;base64,${composed.toString("base64")}`;
}
