import { formatRub } from "./format";

/** Временная цена за шт. — замените, когда будет актуальный прайс NITEOS */
export const STUB_UNIT_PRICE_RUB = 23_500;

export interface StubPricing {
  quantity: number;
  unitPriceRub: number;
  unitPriceLabel: string;
  equipmentTotalRub: number;
  equipmentTotalLabel: string;
  note: string;
}

export function buildStubPricing(quantity: number): StubPricing {
  const equipmentTotalRub = quantity * STUB_UNIT_PRICE_RUB;
  return {
    quantity,
    unitPriceRub: STUB_UNIT_PRICE_RUB,
    unitPriceLabel: `${formatRub(STUB_UNIT_PRICE_RUB)}*`,
    equipmentTotalRub,
    equipmentTotalLabel: `${formatRub(equipmentTotalRub)}*`,
    note: "* Ориентировочные цены. Актуальный прайс предоставит NITEOS.",
  };
}
