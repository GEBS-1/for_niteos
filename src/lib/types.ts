export type LightingType =

  | "контурная"

  | "акцентная"

  | "заливная"

  | "оконная"

  | "линейная";



export type MountTarget = "facade" | "nearby";



export type FixtureMountType = "facade" | "ground" | "pole" | "linear";



export type FixtureCategory =

  | "linear_facade"

  | "park_pole"

  | "window_accent"

  | "contour"

  | "flood";



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

  /** Доп. указание по стилю из фото «Применение» */
  applicationStyle?: string;

}



/** Нормализованный прямоугольник фасада на фото (0–1) */

export interface NormalizedBox {

  x: number;

  y: number;

  width: number;

  height: number;

}



/** Линия монтажа (нормализованные координаты 0–1) */

export interface MountLine {

  id: string;

  x1: number;

  y1: number;

  x2: number;

  y2: number;

  label?: string;

}



/** Этап 1: только геометрия фасада */

export interface FacadeDetection {

  facadeBox: NormalizedBox;

  mountLines: MountLine[];

  confidence?: number;

  notes?: string[];

}



export type ScaleAnchor = "width" | "height" | "length";



/** Этап 2: масштаб пикселей к метрам */

export interface ScaleInfo {

  pixelsPerMeter: number;

  anchor: ScaleAnchor;

  userMeters: number;

  facadePxExtent: number;

}



export interface Fixture {

  id: string;

  name: string;

  type: string[];

  category?: FixtureCategory;

  mountType?: FixtureMountType;

  power: number;

  powerW?: number;

  price: number;

  priceRub?: number;

  lengthMm?: number;

  widthMm?: number;

  heightMm?: number;

  mountingStepMeters: number;

  description: string;

  image: string;

  imageSide?: string;

  imageTop?: string;

  lightTemperatureK?: number;

  promptDescription?: string;

  /** Серия в каталоге NITEOS (MAGISTRAL, X-RAY, NT-RAINBOW…) */
  series?: string;

  /** Ссылка на карточку товара niteos.ru */
  productUrl?: string;

  /** Фото «Применение» — референс итоговой подсветки для AI */
  imageApplication?: string;

  usagePrompts: UsagePrompt[];

}



export interface AnalyzeRequest {

  imageWidth: number;

  imageHeight: number;

  dimensions: BuildingDimensions;

  /** data URL для AI-детекции фасада (этап 1) */

  imageDataUrl?: string;

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

  aiMode: "mock" | "ai" | "mock_fallback";

  aiTasks: AiTaskStatus[];

  facadeDetection?: FacadeDetection;

  scale?: ScaleInfo;

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



export interface FixturePlacement {

  x: number;

  y: number;

  rotation: number;

  /** @deprecated используйте widthPx/heightPx */

  scale?: number;

  widthPx?: number;

  heightPx?: number;

  productId: string;

  mountType: FixtureMountType;

}



export interface PlacementScheme {

  fixtures: FixturePlacement[];

  facadeBox: NormalizedBox;

  mountLines?: MountLine[];

  pixelsPerMeter?: number;

  estimatedWidthM: number;

  estimatedHeightM: number;

  /** @deprecated legacy canvas overlay */

  points?: { x: number; y: number }[];

  lines?: { x1: number; y1: number; x2: number; y2: number }[];

  zoneLabels?: { x: number; y: number; label: string }[];

}



export interface PipelineStages {

  detection: FacadeDetection;

  detectionSource: "ai" | "mock";

  scale: ScaleInfo;

  placementCount: number;

}



export interface AnalyzeResponse {

  analysis: FacadeAnalysis;

  calculations: Record<LightingType, CalculationResult>;

  recommendedLightingType: LightingType;

  placement: PlacementScheme;

  activeCalculation: CalculationResult;

  pipeline?: PipelineStages;

  pipelineLog?: PipelineLogEntry[];

}



export interface PipelineLogEntry {

  ts: string;

  stage: string;

  level: "info" | "warn" | "error" | "debug";

  message: string;

  data?: Record<string, unknown>;

}



export interface LocalRenderReport {

  imageWidth: number;

  imageHeight: number;

  fixturePath: string;

  fixtureFileExists: boolean;

  fixtureSourceSize?: { w: number; h: number };

  placementsTotal: number;

  pngComposited: number;

  pngSkipped: number;

  markerComposited: number;

  skipReasons: string[];

  compositeSamples: Array<{

    index: number;

    x: number;

    y: number;

    targetW: number;

    left: number;

    top: number;

    rw: number;

    rh: number;

  }>;

  displayMode?: string;

}



export interface VisualizationResponse {

  originalImage: string;

  localVisualization: string;

  closeUpVisualization?: string;

  aiVisualization?: string;

  placementScheme: PlacementScheme;

  specification: CalculationResult;

  mode: string;

  provider?: string;

  message?: string;

  lightPrompt?: string;

  localRenderReport?: LocalRenderReport;

  pipelineLog?: PipelineLogEntry[];

}



export interface AiAnalysisProvider {

  analyzeFacade(imageBase64: string, params: AnalyzeRequest): Promise<FacadeAnalysis>;

  generateVisualization(

    imageBase64: string,

    placement: PlacementScheme,

    lightingType: LightingType

  ): Promise<string>;

}

