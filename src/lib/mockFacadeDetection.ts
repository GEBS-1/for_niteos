import type {
  FacadeArchitecture,
  FacadeDetection,
  ForbiddenZones,
  LightingType,
  MountLine,
  MountTarget,
  NormalizedBox,
  RecommendedMountZones,
  ZoneBox,
  ZoneLine,
} from "./types";

export const DEFAULT_FACADE_BOX: NormalizedBox = {
  x: 0.08,
  y: 0.1,
  width: 0.84,
  height: 0.78,
};

function line(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label?: string,
  type?: string
): ZoneLine {
  return { id, x1, y1, x2, y2, label, type };
}

function hBand(
  id: string,
  box: NormalizedBox,
  yRatio: number,
  inset = 0.04,
  label?: string
): ZoneLine {
  const left = box.x + inset;
  const right = box.x + box.width - inset;
  const y = box.y + box.height * yRatio;
  return line(id, left, y, right, y, label, "floorBelt");
}

function windowBox(
  id: string,
  box: NormalizedBox,
  col: number,
  cols: number,
  row: number,
  rows: number
): ZoneBox {
  const colW = box.width / cols;
  const rowH = box.height / rows;
  return {
    x: box.x + col * colW + colW * 0.08,
    y: box.y + row * rowH + rowH * 0.1,
    width: colW * 0.84,
    height: rowH * 0.8,
    type: "window",
  };
}

function buildForbidden(box: NormalizedBox): ForbiddenZones {
  const top = box.y;
  const bottom = box.y + box.height;
  const cols = 5;
  const rows = 4;
  const windows: ZoneBox[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      windows.push(windowBox(`w-${r}-${c}`, box, c, cols, r, rows));
    }
  }
  return {
    sky: [{ x: 0, y: 0, width: 1, height: Math.max(0.03, top - 0.005), type: "sky" }],
    road: [
      {
        x: 0,
        y: Math.min(0.995, bottom + 0.008),
        width: 1,
        height: Math.max(0.02, 1 - bottom - 0.008),
        type: "road",
      },
    ],
    windows,
    doors: [
      {
        x: box.x + box.width * 0.38,
        y: box.y + box.height * 0.72,
        width: box.width * 0.24,
        height: box.height * 0.22,
        type: "door",
      },
    ],
    trees: [],
    cars: [],
    people: [],
  };
}

function buildArchitecture(
  box: NormalizedBox,
  lightingType: LightingType,
  mountTarget: MountTarget
): FacadeArchitecture {
  const groundY = Math.min(0.96, box.y + box.height + 0.035);
  const groundLine = [
    line(
      "ground-front",
      box.x + 0.04,
      groundY,
      box.x + box.width - 0.04,
      groundY,
      "Тротуар перед фасадом",
      "groundLine"
    ),
  ];

  if (mountTarget === "nearby") {
    return {
      roofLine: [],
      cornices: [],
      floorBelts: [],
      columns: [],
      pilasters: [],
      windowRows: [],
      entranceZone: [],
      groundLine,
      sidewalk: groundLine,
      grass: [],
    };
  }

  const cornice = hBand("cornice", box, 0.08, 0.03, "Карниз");
  const floorBelts = [
    hBand("floor-3", box, 0.24, 0.04, "3-й ярус"),
    hBand("floor-2", box, 0.4, 0.04, "2-й ярус"),
    hBand("floor-1", box, 0.56, 0.04, "1-й ярус"),
    hBand("colonnade", box, 0.72, 0.04, "Аркады"),
    hBand("base", box, 0.86, 0.05, "Цоколь"),
  ];

  const windowRows: ZoneBox[] = [];
  const cols = 5;
  const rows = lightingType === "оконная" ? 4 : 3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      windowRows.push(windowBox(`wr-${r}-${c}`, box, c, cols, r, rows));
    }
  }

  const columns: ZoneBox[] = [
    {
      x: box.x + box.width * 0.02,
      y: box.y + box.height * 0.12,
      width: box.width * 0.08,
      height: box.height * 0.78,
      type: "column",
    },
    {
      x: box.x + box.width * 0.9,
      y: box.y + box.height * 0.12,
      width: box.width * 0.08,
      height: box.height * 0.78,
      type: "column",
    },
  ];

  return {
    roofLine: [cornice],
    cornices: [cornice],
    floorBelts,
    columns,
    pilasters: columns,
    windowRows,
    entranceZone: [
      {
        x: box.x + box.width * 0.35,
        y: box.y + box.height * 0.68,
        width: box.width * 0.3,
        height: box.height * 0.28,
        type: "entrance",
      },
    ],
    groundLine,
    sidewalk: groundLine,
    grass: [],
  };
}

function toMountLine(zl: ZoneLine, index: number): MountLine {
  return {
    id: zl.id ?? `ml-${index}`,
    x1: zl.x1,
    y1: zl.y1,
    x2: zl.x2,
    y2: zl.y2,
    label: zl.label,
  };
}

function buildRecommended(
  architecture: FacadeArchitecture,
  lightingType: LightingType,
  mountTarget: MountTarget
): RecommendedMountZones {
  const linear = [
    ...architecture.cornices,
    ...architecture.roofLine,
    ...architecture.floorBelts,
  ];

  const accent = architecture.columns.flatMap((col, i) => {
    const cx = col.x + col.width / 2;
    const cy = col.y + col.height * 0.3;
    const span = col.width * 1.1;
    return [
      line(
        `accent-col-${i}`,
        cx - span / 2,
        cy,
        cx + span / 2,
        cy,
        "Колонна",
        "accent"
      ),
    ];
  });

  const windowLighting: ZoneLine[] = [];
  for (let i = 0; i < architecture.windowRows.length; i++) {
    const w = architecture.windowRows[i];
    const x1 = w.x + w.width * 0.1;
    const x2 = w.x + w.width * 0.9;
    windowLighting.push(
      line(`wl-top-${i}`, x1, w.y + w.height * 0.12, x2, w.y + w.height * 0.12, "над окном", "window"),
      line(`wl-bot-${i}`, x1, w.y + w.height * 0.88, x2, w.y + w.height * 0.88, "под окном", "window")
    );
  }

  const ground = [...architecture.groundLine, ...architecture.sidewalk];

  if (mountTarget === "nearby") {
    return {
      linear_facade: [],
      accent_facade: accent,
      window_lighting: windowLighting,
      ground_projector: ground,
      pole_lighting: ground,
    };
  }

  if (lightingType === "оконная") {
    return {
      linear_facade: [],
      accent_facade: accent,
      window_lighting: windowLighting,
      ground_projector: ground,
      pole_lighting: ground,
    };
  }

  if (lightingType === "акцентная") {
    return {
      linear_facade: [],
      accent_facade: accent,
      window_lighting: windowLighting,
      ground_projector: ground,
      pole_lighting: ground,
    };
  }

  return {
    linear_facade: linear,
    accent_facade: accent,
    window_lighting: windowLighting,
    ground_projector: ground,
    pole_lighting: ground,
  };
}

/**
 * Геометрическая карта зон (когда Vision API недоступен).
 * Строится по архитектурным поясам внутри facadeBox, не сеткой по всему кадру.
 */
export function buildMockFacadeDetection(
  lightingType: LightingType,
  mountTarget: MountTarget
): FacadeDetection {
  const box = DEFAULT_FACADE_BOX;
  const architecture = buildArchitecture(box, lightingType, mountTarget);
  const forbiddenZones = buildForbidden(box);
  const recommendedMountZones = buildRecommended(
    architecture,
    lightingType,
    mountTarget
  );

  const mountLines = (
    mountTarget === "nearby"
      ? recommendedMountZones.pole_lighting
      : lightingType === "оконная"
        ? recommendedMountZones.window_lighting
        : lightingType === "акцентная"
          ? recommendedMountZones.accent_facade
          : recommendedMountZones.linear_facade
  ).map(toMountLine);

  return {
    facadeBox: box,
    mountLines,
    architecture,
    forbiddenZones,
    recommendedMountZones,
    confidence: 0.55,
    notes: [
      "Геометрическая карта зон: карниз, пояса, цоколь; запрет неба и дороги",
    ],
  };
}
