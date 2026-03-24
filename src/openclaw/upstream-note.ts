export type OpenClawPatchMode = "pr" | "standalone";

export interface PatchedCardNoteOptions {
  mode: OpenClawPatchMode;
  agentName: string;
  model?: string;
  provider?: string;
  elapsedMs?: number;
  usageLine?: string;
}

const USAGE_LINE_PATTERN = /(?:\n|^)(Usage:[^\n]+)$/;
const ESTIMATED_COST_PATTERN = /est\s+(\$[0-9][0-9.,]*)/i;

export function splitTrailingUsageLine(text: string): {
  bodyText: string;
  usageLine?: string;
} {
  const match = text.match(USAGE_LINE_PATTERN);
  if (!match || match.index === undefined) {
    return { bodyText: text };
  }

  const usageLine = match[1]?.trim();
  const bodyText = text.slice(0, match.index).replace(/\n+$/, "");
  return {
    bodyText: bodyText || text,
    usageLine,
  };
}

export function formatElapsedDuration(durationMs: number | undefined): string | undefined {
  if (!Number.isFinite(durationMs) || durationMs === undefined || durationMs <= 0) {
    return undefined;
  }

  const totalSeconds = Math.max(Math.round(durationMs / 1000), 1);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function extractEstimatedCostLabel(usageLine: string | undefined): string | undefined {
  if (!usageLine) {
    return undefined;
  }
  return usageLine.match(ESTIMATED_COST_PATTERN)?.[1];
}

function normalizeUsageSummary(usageLine: string | undefined): string | undefined {
  if (!usageLine) {
    return undefined;
  }
  return usageLine.replace(/^Usage:\s*/i, "").trim();
}

export function renderPatchedFeishuCardNote(options: PatchedCardNoteOptions): string {
  const elapsed = formatElapsedDuration(options.elapsedMs);
  const costLabel = extractEstimatedCostLabel(options.usageLine);
  const usageSummary = normalizeUsageSummary(options.usageLine);

  if (options.mode === "standalone" && (elapsed || costLabel || usageSummary)) {
    const parts = ["已完成"];
    if (elapsed) {
      parts.push(`耗时 ${elapsed}`);
    }
    if (costLabel) {
      parts.push(`费用 ${costLabel}`);
    } else if (usageSummary) {
      parts.push(`用量 ${usageSummary}`);
    }
    return parts.join(" · ");
  }

  if (options.mode === "pr" && (elapsed || costLabel || usageSummary)) {
    const parts = ["Completed"];
    if (elapsed) {
      parts.push(elapsed);
    }
    if (costLabel) {
      parts.push(`est ${costLabel}`);
    } else if (usageSummary) {
      parts.push(usageSummary);
    }
    return parts.join(" · ");
  }

  const fallback = [`Agent: ${options.agentName}`];
  if (options.model) {
    fallback.push(`Model: ${options.model}`);
  }
  if (options.provider) {
    fallback.push(`Provider: ${options.provider}`);
  }
  return fallback.join(" | ");
}
