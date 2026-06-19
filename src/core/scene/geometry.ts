import type { Box, Point } from "./types";

export function boxFromPoints(points: Point[]): Box {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function boxToPolygon(box: Box): Point[] {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
}

export function pointInBox(x: number, y: number, box: Box): boolean {
  return (
    x >= box.x &&
    x <= box.x + box.width &&
    y >= box.y &&
    y <= box.y + box.height
  );
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function lineToThinSurfaceBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness = 0.018
): Box {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  if (horizontal) {
    const y = (y1 + y2) / 2;
    return {
      x: minX,
      y: y - thickness / 2,
      width: maxX - minX,
      height: thickness,
    };
  }
  const x = (x1 + x2) / 2;
  return {
    x: x - thickness / 2,
    y: minY,
    width: thickness,
    height: maxY - minY,
  };
}
