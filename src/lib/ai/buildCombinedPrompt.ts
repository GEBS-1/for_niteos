import { CATALOG } from "@/lib/catalog";
import {
  buildFixtureSizePrompt,
  buildLightCharacterPrompt,
  getFixturePlacementProfile,
} from "@/lib/fixturePlacementProfile";
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
    "The building and luminaires are already present on the image.",
    "Do not add new luminaires.",
    "Do not remove luminaires.",
    "Do not move luminaires.",
    "Preserve facade geometry.",
    "Preserve windows.",
    "Preserve roof.",
    "Preserve columns.",
    "Preserve materials.",
    "Preserve perspective.",
    "Do not redesign the building.",
    "Do not add street lamps, people, cars or extra objects.",
    "Only enhance realistic warm white 3000K light emitted from the existing luminaires.",
    "Add realistic glow, reflections and soft facade illumination.",
    "Make the scene look like evening or dusk.",
    "Keep the original building recognizable and structurally unchanged.",
  ].join("\n");
}

function forbiddenRules(
  profile: ReturnType<typeof getFixturePlacementProfile>,
  parkPole: boolean
): string[] {
  if (parkPole) {
    return [
      "- ЗАПРЕЩЕНО: низкие болларды, мини-фонари, другой тип опор; менять количество опор",
    ];
  }
  const rules = [
    "- ЗАПРЕЩЕНО: добавлять новые уличные фонари (кроме явно выбранных опор NT-park)",
  ];
  switch (profile.placementMode) {
    case "flood_wash":
      rules.push(
        "- ЗАПРЕЩЕНО: сплошные горизонтальные LED-полосы, линейные пояса по всему фасаду, тонкие LED-нити без корпуса"
      );
      break;
    case "accent_points":
      rules.push(
        "- ЗАПРЕЩЕНО: сплошные горизонтальные пояса, непрерывные линейные полосы, заливка всего фасада равномерной лентой"
      );
      break;
    case "linear_ribbon":
    case "linear_accent":
      rules.push(
        "- ЗАПРЕЩЕНО: мелкие точечные прожекторы, V-образные uplight между колоннами, тонкие LED-нити без корпуса"
      );
      break;
    case "contour_perimeter":
      rules.push(
        "- ЗАПРЕЩЕНО: горизонтальные пояса по всей ширине фасада (кроме карниза-контура), заливка всей стены прожекторами"
      );
      break;
    case "window_reveal":
      rules.push(
        "- ЗАПРЕЩЕНО: сплошные горизонтальные пояса по этажам, прожекторная заливка всего фасада"
      );
      break;
    default:
      rules.push(
        "- ЗАПРЕЩЕНО: мелкие точечные прожекторы вне схемы, тонкие LED-нити без корпуса"
      );
  }
  return rules;
}

function taskLine(
  target: PromptTarget,
  qty: number,
  profile: ReturnType<typeof getFixturePlacementProfile>,
  parkPole: boolean
): string {
  if (target === "openai_edit") {
    if (parkPole) {
      return `ЗАДАЧА: отредактировать подготовленное фото. На площадке перед фасадом уже размечены РОВНО ${qty} опор — превратить в реалистичный вечер. Сохранить число, позиции и высоту опор.`;
    }
    switch (profile.placementMode) {
      case "linear_ribbon":
      case "linear_accent":
        return "ЗАДАЧА: отредактировать подготовленное фото. На фасаде размечены линии монтажа — превратить их в реалистичный вечерний свет. Линии только НА стене здания, не в небе.";
      case "contour_perimeter":
        return "ЗАДАЧА: отредактировать фото. Контурные линии по карнизу и краям силуэта — реалистичный вечерний контурный свет по разметке.";
      case "flood_wash":
        return `ЗАДАЧА: отредактировать фото. На фасаде размечены РОВНО ${qty} прожектора — широкая мягкая заливка от каждого корпуса. Без сплошных LED-полос.`;
      case "accent_points":
        return `ЗАДАЧА: отредактировать фото. Размечены ${qty} точечных акцента — узкие пучки только в этих местах. Без горизонтальных поясов.`;
      case "window_reveal":
        return "ЗАДАЧА: отредактировать фото. Подсветка оконных проёмов по разметке — мягкий свет в верхней и нижней части каждого окна.";
      default:
        return "ЗАДАЧА: отредактировать подготовленное фото по разметке светильников NITEOS.";
    }
  }
  if (parkPole) {
    return `ЗАДАЧА: фотореалистичное здание вечером с ${qty} высокими опорами NT-park STEP перед фасадом.`;
  }
  return "ЗАДАЧА: фотореалистичное изображение здания с архитектурной подсветкой NITEOS вечером.";
}

function placementRule(
  profile: ReturnType<typeof getFixturePlacementProfile>,
  usage: { lightingType: string; mountTarget: string; title: string },
  qty: number,
  fixtureName: string,
  stepM: number,
  horizontalBands: number,
  parkPole: boolean
): string {
  if (parkPole) {
    const h = 1.45;
    return `РОВНО ${qty} высоких опор «${fixtureName}» (~${h} м от земли) на тротуаре ПЕРЕД фасадом в один ряд. Шаг ${stepM} м. Видимый корпус и светящаяся головка.`;
  }
  switch (profile.placementMode) {
    case "linear_ribbon":
      return `${qty} модулей «${fixtureName}» на ${horizontalBands || "4–6"} горизонтальных поясах по высоте фасада. Непрерывная линия света от видимых корпусов.`;
    case "linear_accent":
      return `${qty} коротких линейных модулей «${fixtureName}» на выбранных карнизах/ярусах (не весь фасад). Видимые корпуса на линиях схемы.`;
    case "contour_perimeter":
      return `${qty} модулей «${fixtureName}» по контуру силуэта: карниз, вертикали углов, цоколь. Непрерывная тонкая линия по краям.`;
    case "flood_wash":
      return `РОВНО ${qty} прожекторов «${fixtureName}» на отмеченных точках — широкий пучок, равномерная заливка фасада. Не больше точек, чем на схеме.`;
    case "accent_points":
      return `РОВНО ${qty} акцентных «${fixtureName}» только в точках схемы (колонны, ниши, вход). Узкий пучок, между акцентами фасад темнее.`;
    case "window_reveal":
      return `${qty} модулей «${fixtureName}» у оконных проёмов — верх и низ каждого окна по схеме.`;
    default:
      return `${qty} светильников «${fixtureName}» по зонам фасада, шаг ${stepM} м.`;
  }
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
  const profile = getFixturePlacementProfile(fixture!, usage.lightingType);
  const tempK = fixture?.lightTemperatureK ?? 3000;

  const mountRule =
    usage.mountTarget === "facade"
      ? "Монтаж НА фасаде здания (крепление по архитектурным линиям схемы)."
      : "Монтаж РЯДОМ со зданием: опоры на тротуаре перед фасадом.";

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

  const sizeLine = fixture ? buildFixtureSizePrompt(fixture) : "";
  const lightCharacter = fixture
    ? buildLightCharacterPrompt(profile, fixture)
    : "";

  const editHint =
    target === "openai_edit" && parkPole
      ? `- Следовать разметке: на площадке РОВНО ${qty} опор; не удалять и не добавлять`
      : target === "openai_edit" && profile.placementMode === "linear_ribbon"
        ? "- Следовать разметке: каждый горизонтальный пояс → одна непрерывная линия света"
        : target === "openai_edit"
          ? "- Следовать разметке на фото: не добавлять и не убирать светильники вне схемы"
          : "";

  return [
    taskLine(target, qty, profile, parkPole),
    "",
    "РАЗМЕРЫ:",
    dimLines.length ? dimLines.join("; ") : "пропорции типичного городского фасада",
    sizeLine ? `Корпус: ${sizeLine}` : "",
    "",
    "СВЕТИЛЬНИК NITEOS:",
    `Модель: ${fixtureName}`,
    `Тип: ${usage.title}`,
    mountRule,
    placementRule(
      profile,
      usage,
      qty,
      fixtureName,
      stepM,
      horizontalBands,
      parkPole
    ),
    lightCharacter,
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
    `- Вечер/сумерки, реалистичная атмосфера, ${tempK}K`,
    `- ${lightCharacter}`,
    profile.placementMode === "linear_ribbon"
      ? "- МОЖНО: зажечь уже существующие уличные фонари на фото (не добавлять новые)"
      : "",
    ...forbiddenRules(profile, parkPole),
    "- Реалистичная профессиональная архитектурная визуализация",
    "- Без схемы, номеров, жёлтых полос, абстрактных точек",
    editHint,
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
  const profile = fixture
    ? getFixturePlacementProfile(fixture, usage.lightingType)
    : null;
  const tempK = fixture?.lightTemperatureK ?? 3000;

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

  const lightHint =
    profile?.placementMode === "accent_points"
      ? "Точечные акценты, без полос."
      : profile?.placementMode === "flood_wash"
        ? "Широкая заливка прожекторами."
        : profile?.placementMode === "contour_perimeter"
          ? "Контур по краям здания."
          : profile?.placementMode === "window_reveal"
            ? "Подсветка окон."
            : "Горизонтальные линии света по этажам.";

  const parts = [
    "Фотореализм, вечер, классическое здание, колонны, окна.",
    `Архитектурная подсветка NITEOS: ${fixtureName}, ${qty} шт., ${mount}.`,
    dimStr + ".",
    lightHint,
    catalogHint,
    `Тёплый белый ${tempK}K, без схемы и точек.`,
  ];

  let text = parts.filter(Boolean).join(" ");
  if (text.length > YANDEX_PROMPT_SAFE_CHARS) {
    text = text.slice(0, YANDEX_PROMPT_SAFE_CHARS - 1).trimEnd() + "…";
  }
  return text;
}
