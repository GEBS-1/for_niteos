import { NextRequest, NextResponse } from "next/server";

import {

  isAiConfigured,

  shouldAllowLocalFallback,

  shouldUseLocalRenderer,

} from "@/config/ai.config";

import { buildCombinedPrompt } from "@/lib/ai/buildCombinedPrompt";

import type { CombinedPromptInput } from "@/lib/ai/buildCombinedPrompt";

import {

  generateVisualization,

  parseVisualizationError,

} from "@/lib/ai/visualizeImage";

import { OpenAiImageError } from "@/lib/ai/openaiVisualize";

import { YandexArtError } from "@/lib/ai/yandexArt";

import {

  dataUrlToBuffer,

  renderLocalVisualization,

} from "@/lib/visualizeLocal";

import { CATALOG } from "@/lib/catalog";

import type {

  BuildingDimensions,

  CalculationResult,

  FacadeAnalysis,

  LightingType,

  MountTarget,

  PlacementScheme,

} from "@/lib/types";



export const maxDuration = 300;



interface VisualizeBody extends CombinedPromptInput {

  imageDataUrl: string;

  imageWidth?: number;

  imageHeight?: number;

  lightingType?: LightingType;

  placement?: PlacementScheme;

  analysis?: FacadeAnalysis;

  calculation?: CalculationResult;

  dimensions?: BuildingDimensions;

}



function resolveMountTarget(

  promptId: string,

  fixtureId?: string

): MountTarget {

  const fixture = fixtureId

    ? CATALOG.find((f) => f.id === fixtureId)

    : undefined;

  const prompt =

    fixture?.usagePrompts.find((p) => p.id === promptId) ??

    CATALOG.flatMap((f) => f.usagePrompts).find((p) => p.id === promptId);

  return prompt?.mountTarget ?? "facade";

}



export async function POST(request: NextRequest) {

  try {

    const body = (await request.json()) as VisualizeBody;



    if (!body.imageDataUrl || !body.promptId) {

      return NextResponse.json(

        { error: "Нужны фото и выбранный светильник" },

        { status: 400 }

      );

    }



    if (!isAiConfigured()) {

      return NextResponse.json(

        {

          error: "Не настроен AI-провайдер",

          code: "no_provider",

          hint:

            "Настройте .env.gigachat, или YANDEX_API_KEY, или OPENAI_API_KEY в .env.local",

        },

        { status: 400 }

      );

    }



    const promptInput: CombinedPromptInput = {

      promptId: body.promptId,

      fixtureId: body.fixtureId,

      dimensions: body.dimensions,

      analysis: body.analysis,

      calculation: body.calculation,

    };



    const combinedPrompt = buildCombinedPrompt(promptInput, "openai_edit");



    if (shouldUseLocalRenderer()) {

      if (!shouldAllowLocalFallback()) {

        return NextResponse.json(

          {

            error: "Включён режим только локального рендера (USE_LOCAL_RENDERER_ONLY).",

            code: "local_only",

            combinedPrompt,

          },

          { status: 400 }

        );

      }

    } else {

      try {

        const buffer = dataUrlToBuffer(body.imageDataUrl);

        const placement = body.placement ?? {

          points: [],

          lines: [],

          zoneLabels: [],

        };

        const lightingType = body.lightingType ?? "линейная";

        const mountTarget = resolveMountTarget(body.promptId, body.fixtureId);



        const result = await generateVisualization({

          imageDataUrl: body.imageDataUrl,

          imageBuffer: buffer,

          input: promptInput,

          placement,

          lightingType,

          mountTarget,

          imageWidth: body.imageWidth,

          imageHeight: body.imageHeight,

        });



        return NextResponse.json({

          mode: result.mode,

          provider: result.provider,

          imageDataUrl: result.imageDataUrl,

          combinedPrompt: result.promptUsed,

          message: result.userMessage,

        });

      } catch (aiError) {

        const parsed = parseVisualizationError(aiError);

        console.error("Visualization failed:", aiError);



        if (!shouldAllowLocalFallback()) {

          return NextResponse.json(

            {

              error: parsed.message,

              code: parsed.code,

              hint: parsed.hint,

              combinedPrompt,

              attempts:

                aiError instanceof OpenAiImageError

                  ? aiError.attempts.map((a) => a.code)

                  : undefined,

            },

            { status: 502 }

          );

        }



        console.warn("ALLOW_LOCAL_FALLBACK=true, using local renderer");

      }

    }



    const placement = body.placement ?? { points: [], lines: [], zoneLabels: [] };

    const lightingType = body.lightingType ?? "линейная";

    const mountTarget = resolveMountTarget(body.promptId, body.fixtureId);

    const buffer = dataUrlToBuffer(body.imageDataUrl);

    const imageDataUrl = await renderLocalVisualization(

      buffer,

      placement,

      lightingType,

      mountTarget

    );



    return NextResponse.json({

      mode: "local_fallback" as const,

      imageDataUrl,

      combinedPrompt,

      message: "Запасной режим: схема подсветки на фото.",

    });

  } catch (e) {

    console.error("visualize error:", e);

    return NextResponse.json(

      { error: e instanceof Error ? e.message : "Ошибка визуализации" },

      { status: 500 }

    );

  }

}


