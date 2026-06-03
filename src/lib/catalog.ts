import catalogData from "../../data/catalog.json";
import type { Fixture, LightingType } from "./types";

export const CATALOG: Fixture[] = catalogData as Fixture[];

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
