/** Реалистичный масштаб по мм или увеличенный для демонстрации клиенту */
export type VisualizationScale = "realistic" | "demo";

export interface DisplayOptions {
  scale: VisualizationScale;
  showBodies: boolean;
  showMarkers: boolean;
  showGlow: boolean;
  /** Затемнение «вечер» на базовом фото (для этапа только корпусов — false) */
  eveningBase?: boolean;
}

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  scale: "realistic",
  showBodies: true,
  showMarkers: false,
  showGlow: true,
  eveningBase: true,
};

/** MVP v2: видимые корпуса на исходном фото (только PNG, без SVG-маркеров) */
export const MVP_BODIES_ONLY: DisplayOptions = {
  scale: "demo",
  showBodies: true,
  showMarkers: false,
  showGlow: false,
  eveningBase: false,
};

/** MVP v2: корпуса + световой эффект 3000K */
export const MVP_BODIES_AND_LIGHT: DisplayOptions = {
  scale: "demo",
  showBodies: true,
  showMarkers: false,
  showGlow: true,
  eveningBase: true,
};

/** Подготовка кадра для AI enhance (свет уже на фото) */
export const PREP_FOR_AI_DISPLAY_OPTIONS: DisplayOptions = {
  ...MVP_BODIES_AND_LIGHT,
};

export function getFixtureWidthBounds(
  scale: VisualizationScale,
  imageWidth: number
): { min: number; max: number; floorPct: number } {
  if (scale === "demo") {
    return {
      min: 80,
      max: 420,
      floorPct: 0.06,
    };
  }
  return {
    min: 20,
    max: 200,
    floorPct: 0,
  };
}
