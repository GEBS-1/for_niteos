"use client";

interface ConfigPanelProps {
  widthM: string;
  lengthM: string;
  heightM: string;
  onWidthChange: (v: string) => void;
  onLengthChange: (v: string) => void;
  onHeightChange: (v: string) => void;
  onCalculate: () => void;
  loading?: boolean;
  canCalculate: boolean;
  dimensionError?: string | null;
}

export function ConfigPanel({
  widthM,
  lengthM,
  heightM,
  onWidthChange,
  onLengthChange,
  onHeightChange,
  onCalculate,
  loading,
  canCalculate,
  dimensionError,
}: ConfigPanelProps) {
  return (
    <div className="glass rounded-2xl p-6 space-y-5 h-full">
      <div>
        <h2 className="text-lg font-semibold mb-1">Параметры расчёта</h2>
        <p className="text-sm text-niteos-muted">
          Укажите реальные размеры здания в метрах. Обязательно заполните хотя бы одно поле.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-niteos-muted">Ширина фасада, м</label>
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="например, 24"
            value={widthM}
            onChange={(e) => onWidthChange(e.target.value)}
            className="w-full rounded-xl bg-niteos-surface border border-niteos-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-niteos-electric/50"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-niteos-muted">Длина / глубина, м</label>
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="например, 40"
            value={lengthM}
            onChange={(e) => onLengthChange(e.target.value)}
            className="w-full rounded-xl bg-niteos-surface border border-niteos-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-niteos-electric/50"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-niteos-muted">Высота здания, м</label>
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="например, 18"
            value={heightM}
            onChange={(e) => onHeightChange(e.target.value)}
            className="w-full rounded-xl bg-niteos-surface border border-niteos-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-niteos-electric/50"
          />
        </div>
      </div>

      {dimensionError && (
        <p className="text-sm text-orange-400">{dimensionError}</p>
      )}

      <button
        type="button"
        onClick={onCalculate}
        disabled={!canCalculate || loading}
        className="w-full py-4 rounded-xl font-semibold electric-gradient text-niteos-bg shadow-glow disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        {loading ? "Расчёт и визуализация…" : "Рассчитать и показать результат"}
      </button>
    </div>
  );
}
