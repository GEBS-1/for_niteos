import type { PlacedItem, Product } from "@/core/products/types";
import type { SceneAnalysis, Surface } from "@/core/scene/types";

function surfaceStroke(type: string): string {
  switch (type) {
    case "facade":
      return "rgba(60,255,140,0.9)";
    case "roof":
      return "rgba(100,200,255,0.85)";
    case "ground":
    case "sidewalk":
      return "rgba(255,200,80,0.85)";
    default:
      return "rgba(140,255,180,0.75)";
  }
}

function forbiddenFill(type: string): { stroke: string; fill: string } {
  if (type === "window" || type === "door") {
    return { stroke: "rgba(255,60,60,0.9)", fill: "rgba(255,40,40,0.22)" };
  }
  return { stroke: "rgba(255,100,60,0.8)", fill: "rgba(255,80,40,0.15)" };
}

export function buildSceneDebugSvg(
  scene: SceneAnalysis,
  placedItems: PlacedItem[],
  surfacesUsed?: Surface[]
): string {
  const w = scene.imageWidth;
  const h = scene.imageHeight;

  const forbiddenRects = scene.forbiddenZones
    .map((z) => {
      const { stroke, fill } = forbiddenFill(z.type);
      return `<rect x="${z.box.x * w}" y="${z.box.y * h}" width="${z.box.width * w}" height="${z.box.height * h}"
        fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    })
    .join("");

  const usedSet = new Set((surfacesUsed ?? []).map((s) => s.id));
  const surfaceLines = scene.surfaces
    .filter((s) => s.orientation === "horizontal")
    .map((s) => {
      const b = s.box;
      const y = (b.y + b.height / 2) * h;
      const stroke = usedSet.has(s.id)
        ? "rgba(60,255,140,0.95)"
        : surfaceStroke(s.type);
      const sw = usedSet.has(s.id) ? 3 : 1.5;
      return `<line x1="${b.x * w}" y1="${y}" x2="${(b.x + b.width) * w}" y2="${y}"
        stroke="${stroke}" stroke-width="${sw}"/>`;
    })
    .join("");

  const fb = scene.facadeBox;
  const facadeRect = fb
    ? `<rect x="${fb.x * w}" y="${fb.y * h}" width="${fb.width * w}" height="${fb.height * h}"
        fill="none" stroke="rgba(255,50,50,0.95)" stroke-width="3"/>`
    : "";

  const dots = placedItems
    .map(
      (p) =>
        `<circle cx="${p.x * w}" cy="${p.y * h}" r="5"
          fill="rgba(255,230,60,0.95)" stroke="rgba(180,120,0,0.9)" stroke-width="2"/>`
    )
    .join("");

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    ${forbiddenRects}
    ${facadeRect}
    ${surfaceLines}
    ${dots}
  </svg>`;
}
