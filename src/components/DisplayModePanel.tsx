"use client";

import type { DisplayOptions, VisualizationScale } from "@/lib/displayOptions";

interface Props {
  options: DisplayOptions;
  onChange: (next: DisplayOptions) => void;
  onApply?: () => void;
  applying?: boolean;
}

export function DisplayModePanel({ options, onChange, onApply, applying }: Props) {
  const setScale = (scale: VisualizationScale) => onChange({ ...options, scale });

  return (
    <div className="glass rounded-xl p-4 space-y-3 text-sm">
      <p className="text-niteos-electric font-medium">Режим отображения</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setScale("realistic")}
          className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
            options.scale === "realistic"
              ? "border-niteos-electric text-niteos-electric bg-niteos-electric/10"
              : "border-niteos-border text-niteos-muted hover:border-niteos-electric/50"
          }`}
        >
          Реалистичный масштаб
        </button>
        <button
          type="button"
          onClick={() => setScale("demo")}
          className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
            options.scale === "demo"
              ? "border-niteos-electric text-niteos-electric bg-niteos-electric/10"
              : "border-niteos-border text-niteos-muted hover:border-niteos-electric/50"
          }`}
        >
          Демо (крупнее корпуса)
        </button>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-niteos-muted">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.showBodies}
            onChange={(e) => onChange({ ...options, showBodies: e.target.checked })}
            className="rounded border-niteos-border"
          />
          Показать корпуса (PNG)
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.showMarkers}
            onChange={(e) => onChange({ ...options, showMarkers: e.target.checked })}
            className="rounded border-niteos-border"
          />
          Точки монтажа
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.showGlow}
            onChange={(e) => onChange({ ...options, showGlow: e.target.checked })}
            className="rounded border-niteos-border"
          />
          Свечение
        </label>
      </div>
      {onApply && (
        <button
          type="button"
          onClick={onApply}
          disabled={applying}
          className="text-xs px-3 py-2 rounded-lg border border-niteos-border hover:border-niteos-electric text-niteos-muted hover:text-niteos-electric disabled:opacity-50"
        >
          {applying ? "Обновление…" : "Применить к визуализации"}
        </button>
      )}
    </div>
  );
}
