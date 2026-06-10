"use client";

import { withBasePath } from "@/lib/basePath";
import type { CalculationResult, Fixture } from "@/lib/types";

interface Props {
  fixture: Fixture;
  calculation: CalculationResult;
}

export function FixtureProductCard({ fixture, calculation }: Props) {
  const img =
    fixture.image?.startsWith("/")
      ? withBasePath(fixture.image)
      : fixture.image;
  const sideImg = fixture.imageSide
    ? withBasePath(fixture.imageSide)
    : null;

  return (
    <div className="glass rounded-2xl p-4 flex flex-col sm:flex-row gap-4">
      <div className="flex gap-2 shrink-0">
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={fixture.name}
            className="w-28 h-28 object-contain rounded-lg bg-black/30 p-2"
          />
        )}
        {sideImg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sideImg}
            alt={`${fixture.name} — вид сбоку`}
            className="w-28 h-28 object-contain rounded-lg bg-black/30 p-2"
          />
        )}
      </div>
      <div className="text-sm space-y-1 min-w-0">
        <p className="font-semibold text-white">{fixture.name}</p>
        {calculation.selectedPrompt && (
          <p className="text-niteos-muted">{calculation.selectedPrompt.title}</p>
        )}
        <p className="text-niteos-muted text-xs">
          {fixture.lengthMm && <>Длина {fixture.lengthMm} мм</>}
          {fixture.widthMm && <> · Ширина {fixture.widthMm} мм</>}
          {fixture.heightMm && <> · Высота {fixture.heightMm} мм</>}
        </p>
        <p className="text-niteos-electric font-medium pt-1">
          {calculation.quantity} шт. ·{" "}
          {calculation.totalPrice.toLocaleString("ru-RU")} ₽
        </p>
        <p className="text-[11px] text-niteos-muted">
          Предварительная визуализация. Точное размещение — после обмера объекта.
        </p>
      </div>
    </div>
  );
}
