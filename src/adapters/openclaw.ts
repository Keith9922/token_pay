import type { CostEvent, UsageBreakdown } from "../core/types.js";
import { calculateCost } from "../core/cost-engine.js";
import {
  asArray,
  asRecord,
  asString,
  defaultSessionIdFromFile,
  pickFirstNumber,
  pickFirstString,
  safeTimestamp,
} from "../core/utils.js";
import { collectFiles, readJson, readJsonLines } from "./common.js";

function mapUsage(value: unknown): UsageBreakdown | null {
  const usage = asRecord(value);
  if (!usage) {
    return null;
  }

  const inputTokens = pickFirstNumber(usage, [
    "inputTokens",
    "input_tokens",
    "promptTokens",
    "prompt_tokens",
  ]);
  const outputTokens = pickFirstNumber(usage, [
    "outputTokens",
    "output_tokens",
    "completionTokens",
    "completion_tokens",
  ]);

  if (inputTokens === undefined || outputTokens === undefined) {
    return null;
  }

  return {
    inputTokens,
    cachedInputTokens: pickFirstNumber(usage, [
      "cachedInputTokens",
      "cached_input_tokens",
    ]),
    outputTokens,
    reasoningOutputTokens: pickFirstNumber(usage, [
      "reasoningOutputTokens",
      "reasoning_output_tokens",
    ]),
    cacheReadInputTokens: pickFirstNumber(usage, [
      "cacheReadInputTokens",
      "cache_read_input_tokens",
    ]),
    cacheWrite5mInputTokens: pickFirstNumber(usage, [
      "cacheWrite5mInputTokens",
      "cache_write_5m_input_tokens",
      "cacheCreationInputTokens",
      "cache_creation_input_tokens",
    ]),
    cacheWrite1hInputTokens: pickFirstNumber(usage, [
      "cacheWrite1hInputTokens",
      "cache_write_1h_input_tokens",
    ]),
  };
}

function candidateToEvent(
  candidate: Record<string, unknown>,
  filePath: string,
): CostEvent | null {
  const usage =
    mapUsage(candidate.responseUsage) ??
    mapUsage(candidate.usage) ??
    mapUsage(candidate.messageUsage);

  const model =
    pickFirstString(candidate, ["model", "modelName"]) ??
    pickFirstString(asRecord(candidate.message) ?? {}, ["model", "modelName"]) ??
    pickFirstString(asRecord(candidate.response) ?? {}, ["model", "modelName"]);

  if (!usage || !model) {
    return null;
  }

  const sessionId =
    pickFirstString(candidate, ["sessionId", "conversationId", "threadId"]) ??
    defaultSessionIdFromFile(filePath);

  const messageId = pickFirstString(candidate, ["messageId", "id", "responseId"]);
  const timestamp = pickFirstString(candidate, [
    "timestamp",
    "createdAt",
    "updatedAt",
  ]);

  return {
    provider: "openclaw",
    sessionId,
    messageId,
    model,
    timestamp: safeTimestamp(timestamp),
    usage,
    cost: calculateCost(model, usage),
    source: "derived",
    rawFile: filePath,
  };
}

function walkCandidates(value: unknown, filePath: string, events: CostEvent[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      walkCandidates(item, filePath, events);
    }
    return;
  }

  const record = asRecord(value);
  if (!record) {
    return;
  }

  const event = candidateToEvent(record, filePath);
  if (event) {
    events.push(event);
  }

  for (const nested of Object.values(record)) {
    if (asRecord(nested) || Array.isArray(nested)) {
      walkCandidates(nested, filePath, events);
    }
  }
}

function dedupeEvents(events: CostEvent[]): CostEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = [
      event.sessionId,
      event.messageId ?? "",
      event.timestamp,
      event.model,
      event.usage.inputTokens,
      event.usage.outputTokens,
    ].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function parseOpenClawValue(
  value: unknown,
  filePath = "inline.json",
): CostEvent[] {
  const events: CostEvent[] = [];
  walkCandidates(value, filePath, events);
  return dedupeEvents(events).sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

export async function parseOpenClawPath(inputPath: string): Promise<CostEvent[]> {
  const files = await collectFiles(inputPath, new Set([".json", ".jsonl"]));
  const events: CostEvent[] = [];

  for (const filePath of files) {
    const parsed =
      filePath.endsWith(".jsonl")
        ? asArray(await readJsonLines(filePath))
        : (await readJson(filePath));
    events.push(...parseOpenClawValue(parsed, filePath));
  }

  return dedupeEvents(events).sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}
