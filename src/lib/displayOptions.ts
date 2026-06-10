/** Реалистичный масштаб по мм или увеличенный для демонстрации клиенту */
export type VisualizationScale = "realistic" | "demo";

export interface DisplayOptions {
  scale: VisualizationScale;
  showBodies: boolean;
  showMarkers: boolean;
  showGlow: boolean;
}

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  scale: "realistic",
  showBodies: true,
  showMarkers: false,
  showGlow: true,
};

/** Подготовка кадра для AI: тонкие корпуса + мягкое свечение (без жёлтых полос demo) */
export const PREP_FOR_AI_DISPLAY_OPTIONS: DisplayOptions = {
  scale: "realistic",
  showBodies: true,
  showMarkers: false,
  showGlow: true,
};

export function getFixtureWidthBounds(
  scale: VisualizationScale,
  imageWidth: number
): { min: number; max: number; floorPct: number } {
  if (scale === "demo") {
    return {
      min: 100,
      max: 360,
      floorPct: 0.1,
    };
  }
  return {
    min: 20,
    max: 200,
    floorPct: 0,
  };
}
