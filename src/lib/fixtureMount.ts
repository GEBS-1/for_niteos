import type { BuildingDimensions, CalculationResult, Fixture } from "./types";

export function isParkPoleFixture(fixture?: Fixture | null): boolean {
  return fixture?.category === "park_pole" || fixture?.mountType === "pole";
}

/** Длина зоны для опор перед фасадом (м) — устойчиво к «плоскому» bbox на фото */
export function estimatePoleZoneLengthM(
  facadeBox: { width: number; height: number },
  scale: { pixelsPerMeter: number },
  dimensions: BuildingDimensions | undefined,
  imageWidth: number,
  imageHeight: number
): number {
  if (dimensions?.widthM && dimensions.widthM > 0) {
    return Math.round(dimensions.widthM * 0.9 * 10) / 10;
  }

  const pxPerM = scale.pixelsPerMeter;
  const photoWidthM = (facadeBox.width * imageWidth) / pxPerM;
  const photoHeightM = (facadeBox.height * imageHeight) / pxPerM;

  let widthM = photoWidthM;
  const aspect = photoHeightM > 0.5 ? photoWidthM / photoHeightM : 2;
  if (aspect > 3) {
    widthM = photoHeightM * 1.6;
  }

  return Math.round(widthM * 0.9 * 10) / 10;
}

export function buildQuantityHint(calc: CalculationResult): string {
  const step = calc.fixture.mountingStepMeters;
  const zone = calc.zoneLengthM;

  if (isParkPoleFixture(calc.fixture) || calc.mountTarget === "nearby") {
    return `Вдоль площадки перед фасадом (~${zone} м) ÷ шаг ${step} м. На изображении — иллюстрация; для сметы ориентируйтесь на расчётное число.`;
  }

  return `По длине линий монтажа на фасаде (~${zone} м) ÷ шаг ${step} м. Линии определяются по фото и типу подсветки.`;
}
