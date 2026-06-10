import type { LocalRenderReport, PipelineLogEntry } from "@/lib/types";

interface Props {
  title?: string;
  logs?: PipelineLogEntry[];
  renderReport?: LocalRenderReport;
}

export function PipelineDebugPanel({ title = "Журнал пайплайна", logs, renderReport }: Props) {
  if ((!logs || logs.length === 0) && !renderReport) return null;

  return (
    <details className="glass rounded-xl p-4 text-xs" open>
      <summary className="cursor-pointer text-niteos-electric font-medium">
        {title}
        {logs && (
          <span className="text-niteos-muted font-normal ml-2">
            ({logs.length} записей)
          </span>
        )}
      </summary>

      {renderReport && (
        <div className="mt-3 p-3 rounded-lg bg-black/30 border border-niteos-border space-y-1 font-mono text-[11px]">
          <p className="text-white/80 font-sans text-xs font-semibold mb-2">
            Этап 3 — локальный рендер
          </p>
          <p>Фото: {renderReport.imageWidth}×{renderReport.imageHeight} px</p>
          <p>
            PNG файл:{" "}
            {renderReport.fixtureFileExists ? "найден" : "НЕ НАЙДЕН"} —{" "}
            <span className="break-all">{renderReport.fixturePath}</span>
          </p>
          {renderReport.fixtureSourceSize && (
            <p>
              Исходный PNG: {renderReport.fixtureSourceSize.w}×
              {renderReport.fixtureSourceSize.h}
            </p>
          )}
          <p>
            Точек расстановки: {renderReport.placementsTotal} | наложено PNG:{" "}
            <span
              className={
                renderReport.pngComposited > 0
                  ? "text-green-400"
                  : "text-amber-400"
              }
            >
              {renderReport.pngComposited}
            </span>{" "}
            | пропущено: {renderReport.pngSkipped} | маркеры: да
          </p>
          {renderReport.skipReasons.length > 0 && (
            <p className="text-amber-300">
              Пропуски: {renderReport.skipReasons.join("; ")}
            </p>
          )}
          {renderReport.compositeSamples.length > 0 && (
            <pre className="mt-2 whitespace-pre-wrap text-niteos-muted overflow-auto max-h-32">
              {JSON.stringify(renderReport.compositeSamples, null, 2)}
            </pre>
          )}
        </div>
      )}

      {logs && logs.length > 0 && (
        <div className="mt-3 max-h-72 overflow-auto font-mono text-[10px] space-y-1">
          {logs.map((e, i) => (
            <div
              key={`${e.ts}-${i}`}
              className={
                e.level === "error"
                  ? "text-red-300"
                  : e.level === "warn"
                    ? "text-amber-300"
                    : "text-niteos-muted"
              }
            >
              <span className="text-niteos-electric/80">{e.stage}</span>{" "}
              {e.message}
              {e.data && (
                <pre className="whitespace-pre-wrap opacity-80 mt-0.5">
                  {JSON.stringify(e.data, null, 0)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
