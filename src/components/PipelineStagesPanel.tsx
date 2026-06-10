import type { PipelineStages } from "@/lib/types";

interface Props {
  pipeline: PipelineStages;
}

const ANCHOR_LABEL: Record<PipelineStages["scale"]["anchor"], string> = {
  width: "ширина",
  height: "высота",
  length: "длина",
};

export function PipelineStagesPanel({ pipeline }: Props) {
  const { detection, detectionSource, scale, placementCount } = pipeline;

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-niteos-electric">
        Пайплайн расчёта (4 этапа)
      </h3>
      <ol className="space-y-2 text-xs text-niteos-muted">
        <li className="flex gap-2">
          <span className="text-niteos-electric font-mono shrink-0">1</span>
          <span>
            <strong className="text-white/90">Детекция фасада</strong>
            {" — "}
            {detectionSource === "ai" ? "Vision API" : "геометрическая модель"}
            ; линий монтажа: {detection.mountLines.length}
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-niteos-electric font-mono shrink-0">2</span>
          <span>
            <strong className="text-white/90">Масштаб</strong>
            {" — "}
            {scale.pixelsPerMeter.toFixed(1)} px/м по{" "}
            {ANCHOR_LABEL[scale.anchor]} ({scale.userMeters} м)
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-niteos-electric font-mono shrink-0">3</span>
          <span>
            <strong className="text-white/90">Расстановка</strong>
            {" — "}
            {placementCount} светильников (PNG + свечение)
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-niteos-electric font-mono shrink-0">4</span>
          <span>
            <strong className="text-white/90">AI-свет</strong>
            {" — "}
            только улучшение свечения, здание не перерисовывается
          </span>
        </li>
      </ol>
    </div>
  );
}
