"use client";

interface BeforeAfterProps {
  beforeUrl: string;
  afterUrl: string | null;
  onGenerate: () => void;
  generating?: boolean;
}

export function BeforeAfter({
  beforeUrl,
  afterUrl,
  onGenerate,
  generating,
}: BeforeAfterProps) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <h3 className="text-lg font-semibold">До / После</h3>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="px-5 py-2.5 rounded-xl border border-niteos-electric text-niteos-electric hover:bg-niteos-electric/10 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {generating ? "Генерация…" : "Сгенерировать визуализацию"}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <figure>
          <figcaption className="text-sm text-niteos-muted mb-2">До</figcaption>
          <div className="rounded-xl overflow-hidden border border-niteos-border aspect-video bg-niteos-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={beforeUrl} alt="Исходное фото" className="w-full h-full object-cover" />
          </div>
        </figure>
        <figure>
          <figcaption className="text-sm text-niteos-muted mb-2">
            После {afterUrl ? "(визуализация подсветки)" : ""}
          </figcaption>
          <div className="rounded-xl overflow-hidden border border-niteos-electric/40 aspect-video bg-niteos-surface relative">
            {afterUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={afterUrl} alt="С подсветкой" className="w-full h-full object-cover" />
                <span className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-niteos-electric/20 text-niteos-electric border border-niteos-electric/40">
                  Каталог NITEOS
                </span>
              </>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[200px] text-niteos-muted text-sm px-4 text-center">
                Нажмите «Сгенерировать визуализацию» — на фасад будут наложены световые точки и линии без изменения здания
              </div>
            )}
          </div>
        </figure>
      </div>
    </div>
  );
}
