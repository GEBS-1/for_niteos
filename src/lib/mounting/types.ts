export type NormalizedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  type?: string;
};

export type NormalizedLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type?: string;
};

export type MountType =
  | "linear_facade"
  | "accent_facade"
  | "contour"
  | "ground_projector"
  | "pole";

export type ProductForMounting = {
  id: string;
  name: string;
  mountType: MountType;
  lengthMm: number;
  widthMm?: number;
  heightMm: number;
  mountingStepMeters: number;
  priceRub: number;
  powerW: number;
  image: string;
};

export type VisionResult = {
  facadeBox: NormalizedBox;

  architecture?: {
    horizontalBelts?: NormalizedLine[];
    cornices?: NormalizedLine[];
    roofEdges?: NormalizedLine[];
    facadeEdges?: NormalizedLine[];
    verticalPilasters?: NormalizedLine[];
    columns?: NormalizedBox[];
    windowRows?: NormalizedBox[];
    windowFrames?: NormalizedBox[];
    entranceZone?: NormalizedBox[];
    groundEdges?: NormalizedLine[];
  };

  forbiddenZones?: {
    sky?: NormalizedBox[];
    road?: NormalizedBox[];
    windows?: NormalizedBox[];
    doors?: NormalizedBox[];
    trees?: NormalizedBox[];
    cars?: NormalizedBox[];
    people?: NormalizedBox[];
  };

  recommendedMountZones?: Partial<Record<MountType, NormalizedLine[]>>;
};

export type PlacedFixture = {
  productId: string;
  x: number;
  y: number;
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
  rotation: number;
  mountLineType?: string;
};

export type MountingSpecification = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceRub: number;
  equipmentTotalRub: number;
  workPriceRub: number;
  totalPriceRub: number;
  powerW: number;
  totalPowerW: number;
};

export type MountingPipelineResult = {
  visionResult: VisionResult;
  selectedZones: NormalizedLine[];
  placedFixtures: PlacedFixture[];
  specification: MountingSpecification;
  zoneLengthM: number;
};
