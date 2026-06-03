"use client";

import { useEffect, useState } from "react";

type AiStatus = {
  activeProvider: "openai" | "yandex" | "gigachat" | null;
  imageProviderSetting: string;
  gigachatEnvFile?: boolean;
  gigachatConfigured?: boolean;
  gigachatModel?: string;
  openAiKeySet: boolean;
  yandexKeySet: boolean;
  yandexFolderSet: boolean;
  allowLocalFallback: boolean;
  pipeline: string;
  gateLlm?: boolean;
  connection?: {
    ok: boolean;
    code?: string;
    message: string;
    hint?: string;
    model?: string;
  };
};

export function AiPipelineNote() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [probing, setProbing] = useState(false);

  const load = (withProbe: boolean) => {
    setProbing(withProbe);
    fetch(withProbe ? "/api/ai-status?probe=1" : "/api/ai-status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => null)
      .finally(() => setProbing(false));
  };

  useEffect(() => {
    load(true);
  }, []);

  if (!status) return null;

  const conn = status.connection;
  const providerLabel =
    status.activeProvider === "gigachat"
      ? `GigaChat (${status.gigachatModel ?? "Lite"})`
      : status.activeProvider === "yandex"
        ? "Yandex Cloud"
        : status.activeProvider === "openai"
          ? status.gateLlm
            ? "GateLLM"
            : "OpenAI"
          : "не выбран";

  return (
    <div className="glass rounded-xl p-4 text-sm border border-niteos-border/80 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="font-medium text-niteos-electric">Провайдер: {providerLabel}</p>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={probing}
          className="text-xs px-2 py-1 rounded-lg border border-niteos-border hover:border-niteos-electric text-niteos-muted disabled:opacity-50"
        >
          {probing ? "Проверка…" : "Проверить снова"}
        </button>
      </div>

      <ul className="text-xs text-niteos-muted space-y-1 list-disc list-inside mb-3">
        <li>Режим: {status.imageProviderSetting}</li>
        {status.gigachatEnvFile && (
          <li>
            Файл .env.gigachat: подключён · модель {status.gigachatModel}
          </li>
        )}
        <li>
          Запасная подсветка на фото:{" "}
          {status.allowLocalFallback ? "включена" : "выключена"}
        </li>
      </ul>

      {conn && (
        <div
          className={`rounded-lg p-3 text-xs ${
            conn.ok
              ? "bg-green-500/10 border border-green-500/30 text-green-300"
              : "bg-amber-500/10 border border-amber-500/30 text-amber-200"
          }`}
        >
          <p className="font-medium">
            {conn.ok ? "✓ " : "✗ "}
            {conn.message}
          </p>
          {conn.hint && <p className="mt-2 opacity-90">{conn.hint}</p>}
        </div>
      )}

      <p className="text-[11px] text-niteos-muted mt-3">{status.pipeline}</p>
    </div>
  );
}
