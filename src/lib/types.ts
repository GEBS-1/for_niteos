export type LightingType =
  | "контурная"
  | "акцентная"
  | "заливная"
  | "оконная"
  | "линейная";

export type MountTarget = "facade" | "nearby";

export interface BuildingDimensions {
  widthM?: number;
  lengthM?: number;
  heightM?: number;
}

export interface UsagePrompt {
  id: string;
  title: string;
  lightingType: LightingType;
  mountTarget: MountTarget;
  description: string;
  prompt: string;
}

export interface Fixture {
  id: string;
  name: string;
  type: string[];
  power: number;
  price: number;
  mountingStepMeters: number;
  description: string;
  image: string;
  usagePrompts: UsagePrompt[];
}

export interface AnalyzeRequest {
  imageWidth: number;
  imageHeight: number;
  dimensions: BuildingDimensions;
  lightingType?: LightingType;
  fixtureId?: string;
  promptId?: string;
}

export interface FacadeAnalysis {
  windowsDetected: number;
  cornersDetected: number;
  facadeWidthM: number;
  facadeHeightM: number;
  facadeLengthM: number;
  facadeAreaM2: number;
  mountingZones: string[];
  pixelsPerMeter: number;
  imageQuality: "good" | "acceptable" | "low";
  qualityNotes: string[];
  aiMode: "mock";
  aiTasks: AiTaskStatus[];
}

export interface AiTaskStatus {
  task: string;
  status: "mock" | "pending_api" | "done";
  detail: string;
}

export interface CalculationResult {
  fixture: Fixture;
  matchingFixtures: Fixture[];
  lightingType: LightingType;
  mountTarget: MountTarget;
  zoneLengthM: number;
  quantity: number;
  totalPower: number;
  equipmentPrice: number;
  workPrice: number;
  totalPrice: number;
  selectedPrompt?: UsagePrompt;
}

export interface PlacementPoint {
  x: number;
  y: number;
}

export interface PlacementLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PlacementScheme {
  points: PlacementPoint[];
  lines: PlacementLine[];
  zoneLabels: { x: number; y: number; label: string }[];
}

export interface AnalyzeResponse {
  analysis: FacadeAnalysis;
  calculations: Record<LightingType, CalculationResult>;
  recommendedLightingType: LightingType;
  placement: PlacementScheme;
  activeCalculation: CalculationResult;
}

export interface AiAnalysisProvider {
  analyzeFacade(imageBase64: string, params: AnalyzeRequest): Promise<FacadeAnalysis>;
  generateVisualization(
    imageBase64: string,
    placement: PlacementScheme,
    lightingType: LightingType
  ): Promise<string>;
}
