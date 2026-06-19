import { formatRub } from "./format";
import type { Fixture } from "./types";

export interface EquipmentPricing {
  quantity: number;
  unitPriceRub: number;
  unitPriceLabel: string;
  totalPowerW: number;
  equipmentTotalRub: number;
  equipmentTotalLabel: string;
}

export function getFixtureUnitPriceRub(fixture: Fixture): number {
  return fixture.priceRub ?? fixture.price;
}

export function getFixturePowerW(fixture: Fixture): number {
  return fixture.powerW ?? fixture.power;
}

export function buildEquipmentPricing(
  fixture: Fixture,
  quantity: number
): EquipmentPricing {
  const unitPriceRub = getFixtureUnitPriceRub(fixture);
  const totalPowerW = quantity * getFixturePowerW(fixture);
  const equipmentTotalRub = quantity * unitPriceRub;
  return {
    quantity,
    unitPriceRub,
    unitPriceLabel: formatRub(unitPriceRub),
    totalPowerW,
    equipmentTotalRub,
    equipmentTotalLabel: formatRub(equipmentTotalRub),
  };
}
