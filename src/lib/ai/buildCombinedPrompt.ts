import { CATALOG } from "@/lib/catalog";
import type { BuildingDimensions, FacadeAnalysis, CalculationResult } from "../types";

export interface CombinedPromptInput {
  promptId: string;
  fixtureId?: string;
  dimensions?: BuildingDimensions;
  analysis?: FacadeAnalysis;
  calculation?: CalculationResult;
}

export type PromptTarget = "openai_edit" | "yandex_generate";

export function buildCombinedPrompt(
  input: CombinedPromptInput,
  target: PromptTarget = "openai_edit"
): string {
  const fixture = input.fixtureId
    ? CATALOG.find((f) => f.id === input.fixtureId)
    : undefined;
  const usage =
    fixture?.usagePrompts.find((p) => p.id === input.promptId) ??
    CATALOG.flatMap((f) => f.usagePrompts).find((p) => p.id === input.promptId);

  if (!usage) {
    throw new Error("Вариант светильника не найден в каталоге");
  }

  const calc = input.calculation;
  const analysis = input.analysis;
  const dim = input.dimensions;

  const mountRule =
    usage.mountTarget === "facade"
      ? "Монтаж НА фасаде здания (наружное крепление линейных светильников по архитектурным линиям)."
      : "Монтаж РЯДОМ со зданием: отдельные опоры/фонари в зоне перед фасадом, без крепления к стене.";

  const dimLines: string[] = [];
  if (dim?.widthM) dimLines.push(`ширина фасада ${dim.widthM} м`);
  if (dim?.heightM) dimLines.push(`высота здания ${dim.heightM} м`);
  if (dim?.lengthM) dimLines.push(`длина/глубина ${dim.lengthM} м`);
  if (analysis) {
    dimLines.push(
      `пропорции фасада ~${analysis.facadeWidthM}×${analysis.facadeHeightM} м`
    );
  }

  const qty = calc?.quantity ?? 0;
  const fixtureName = calc?.fixture.name ?? fixture?.name ?? "NITEOS";

  const placementRule =
    usage.lightingType === "линейная"
      ? `Ровно ${qty} линейных светильников «${fixtureName}» вдоль горизонтальных архитектурных поясов (линии этажей), равномерно по ширине фасада.`
      : usage.mountTarget === "nearby"
        ? `${qty} опорных светильников «${fixtureName}» перед фасадом, свет на здание.`
        : `${qty} светильников «${fixtureName}» по зонам фасада.`;

  const taskLine =
    target === "openai_edit"
      ? "ЗАДАЧА: отредактировать загруженное фото здания. Добавить только архитектурную подсветку вечером."
      : "ЗАДАЧА: фотореалистичное изображение административного/общественного здания с архитектурной подсветкой вечером. Классический фасад с колоннами и окнами.";

  return [
    taskLine,
    "",
    "РАЗМЕРЫ:",
    dimLines.length ? dimLines.join("; ") : "пропорции типичного городского фасада",
    "",
    "СВЕТИЛЬНИК NITEOS:",
    `Модель: ${fixtureName}`,
    `Тип: ${usage.title}`,
    mountRule,
    placementRule,
    calc
      ? `Зона подсветки ~${calc.zoneLengthM} м, шаг ${calc.fixture.mountingStepMeters} м.`
      : "",
    "",
    "КАТАЛОГ:",
    usage.prompt,
    "",
    "ТРЕБОВАНИЯ:",
    "- Вечер/сумерки, тёплый белый свет 3000K",
    "- Реалистичные световые линии/пятна от указанного оборудования",
    "- Без схемы, без абстрактных точек, без посторонних фонарей",
    target === "openai_edit"
      ? "- Не менять форму здания, окна, колонны и материалы фасада"
      : "- Детализированный фасад, профессиональная архитектурная съёмка",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Лимит YandexART на текст промпта */
export const YANDEX_PROMPT_MAX_CHARS = 500;
export const YANDEX_PROMPT_SAFE_CHARS = 480;

/**
 * Короткий промпт для YandexART (API: макс. 500 символов).
 */
export function buildYandexPrompt(input: CombinedPromptInput): string {
  const fixture = input.fixtureId
    ? CATALOG.find((f) => f.id === input.fixtureId)
    : undefined;
  const usage =
    fixture?.usagePrompts.find((p) => p.id === input.promptId) ??
    CATALOG.flatMap((f) => f.usagePrompts).find((p) => p.id === input.promptId);

  if (!usage) {
    throw new Error("Вариант светильника не найден в каталоге");
  }

  const calc = input.calculation;
  const dim = input.dimensions;
  const qty = calc?.quantity ?? 0;
  const fixtureName = calc?.fixture.name ?? fixture?.name ?? "NITEOS";

  const dims: string[] = [];
  if (dim?.heightM) dims.push(`высота ${dim.heightM} м`);
  if (dim?.widthM) dims.push(`ширина ${dim.widthM} м`);
  const dimStr = dims.length ? dims.join(", ") : "городской фасад";

  const mount =
    usage.mountTarget === "facade"
      ? "светильники на фасаде"
      : "опоры перед фасадом";

  const catalogHint = usage.prompt
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  const parts = [
    "Фотореализм, вечер, классическое здание, колонны, окна.",
    `Архитектурная подсветка NITEOS: ${fixtureName}, ${qty} шт., ${mount}.`,
    dimStr + ".",
    usage.lightingType === "линейная"
      ? "Горизонтальные линии света по этажам."
      : "Мягкая заливка фасада.",
    catalogHint,
    "Тёплый белый 3000K, без схемы и точек.",
  ];

  let text = parts.filter(Boolean).join(" ");
  if (text.length > YANDEX_PROMPT_SAFE_CHARS) {
    text = text.slice(0, YANDEX_PROMPT_SAFE_CHARS - 1).trimEnd() + "…";
  }
  return text;
}
