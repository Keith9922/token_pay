import type { CostEvent, UsageBreakdown } from "../core/types.js";
import { calculateCost } from "../core/cost-engine.js";
import {
  asRecord,
  asString,
  defaultSessionIdFromFile,
  safeTimestamp,
} from "../core/utils.js";
import { collectFiles, readJsonLines } from "./common.js";

function mapClaudeUsage(value: unknown): UsageBreakdown | null {
  const usage = asRecord(value);
  if (!usage) {
    return null;
  }

  return {
    inputTokens: Number(usage.input_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? 0),
    cacheReadInputTokens: Number(usage.cache_read_input_tokens ?? 0),
    cacheWrite5mInputTokens:
      Number(usage.claude_cache_creation_5_m_tokens ?? 0) ||
      Number(usage.cache_creation_input_tokens ?? 0),
    cacheWrite1hInputTokens: Number(usage.claude_cache_creation_1_h_tokens ?? 0),
  };
}

export async function parseClaudePath(inputPath: string): Promise<CostEvent[]> {
  const files = await collectFiles(inputPath, new Set([".jsonl"]));
  const events: CostEvent[] = [];

  for (const filePath of files) {
    const lines = await readJsonLines(filePath);
    const fallbackSessionId = defaultSessionIdFromFile(filePath);

    for (const line of lines) {
      const record = asRecord(line);
      const message = asRecord(record?.message);
      const usage = mapClaudeUsage(message?.usage);
      if (!record || !message || !usage) {
        continue;
      }

      const role = asString(message.role);
      const model = asString(message.model);
      if (role !== "assistant" || !model) {
        continue;
      }

      const sessionId = asString(record.sessionId) ?? fallbackSessionId;
      const messageId = asString(message.id);
      events.push({
        provider: "claude-code",
        sessionId,
        messageId,
        model,
        timestamp: safeTimestamp(asString(record.timestamp)),
        usage,
        cost: calculateCost(model, usage),
        source: "local_log",
        rawFile: filePath,
      });
    }
  }

  return events.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

