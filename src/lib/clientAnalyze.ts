import { runAnalyzePipelineSync } from "@/lib/analyzePipeline";
import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/types";

/** Расчёт на клиенте (GitHub Pages без сервера, mock-детекция) */
export function runClientAnalyze(body: AnalyzeRequest): AnalyzeResponse {
  return runAnalyzePipelineSync(body);
}
