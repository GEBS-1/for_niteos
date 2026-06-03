import { renderLightingOverlay } from "@/lib/mockAi";
import type { AnalyzeResponse, BuildingDimensions } from "@/lib/types";

export async function runClientVisualization(
  imageDataUrl: string,
  response: AnalyzeResponse
): Promise<{ imageDataUrl: string; mode: "static_demo"; message: string }> {
  const out = await renderLightingOverlay(
    imageDataUrl,
    response.placement,
    response.activeCalculation.lightingType
  );
  return {
    imageDataUrl: out,
    mode: "static_demo",
    message:
      "Демо-подсветка в браузере. Для GigaChat/OpenAI запустите проект локально (npm run dev).",
  };
}

export type ClientVisualizeParams = {
  imageDataUrl: string;
  response: AnalyzeResponse;
  dimensions: BuildingDimensions;
};
