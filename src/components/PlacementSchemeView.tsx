"use client";

import type { PlacementScheme } from "@/lib/types";

interface Props {
  placement: PlacementScheme;
  className?: string;
}

/** Схема размещения — отдельно от фото, без AI */
export function PlacementSchemeView({ placement, className = "" }: Props) {
  const w = 800;
  const h = 520;
  const box = placement.facadeBox;

  return (
    <div className={`rounded-xl overflow-hidden bg-[#0a1628] border border-niteos-border ${className}`}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label="Схема размещения светильников"
      >
        <rect width={w} height={h} fill="#0d1f35" />
        <rect
          x={box.x * w}
          y={box.y * h}
          width={box.width * w}
          height={box.height * h}
          fill="rgba(30,60,100,0.4)"
          stroke="rgba(100,180,255,0.5)"
          strokeWidth={2}
          rx={4}
        />
        {(placement.mountLines ?? []).map((ml) => (
          <g key={ml.id}>
            <line
              x1={ml.x1 * w}
              y1={ml.y1 * h}
              x2={ml.x2 * w}
              y2={ml.y2 * h}
              stroke="rgba(255,180,80,0.35)"
              strokeWidth={10}
              strokeLinecap="round"
            />
            <line
              x1={ml.x1 * w}
              y1={ml.y1 * h}
              x2={ml.x2 * w}
              y2={ml.y2 * h}
              stroke="rgba(0,255,200,0.55)"
              strokeWidth={2}
              strokeDasharray="8 5"
            />
          </g>
        ))}
        {placement.fixtures.map((fp, i) => {
          const cx = fp.x * w;
          const cy = fp.y * h;
          const rw = Math.max(28, (fp.widthPx ?? 40) * 0.9);
          const rh = Math.max(10, (fp.heightPx ?? 14) * 0.9);
          return (
            <g key={`f-${i}`}>
              <rect
                x={cx - rw / 2}
                y={cy - rh / 2}
                width={rw}
                height={rh}
                fill="rgba(255,200,80,0.35)"
                stroke="#ffc850"
                strokeWidth={2}
                rx={3}
              />
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fontSize={12}
                fill="#fff"
                fontFamily="system-ui,sans-serif"
              >
                {i + 1}
              </text>
            </g>
          );
        })}
        <text x={16} y={24} fill="rgba(255,255,255,0.5)" fontSize={13} fontFamily="system-ui">
          Фасад · {placement.fixtures.length} светильников
        </text>
      </svg>
    </div>
  );
}
