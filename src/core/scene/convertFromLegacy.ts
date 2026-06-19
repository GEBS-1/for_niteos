import type { FacadeDetection } from "@/lib/types";
import type {
  Box,
  DetectedObject,
  ForbiddenZone,
  ForbiddenZoneType,
  SceneAnalysis,
  SceneType,
  Surface,
  SurfaceOrientation,
  SurfaceType,
} from "./types";
import {
  boxToPolygon,
  clamp01,
  lineToThinSurfaceBox,
} from "./geometry";

const FORBIDDEN_KEY_MAP: Record<string, ForbiddenZoneType> = {
  sky: "sky",
  road: "road",
  windows: "window",
  doors: "door",
  trees: "tree",
  cars: "car",
  people: "person",
};

function lineToSurface(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  surfaceType: SurfaceType,
  label?: string
): Surface {
  const box = lineToThinSurfaceBox(x1, y1, x2, y2);
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const orientation: SurfaceOrientation =
    dx > dy * 1.2 ? "horizontal" : dy > dx * 1.2 ? "vertical" : "sloped";

  return {
    id,
    type: surfaceType,
    box,
    polygon: boxToPolygon(box),
    orientation,
    confidence: 0.72,
    label,
  };
}

function boxSurface(
  id: string,
  box: Box,
  type: SurfaceType,
  orientation: SurfaceOrientation,
  confidence = 0.65
): Surface {
  return {
    id,
    type,
    box,
    polygon: boxToPolygon(box),
    orientation,
    confidence,
  };
}

/** Конвертация FacadeDetection (Vision/mock) → универсальная SceneAnalysis */
export function facadeDetectionToSceneAnalysis(
  detection: FacadeDetection,
  imageWidth: number,
  imageHeight: number,
  source: "ai" | "mock"
): SceneAnalysis {
  const surfaces: Surface[] = [];
  const fb = detection.facadeBox;

  surfaces.push(
    boxSurface(
      "facade-main",
      fb,
      "facade",
      "vertical",
      detection.confidence ?? 0.6
    )
  );

  surfaces.push(
    boxSurface("facade-wall", fb, "vertical_wall", "vertical", 0.7)
  );

  const arch = detection.architecture;
  if (arch) {
    arch.roofLine.forEach((l, i) => {
      surfaces.push(
        lineToSurface(
          `roof-${i}`,
          l.x1,
          l.y1,
          l.x2,
          l.y2,
          "roof",
          l.label ?? "roofLine"
        )
      );
    });
    arch.cornices.forEach((l, i) => {
      surfaces.push(
        lineToSurface(
          `cornice-${i}`,
          l.x1,
          l.y1,
          l.x2,
          l.y2,
          "facade",
          l.label ?? "cornice"
        )
      );
    });
    arch.floorBelts.forEach((l, i) => {
      surfaces.push(
        lineToSurface(
          `belt-${i}`,
          l.x1,
          l.y1,
          l.x2,
          l.y2,
          "facade",
          l.label ?? "floorBelt"
        )
      );
    });
    arch.groundLine.forEach((l, i) => {
      surfaces.push(
        lineToSurface(
          `ground-${i}`,
          l.x1,
          l.y1,
          l.x2,
          l.y2,
          "ground",
          l.label ?? "groundLine"
        )
      );
    });
    arch.sidewalk.forEach((l, i) => {
      surfaces.push(
        lineToSurface(
          `sidewalk-${i}`,
          l.x1,
          l.y1,
          l.x2,
          l.y2,
          "sidewalk",
          l.label ?? "sidewalk"
        )
      );
    });
    arch.grass.forEach((l, i) => {
      surfaces.push(
        lineToSurface(
          `grass-${i}`,
          l.x1,
          l.y1,
          l.x2,
          l.y2,
          "grass",
          l.label ?? "grass"
        )
      );
    });
  }

  const rec = detection.recommendedMountZones;
  if (rec) {
    const allLines = [
      ...rec.linear_facade,
      ...rec.accent_facade,
      ...rec.window_lighting,
      ...rec.ground_projector,
      ...rec.pole_lighting,
    ];
    allLines.forEach((l, i) => {
      const exists = surfaces.some(
        (s) =>
          Math.abs(s.box.y - (l.y1 + l.y2) / 2) < 0.008 &&
          Math.abs(s.box.x - Math.min(l.x1, l.x2)) < 0.02
      );
      if (!exists) {
        surfaces.push(
          lineToSurface(
            `rec-line-${i}`,
            l.x1,
            l.y1,
            l.x2,
            l.y2,
            "facade",
            l.label ?? l.type
          )
        );
      }
    });
  }

  const forbiddenZones: ForbiddenZone[] = [];
  const fz = detection.forbiddenZones;
  if (fz) {
    for (const [key, boxes] of Object.entries(fz)) {
      const type = FORBIDDEN_KEY_MAP[key];
      if (!type) continue;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        forbiddenZones.push({
          type,
          box: {
            x: clamp01(b.x),
            y: clamp01(b.y),
            width: b.width,
            height: b.height,
          },
          confidence: 0.75,
        });
      }
    }
  }

  const detectedObjects: DetectedObject[] = [];
  if (arch) {
    for (const col of arch.columns) {
      detectedObjects.push({
        id: `col-${col.x}`,
        type: "column",
        box: col,
        confidence: 0.7,
      });
    }
    for (const w of arch.windowRows) {
      detectedObjects.push({
        id: `win-row-${w.x}`,
        type: "window_row",
        box: w,
        confidence: 0.7,
      });
    }
  }

  const sceneType: SceneType = fb.height > 0.15 ? "building_facade" : "unknown";

  return {
    imageWidth,
    imageHeight,
    sceneType,
    facadeBox: fb,
    surfaces,
    forbiddenZones,
    detectedObjects,
    confidence: detection.confidence ?? (source === "ai" ? 0.65 : 0.55),
    source,
    notes: detection.notes,
  };
}
