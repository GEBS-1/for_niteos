export type PipelineLogLevel = "info" | "warn" | "error" | "debug";

export interface PipelineLogEntry {
  ts: string;
  stage: string;
  level: PipelineLogLevel;
  message: string;
  data?: Record<string, unknown>;
}

export class PipelineLogger {
  private readonly entries: PipelineLogEntry[];
  private readonly runId: string;
  private readonly stagePrefix: string;

  constructor(runId?: string, sharedEntries?: PipelineLogEntry[], stagePrefix = "") {
    this.runId = runId ?? `run-${Date.now().toString(36)}`;
    this.entries = sharedEntries ?? [];
    this.stagePrefix = stagePrefix;
  }

  get id(): string {
    return this.runId;
  }

  log(
    stage: string,
    message: string,
    data?: Record<string, unknown>,
    level: PipelineLogLevel = "info"
  ): void {
    const fullStage = this.stagePrefix ? `${this.stagePrefix}/${stage}` : stage;
    const entry: PipelineLogEntry = {
      ts: new Date().toISOString(),
      stage: fullStage,
      level,
      message,
      data: data ? { runId: this.runId, ...data } : { runId: this.runId },
    };
    this.entries.push(entry);
    const payload = data ? ` ${JSON.stringify(data)}` : "";
    const line = `[NITEOS][${this.runId}][${fullStage}][${level}] ${message}${payload}`;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  child(stagePrefix: string): PipelineLogger {
    return new PipelineLogger(this.runId, this.entries, stagePrefix);
  }

  snapshot(): PipelineLogEntry[] {
    return [...this.entries];
  }
}
