import { NextRequest, NextResponse } from "next/server";
import { buildFullAnalyzeResult, validateDimensions } from "@/lib/calculation";
import type { AnalyzeRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeRequest;

    if (!body.imageWidth || !body.imageHeight || !body.dimensions) {
      return NextResponse.json(
        { error: "Не заполнены параметры: загрузите фото и укажите размеры" },
        { status: 400 }
      );
    }

    const dimError = validateDimensions(body.dimensions);
    if (dimError) {
      return NextResponse.json({ error: dimError }, { status: 400 });
    }

    const result = buildFullAnalyzeResult(body);

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Ошибка при анализе фасада" },
      { status: 500 }
    );
  }
}
