import catalogData from "../../data/catalog.json";
import type { Fixture, LightingType } from "./types";

function normalizeFixture(raw: Fixture): Fixture {
  return {
    ...raw,
    frontImage: raw.frontImage ?? raw.image,
    sideImage: raw.sideImage ?? raw.imageSide,
    angleImage: raw.angleImage ?? raw.imageSide,
    priceRub: raw.priceRub ?? raw.price,
    powerW: raw.powerW ?? raw.power,
  };
}

export const CATALOG: Fixture[] = (catalogData as Fixture[]).map(normalizeFixture);

export function getCatalogSeries(): string[] {
  const series = new Set(CATALOG.map((f) => f.series).filter(Boolean) as string[]);
  return [...series].sort();
}

export function getFixturesBySeries(series: string): Fixture[] {
  return CATALOG.filter((f) => f.series === series);
}

export const LIGHTING_OPTIONS: { value: LightingType; label: string }[] = [
  { value: "контурная", label: "Контурная подсветка" },
  { value: "акцентная", label: "Акцентная подсветка" },
  { value: "заливная", label: "Заливная подсветка" },
  { value: "оконная", label: "Оконная подсветка" },
  { value: "линейная", label: "Линейная подсветка" },
];

export function getFixturesForLightingType(type: LightingType): Fixture[] {
  return CATALOG.filter((f) => f.type.includes(type));
}

export function pickPrimaryFixture(type: LightingType): Fixture {
  const matches = getFixturesForLightingType(type);
  if (matches.length === 0) {
    return CATALOG[0];
  }
  return matches[0];
}
