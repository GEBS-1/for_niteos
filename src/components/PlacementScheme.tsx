"use client";

import type { PlacementScheme as PlacementSchemeType } from "@/lib/types";

interface PlacementSchemeProps {
  imageUrl: string;
  placement: PlacementSchemeType;
  width: number;
  height: number;
}

export function PlacementSchemeView({
  imageUrl,
  placement,
  width,
  height,
}: PlacementSchemeProps) {
  const viewW = 400;
  const scale = viewW / width;
  const viewH = height * scale;

  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4">Схема размещения</h3>
      <div className="relative mx-auto rounded-xl overflow-hidden border border-niteos-border bg-niteos-surface">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={viewW}
          height={viewH}
          className="block"
        >
          <image href={imageUrl} width={width} height={height} opacity={0.35} />
          {placement.lines.map((line, i) => (
            <line
              key={`l-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#00d4ff"
              strokeWidth={3}
              strokeOpacity={0.8}
            />
          ))}
          {placement.points.map((p, i) => (
            <g key={`p-${i}`}>
              <circle cx={p.x} cy={p.y} r={12} fill="rgba(0,212,255,0.3)" />
              <circle cx={p.x} cy={p.y} r={4} fill="#00d4ff" />
            </g>
          ))}
        </svg>
      </div>
      <p className="text-xs text-niteos-muted mt-3 text-center">
        Точки и линии — расчётные позиции светильников из каталога NITEOS
      </p>
    </div>
  );
}
