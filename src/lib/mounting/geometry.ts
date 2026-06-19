import type { NormalizedBox, NormalizedLine } from "./types";

export function lineLengthPx(
  line: NormalizedLine,
  imageWidth: number,
  imageHeight: number
) {
  const x1 = line.x1 * imageWidth;
  const y1 = line.y1 * imageHeight;
  const x2 = line.x2 * imageWidth;
  const y2 = line.y2 * imageHeight;

  return Math.hypot(x2 - x1, y2 - y1);
}

export function lineAngleDeg(line: NormalizedLine) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function isMostlyHorizontal(line: NormalizedLine) {
  return Math.abs(lineAngleDeg(line)) < 12;
}

export function isMostlyVertical(line: NormalizedLine) {
  const angle = Math.abs(lineAngleDeg(line));
  return angle > 78 && angle < 102;
}

export function pointInsideBox(x: number, y: number, box: NormalizedBox) {
  return (
    x >= box.x &&
    x <= box.x + box.width &&
    y >= box.y &&
    y <= box.y + box.height
  );
}

export function boxesIntersect(a: NormalizedBox, b: NormalizedBox) {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export function lineToThinBox(
  line: NormalizedLine,
  thickness = 0.015
): NormalizedBox {
  const minX = Math.min(line.x1, line.x2);
  const maxX = Math.max(line.x1, line.x2);
  const minY = Math.min(line.y1, line.y2);
  const maxY = Math.max(line.y1, line.y2);

  return {
    x: minX,
    y: minY - thickness / 2,
    width: maxX - minX,
    height: Math.max(maxY - minY, thickness),
    type: line.type,
  };
}

export function clampLineToFacade(
  line: NormalizedLine,
  facadeBox: NormalizedBox
): NormalizedLine {
  const minX = facadeBox.x;
  const maxX = facadeBox.x + facadeBox.width;
  const minY = facadeBox.y;
  const maxY = facadeBox.y + facadeBox.height;

  return {
    ...line,
    x1: Math.min(Math.max(line.x1, minX), maxX),
    y1: Math.min(Math.max(line.y1, minY), maxY),
    x2: Math.min(Math.max(line.x2, minX), maxX),
    y2: Math.min(Math.max(line.y2, minY), maxY),
  };
}
