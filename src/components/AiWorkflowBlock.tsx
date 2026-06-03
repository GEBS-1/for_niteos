import type { FacadeAnalysis } from "@/lib/types";

interface AiWorkflowBlockProps {
  analysis: FacadeAnalysis;
}

export function AiWorkflowBlock({ analysis }: AiWorkflowBlockProps) {
  return (
    <div className="glass rounded-2xl p-6 border border-amber-500/20">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold">Как сейчас работает «AI»</h3>
        <span className="text-xs px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
          Режим: {analysis.aiMode.toUpperCase()} · API не подключён
        </span>
      </div>

      <p className="text-sm text-niteos-muted mb-4">
        Сейчас фото <strong className="text-niteos-text">не отправляется</strong> во внешний AI-сервис.
        Расчёт и визуализация выполняются локально по вашим размерам и геометрии кадра.
        Для распознавания окон и генерации «фотореалистичного» после понадобится API-ключ (OpenAI Vision, Replicate и т.д.).
      </p>

      <ol className="space-y-3 mb-4">
        {analysis.aiTasks.map((t, i) => (
          <li
            key={t.task}
            className="flex gap-3 text-sm bg-niteos-surface/60 rounded-xl p-3 border border-niteos-border/50"
          >
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-niteos-card border border-niteos-border flex items-center justify-center text-xs text-niteos-electric">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className="font-medium">{t.task}</span>
                <StatusBadge status={t.status} />
              </div>
              <p className="text-niteos-muted text-xs">{t.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="text-xs text-niteos-muted p-3 rounded-lg bg-niteos-surface border border-niteos-border">
        <strong className="text-niteos-electric">Нужен ли API?</strong> Для демо — нет. Для реального
        анализа фасада по пикселям — да: внесите ключ и модель в{" "}
        <code>src/config/ai.config.ts</code>, затем добавьте ключ в{" "}
        <code>.env.local</code>. Текущий MVP этот API автоматически не вызывает.
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "done"
      ? "bg-green-500/15 text-green-400 border-green-500/30"
      : status === "pending_api"
        ? "bg-orange-500/15 text-orange-300 border-orange-500/30"
        : "bg-niteos-electric/10 text-niteos-electric border-niteos-electric/30";

  const label =
    status === "done" ? "готово" : status === "pending_api" ? "нужен API" : "mock";

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${styles}`}>{label}</span>
  );
}
