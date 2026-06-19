import type { FixturePlacementProfile } from "@/lib/fixturePlacementProfile";
import type {
  FacadeArchitecture,
  Fixture,
  ForbiddenZones,
  MountTarget,
  MountZoneKey,
} from "./types";

export type ArchitectureLineSource =
  | "roofLine"
  | "cornices"
  | "floorBelts"
  | "groundLine"
  | "sidewalk"
  | "grass";

export type ArchitectureBoxSource =
  | "columns"
  | "pilasters"
  | "entranceZone"
  | "windowRows";

export type ForbiddenZoneKey = keyof ForbiddenZones;

export interface MountRuleSet {
  allowedLineSources: ArchitectureLineSource[];
  allowedBoxSources: ArchitectureBoxSource[];
  forbiddenZoneKeys: ForbiddenZoneKey[];
  recommendedKey: MountZoneKey;
}

export const MOUNT_RULES: Record<MountZoneKey, MountRuleSet> = {
  linear_facade: {
    allowedLineSources: ["roofLine", "cornices", "floorBelts"],
    allowedBoxSources: [],
    forbiddenZoneKeys: ["sky", "windows", "doors", "road", "trees", "cars", "people"],
    recommendedKey: "linear_facade",
  },
  accent_facade: {
    allowedLineSources: ["cornices", "floorBelts"],
    allowedBoxSources: ["columns", "pilasters", "entranceZone"],
    forbiddenZoneKeys: ["sky", "windows", "doors", "road", "trees", "cars", "people"],
    recommendedKey: "accent_facade",
  },
  window_lighting: {
    allowedLineSources: ["floorBelts"],
    allowedBoxSources: ["windowRows"],
    forbiddenZoneKeys: ["sky", "doors", "road", "trees", "cars", "people"],
    recommendedKey: "window_lighting",
  },
  ground_projector: {
    allowedLineSources: ["groundLine", "sidewalk", "grass"],
    allowedBoxSources: [],
    forbiddenZoneKeys: ["sky", "windows", "doors", "trees", "cars", "people"],
    recommendedKey: "ground_projector",
  },
  pole_lighting: {
    allowedLineSources: ["groundLine", "sidewalk", "grass"],
    allowedBoxSources: [],
    forbiddenZoneKeys: ["sky", "windows", "doors", "trees", "cars", "people"],
    recommendedKey: "pole_lighting",
  },
};

export function getMountZoneKey(
  fixture: Fixture,
  mountTarget: MountTarget,
  profile?: FixturePlacementProfile
): MountZoneKey {
  if (mountTarget === "nearby" || fixture.category === "park_pole") {
    return "pole_lighting";
  }
  switch (fixture.category) {
    case "linear_facade":
      return "linear_facade";
    case "window_accent":
      return "window_lighting";
    case "contour":
      return "linear_facade";
    case "flood":
      return "linear_facade";
    default:
      break;
  }
  switch (profile?.placementMode) {
    case "accent_points":
      return "accent_facade";
    case "window_reveal":
      return "window_lighting";
    case "pole_row":
      return "pole_lighting";
    case "flood_wash":
      return "ground_projector";
    case "contour_perimeter":
      return "linear_facade";
    default:
      return "linear_facade";
  }
}

export function linesFromArchitecture(
  architecture: FacadeArchitecture,
  sources: ArchitectureLineSource[]
) {
  const out = [];
  for (const key of sources) {
    const chunk = architecture[key];
    if (Array.isArray(chunk)) out.push(...chunk);
  }
  return out;
}
