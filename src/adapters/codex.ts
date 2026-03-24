import { basename } from "node:path";
import type { CostEvent, UsageBreakdown } from "../core/types.js";
import { calculateCost } from "../core/cost-engine.js";
import { asRecord, asString, defaultSessionIdFromFile, safeTimestamp } from "../core/utils.js";
import { collectFiles, readJsonLines } from "./common.js";

function mapLastTokenUsage(value: unknown): UsageBreakdown | null {
  const usage = asRecord(value);
  if (!usage) {
    return null;
  }
  return {
    inputTokens: Number(usage.input_tokens ?? 0),
    cachedInputTokens: Number(usage.cached_input_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? 0),
    reasoningOutputTokens: Number(usage.reasoning_output_tokens ?? 0),
  };
}

export async function parseCodexPath(inputPath: string): Promise<CostEvent[]> {
  const files = await collectFiles(inputPath, new Set([".jsonl"]));
  const events: CostEvent[] = [];

  for (const filePath of files) {
    const lines = await readJsonLines(filePath);
    let currentModel = "gpt-5.4";
    let currentTurnId: string | undefined;
    const sessionId = defaultSessionIdFromFile(filePath);

    for (const line of lines) {
      const record = asRecord(line);
      if (!record) {
        continue;
      }

      if (record.type === "turn_context") {
        const payload = asRecord(record.payload);
        currentModel = asString(payload?.model) ?? currentModel;
        currentTurnId = asString(payload?.turn_id) ?? currentTurnId;
        continue;
      }

      if (record.type !== "event_msg") {
        continue;
      }

      const payload = asRecord(record.payload);
      if (!payload || payload.type !== "token_count") {
        continue;
      }

      const info = asRecord(payload.info);
      const usage = mapLastTokenUsage(info?.last_token_usage);
      if (!usage) {
        continue;
      }

      events.push({
        provider: "codex",
        sessionId,
        turnId: currentTurnId,
        model: currentModel,
        timestamp: safeTimestamp(asString(record.timestamp)),
        usage,
        cost: calculateCost(currentModel, usage),
        source: "local_log",
        rawFile: filePath,
        messageId: basename(filePath),
      });
    }
  }

  return events.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

