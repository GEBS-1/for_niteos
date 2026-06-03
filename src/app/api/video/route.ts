import { NextRequest, NextResponse } from "next/server";
import { isAiConfigured } from "@/config/ai.config";
import { generateVideoWithOpenAI } from "@/lib/ai/openaiVisualize";

export const maxDuration = 180;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.imageDataUrl || !body.promptId) {
      return NextResponse.json(
        { error: "Нужны imageDataUrl и promptId" },
        { status: 400 }
      );
    }

    if (!isAiConfigured()) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY не настроен",
          message: "Добавьте ключ в .env.local",
        },
        { status: 400 }
      );
    }

    const result = await generateVideoWithOpenAI(body.imageDataUrl, {
      promptId: body.promptId,
      fixtureId: body.fixtureId,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("video error:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Ошибка генерации видео",
      },
      { status: 500 }
    );
  }
}
