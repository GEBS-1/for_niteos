"use client";

import type { CalculationResult } from "@/lib/types";
import { formatRub } from "@/lib/format";
import { LIGHTING_OPTIONS } from "@/lib/catalog";

interface SpecificationProps {
  calculation: CalculationResult;
  onRequestQuote: () => void;
}

export function Specification({ calculation, onRequestQuote }: SpecificationProps) {
  const lightingLabel =
    LIGHTING_OPTIONS.find((o) => o.value === calculation.lightingType)?.label ??
    calculation.lightingType;

  const rows = [
    { label: "Тип подсветки", value: lightingLabel },
    { label: "Светильник", value: calculation.fixture.name },
    { label: "Количество", value: `${calculation.quantity} шт.` },
    { label: "Мощность", value: `${calculation.totalPower} Вт` },
    { label: "Оборудование", value: formatRub(calculation.equipmentPrice) },
    { label: "Монтажные работы (30%)", value: formatRub(calculation.workPrice) },
  ];

  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4">Предварительная спецификация</h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-niteos-border/50">
              <td className="py-3 text-niteos-muted">{row.label}</td>
              <td className="py-3 text-right font-medium">{row.value}</td>
            </tr>
          ))}
          <tr>
            <td className="pt-4 text-base font-semibold">Итого</td>
            <td className="pt-4 text-right text-xl font-bold text-niteos-electric">
              {formatRub(calculation.totalPrice)}
            </td>
          </tr>
        </tbody>
      </table>
      {calculation.selectedPrompt && (
        <details className="mt-4 text-xs">
          <summary className="text-niteos-muted cursor-pointer">Промпт для AI (будущее)</summary>
          <p className="mt-2 p-3 rounded-lg bg-niteos-surface border border-niteos-border text-niteos-muted">
            {calculation.selectedPrompt.prompt}
          </p>
        </details>
      )}
      <p className="text-xs text-niteos-muted mt-4">
        Расчёт ориентировочный. Точная смета после выезда инженера NITEOS.
      </p>
      <button
        type="button"
        onClick={onRequestQuote}
        className="mt-6 w-full py-4 rounded-xl font-semibold border-2 border-niteos-electric text-niteos-electric hover:bg-niteos-electric hover:text-niteos-bg transition-colors"
      >
        Оставить заявку
      </button>
    </div>
  );
}
