import { getFixturePlacementProfile } from "@/lib/fixturePlacementProfile";
import type {
  FacadeDetection,
  Fixture,
  LightingType,
  MountLine,
  MountTarget,
  NormalizedBox,
} from "./types";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function lineCenterY(ml: MountLine): number {
  return (ml.y1 + ml.y2) / 2;
}

export function isMostlyHorizontal(ml: MountLine): boolean {
  return Math.abs(ml.x2 - ml.x1) > Math.abs(ml.y2 - ml.y1) * 1.15;
}

function horizontalSpan(ml: MountLine): number {
  return Math.abs(ml.x2 - ml.x1);
}

/** Горизонтальная линия внутри бокса фасада */
function bandAtY(
  box: NormalizedBox,
  y: number,
  id: string,
  label?: string
): MountLine {
  const inset = Math.max(0.025, box.width * 0.035);
  const yClamped = clamp01(y);
  return {
    id,
    x1: box.x + inset,
    y1: yClamped,
    x2: box.x + box.width - inset,
    y2: yClamped,
    label,
  };
}

/**
 * Поджимает facadeBox: убирает небо над крышей.
 * Верх бокса — чуть выше верхней линии монтажа, низ — чуть ниже нижней.
 */
export function tightenFacadeBox(
  box: NormalizedBox,
  mountLines: MountLine[]
): NormalizedBox {
  const horiz = mountLines.filter(isMostlyHorizontal);
  if (horiz.length === 0) {
    return {
      ...box,
      y: clamp01(box.y),
      height: clamp01(Math.min(box.height, 0.92 - box.y)),
    };
  }

  const ys = horiz.map(lineCenterY);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxY - minY, box.height * 0.35);
  const margin = Math.max(0.015, span * 0.05);

  let y0 = Math.max(box.y, minY - margin);
  let y1 = Math.min(0.98, Math.max(box.y + box.height, maxY + margin));

  // Бокс Vision часто включает небо — обрезаем верх по линиям
  if (minY > box.y + box.height * 0.08) {
    y0 = Math.max(box.y, minY - margin);
  }

  const height = Math.max(span * 1.08, Math.min(0.92, y1 - y0));
  y1 = Math.min(0.98, y0 + height);

  return {
    x: clamp01(box.x),
    y: clamp01(y0),
    width: clamp01(Math.min(box.width, 1 - box.x)),
    height: clamp01(Math.min(y1 - y0, 1 - y0)),
  };
}

/** Обрезает линию по границам фасада; горизонтали выравнивает по Y */
export function clampMountLineToBox(ml: MountLine, box: NormalizedBox): MountLine {
  const top = box.y + box.height * 0.04;
  const bottom = box.y + box.height * 0.96;
  const left = box.x + box.width * 0.02;
  const right = box.x + box.width * 0.98;

  if (isMostlyHorizontal(ml)) {
    const y = clamp01(Math.max(top, Math.min(bottom, lineCenterY(ml))));
    const x1 = clamp01(Math.max(left, Math.min(right, Math.min(ml.x1, ml.x2))));
    const x2 = clamp01(Math.max(left, Math.min(right, Math.max(ml.x1, ml.x2))));
    return { ...ml, x1, y1: y, x2, y2: y };
  }

  return {
    ...ml,
    x1: clamp01(ml.x1),
    y1: clamp01(Math.max(top, Math.min(bottom, ml.y1))),
    x2: clamp01(ml.x2),
    y2: clamp01(Math.max(top, Math.min(bottom, ml.y2))),
  };
}

/** Равномерные пояса внутри бокса (не фиксированные % кадра) */
export function evenHorizontalBandsInBox(
  box: NormalizedBox,
  count: number
): MountLine[] {
  const topInset = 0.07;
  const bottomInset = 0.06;
  const yMin = box.y + box.height * topInset;
  const yMax = box.y + box.height * (1 - bottomInset);
  const n = Math.max(3, Math.min(6, count));

  const bands: MountLine[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const y = yMin + (yMax - yMin) * t;
    bands.push(bandAtY(box, y, `even-${i}`, `Пояс ${i + 1}`));
  }
  return bands;
}

/**
 * Линейная подсветка: сначала линии Vision (на фасаде), затем добор равномерными поясами.
 */
export function resolveLinearMountLines(
  box: NormalizedBox,
  detected: MountLine[],
  minBands = 4,
  maxBands = 6
): MountLine[] {
  const minSpan = box.width * 0.12;
  const top = box.y + box.height * 0.05;
  const bottom = box.y + box.height * 0.95;

  let horiz = detected
    .filter(isMostlyHorizontal)
    .map((ml) => clampMountLineToBox(ml, box))
    .filter((ml) => horizontalSpan(ml) >= minSpan)
    .filter((ml) => {
      const y = lineCenterY(ml);
      return y >= top && y <= bottom;
    });

  horiz.sort((a, b) => lineCenterY(a) - lineCenterY(b));

  const mergeThreshold = box.height * 0.065;
  const targetBands = Math.max(
    minBands,
    Math.min(maxBands, Math.max(horiz.length, minBands))
  );
  const template = evenHorizontalBandsInBox(box, targetBands);

  const merged: MountLine[] = [];

  for (const slot of template) {
    const slotY = lineCenterY(slot);
    const existing = horiz.find(
      (ml) => Math.abs(lineCenterY(ml) - slotY) < mergeThreshold
    );
    if (existing) {
      const dup = merged.some(
        (m) => Math.abs(lineCenterY(m) - lineCenterY(existing)) < mergeThreshold * 0.5
      );
      if (!dup) merged.push(existing);
    } else {
      const covered = horiz.some(
        (ml) => Math.abs(lineCenterY(ml) - slotY) < mergeThreshold
      );
      if (!covered) merged.push(slot);
    }
  }

  for (const ml of horiz) {
    const dup = merged.some(
      (m) => Math.abs(lineCenterY(m) - lineCenterY(ml)) < mergeThreshold * 0.5
    );
    if (!dup) merged.push(ml);
  }

  merged.sort((a, b) => lineCenterY(a) - lineCenterY(b));

  if (merged.length < minBands) {
    return evenHorizontalBandsInBox(box, minBands).slice(0, maxBands);
  }

  return merged.slice(0, maxBands);
}

/** Короткие сегменты для точечных акцентов (X-RAY SPOT и т.п.) */
export function resolveAccentMountLines(
  box: NormalizedBox,
  detected: MountLine[],
  maxSegments = 8
): MountLine[] {
  const minShortSpan = box.width * 0.06;
  const top = box.y + box.height * 0.08;
  const bottom = box.y + box.height * 0.92;

  let segments = detected
    .filter(isMostlyHorizontal)
    .map((ml) => clampMountLineToBox(ml, box))
    .filter((ml) => {
      const span = horizontalSpan(ml);
      const y = lineCenterY(ml);
      return y >= top && y <= bottom && span >= minShortSpan;
    });

  if (segments.length === 0) {
    const ys = [0.2, 0.38, 0.55, 0.72];
    const xs = [0.2, 0.5, 0.8];
    let i = 0;
    for (const yr of ys) {
      for (const xr of xs) {
        if (i >= maxSegments) break;
        const w = box.width * 0.14;
        const cx = box.x + box.width * xr;
        const y = box.y + box.height * yr;
        segments.push({
          id: `accent-${i}`,
          x1: cx - w / 2,
          y1: y,
          x2: cx + w / 2,
          y2: y,
          label: "Акцент",
        });
        i++;
      }
    }
  }

  segments.sort((a, b) => lineCenterY(a) - lineCenterY(b));
  return segments.slice(0, maxSegments);
}

/** Контур здания: карниз, вертикали углов, цоколь */
export function resolveContourMountLines(
  box: NormalizedBox,
  detected: MountLine[]
): MountLine[] {
  const left = box.x;
  const right = box.x + box.width;
  const top = box.y + box.height * 0.06;
  const bottom = box.y + box.height * 0.94;

  const horizDetected = detected
    .filter(isMostlyHorizontal)
    .map((ml) => clampMountLineToBox(ml, box))
    .filter((ml) => horizontalSpan(ml) >= box.width * 0.35);

  const cornice =
    horizDetected.find((ml) => lineCenterY(ml) < box.y + box.height * 0.2) ??
    bandAtY(box, box.y + box.height * 0.08, "contour-cornice", "Верхний контур");

  const base =
    horizDetected.find((ml) => lineCenterY(ml) > box.y + box.height * 0.75) ??
    bandAtY(box, box.y + box.height * 0.92, "contour-base", "Нижний контур");

  const vertDetected = detected
    .filter((ml) => !isMostlyHorizontal(ml))
    .map((ml) => clampMountLineToBox(ml, box));

  const leftEdge =
    vertDetected.find((ml) => (ml.x1 + ml.x2) / 2 < box.x + box.width * 0.15) ?? {
      id: "contour-left",
      x1: left + box.width * 0.02,
      y1: top,
      x2: left + box.width * 0.02,
      y2: bottom,
      label: "Левый контур",
    };

  const rightEdge =
    vertDetected.find((ml) => (ml.x1 + ml.x2) / 2 > box.x + box.width * 0.85) ?? {
      id: "contour-right",
      x1: right - box.width * 0.02,
      y1: top,
      x2: right - box.width * 0.02,
      y2: bottom,
      label: "Правый контур",
    };

  return [cornice, leftEdge, rightEdge, base];
}

/** Заливка прожекторами: 2–3 горизонтальные зоны, без плотной ленты */
export function resolveFloodMountLines(
  box: NormalizedBox,
  detected: MountLine[],
  minBands = 2,
  maxBands = 3
): MountLine[] {
  return resolveLinearMountLines(box, detected, minBands, maxBands);
}

/** Оконная подсветка: короткие сегменты в сетке проёмов */
export function resolveWindowMountLines(
  box: NormalizedBox,
  detected: MountLine[],
  maxSegments = 40
): MountLine[] {
  const minShortSpan = box.width * 0.04;
  const top = box.y + box.height * 0.1;
  const bottom = box.y + box.height * 0.9;

  let segments = detected
    .filter(isMostlyHorizontal)
    .map((ml) => clampMountLineToBox(ml, box))
    .filter((ml) => {
      const span = horizontalSpan(ml);
      const y = lineCenterY(ml);
      return y >= top && y <= bottom && span >= minShortSpan && span <= box.width * 0.22;
    });

  if (segments.length < 6) {
    const cols = 5;
    const rows = 4;
    segments = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const colW = box.width / cols;
        const rowH = box.height / rows;
        const x1 = box.x + c * colW + colW * 0.12;
        const x2 = box.x + (c + 1) * colW - colW * 0.12;
        const rowY = box.y + r * rowH;
        for (const band of ["top", "bottom"] as const) {
          const y =
            band === "top" ? rowY + rowH * 0.22 : rowY + rowH * 0.78;
          segments.push({
            id: `win-${r}-${c}-${band}`,
            x1,
            y1: y,
            x2,
            y2: y,
            label: `окно ${r + 1}-${c + 1} ${band}`,
          });
        }
      }
    }
  }

  return segments.slice(0, maxSegments);
}

export function buildGroundFrontLine(box: NormalizedBox): MountLine {
  const bottom = box.y + box.height;
  const groundY = Math.min(0.97, bottom + 0.03);
  return {
    id: "ground-front",
    x1: box.x + box.width * 0.05,
    y1: groundY,
    x2: box.x + box.width * 0.95,
    y2: groundY,
    label: "Опоры перед фасадом",
  };
}

export interface NormalizeDetectionOptions {
  lightingType?: LightingType;
  mountTarget?: MountTarget;
  fixture?: Fixture;
}

/**
 * Единая пост-обработка детекции для любого фото (AI или mock).
 * 1) поджать бокс  2) отфильтровать линии  3) собрать линии по профилю светильника
 */
export function normalizeFacadeDetection(
  raw: FacadeDetection,
  options: NormalizeDetectionOptions = {}
): FacadeDetection {
  const { lightingType, mountTarget, fixture } = options;
  const isNearby = mountTarget === "nearby";
  const profile = fixture
    ? getFixturePlacementProfile(fixture, lightingType)
    : null;

  let box = tightenFacadeBox(raw.facadeBox, raw.mountLines);
  let mountLines = raw.mountLines.map((ml) => clampMountLineToBox(ml, box));

  if (isNearby) {
    return {
      ...raw,
      facadeBox: box,
      mountLines: [buildGroundFrontLine(box)],
    };
  }

  const mode = profile?.placementMode;
  const isLinear =
    !isNearby &&
    (mode === "linear_ribbon" ||
      mode === "linear_accent" ||
      (!profile && lightingType === "линейная"));

  if (isLinear) {
    const min = profile?.minBands ?? 4;
    const max = profile?.maxBands ?? 6;
    mountLines = resolveLinearMountLines(box, mountLines, min, max);
    box = tightenFacadeBox(box, mountLines);
    mountLines = mountLines.map((ml) => clampMountLineToBox(ml, box));
  } else if (
    mode === "contour_perimeter" ||
    (!profile && lightingType === "контурная")
  ) {
    mountLines = resolveContourMountLines(box, mountLines);
    box = tightenFacadeBox(box, mountLines);
    mountLines = mountLines.map((ml) => clampMountLineToBox(ml, box));
  } else if (mode === "window_reveal" || (!profile && lightingType === "оконная")) {
    mountLines = resolveWindowMountLines(box, mountLines);
    box = tightenFacadeBox(box, mountLines);
    mountLines = mountLines.map((ml) => clampMountLineToBox(ml, box));
  } else if (
    mode === "flood_wash" ||
    (!profile && lightingType === "заливная" && mountTarget === "facade")
  ) {
    const min = profile?.minBands ?? 2;
    const max = profile?.maxBands ?? 3;
    mountLines = resolveFloodMountLines(box, mountLines, min, max);
    box = tightenFacadeBox(box, mountLines);
    mountLines = mountLines.map((ml) => clampMountLineToBox(ml, box));
  } else if (
    mode === "accent_points" ||
    (!profile && lightingType === "акцентная")
  ) {
    mountLines = resolveAccentMountLines(box, mountLines);
    box = tightenFacadeBox(box, mountLines);
    mountLines = mountLines.map((ml) => clampMountLineToBox(ml, box));
  } else {
    mountLines = mountLines
      .map((ml) => clampMountLineToBox(ml, box))
      .filter((ml) => horizontalSpan(ml) > 0.02 || !isMostlyHorizontal(ml));
  }

  if (mountLines.length === 0 && isLinear) {
    mountLines = evenHorizontalBandsInBox(box, profile?.minBands ?? 5);
  }

  return {
    ...raw,
    facadeBox: box,
    mountLines,
  };
}

/** Все Y линий внутри бокса (для тестов) */
export function mountLinesInsideBox(
  lines: MountLine[],
  box: NormalizedBox,
  marginRatio = 0.02
): boolean {
  const top = box.y + box.height * marginRatio;
  const bottom = box.y + box.height * (1 - marginRatio);
  return lines.every((ml) => {
    const y = lineCenterY(ml);
    return y >= top && y <= bottom;
  });
}
