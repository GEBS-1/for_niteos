import type {
  FacadeDetection,
  LightingType,
  MountLine,
  MountTarget,
  NormalizedBox,
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
  label?: string
): MountLine {
  return { id, x1, y1, x2, y2, label };
}

/** Горизонталь по ширине фасада */
function hBand(
  id: string,
  box: NormalizedBox,
  yRatio: number,
  inset = 0.04,
  label?: string
): MountLine {
  const left = box.x + inset;
  const right = box.x + box.width - inset;
  const y = box.y + box.height * yRatio;
  return line(id, left, y, right, y, label);
}

/** Вертикаль по высоте фасада */
function vBand(
  id: string,
  box: NormalizedBox,
  xRatio: number,
  yTop = 0.06,
  yBottom = 0.94,
  label?: string
): MountLine {
  const x = box.x + box.width * xRatio;
  const top = box.y + box.height * yTop;
  const bottom = box.y + box.height * yBottom;
  return line(id, x, top, x, bottom, label);
}

/** Короткая горизонталь (оконный пояс) */
function windowBand(
  id: string,
  box: NormalizedBox,
  col: number,
  cols: number,
  row: number,
  rows: number,
  band: "top" | "bottom"
): MountLine {
  const colW = box.width / cols;
  const rowH = box.height / rows;
  const x1 = box.x + col * colW + colW * 0.12;
  const x2 = box.x + (col + 1) * colW - colW * 0.12;
  const rowY = box.y + row * rowH;
  const y =
    band === "top"
      ? rowY + rowH * 0.22
      : rowY + rowH * 0.78;
  return line(id, x1, y, x2, y, `окно ${row + 1}-${col + 1} ${band}`);
}

/**
 * Линии монтажа по принципам референсов:
 * карниз, межэтажные пояса, цоколь, вертикали углов, окна (верх/низ проёма).
 */
export function buildMockFacadeDetection(
  lightingType: LightingType,
  mountTarget: MountTarget
): FacadeDetection {
  const box = DEFAULT_FACADE_BOX;
  const left = box.x;
  const right = box.x + box.width;
  const top = box.y;
  const bottom = box.y + box.height;

  let mountLines: MountLine[] = [];

  if (mountTarget === "nearby") {
    const groundY = Math.min(0.96, bottom + 0.04);
    mountLines = [
      line("ground-front", left + 0.04, groundY, right - 0.04, groundY, "Опоры перед фасадом"),
    ];
  } else if (lightingType === "линейная") {
    mountLines = [
      hBand("cornice", box, 0.10, 0.03, "Карниз / аттик"),
      hBand("floor-3", box, 0.26, 0.04, "3-й этаж"),
      hBand("floor-2", box, 0.42, 0.04, "2-й этаж"),
      hBand("floor-1", box, 0.58, 0.04, "1-й этаж"),
      hBand("colonnade", box, 0.74, 0.04, "Аркады / цоколь"),
      hBand("base", box, 0.88, 0.05, "Нижний пояс"),
    ];
  } else if (lightingType === "контурная") {
    mountLines = [
      hBand("cornice", box, 0.06, 0.02, "Верхний контур"),
      line("right", right, top + 0.06, right, bottom - 0.04),
      hBand("mid", box, 0.5, 0.05, "Средний пояс"),
      line("left", left, bottom - 0.04, left, top + 0.06),
      hBand("base", box, 0.94, 0.04, "Нижний контур"),
    ];
  } else if (lightingType === "оконная") {
    const cols = 5;
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        mountLines.push(windowBand(`w-${r}-${c}-top`, box, c, cols, r, rows, "top"));
        mountLines.push(windowBand(`w-${r}-${c}-bot`, box, c, cols, r, rows, "bottom"));
      }
    }
  } else if (lightingType === "заливная") {
    mountLines = [
      hBand("cornice", box, 0.1, 0.03, "Карниз"),
      hBand("flood-mid", box, 0.48, 0.05, "Заливка середина"),
      hBand("flood-low", box, 0.88, 0.06, "Нижняя зона"),
    ];
  } else {
    mountLines = [
      vBand("accent-left", box, 0.03, 0.1, 0.9),
      vBand("accent-right", box, 0.97, 0.1, 0.9),
      hBand("accent-mid", box, 0.5, 0.08, "Акцентная горизонталь"),
    ];
  }

  return {
    facadeBox: box,
    mountLines,
    confidence: 0.5,
    notes: [
      "Архитектурные линии: карниз, пояса, цоколь, углы (по референсам до/после)",
    ],
  };
}
