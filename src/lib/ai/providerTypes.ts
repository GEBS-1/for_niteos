/** Провайдеры AI-улучшения света, доступные на сайте */
export type SelectableAiProvider = "openai" | "gigachat";

export const AI_PROVIDER_STORAGE_KEY = "niteos-ai-provider";

export function isSelectableAiProvider(v: string): v is SelectableAiProvider {
  return v === "openai" || v === "gigachat";
}
