"use client";

import Image from "next/image";
import { CATALOG } from "@/lib/catalog";
import type { UsagePrompt } from "@/lib/types";

interface FixtureCatalogStageProps {
  selectedPromptId: string | null;
  selectedFixtureId: string | null;
  onSelect: (prompt: UsagePrompt, fixtureId: string) => void;
}

export function FixtureCatalogStage({
  selectedPromptId,
  selectedFixtureId,
  onSelect,
}: FixtureCatalogStageProps) {
  const mountLabel = (p: UsagePrompt) =>
    p.mountTarget === "facade" ? "На фасаде" : "Рядом со зданием";

  return (
    <section className="glass rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-1">Каталог светильников</h3>
      <p className="text-sm text-niteos-muted mb-5">
        Выберите светильник и вариант установки. Листайте карточки горизонтально.
      </p>

      <div className="overflow-x-auto pb-3 -mx-1 px-1">
        <div className="flex gap-5 w-max snap-x snap-mandatory">
          {CATALOG.map((fixture) => {
            const fixtureSelected = selectedFixtureId === fixture.id;
            return (
              <article
                key={fixture.id}
                className={`snap-start w-[300px] sm:w-[340px] rounded-[24px] border-2 overflow-hidden bg-[#f4f5f7] text-[#0f1118] transition-all ${
                  fixtureSelected
                    ? "border-[#0059b8] shadow-lg shadow-[#0059b8]/20"
                    : "border-transparent"
                }`}
              >
                <div className="p-5 pb-3">
                  <div className="flex items-start gap-4">
                    <div className="relative w-24 h-24 flex-shrink-0 rounded-xl bg-white border border-gray-200">
                      <Image
                        src={fixture.image}
                        alt={fixture.name}
                        fill
                        className="object-contain p-1"
                        sizes="96px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-[#0059b8] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0059b8]" />
                        В наличии
                      </p>
                      <h4 className="font-bold text-xl leading-tight mt-1 line-clamp-2">
                        {fixture.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {fixture.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5 space-y-2">
                  {fixture.usagePrompts.map((prompt) => {
                    const selected = selectedPromptId === prompt.id;
                    return (
                      <button
                        key={prompt.id}
                        type="button"
                        onClick={() => onSelect(prompt, fixture.id)}
                        className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                          selected
                            ? "border-[#0059b8] bg-[#e8f2ff] ring-2 ring-[#0059b8]/30"
                            : "border-gray-200 bg-white hover:border-[#0059b8]/50"
                        }`}
                      >
                        <span className="font-semibold text-[#101321]">{prompt.title}</span>
                        <span className="block text-xs text-gray-500 mt-0.5">
                          {prompt.description}
                        </span>
                        <span className="block text-[11px] font-medium text-[#0059b8] mt-1">
                          {mountLabel(prompt)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="px-5 pb-4 flex items-center justify-between text-xs text-gray-400 border-t border-gray-200/80 pt-3 mx-5">
                  <span>Подробнее</span>
                  <span className="w-8 h-8 rounded-full bg-[#0f1118] text-white flex items-center justify-center text-sm">
                    →
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {!selectedPromptId && (
        <p className="text-sm text-amber-400/90 mt-3">
          Выберите вариант в карточке светильника, чтобы перейти к расчёту.
        </p>
      )}
    </section>
  );
}
