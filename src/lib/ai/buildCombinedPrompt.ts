import { CATALOG } from "@/lib/catalog";
import { isParkPoleFixture } from "@/lib/fixtureMount";
import type { BuildingDimensions, FacadeAnalysis, CalculationResult } from "../types";

export interface CombinedPromptInput {
  promptId: string;
  fixtureId?: string;
  dimensions?: BuildingDimensions;
  analysis?: FacadeAnalysis;
  calculation?: CalculationResult;
}

export type PromptTarget = "openai_edit" | "yandex_generate";

/**
 * Короткий промпт только для улучшения света (без каталога, цен, размеров).
 */
export function buildLightOnlyPrompt(): string {
  return [
    "Image edit only.",
    "Preserve the exact original building.",
    "Do not change facade geometry.",
    "Do not change windows.",
    "Do not change roof.",
    "Do not change columns.",
    "Do not change materials.",
    "Do not change perspective.",
    "Do not redesign the building.",
    "Do not add new buildings.",
    "Do not add street lamps.",
    "Do not add people, cars or extra objects.",
    "Do not add fixtures.",
    "Do not remove fixtures.",
    "Do not move fixtures.",
    "Only enhance realistic warm white 3000K architectural light emitted from the already placed luminaires.",
    "Make the scene look like evening or dusk.",
    "Add realistic glow, reflections and soft facade illumination.",
    "Keep the original building recognizable and structurally unchanged.",
  ].join("\n");
}

/** @deprecated Используйте buildLightOnlyPrompt для AI; полный промпт — только для отладки */
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
  const stepM = calc?.fixture.mountingStepMeters ?? 8;
  const parkPole = isParkPoleFixture(fixture);

  const horizontalBands =
    analysis?.facadeDetection?.mountLines?.filter(
      (ml) => Math.abs(ml.x2 - ml.x1) > Math.abs(ml.y2 - ml.y1)
    ).length ?? 0;

  const placementRule = parkPole
    ? `РОВНО ${qty} высоких опор «${fixtureName}» (NT-park STEP, ~1,45 м) на тротуаре ПЕРЕД фасадом в один ряд. Равномерный шаг ${stepM} м. Прямоугольный корпус, светящаяся головка сверху. НЕ низкие болларды и НЕ мини-фонарики.`
    : usage.lightingType === "линейная"
      ? `${qty} модулей «${fixtureName}» на ${horizontalBands || "4–6"} ГОРИЗОНТАЛЬНЫХ поясах по ВСЕЙ высоте фасада. Непрерывная линия тёплого света, без разрывов по окнам.`
      : usage.lightingType === "заливная" && usage.mountTarget === "nearby"
        ? `${qty} светильников «${fixtureName}» у основания здания / на площадке ПЕРЕД фасадом (низкий монтаж, без высоких столбов), шаг ${stepM} м. Заливка фасада и прилегающей зоны.`
        : usage.lightingType === "заливная"
          ? `${qty} прожекторов «${fixtureName}» по схеме — равномерная ЗАЛИВКА поверхности фасада широким пучком. Только корпуса NITEOS на отмеченных точках.`
          : usage.lightingType === "акцентная"
            ? `${qty} светильников «${fixtureName}» ТОЛЬКО в точках акцента на схеме (колонны, ниши, ризалиты). Узкий пучок, без сплошных линейных поясов.`
            : usage.mountTarget === "nearby"
              ? `${qty} опор «${fixtureName}» на тротуаре ПЕРЕД зданием (ноги на земле), шаг ${stepM} м.`
              : `${qty} светильников «${fixtureName}» по зонам фасада.`;

  const taskLine =
    target === "openai_edit"
      ? parkPole
        ? `ЗАДАЧА: отредактировать подготовленное фото. На площадке перед фасадом уже размечены РОВНО ${qty} опор — превратить в реалистичный вечер 3000K. Сохранить число и позиции опор.`
        : "ЗАДАЧА: отредактировать подготовленное фото. На фасаде уже размечены линии монтажа — превратить их в реалистичный вечерний свет 3000K. Линии только НА стене здания, не в небе."
      : parkPole
        ? `ЗАДАЧА: фотореалистичное здание вечером с ${qty} высокими опорами NT-park STEP перед фасадом.`
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
    fixture?.imageApplication
      ? "РЕФЕРЕНС ПРИМЕНЕНИЯ: итоговая картинка как на официальном фото «Применение» NITEOS — тот же характер света, плотность и равномерность."
      : "",
    usage.applicationStyle ?? "",
    "",
    "ТРЕБОВАНИЯ:",
    "- Вечер/сумерки, реалистичная городская атмосфера, тёплый белый 3000K",
    parkPole
      ? `- РОВНО ${qty} высоких опор (~1,45 м) на тротуаре; свет снизу вверх на фасад; шаг ~${stepM} м`
      : usage.lightingType === "линейная"
        ? "- Подсветка ВСЕГО здания: горизонтальные линии от карниза до цоколя; сплошная полоса света (не пятна, не «дым»)"
        : usage.lightingType === "заливная"
          ? "- Равномерная заливка фасада широким пучком; мягкий свет без пересветов; только выбранная серия NITEOS"
          : usage.lightingType === "акцентная"
            ? "- Точечные акценты ТОЛЬКО на архитектурных деталях по схеме; между акцентами фасад темнее"
            : usage.mountTarget === "nearby"
              ? "- Опоры/прожекторы на земле перед фасадом по схеме"
              : "- На фасаде видны корпуса светильников NITEOS",
    usage.lightingType === "линейная"
      ? `- Корпуса «${fixtureName}» видны вдоль линий; свет — ровная лента, чёткий край, мягкая заливка между поясами`
      : "",
    usage.lightingType === "линейная"
      ? "- МОЖНО: включить тёплый свет у УЖЕ СУЩЕСТВУЮЩИХ уличных фонарей на фото (если они есть) — только зажечь, не добавлять новые"
      : "",
    parkPole
      ? "- ЗАПРЕЩЕНО: низкие болларды, мини-фонари, другой тип опор; менять количество опор"
      : "- ЗАПРЕЩЕНО: мелкие точечные прожекторы, V-образные uplight между колоннами, светильники на столбах/балконах, которых нет в схеме",
    parkPole ? "" : "- ЗАПРЕЩЕНО: тонкие LED-нити без корпуса, вертикальные линии, дымчатые облака вместо линейного света",
    parkPole || usage.mountTarget === "nearby"
      ? ""
      : "- ЗАПРЕЩЕНО: добавлять новые уличные фонари (кроме явно выбранных опор NT-park)",
    "- Реалистичная заливка 3000K, профессиональная архитектурная визуализация",
    "- Без схемы, номеров, жёлтых полос, абстрактных точек",
    target === "openai_edit" && parkPole
      ? `- Следовать разметке: на площадке перед фасадом РОВНО ${qty} опор; не удалять и не добавлять`
      : target === "openai_edit"
        ? "- Следовать разметке на фото: каждый горизонтальный пояс → одна непрерывная линия света на карнизе/межэтажье; подсветить ВСЕ пояса сверху донизу"
        : "",
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

  const parkPole = isParkPoleFixture(fixture);
  const mount = parkPole
    ? `высокие опоры NT-park STEP, ровно ${qty} шт.`
    : usage.mountTarget === "facade"
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
