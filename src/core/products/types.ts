export type PlacementMode =
  | "repeated_line"
  | "single_object"
  | "grid_surface"
  | "contour"
  | "ground_row";

export interface PlacementProfile {
  surfaceTypes: string[];
  forbiddenZoneTypes: string[];
  placementMode: PlacementMode;
  mountingStepMeters?: number;
  visualScaleBoost?: number;
  requiresVerticalSurface?: boolean;
  requiresGroundSurface?: boolean;
  maxSurfaces?: number;
  maxItems?: number;
  onePerSurface?: boolean;
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  category: string;
  priceRub: number;
  powerW: number;
  dimensionsMm: {
    length: number;
    width: number;
    height: number;
  };
  assets: {
    frontPng: string;
    sidePng?: string;
    anglePng?: string;
  };
  placementProfile: PlacementProfile;
}

export interface PlacedItem {
  productId: string;
  x: number;
  y: number;
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
  rotation: number;
  surfaceId: string;
  score: number;
}

export interface UserReferenceSize {
  facadeHeightM?: number;
  facadeWidthM?: number;
  lengthM?: number;
}
