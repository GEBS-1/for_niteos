"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { PhotoUpload } from "@/components/PhotoUpload";
import { ConfigPanel } from "@/components/ConfigPanel";
import { FixtureCatalogStage } from "@/components/FixtureCatalogStage";
import { AiProviderPanel } from "@/components/AiProviderPanel";
import type { SelectableAiProvider } from "@/lib/ai/providerTypes";
import { validateDimensions } from "@/lib/calculation";
import { runClientAnalyze } from "@/lib/clientAnalyze";
import { runClientVisualization } from "@/lib/clientVisualize";
import { isStaticHosting, withBasePath } from "@/lib/basePath";
import { ResultsFeedbackForm } from "@/components/ResultsFeedbackForm";
import { captureLeadFromUrl, trackLeadEvent } from "@/lib/leadTracking.client";
import { buildQuantityHint } from "@/lib/fixtureMount";
import { buildStubPricing } from "@/lib/pricingStub";
import type {
  AnalyzeResponse,
  BuildingDimensions,
  CalculationResult,
  UsagePrompt,
} from "@/lib/types";

function parseDim(value: string): number | undefined {
  const n = parseFloat(value.replace(",", "."));
  return n > 0 ? n : undefined;
}

export default function HomePage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageW, setImageW] = useState(0);
  const [imageH, setImageH] = useState(0);

  const [widthM, setWidthM] = useState("");
  const [lengthM, setLengthM] = useState("");
  const [heightM, setHeightM] = useState("");

  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(
    "magistral-v3-ai-70"
  );
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(
    "magistral-facade-175"
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [activeCalculation, setActiveCalculation] = useState<CalculationResult | null>(null);
  const [aiProvider, setAiProvider] = useState<SelectableAiProvider | null>(null);
  const [visualMode, setVisualMode] = useState<string | null>(null);
  const [visualMessage, setVisualMessage] = useState<string | null>(null);
  const [visLoading, setVisLoading] = useState(false);

  useEffect(() => {
    captureLeadFromUrl();
    void trackLeadEvent("visit");
  }, []);

  const dimensions: BuildingDimensions = useMemo(
    () => ({
      widthM: parseDim(widthM),
      lengthM: parseDim(lengthM),
      heightM: parseDim(heightM),
    }),
    [widthM, lengthM, heightM]
  );

  const dimensionError = imageUrl ? validateDimensions(dimensions) : null;
  const canCalculate =
    !!imageUrl && !dimensionError && !!selectedFixtureId && !!selectedPromptId;

  const onFileSelect = useCallback(
    (_file: File, dataUrl: string, width: number, height: number) => {
      setImageUrl(dataUrl);
      setImageW(width);
      setImageH(height);
      setResult(null);
      setAfterUrl(null);
      setActiveCalculation(null);
      setVisualMode(null);
      setVisualMessage(null);
      setError(null);
    },
    []
  );

  const loadSamplePhoto = useCallback(
    async (
      url: string,
      filename: string,
      opts: {
        heightM?: string;
        widthM?: string;
        fixtureId: string;
        promptId: string;
        errorLabel: string;
      }
    ) => {
      try {
        const res = await fetch(withBasePath(url));
        if (!res.ok) throw new Error("not found");
        const blob = await res.blob();
        const file = new File([blob], filename, { type: blob.type });
        const { loadImageFromFile } = await import("@/lib/imageLoad");
        const loaded = await loadImageFromFile(file);
        onFileSelect(loaded.file, loaded.dataUrl, loaded.width, loaded.height);
        if (opts.heightM) setHeightM(opts.heightM);
        if (opts.widthM) setWidthM(opts.widthM);
        setSelectedFixtureId(opts.fixtureId);
        setSelectedPromptId(opts.promptId);
        setResult(null);
        setAfterUrl(null);
        setError(null);
      } catch {
        setError(
          `Не удалось загрузить ${opts.errorLabel}. Положите фото в assets/samples/ и запустите: node scripts/import-demo-samples.mjs`
        );
      }
    },
    [onFileSelect]
  );

  const loadKazanDemo = useCallback(
    () =>
      void loadSamplePhoto("/samples/meriya-kazani.jpg", "meriya-kazani.jpg", {
        heightM: "18",
        fixtureId: "magistral-v3-ai-70",
        promptId: "magistral-facade-175",
        errorLabel: "«Мэрия Казани»",
      }),
    [loadSamplePhoto]
  );

  const loadOfficeDemo = useCallback(
    () =>
      void loadSamplePhoto("/samples/demo-office-day.jpg", "demo-office-day.jpg", {
        heightM: "22",
        fixtureId: "magistral-v3-ai-70",
        promptId: "magistral-facade-175",
        errorLabel: "пример «Офис»",
      }),
    [loadSamplePhoto]
  );

  const loadBrickDemo = useCallback(
    () =>
      void loadSamplePhoto("/samples/demo-brick-day.jpg", "demo-brick-day.jpg", {
        heightM: "8",
        fixtureId: "magistral-v3-ai-70",
        promptId: "magistral-facade-175",
        errorLabel: "пример «Кирпич»",
      }),
    [loadSamplePhoto]
  );

  const onSelectFixture = useCallback((prompt: UsagePrompt, fixtureId: string) => {
    setSelectedPromptId(prompt.id);
    setSelectedFixtureId(fixtureId);
    setResult(null);
    setAfterUrl(null);
    setActiveCalculation(null);
    setVisualMode(null);
    setVisualMessage(null);
  }, []);

  const fetchVisualization = useCallback(
    async (
      sourceImage: string,
      response: AnalyzeResponse,
      promptId: string,
      fixtureId: string,
      dims: BuildingDimensions,
      imgW: number,
      imgH: number
    ) => {
      if (isStaticHosting) {
        const visData = await runClientVisualization(sourceImage, response);
        setAfterUrl(visData.imageDataUrl);
        setVisualMode(visData.mode);
        setVisualMessage(visData.message);
        void trackLeadEvent("result_view", {
          fixtureId: response.activeCalculation.fixture.id,
        });
        return;
      }

      const visRes = await fetch(withBasePath("/api/visualize"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: sourceImage,
          imageWidth: imgW,
          imageHeight: imgH,
          promptId,
          fixtureId,
          dimensions: dims,
          analysis: response.analysis,
          calculation: response.activeCalculation,
          lightingType: response.activeCalculation.lightingType,
          placement: response.placement,
          provider: aiProvider ?? undefined,
        }),
      });

      const visData = await visRes.json();

      if (!visRes.ok) {
        const code = visData.code ? `[${visData.code}] ` : "";
        const hint = visData.hint ? `\n\n${visData.hint}` : "";
        throw new Error(`${code}${visData.error ?? "AI не обработал фото"}${hint}`);
      }

      if (visData.imageDataUrl && visData.mode) {
        setAfterUrl(visData.imageDataUrl);
        setVisualMode(visData.mode);
        setVisualMessage(visData.message ?? "Готово");
        void trackLeadEvent("result_view", {
          fixtureId: response.activeCalculation.fixture.id,
        });
        return;
      }

      throw new Error(visData.error ?? "Не удалось получить изображение");
    },
    [aiProvider]
  );

  const runCalculate = useCallback(async () => {
    if (!canCalculate) return;
    setLoading(true);
    setError(null);

    try {
      let response: AnalyzeResponse;

      if (isStaticHosting) {
        response = runClientAnalyze({
          imageWidth: imageW,
          imageHeight: imageH,
          dimensions,
          imageDataUrl: imageUrl ?? undefined,
          fixtureId: selectedFixtureId!,
          promptId: selectedPromptId!,
        });
      } else {
        const res = await fetch(withBasePath("/api/analyze"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageWidth: imageW,
            imageHeight: imageH,
            dimensions,
            imageDataUrl: imageUrl,
            fixtureId: selectedFixtureId,
            promptId: selectedPromptId,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Ошибка расчёта");
        }
        response = data as AnalyzeResponse;
      }
      setResult(response);
      setActiveCalculation(response.activeCalculation);

      void trackLeadEvent("calculate", {
        fixtureId: response.activeCalculation.fixture.id,
        fixtureName: response.activeCalculation.fixture.name,
        quantity: response.activeCalculation.quantity,
        totalPrice: response.activeCalculation.totalPrice,
      });

      setTimeout(() => {
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      if (imageUrl && selectedPromptId && selectedFixtureId) {
        setVisLoading(true);
        try {
          await fetchVisualization(
            imageUrl,
            response,
            selectedPromptId,
            selectedFixtureId,
            dimensions,
            imageW,
            imageH
          );
        } catch (visErr) {
          setError(
            visErr instanceof Error
              ? visErr.message
              : "Локальная визуализация не выполнена"
          );
        } finally {
          setVisLoading(false);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }, [
    canCalculate,
    imageW,
    imageH,
    dimensions,
    imageUrl,
    selectedFixtureId,
    selectedPromptId,
    fetchVisualization,
  ]);

  const resetProject = () => {
    setResult(null);
    setAfterUrl(null);
    setActiveCalculation(null);
    setVisualMode(null);
    setVisualMessage(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showResults = result && activeCalculation;
  const showQuantity =
    showResults && !visLoading && !!afterUrl && !!activeCalculation;
  const stubPricing = activeCalculation
    ? buildStubPricing(activeCalculation.quantity)
    : null;

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="mb-8 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            Подсветка фасада{" "}
            <span className="text-gradient">по фотографии</span>
          </h2>
          <p className="text-niteos-muted">
            {showResults
              ? "Готовый вариант визуализации"
              : "Загрузите фото, укажите размеры и выберите светильник из каталога"}
          </p>
        </section>

        {!showResults && (
          <>
            <AiProviderPanel
              selected={aiProvider}
              onProviderChange={setAiProvider}
            />
            <div className="grid lg:grid-cols-5 gap-6 mb-6">
              <div className="lg:col-span-3 space-y-3">
                <PhotoUpload previewUrl={imageUrl} onFileSelect={onFileSelect} />
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => void loadOfficeDemo()}
                    className="text-sm py-2.5 rounded-xl border border-niteos-border text-niteos-muted hover:border-niteos-electric hover:text-niteos-electric transition-colors"
                  >
                    Пример: офис
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadBrickDemo()}
                    className="text-sm py-2.5 rounded-xl border border-niteos-border text-niteos-muted hover:border-niteos-electric hover:text-niteos-electric transition-colors"
                  >
                    Пример: кирпич
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadKazanDemo()}
                    className="text-sm py-2.5 rounded-xl border border-niteos-border text-niteos-muted hover:border-niteos-electric hover:text-niteos-electric transition-colors"
                  >
                    Мэрия Казани
                  </button>
                </div>
              </div>
              <div className="lg:col-span-2">
                <ConfigPanel
                  widthM={widthM}
                  lengthM={lengthM}
                  heightM={heightM}
                  onWidthChange={setWidthM}
                  onLengthChange={setLengthM}
                  onHeightChange={setHeightM}
                  dimensionError={dimensionError}
                />
              </div>
            </div>

            <div className="mb-6">
              <FixtureCatalogStage
                selectedFixtureId={selectedFixtureId}
                onSelect={onSelectFixture}
              />
            </div>

            <button
              type="button"
              onClick={() => void runCalculate()}
              disabled={!canCalculate || loading}
              className="w-full py-4 rounded-xl font-semibold electric-gradient text-niteos-bg shadow-glow disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-[1.01] active:scale-[0.99] mb-2"
            >
              {loading || visLoading
                ? "Расчёт и генерация…"
                : "Рассчитать"}
            </button>
          </>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {showResults && (
          <div id="results" className="space-y-6 scroll-mt-8 max-w-3xl mx-auto">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={resetProject}
                className="text-sm px-4 py-2 rounded-xl border border-niteos-border hover:border-niteos-electric text-niteos-muted hover:text-niteos-electric transition-colors"
              >
                Новый расчёт
              </button>
            </div>

            <div className="glass rounded-2xl p-3 overflow-hidden space-y-2">
              {visualMode && (
                <p className="text-xs text-niteos-electric px-1">
                  {visualMode === "openai"
                    ? "OpenAI / RouterAI"
                    : visualMode === "gigachat"
                      ? "GigaChat"
                      : visualMode === "local"
                        ? "Локальная визуализация"
                        : visualMode}
                </p>
              )}
              {visualMessage && (
                <p className="text-xs text-niteos-muted px-1">{visualMessage}</p>
              )}
              {visLoading ? (
                <div className="py-20 text-center text-sm text-niteos-muted">
                  Генерация подсветки (AI)… до 2 мин
                </div>
              ) : afterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={afterUrl}
                  alt="Визуализация подсветки на фасаде"
                  className="w-full max-h-[560px] object-contain rounded-lg"
                />
              ) : (
                <div className="rounded-lg border border-dashed border-niteos-border p-12 text-center text-sm text-niteos-muted">
                  Изображение не сгенерировано
                </div>
              )}
            </div>

            {showQuantity && stubPricing && (
              <div className="glass rounded-2xl px-6 py-5 space-y-4">
                <div className="text-center">
                  <p className="text-niteos-muted text-sm mb-1">Светильник</p>
                  <p className="text-lg font-semibold text-white">
                    {activeCalculation.fixture.name}
                  </p>
                </div>

                <div className="text-center border-t border-niteos-border/50 pt-4">
                  <p className="text-niteos-muted text-sm mb-1">
                    Количество (после визуализации)
                  </p>
                  <p className="text-4xl font-bold text-niteos-electric">
                    {stubPricing.quantity}{" "}
                    <span className="text-xl font-medium text-niteos-muted">шт.</span>
                  </p>
                  <p className="text-xs text-niteos-muted mt-2 max-w-md mx-auto">
                    {buildQuantityHint(activeCalculation)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-niteos-border/50 pt-4 text-center text-sm">
                  <div>
                    <p className="text-niteos-muted mb-1">Цена за шт.</p>
                    <p className="font-semibold text-white">
                      {stubPricing.unitPriceLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-niteos-muted mb-1">Итого оборудование</p>
                    <p className="font-semibold text-niteos-electric">
                      {stubPricing.equipmentTotalLabel}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-center text-niteos-muted">
                  {stubPricing.note}
                </p>
              </div>
            )}

            {showQuantity && activeCalculation && (
              <ResultsFeedbackForm
                context={{
                  fixtureId: activeCalculation.fixture.id,
                  fixtureName: activeCalculation.fixture.name,
                  quantity: activeCalculation.quantity,
                  totalPrice: activeCalculation.totalPrice,
                }}
              />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-niteos-border py-6 text-center text-xs text-niteos-muted">
        © NITEOS · Конфигуратор архитектурной подсветки
      </footer>
    </>
  );
}
