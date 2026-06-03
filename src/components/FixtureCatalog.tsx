"use client";

import Image from "next/image";
import { CATALOG, LIGHTING_OPTIONS } from "@/lib/catalog";
import type { CalculationResult, LightingType, UsagePrompt } from "@/lib/types";
import { formatRub } from "@/lib/format";

interface FixtureCatalogProps {
  calculations: Record<LightingType, CalculationResult>;
  activeLightingType: LightingType;
  selectedPromptId: string | null;
  onSelectPrompt: (prompt: UsagePrompt, fixtureId: string) => void;
  onSelectLightingType: (type: LightingType) => void;
}

export function FixtureCatalog({
  calculations,
  activeLightingType,
  selectedPromptId,
  onSelectPrompt,
  onSelectLightingType,
}: FixtureCatalogProps) {
  const mountTargetLabel = (prompt: UsagePrompt) =>
    prompt.mountTarget === "facade" ? "На фасаде" : "Рядом со зданием";

  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Каталог светильников NITEOS</h3>
        <p className="text-sm text-niteos-muted">
          Выберите тип подсветки и карточку светильника. Карточки можно листать
          горизонтально как витрину.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {LIGHTING_OPTIONS.map((opt) => {
          const calc = calculations[opt.value];
          const active = opt.value === activeLightingType;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelectLightingType(opt.value)}
              className={`text-sm px-3 py-2 rounded-xl border transition-all ${
                active
                  ? "border-niteos-electric bg-niteos-electric/10 text-niteos-electric"
                  : "border-niteos-border hover:border-niteos-electric/50"
              }`}
            >
              {opt.label}
              <span className="ml-2 text-xs opacity-70">{formatRub(calc.totalPrice)}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-5 w-max min-w-full snap-x snap-mandatory">
        {CATALOG.map((fixture) => {
          const calc = calculations[activeLightingType];
          const isPrimary = calc.fixture.id === fixture.id;
          return (
            <article
              key={fixture.id}
              className={`snap-start w-[320px] sm:w-[360px] rounded-[28px] border overflow-hidden bg-[#f4f5f7] text-[#0f1118] ${
                isPrimary ? "border-niteos-electric shadow-glow" : "border-white/70"
              }`}
            >
              <div className="flex gap-4 p-6 pb-3">
                <div className="relative w-28 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-white border border-gray-200">
                  <Image
                    src={
                      fixture.image.startsWith("/")
                        ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${fixture.image}`
                        : fixture.image
                    }
                    alt={fixture.name}
                    fill
                    className="object-contain p-2"
                  />
                </div>
                <div className="min-w-0">
                  {isPrimary && (
                    <span className="text-xs text-[#0059b8] font-semibold">Рекомендован</span>
                  )}
                  <h4 className="font-semibold text-[30px] leading-tight tracking-tight line-clamp-2">
                    {fixture.name}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{fixture.description}</p>
                  <p className="text-sm mt-2 text-[#0059b8]">
                    {formatRub(fixture.price)} · {fixture.power} Вт · шаг {fixture.mountingStepMeters} м
                  </p>
                </div>
              </div>

              <div className="px-6 pb-6 space-y-2">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
                  Варианты применения (промпты)
                </p>
                {fixture.usagePrompts.map((prompt) => {
                  const selected = selectedPromptId === prompt.id;
                  return (
                    <button
                      key={prompt.id}
                      type="button"
                      onClick={() => onSelectPrompt(prompt, fixture.id)}
                      className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                        selected
                          ? "border-[#0059b8] bg-[#e8f2ff]"
                          : "border-gray-200 hover:border-[#0059b8]/40 bg-white"
                      }`}
                    >
                      <span className="font-medium block text-[#101321]">{prompt.title}</span>
                      <span className="text-xs text-gray-500">{prompt.description}</span>
                      <span className="mt-1 block text-[11px] font-semibold text-[#0059b8]">
                        {mountTargetLabel(prompt)}
                      </span>
                    </button>
                  );
                })}
                <div className="pt-2 flex items-center justify-between text-gray-500 text-xs">
                  <span>Подробнее</span>
                  <span>→</span>
                </div>
              </div>
            </article>
          );
        })}
        </div>
      </div>
    </div>
  );
}
