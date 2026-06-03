import type { FacadeAnalysis } from "@/lib/types";
import { formatMeters } from "@/lib/format";

interface AnalysisBlockProps {
  analysis: FacadeAnalysis;
}

export function AnalysisBlock({ analysis }: AnalysisBlockProps) {
  const qualityColor =
    analysis.imageQuality === "good"
      ? "text-green-400"
      : analysis.imageQuality === "acceptable"
        ? "text-yellow-400"
        : "text-orange-400";

  const items = [
    { label: "Обнаружено окон (оценка)", value: String(analysis.windowsDetected) },
    { label: "Углы здания (оценка)", value: String(analysis.cornersDetected) },
    { label: "Ширина фасада", value: formatMeters(analysis.facadeWidthM) },
    { label: "Высота фасада", value: formatMeters(analysis.facadeHeightM) },
    { label: "Длина / глубина", value: formatMeters(analysis.facadeLengthM) },
    { label: "Площадь фасада", value: `${analysis.facadeAreaM2} м²` },
  ];

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-niteos-electric animate-pulse" />
          Анализ фасада
        </h3>
        <span className="text-xs px-2 py-1 rounded bg-niteos-surface border border-niteos-border text-niteos-muted">
          расчётный mock
        </span>
      </div>

      <p className={`text-sm mb-4 ${qualityColor}`}>
        Качество фото:{" "}
        {analysis.imageQuality === "good"
          ? "хорошее"
          : analysis.imageQuality === "acceptable"
            ? "приемлемое"
            : "низкое"}
      </p>
      <ul className="text-xs text-niteos-muted mb-4 space-y-1">
        {analysis.qualityNotes.map((note, i) => (
          <li key={i}>• {note}</li>
        ))}
      </ul>

      <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-niteos-surface/80 rounded-xl px-4 py-3 border border-niteos-border/50"
          >
            <dt className="text-xs text-niteos-muted">{item.label}</dt>
            <dd className="text-lg font-semibold text-niteos-electric">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h4 className="text-sm font-medium text-niteos-muted mb-2">Зоны монтажа</h4>
        <ul className="flex flex-wrap gap-2">
          {analysis.mountingZones.map((zone) => (
            <li
              key={zone}
              className="text-sm px-3 py-1.5 rounded-full bg-niteos-electric/10 border border-niteos-electric/30 text-niteos-electric"
            >
              {zone}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
