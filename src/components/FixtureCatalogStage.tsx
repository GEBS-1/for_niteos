"use client";

import Image from "next/image";
import { CATALOG } from "@/lib/catalog";
import { withBasePath } from "@/lib/basePath";
import type { UsagePrompt } from "@/lib/types";

/** Первый (основной) вариант применения для каждого светильника */
export const DEFAULT_PROMPT_BY_FIXTURE: Record<string, string> = {
  "magistral-v3-ai-70": "magistral-facade-175",
  "nt-park-step": "nt-park-nearby-zone",
  "nt-slim": "nt-slim-linear-facade",
  "nt-rainbow-24": "rainbow-facade-wash",
  "x-ray": "xray-facade",
  "nt-horizon": "nt-horizon-facade",
  "nt-contour": "nt-contour-building",
  "nt-slim-contour-mini": "nt-slim-mini-contour",
  "nt-uno": "nt-uno-accent",
  "nt-uno-line": "nt-uno-line-accent",
  "nt-liga-window": "nt-liga-window-reveal",
  "nt-lace": "nt-lace-contour",
};

function defaultPromptFor(fixtureId: string) {
  const fixture = CATALOG.find((f) => f.id === fixtureId);
  if (!fixture) return null;
  const pid = DEFAULT_PROMPT_BY_FIXTURE[fixtureId];
  return fixture.usagePrompts.find((p) => p.id === pid) ?? fixture.usagePrompts[0];
}

interface FixtureCatalogStageProps {
  selectedFixtureId: string | null;
  onSelect: (prompt: UsagePrompt, fixtureId: string) => void;
}

export function FixtureCatalogStage({
  selectedFixtureId,
  onSelect,
}: FixtureCatalogStageProps) {
  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <h3 className="text-lg font-semibold mb-1">Каталог светильников</h3>
      <p className="text-sm text-niteos-muted mb-4">
        {CATALOG.length} позиций — листайте и нажмите «Выбрать».
      </p>

      <div className="overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        <div className="flex gap-4 w-max">
          {CATALOG.map((fixture) => {
            const selected = selectedFixtureId === fixture.id;
            const prompt = defaultPromptFor(fixture.id);
            const imageSrc = `${withBasePath(fixture.image)}?v=12`;

            return (
              <article
                key={fixture.id}
                className={`snap-start w-[260px] sm:w-[300px] flex-shrink-0 rounded-2xl border-2 overflow-hidden flex flex-col bg-niteos-surface/60 transition-all ${
                  selected
                    ? "border-niteos-electric shadow-lg shadow-niteos-electric/15"
                    : "border-niteos-border"
                }`}
              >
                <div className="relative h-[200px] sm:h-[220px] bg-[#0a0f18]">
                  <Image
                    src={imageSrc}
                    alt={fixture.name}
                    fill
                    className="object-contain p-3"
                    sizes="300px"
                    unoptimized
                  />
                </div>

                <div className="p-4 flex flex-col flex-1 gap-2">
                  {fixture.series && (
                    <span className="text-[11px] font-medium uppercase tracking-wide text-niteos-electric/90">
                      {fixture.series}
                    </span>
                  )}
                  <h4 className="font-semibold text-sm sm:text-base leading-snug line-clamp-2">
                    {fixture.name}
                  </h4>
                  {fixture.description && (
                    <p className="text-xs text-niteos-muted line-clamp-2 leading-relaxed">
                      {fixture.description}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => prompt && onSelect(prompt, fixture.id)}
                    className={`mt-auto w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      selected
                        ? "bg-niteos-electric/20 text-niteos-electric border border-niteos-electric"
                        : "bg-niteos-bg border border-niteos-border text-white hover:border-niteos-electric hover:text-niteos-electric"
                    }`}
                  >
                    {selected ? "Выбрано" : "Выбрать"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
