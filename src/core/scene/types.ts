export type SceneType =
  | "building_facade"
  | "interior"
  | "landscape"
  | "street"
  | "unknown";

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SurfaceType =
  | "vertical_wall"
  | "ground"
  | "roof"
  | "facade"
  | "sidewalk"
  | "grass";

export type SurfaceOrientation = "vertical" | "horizontal" | "sloped";

export interface Surface {
  id: string;
  type: SurfaceType;
  polygon: Point[];
  box: Box;
  orientation: SurfaceOrientation;
  confidence: number;
  /** Optional label from vision (cornice, belt, etc.) */
  label?: string;
}

export type ForbiddenZoneType =
  | "sky"
  | "window"
  | "door"
  | "road"
  | "tree"
  | "car"
  | "person"
  | "water";

export interface ForbiddenZone {
  type: ForbiddenZoneType;
  box: Box;
  confidence: number;
}

export interface DetectedObject {
  id: string;
  type: string;
  box: Box;
  confidence: number;
}

export interface SceneAnalysis {
  imageWidth: number;
  imageHeight: number;
  sceneType: SceneType;
  facadeBox?: Box;
  surfaces: Surface[];
  forbiddenZones: ForbiddenZone[];
  detectedObjects: DetectedObject[];
  confidence: number;
  source: "ai" | "mock";
  notes?: string[];
}

export interface AnalyzeSceneOptions {
  imageWidth: number;
  imageHeight: number;
  lightingType?: string;
  mountTarget?: string;
  productCategory?: string;
}
