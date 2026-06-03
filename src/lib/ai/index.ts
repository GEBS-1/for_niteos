/**
 * AI integration entry point.
 * Swap MockAiProvider with a real implementation when OPENAI_API_KEY is set.
 */
import type { AiAnalysisProvider } from "../types";
import { buildFacadeAnalysis } from "../calculation";
import { renderLightingOverlay } from "../mockAi";
import type { AnalyzeRequest, FacadeAnalysis, LightingType, PlacementScheme } from "../types";

class MockAiProvider implements AiAnalysisProvider {
  async analyzeFacade(_imageBase64: string, params: AnalyzeRequest): Promise<FacadeAnalysis> {
    await new Promise((r) => setTimeout(r, 300));
    return buildFacadeAnalysis(params);
  }

  async generateVisualization(
    imageBase64: string,
    placement: PlacementScheme,
    lightingType: LightingType
  ): Promise<string> {
    return renderLightingOverlay(imageBase64, placement, lightingType);
  }
}

export type { AiAnalysisProvider };
export const aiProvider: AiAnalysisProvider = new MockAiProvider();
