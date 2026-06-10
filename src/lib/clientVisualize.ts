import { renderLightingOverlay } from "@/lib/mockAi";
import type { AnalyzeResponse } from "@/lib/types";

/** GitHub Pages: демо через canvas (без sharp) */
export async function runClientVisualization(
  imageDataUrl: string,
  response: AnalyzeResponse
): Promise<{ imageDataUrl: string; mode: "static_demo"; message: string }> {
  const legacyPoints = response.placement.fixtures?.length
    ? response.placement.fixtures.map((f) => ({
        x: f.x * 1000,
        y: f.y * 800,
      }))
    : [];

  const out = await renderLightingOverlay(
    imageDataUrl,
    {
      fixtures: response.placement.fixtures ?? [],
      facadeBox: response.placement.facadeBox,
      estimatedWidthM: response.placement.estimatedWidthM,
      estimatedHeightM: response.placement.estimatedHeightM,
      points: legacyPoints,
      lines: [],
      zoneLabels: [],
    },
    response.activeCalculation.lightingType
  );
  return {
    imageDataUrl: out,
    mode: "static_demo",
    message:
      "Демо в браузере. Полная визуализация с PNG светильниками — при npm run dev.",
  };
}
