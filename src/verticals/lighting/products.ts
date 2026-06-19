import type { Fixture } from "@/lib/types";
import type { PlacementMode, PlacementProfile, Product } from "@/core/products/types";

const COMPANY_ID = "niteos";

function profileForCategory(
  category: string | undefined,
  mountTarget?: string
): PlacementProfile {
  if (category === "park_pole" || mountTarget === "nearby") {
    return {
      surfaceTypes: ["sidewalk", "ground", "grass"],
      forbiddenZoneTypes: [
        "sky",
        "window",
        "door",
        "road",
        "tree",
        "car",
        "person",
      ],
      placementMode: "ground_row",
      mountingStepMeters: 8,
      visualScaleBoost: 1.4,
      requiresGroundSurface: true,
      maxSurfaces: 2,
      maxItems: 24,
    };
  }

  if (category === "contour") {
    return {
      surfaceTypes: ["facade", "roof", "vertical_wall"],
      forbiddenZoneTypes: ["sky", "road", "tree", "car", "person"],
      placementMode: "contour",
      mountingStepMeters: 2,
      visualScaleBoost: 2,
      requiresVerticalSurface: true,
      maxSurfaces: 4,
      maxItems: 80,
    };
  }

  if (category === "flood") {
    return {
      surfaceTypes: ["facade", "vertical_wall"],
      forbiddenZoneTypes: [
        "sky",
        "window",
        "door",
        "road",
        "tree",
        "car",
        "person",
      ],
      placementMode: "single_object",
      mountingStepMeters: 5,
      visualScaleBoost: 1.6,
      maxSurfaces: 3,
      maxItems: 12,
      onePerSurface: false,
    };
  }

  if (category === "window_accent") {
    return {
      surfaceTypes: ["facade", "vertical_wall"],
      forbiddenZoneTypes: ["sky", "road", "tree", "car", "person"],
      placementMode: "repeated_line",
      mountingStepMeters: 1.2,
      visualScaleBoost: 1.8,
      maxSurfaces: 12,
      maxItems: 48,
      onePerSurface: true,
    };
  }

  return {
    surfaceTypes: ["facade", "vertical_wall"],
    forbiddenZoneTypes: [
      "sky",
      "window",
      "door",
      "road",
      "tree",
      "car",
      "person",
    ],
    placementMode: "repeated_line",
    mountingStepMeters: 2,
    visualScaleBoost: 2.2,
    requiresVerticalSurface: true,
    maxSurfaces: 6,
    maxItems: 120,
  };
}

const PRODUCT_OVERRIDES: Record<string, Partial<Product>> = {
  "magistral-v3-ai-70": {
    dimensionsMm: { length: 360, width: 138, height: 100 },
    placementProfile: {
      surfaceTypes: ["vertical_wall", "facade"],
      forbiddenZoneTypes: [
        "sky",
        "window",
        "door",
        "road",
        "tree",
        "car",
        "person",
      ],
      placementMode: "repeated_line",
      mountingStepMeters: 2,
      visualScaleBoost: 2.2,
      requiresVerticalSurface: true,
      maxSurfaces: 6,
      maxItems: 120,
    },
  },
};

export function fixtureToLightingProduct(
  fixture: Fixture,
  mountTarget?: string
): Product {
  const baseProfile = profileForCategory(fixture.category, mountTarget);
  const product: Product = {
    id: fixture.id,
    companyId: COMPANY_ID,
    name: fixture.name,
    category: fixture.category ?? "linear_facade",
    priceRub: fixture.priceRub ?? fixture.price,
    powerW: fixture.powerW ?? fixture.power,
    dimensionsMm: {
      length: fixture.lengthMm ?? 1000,
      width: fixture.widthMm ?? 100,
      height: fixture.heightMm ?? 80,
    },
    assets: {
      frontPng: fixture.frontImage ?? fixture.image,
      sidePng: fixture.sideImage ?? fixture.imageSide,
      anglePng: fixture.angleImage ?? fixture.imageSide,
    },
    placementProfile: {
      ...baseProfile,
      mountingStepMeters:
        fixture.mountingStepMeters ?? baseProfile.mountingStepMeters,
    },
  };

  const override = PRODUCT_OVERRIDES[fixture.id];
  if (!override) return product;
  return {
    ...product,
    ...override,
    dimensionsMm: { ...product.dimensionsMm, ...override.dimensionsMm },
    assets: { ...product.assets, ...override.assets },
    placementProfile: {
      ...product.placementProfile,
      ...override.placementProfile,
    },
  };
}

export function getLightingProductById(
  id: string,
  catalog: Fixture[],
  mountTarget?: string
): Product | undefined {
  const fixture = catalog.find((f) => f.id === id);
  if (!fixture) return undefined;
  return fixtureToLightingProduct(fixture, mountTarget);
}

/** Все товары NITEOS lighting vertical */
export function buildLightingProducts(catalog: Fixture[]): Product[] {
  return catalog.map((f) =>
    fixtureToLightingProduct(f, f.usagePrompts[0]?.mountTarget)
  );
}

export const LIGHTING_COMPANY_ID = COMPANY_ID;
