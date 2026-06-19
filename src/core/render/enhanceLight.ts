import { shouldAiEnhanceLight, isOpenAiConfigured } from "@/config/ai.config";
import { enhanceLightWithOpenAI } from "@/lib/ai/openaiVisualize";

/**
 * Опциональное AI-усиление света поверх локального рендера.
 */
export async function enhanceLight(
  imageDataUrl: string,
  imageBuffer: Buffer
): Promise<string | null> {
  if (!shouldAiEnhanceLight() || !isOpenAiConfigured()) {
    return null;
  }

  try {
    const result = await enhanceLightWithOpenAI(imageDataUrl, imageBuffer);
    return result.imageDataUrl;
  } catch (e) {
    console.warn("enhanceLight failed:", e);
    return null;
  }
}
