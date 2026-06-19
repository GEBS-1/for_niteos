import type { SceneAnalysis, Surface } from "./types";

function surfaceY(s: Surface): number {
  return s.box.y + s.box.height / 2;
}

function mergeSurfaces(primary: Surface[], extra: Surface[]): Surface[] {
  const out = [...primary];
  for (const s of extra) {
    const dup = out.some(
      (o) =>
        o.orientation === s.orientation &&
        Math.abs(surfaceY(o) - surfaceY(s)) < 0.025
    );
    if (!dup) out.push(s);
  }
  return out;
}

/**
 * Vision часто возвращает 2–3 поверхности. Дополняем из facade-detection (пояса, карнизы).
 */
export function enrichSceneAnalysis(
  sparse: SceneAnalysis,
  rich: SceneAnalysis
): SceneAnalysis {
  const sparseHoriz = sparse.surfaces.filter((s) => s.orientation === "horizontal");
  const richHoriz = rich.surfaces.filter((s) => s.orientation === "horizontal");

  let surfaces = sparse.surfaces;
  if (sparseHoriz.length < 4 && richHoriz.length > sparseHoriz.length) {
    surfaces = mergeSurfaces(sparse.surfaces, richHoriz);
  }

  const sparseWindows = sparse.forbiddenZones.filter((z) => z.type === "window");
  const richWindows = rich.forbiddenZones.filter((z) => z.type === "window");
  const forbiddenZones =
    richWindows.length > sparseWindows.length
      ? rich.forbiddenZones
      : sparse.forbiddenZones;

  return {
    ...sparse,
    facadeBox: sparse.facadeBox ?? rich.facadeBox,
    surfaces,
    forbiddenZones,
    notes: [
      ...(sparse.notes ?? []),
      `enriched: +${surfaces.length - sparse.surfaces.length} surfaces`,
    ],
  };
}

export function fallbackHorizontalBelts(facadeBox: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Surface[] {
  const left = facadeBox.x + facadeBox.width * 0.06;
  const right = facadeBox.x + facadeBox.width * 0.94;
  const ratios = [0.14, 0.3, 0.46, 0.62, 0.78];
  return ratios.map((r, i) => {
    const y = facadeBox.y + facadeBox.height * r;
    const thickness = 0.018;
    return {
      id: `fallback-belt-${i}`,
      type: "facade" as const,
      orientation: "horizontal" as const,
      box: {
        x: left,
        y: y - thickness / 2,
        width: right - left,
        height: thickness,
      },
      polygon: [
        { x: left, y: y - thickness / 2 },
        { x: right, y: y - thickness / 2 },
        { x: right, y: y + thickness / 2 },
        { x: left, y: y + thickness / 2 },
      ],
      confidence: 0.5,
      label: "fallback_belt",
    };
  });
}
