import type { CalculationResult } from "@/lib/types";
import { formatRub } from "@/lib/format";

interface ResultSpecificationTableProps {
  calculation: CalculationResult;
}

export function ResultSpecificationTable({ calculation }: ResultSpecificationTableProps) {
  const { fixture, quantity, equipmentPrice, workPrice, totalPrice } = calculation;
  const lineTotal = quantity * fixture.price;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <h3 className="text-lg font-semibold px-6 pt-6 pb-4">Спецификация</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-niteos-border bg-niteos-surface/80">
              <th className="text-left py-3 px-6 font-medium text-niteos-muted">
                Наименование
              </th>
              <th className="text-right py-3 px-4 font-medium text-niteos-muted w-28">
                Количество
              </th>
              <th className="text-right py-3 px-4 font-medium text-niteos-muted w-36">
                Цена за ед.
              </th>
              <th className="text-right py-3 px-6 font-medium text-niteos-muted w-36">
                Сумма
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-niteos-border/50">
              <td className="py-4 px-6 font-medium">{fixture.name}</td>
              <td className="py-4 px-4 text-right">{quantity} шт.</td>
              <td className="py-4 px-4 text-right">{formatRub(fixture.price)}</td>
              <td className="py-4 px-6 text-right font-medium">{formatRub(lineTotal)}</td>
            </tr>
            <tr className="border-b border-niteos-border/50 text-niteos-muted">
              <td className="py-3 px-6" colSpan={3}>
                Монтажные работы (30%)
              </td>
              <td className="py-3 px-6 text-right">{formatRub(workPrice)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-niteos-electric/5">
              <td className="py-4 px-6 font-semibold text-base" colSpan={3}>
                Итого
              </td>
              <td className="py-4 px-6 text-right text-xl font-bold text-niteos-electric">
                {formatRub(totalPrice)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-niteos-muted px-6 py-4 border-t border-niteos-border/50">
        Оборудование: {formatRub(equipmentPrice)} · Расчёт ориентировочный.
      </p>
    </div>
  );
}
