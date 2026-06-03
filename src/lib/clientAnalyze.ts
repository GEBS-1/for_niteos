import { buildFullAnalyzeResult } from "@/lib/calculation";
import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/types";

/** Расчёт на клиенте (GitHub Pages без сервера) */
export function runClientAnalyze(body: AnalyzeRequest): AnalyzeResponse {
  return buildFullAnalyzeResult(body);
}
