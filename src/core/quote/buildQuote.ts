import type { Product, PlacedItem } from "@/core/products/types";

export interface Quote {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceRub: number;
  equipmentTotalRub: number;
  workPriceRub: number;
  totalPriceRub: number;
  powerW: number;
  totalPowerW: number;
}

export function buildQuote(product: Product, placedItems: PlacedItem[]): Quote {
  const quantity = placedItems.length;
  const equipmentTotalRub = quantity * product.priceRub;
  const totalPowerW = quantity * product.powerW;
  const workPriceRub = Math.round(equipmentTotalRub * 0.3);

  return {
    productId: product.id,
    productName: product.name,
    quantity,
    unitPriceRub: product.priceRub,
    equipmentTotalRub,
    workPriceRub,
    totalPriceRub: equipmentTotalRub + workPriceRub,
    powerW: product.powerW,
    totalPowerW,
  };
}
