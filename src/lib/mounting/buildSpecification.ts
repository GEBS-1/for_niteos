import type { MountingSpecification, PlacedFixture, ProductForMounting } from "./types";

export function buildSpecification(
  product: ProductForMounting,
  fixtures: PlacedFixture[]
): MountingSpecification {
  const quantity = fixtures.length;
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
