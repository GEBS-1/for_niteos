"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AI_PROVIDER_STORAGE_KEY,
  isSelectableAiProvider,
  type SelectableAiProvider,
} from "@/lib/ai/providerTypes";
import { isStaticHosting, withBasePath } from "@/lib/basePath";

type ProviderInfo = {
  configured: boolean;
  label: string;
  gateLlm?: boolean;
  openAiProxy?: string;
  baseUrl?: string;
  imageModel?: string;
  model?: string;
  modelApi?: string;
};

type AiStatusResponse = {
  selectable: SelectableAiProvider[];
  defaultProvider: SelectableAiProvider | null;
  providers: {
    openai: ProviderInfo;
    gigachat: ProviderInfo;
  };
  allowLocalFallback: boolean;
  connections?: Record<
    string,
    { ok: boolean; message: string; hint?: string; model?: string }
  >;
  connection?: { ok: boolean; message: string; hint?: string };
};

export interface AiProviderPanelProps {
  selected: SelectableAiProvider | null;
  onProviderChange: (provider: SelectableAiProvider) => void;
}

function StaticHostingNote() {
  return (
    <div className="glass rounded-xl p-4 text-sm border border-niteos-border/80 mb-6">
      <p className="font-medium text-niteos-electric mb-2">Режим GitHub Pages</p>
      <p className="text-xs text-niteos-muted">
        AI-переключатель доступен при <code className="text-niteos-electric">npm run dev</code>
      </p>
    </div>
  );
}

export function AiProviderPanel({ selected, onProviderChange }: AiProviderPanelProps) {
  const [status, setStatus] = useState<AiStatusResponse | null>(null);
  const [probing, setProbing] = useState(false);

  const loadStatus = useCallback((provider?: SelectableAiProvider) => {
    setProbing(true);
    const params = new URLSearchParams({ probe: "1" });
    if (provider) params.set("provider", provider);
    fetch(withBasePath(`/api/ai-status?${params}`))
      .then((r) => r.json())
      .then((data: AiStatusResponse) => {
        setStatus(data);
        if (!selected && data.defaultProvider) {
          onProviderChange(data.defaultProvider);
        }
      })
      .catch(() => null)
      .finally(() => setProbing(false));
  }, [selected, onProviderChange]);

  useEffect(() => {
    if (isStaticHosting) return;
    const saved = localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
    const initial =
      saved && isSelectableAiProvider(saved) ? saved : undefined;
    fetch(withBasePath(`/api/ai-status?probe=1${initial ? `&provider=${initial}` : ""}`))
      .then((r) => r.json())
      .then((data: AiStatusResponse) => {
        setStatus(data);
        const pick =
          initial && data.providers[initial]?.configured
            ? initial
            : data.defaultProvider;
        if (pick) onProviderChange(pick);
      })
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => {
    if (isStaticHosting || !selected) return;
    loadStatus(selected);
  }, [selected, loadStatus]);

  const pickProvider = (p: SelectableAiProvider) => {
    if (!status?.providers[p]?.configured) return;
    localStorage.setItem(AI_PROVIDER_STORAGE_KEY, p);
    onProviderChange(p);
    loadStatus(p);
  };

  if (isStaticHosting) return <StaticHostingNote />;
  if (!status) return null;

  const { providers, selectable } = status;
  const conn =
    selected && status.connections?.[selected]
      ? status.connections[selected]
      : status.connection;

  const cards: Array<{
    id: SelectableAiProvider;
    title: string;
    subtitle: string;
    configured: boolean;
  }> = [
    {
      id: "openai",
      title: providers.openai.label,
      subtitle:
        providers.openai.gateLlm ||
        (providers.openai.openAiProxy &&
          providers.openai.openAiProxy !== "direct")
          ? providers.openai.baseUrl ?? providers.openai.label
          : "OpenAI API",
      configured: providers.openai.configured,
    },
    {
      id: "gigachat",
      title: providers.gigachat.label,
      subtitle: providers.gigachat.model
        ? `Модель: ${providers.gigachat.model}`
        : "Сбер GigaChat",
      configured: providers.gigachat.configured,
    },
  ];

  return (
    <div className="glass rounded-xl p-4 text-sm border border-niteos-border/80 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="font-medium text-niteos-electric">AI для улучшения света</p>
        <button
          type="button"
          onClick={() => loadStatus(selected ?? undefined)}
          disabled={probing}
          className="text-xs px-2 py-1 rounded-lg border border-niteos-border hover:border-niteos-electric text-niteos-muted disabled:opacity-50"
        >
          {probing ? "Проверка…" : "Проверить"}
        </button>
      </div>

      <p className="text-xs text-niteos-muted mb-3">
        Сначала локальная расстановка светильников, затем выбранный AI только
        усиливает свет. Оба ключа могут быть активны — переключите провайдер:
      </p>

      <div className="grid sm:grid-cols-2 gap-2 mb-3">
        {cards.map((card) => {
          const active = selected === card.id;
          const disabled = !card.configured;
          return (
            <button
              key={card.id}
              type="button"
              disabled={disabled}
              onClick={() => pickProvider(card.id)}
              className={`text-left p-3 rounded-xl border transition-colors ${
                disabled
                  ? "opacity-40 cursor-not-allowed border-niteos-border/50"
                  : active
                    ? "border-niteos-electric bg-niteos-electric/10"
                    : "border-niteos-border hover:border-niteos-electric/60"
              }`}
            >
              <p className="font-medium text-sm">{card.title}</p>
              <p className="text-[11px] text-niteos-muted mt-1 truncate">
                {disabled ? "Ключ не настроен" : card.subtitle}
              </p>
              {active && (
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-niteos-electric/20 text-niteos-electric">
                  Выбран
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectable.length === 0 && (
        <p className="text-xs text-amber-300">
          Нет настроенных ключей. Добавьте OPENAI_API_KEY в .env.local и/или
          .env.gigachat.
        </p>
      )}

      {conn && selected && (
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

      <p className="text-[11px] text-niteos-muted mt-2">
        Запасная подсветка без AI:{" "}
        {status.allowLocalFallback ? "включена" : "выключена"}
      </p>
    </div>
  );
}
