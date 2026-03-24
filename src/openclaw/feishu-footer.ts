import type { CostEvent, FooterOptions } from "../core/types.js";
import { formatTokenCount, formatUsd } from "../core/utils.js";
import { parseOpenClawValue } from "../adapters/openclaw.js";

const DEFAULT_OPTIONS: Required<FooterOptions> = {
  enabled: true,
  showModel: true,
  showTokenBreakdown: true,
  showUsd: true,
  style: "compact",
};

export function renderOpenClawFeishuFooter(
  event: CostEvent,
  options: FooterOptions = {},
): string {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  if (!merged.enabled) {
    return "";
  }

  if (merged.style === "compact") {
    return merged.showUsd ? `费用 ${formatUsd(event.cost.totalUsd)}` : "";
  }

  const parts: string[] = [];
  if (merged.showUsd) {
    parts.push(`费用 ${formatUsd(event.cost.totalUsd)}`);
  }

  if (merged.showTokenBreakdown) {
    const tokenParts = [`in ${formatTokenCount(event.usage.inputTokens)}`];
    if (event.usage.cachedInputTokens) {
      tokenParts.push(`cache ${formatTokenCount(event.usage.cachedInputTokens)}`);
    }
    if (event.usage.cacheReadInputTokens) {
      tokenParts.push(`read ${formatTokenCount(event.usage.cacheReadInputTokens)}`);
    }
    if (event.usage.cacheWrite5mInputTokens) {
      tokenParts.push(`write ${formatTokenCount(event.usage.cacheWrite5mInputTokens)}`);
    }
    tokenParts.push(`out ${formatTokenCount(event.usage.outputTokens)}`);
    parts.push(tokenParts.join(" / "));
  }

  if (merged.showModel) {
    parts.push(event.model);
  }

  return parts.join(" · ");
}

export function appendOpenClawFeishuFooterSegment(baseFooter: string, event: CostEvent): string {
  const segment = renderOpenClawFeishuFooter(event, { style: "compact" });
  if (!segment) {
    return baseFooter;
  }
  if (!baseFooter.trim()) {
    return segment;
  }
  return `${baseFooter} · ${segment}`;
}

export function renderOpenClawFeishuFooterFromUnknown(
  value: unknown,
  options: FooterOptions = {},
): string {
  const events = parseOpenClawValue(value, "inline.json");
  const latest = events.at(-1);
  return latest ? renderOpenClawFeishuFooter(latest, options) : "";
}
