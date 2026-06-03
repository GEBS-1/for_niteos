"use client";

import { useCallback, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { PhotoUpload } from "@/components/PhotoUpload";
import { ConfigPanel } from "@/components/ConfigPanel";
import { FixtureCatalogStage } from "@/components/FixtureCatalogStage";
import { ResultSpecificationTable } from "@/components/ResultSpecificationTable";
import { AiPipelineNote } from "@/components/AiPipelineNote";
import { validateDimensions } from "@/lib/calculation";
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

  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [activeCalculation, setActiveCalculation] = useState<CalculationResult | null>(null);
  const [visualMode, setVisualMode] = useState<
    | "openai"
    | "yandex"
    | "yandex_photo"
    | "gigachat"
    | "gigachat_photo"
    | "local_fallback"
    | null
  >(null);
  const [visualMessage, setVisualMessage] = useState<string | null>(null);
  const [combinedPrompt, setCombinedPrompt] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoMessage, setVideoMessage] = useState<string | null>(null);

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

  const loadKazanDemo = useCallback(async () => {
    try {
      const res = await fetch("/samples/meriya-kazani.jpg");
      const blob = await res.blob();
      const file = new File([blob], "meriya-kazani.jpg", { type: blob.type });
      const { loadImageFromFile } = await import("@/lib/imageLoad");
      const loaded = await loadImageFromFile(file);
      onFileSelect(loaded.file, loaded.dataUrl, loaded.width, loaded.height);
      setHeightM("18");
      setSelectedFixtureId("magistral-v3");
      setSelectedPromptId("magistral-facade-175");
      setResult(null);
      setAfterUrl(null);
    } catch {
      setError("Не удалось загрузить пример «Мэрия Казани»");
    }
  }, [onFileSelect]);

  const onSelectFixture = useCallback((prompt: UsagePrompt, fixtureId: string) => {
    setSelectedPromptId(prompt.id);
    setSelectedFixtureId(fixtureId);
    setResult(null);
    setAfterUrl(null);
    setActiveCalculation(null);
    setVisualMode(null);
    setVisualMessage(null);
    setVideoMessage(null);
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
      const visRes = await fetch("/api/visualize", {
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
        }),
      });

      const visData = await visRes.json();

      if (visData.combinedPrompt) {
        setCombinedPrompt(visData.combinedPrompt);
      }

      if (!visRes.ok) {
        const code = visData.code ? `[${visData.code}] ` : "";
        const hint = visData.hint ? `\n\n${visData.hint}` : "";
        throw new Error(`${code}${visData.error ?? "OpenAI не обработал фото"}${hint}`);
      }

      if (visData.imageDataUrl && visData.mode) {
        setAfterUrl(visData.imageDataUrl);
        setVisualMode(visData.mode);
        setVisualMessage(visData.message ?? "Готово");
        return;
      }

      throw new Error(visData.error ?? "Не удалось получить изображение");
    },
    []
  );

  const runCalculate = useCallback(async () => {
    if (!canCalculate) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageWidth: imageW,
          imageHeight: imageH,
          dimensions,
          fixtureId: selectedFixtureId,
          promptId: selectedPromptId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Ошибка расчёта");
      }

      const response = data as AnalyzeResponse;
      setResult(response);
      setActiveCalculation(response.activeCalculation);

      setTimeout(() => {
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      if (imageUrl && selectedPromptId && selectedFixtureId) {
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
              : "Визуализация OpenAI не выполнена"
          );
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

  const runGenerateVideo = useCallback(async () => {
    if (!imageUrl || !selectedPromptId) return;
    setVideoLoading(true);
    setVideoMessage(null);
    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: imageUrl,
          promptId: selectedPromptId,
          fixtureId: selectedFixtureId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Ошибка видео");
      }
      setVideoMessage(data.message ?? "Запрос отправлен");
    } catch (e) {
      setVideoMessage(e instanceof Error ? e.message : "Ошибка видео");
    } finally {
      setVideoLoading(false);
    }
  }, [imageUrl, selectedPromptId, selectedFixtureId]);

  const resetProject = () => {
    setResult(null);
    setAfterUrl(null);
    setActiveCalculation(null);
    setVisualMode(null);
    setVisualMessage(null);
    setCombinedPrompt(null);
    setVideoMessage(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showResults = result && activeCalculation;

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
              ? "Готовый вариант визуализации и спецификация"
              : "Загрузите фото, укажите размеры и выберите светильник из каталога"}
          </p>
        </section>

        {!showResults && (
          <>
            <AiPipelineNote />
            <div className="grid lg:grid-cols-5 gap-6 mb-6">
              <div className="lg:col-span-3 space-y-3">
                <PhotoUpload previewUrl={imageUrl} onFileSelect={onFileSelect} />
                <button
                  type="button"
                  onClick={() => void loadKazanDemo()}
                  className="w-full text-sm py-2.5 rounded-xl border border-niteos-border text-niteos-muted hover:border-niteos-electric hover:text-niteos-electric transition-colors"
                >
                  Загрузить пример: Мэрия Казани (18 м, МАГИСТРАЛЬ)
                </button>
              </div>
              <div className="lg:col-span-2">
                <ConfigPanel
                  widthM={widthM}
                  lengthM={lengthM}
                  heightM={heightM}
                  onWidthChange={setWidthM}
                  onLengthChange={setLengthM}
                  onHeightChange={setHeightM}
                  onCalculate={runCalculate}
                  loading={loading}
                  canCalculate={canCalculate}
                  dimensionError={dimensionError}
                />
              </div>
            </div>

            <FixtureCatalogStage
              selectedPromptId={selectedPromptId}
              selectedFixtureId={selectedFixtureId}
              onSelect={onSelectFixture}
            />
          </>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {showResults && (
          <div id="results" className="space-y-6 scroll-mt-8 max-w-4xl mx-auto">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={resetProject}
                className="text-sm px-4 py-2 rounded-xl border border-niteos-border hover:border-niteos-electric text-niteos-muted hover:text-niteos-electric transition-colors"
              >
                Новый расчёт
              </button>
            </div>

            <div className="glass rounded-2xl p-4 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm text-niteos-muted">Визуализация с подсветкой</p>
                {visualMode && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full border ${
                      visualMode === "openai" ||
                      visualMode === "yandex" ||
                      visualMode === "gigachat"
                        ? "border-green-500/40 text-green-400 bg-green-500/10"
                        : visualMode === "yandex_photo" ||
                            visualMode === "gigachat_photo"
                          ? "border-niteos-electric/40 text-niteos-electric bg-niteos-electric/10"
                          : "border-amber-500/40 text-amber-300 bg-amber-500/10"
                    }`}
                  >
                    {visualMode === "openai"
                      ? "OpenAI"
                      : visualMode === "gigachat"
                        ? "GigaChat"
                        : visualMode === "yandex"
                          ? "YandexART"
                          : visualMode === "yandex_photo" ||
                              visualMode === "gigachat_photo"
                            ? "Ваше фото + подсветка"
                            : "Запасная схема"}
                  </span>
                )}
              </div>
              {visualMessage && (
                <p
                  className={`text-xs mb-3 ${
                    visualMode === "local_fallback" ||
                    visualMode === "yandex_photo" ||
                    visualMode === "gigachat_photo"
                      ? "text-amber-300"
                      : "text-niteos-muted"
                  }`}
                >
                  {visualMessage}
                </p>
              )}
              {afterUrl ? (
                <div className="rounded-xl overflow-hidden bg-niteos-surface flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={afterUrl}
                    alt="Фасад с подсветкой NITEOS"
                    className="w-full max-h-[560px] object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-niteos-border p-8 text-center text-niteos-muted text-sm">
                  Изображение не сгенерировано. Смотрите красное сообщение выше и блок
                  «Подключение OpenAI» — там точная причина (прокси, баланс, ключ).
                </div>
              )}
            </div>

            {combinedPrompt && (
              <details className="glass rounded-xl p-4 text-xs">
                <summary className="cursor-pointer text-niteos-muted">
                  Объединённый промпт для OpenAI
                </summary>
                <pre className="mt-3 whitespace-pre-wrap text-niteos-muted font-mono text-[11px]">
                  {combinedPrompt}
                </pre>
              </details>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void runGenerateVideo()}
                disabled={videoLoading}
                className="px-4 py-2 rounded-xl border border-niteos-electric text-niteos-electric hover:bg-niteos-electric/10 disabled:opacity-50 text-sm"
              >
                {videoLoading ? "Запуск видео…" : "Сгенерировать видео (Sora)"}
              </button>
            </div>
            {videoMessage && (
              <p className="text-sm text-niteos-muted -mt-3">{videoMessage}</p>
            )}

            <ResultSpecificationTable calculation={activeCalculation} />
          </div>
        )}
      </main>

      <footer className="border-t border-niteos-border py-6 text-center text-xs text-niteos-muted">
        © NITEOS · Конфигуратор архитектурной подсветки
      </footer>
    </>
  );
}
