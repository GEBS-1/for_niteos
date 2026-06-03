import type { CalculationResult } from "@/lib/types";
import { formatRub } from "@/lib/format";
import { LIGHTING_OPTIONS } from "@/lib/catalog";

interface FixtureCardsProps {
  calculation: CalculationResult;
}

export function FixtureCards({ calculation }: FixtureCardsProps) {
  const { fixture, quantity, totalPower, zoneLengthM, lightingType, selectedPrompt } =
    calculation;
  const mountLabel =
    calculation.mountTarget === "facade" ? "Крепление на фасаде" : "Размещение рядом с фасадом";

  const lightingLabel =
    LIGHTING_OPTIONS.find((o) => o.value === lightingType)?.label ?? lightingType;

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-semibold">Итог расчёта</h3>

      {selectedPrompt && (
        <p className="text-sm text-niteos-muted border-l-2 border-niteos-electric pl-3">
          Вариант: <strong className="text-niteos-text">{selectedPrompt.title}</strong> —{" "}
          {selectedPrompt.description}
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl bg-niteos-surface/60 border border-niteos-border">
        <div>
          <p className="text-xs text-niteos-muted">Тип подсветки</p>
          <p className="text-lg font-bold">{lightingLabel}</p>
        </div>
        <div>
          <p className="text-xs text-niteos-muted">Светильник</p>
          <p className="text-lg font-bold text-niteos-electric">{fixture.name}</p>
        </div>
        <div>
          <p className="text-xs text-niteos-muted">Количество</p>
          <p className="text-2xl font-bold text-niteos-electric">{quantity} шт.</p>
        </div>
        <div>
          <p className="text-xs text-niteos-muted">Мощность / зона</p>
          <p className="text-lg font-bold">
            {totalPower} Вт · {zoneLengthM} м
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span>{mountLabel}</span>
        <span>Оборудование: {formatRub(calculation.equipmentPrice)}</span>
        <span>Монтаж: {formatRub(calculation.workPrice)}</span>
        <span className="text-niteos-electric font-semibold">
          Итого: {formatRub(calculation.totalPrice)}
        </span>
      </div>
    </div>
  );
}
