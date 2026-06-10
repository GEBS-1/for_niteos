import { NextRequest, NextResponse } from "next/server";

import { CATALOG } from "@/lib/catalog";

import {

  parseVisualizationError,

  runVisualizationPipeline,

} from "@/lib/ai/visualizeImage";

import { PipelineLogger } from "@/lib/pipelineLog";

import { dataUrlToBuffer } from "@/lib/visualizeLocal";

import type {

  BuildingDimensions,

  CalculationResult,

  FacadeAnalysis,

  PlacementScheme,

} from "@/lib/types";



export const maxDuration = 300;



interface VisualizeBody {

  imageDataUrl: string;

  imageWidth?: number;

  imageHeight?: number;

  promptId: string;

  fixtureId?: string;

  dimensions?: BuildingDimensions;

  analysis?: FacadeAnalysis;

  calculation?: CalculationResult;

  placement?: PlacementScheme;

  provider?: "openai" | "gigachat";

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



    if (!body.calculation || !body.placement) {

      return NextResponse.json(

        {

          error: "Сначала выполните расчёт (/api/analyze)",

          code: "no_calculation",

        },

        { status: 400 }

      );

    }



    const fixture =

      body.calculation.fixture ??

      CATALOG.find((f) => f.id === body.fixtureId);

    if (!fixture) {

      return NextResponse.json(

        { error: "Товар не найден в каталоге" },

        { status: 400 }

      );

    }



    const buffer = dataUrlToBuffer(body.imageDataUrl);

    const logger = new PipelineLogger();

    logger.log("api", "POST /api/visualize", {

      fixtureId: fixture.id,

      placementCount: body.placement.fixtures?.length ?? 0,

      provider: body.provider,

    });



    const result = await runVisualizationPipeline({

      imageDataUrl: body.imageDataUrl,

      imageBuffer: buffer,

      placement: body.placement,

      fixture,

      specification: body.calculation,

      promptId: body.promptId,

      dimensions: body.dimensions,

      analysis: body.analysis,

      provider: body.provider ?? null,

      logger,

    });



    const primaryImage =

      result.aiVisualization ?? result.localVisualization;



    return NextResponse.json({

      ...result,

      imageDataUrl: primaryImage,

      combinedPrompt: result.lightPrompt,

      mode: result.mode,

      message: result.message,

      localRenderReport: result.localRenderReport,

      pipelineLog: result.pipelineLog,

    });

  } catch (e) {

    console.error("visualize error:", e);

    const parsed = parseVisualizationError(e);

    return NextResponse.json(

      {

        error: parsed.message,

        code: parsed.code,

        hint: parsed.hint,

      },

      { status: 502 }

    );

  }

}

