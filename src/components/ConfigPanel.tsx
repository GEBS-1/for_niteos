"use client";



interface ConfigPanelProps {

  widthM: string;

  lengthM: string;

  heightM: string;

  onWidthChange: (v: string) => void;

  onLengthChange: (v: string) => void;

  onHeightChange: (v: string) => void;

  dimensionError?: string | null;

}



export function ConfigPanel({

  widthM,

  lengthM,

  heightM,

  onWidthChange,

  onLengthChange,

  onHeightChange,

  dimensionError,

}: ConfigPanelProps) {

  return (

    <div className="glass rounded-2xl p-6 space-y-4 h-full">

      <div>

        <h2 className="text-lg font-semibold mb-1">Размеры здания</h2>

        <p className="text-sm text-niteos-muted">

          Укажите хотя бы один размер в метрах.

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

    </div>

  );

}

