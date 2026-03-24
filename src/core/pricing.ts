import type { ModelPricing } from "./types.js";

const PRICING: Record<string, ModelPricing> = {
  "openai:gpt-5.4": {
    canonicalModel: "gpt-5.4",
    provider: "openai",
    effectiveDate: "2026-03-24",
    sourceUrl: "https://openai.com/api/pricing/",
    inputUsdPer1M: 2.5,
    cachedInputUsdPer1M: 0.25,
    outputUsdPer1M: 15,
  },
  "openai:gpt-5-mini": {
    canonicalModel: "gpt-5-mini",
    provider: "openai",
    effectiveDate: "2026-03-24",
    sourceUrl: "https://openai.com/api/pricing/",
    inputUsdPer1M: 0.25,
    cachedInputUsdPer1M: 0.025,
    outputUsdPer1M: 2,
  },
  "anthropic:claude-sonnet-4": {
    canonicalModel: "claude-sonnet-4",
    provider: "anthropic",
    effectiveDate: "2026-03-24",
    sourceUrl: "https://www.anthropic.com/pricing",
    inputUsdPer1M: 3,
    cacheReadUsdPer1M: 0.3,
    cacheWrite5mUsdPer1M: 3.75,
    cacheWrite1hUsdPer1M: 6,
    outputUsdPer1M: 15,
  },
};

const MODEL_ALIASES: Record<string, string> = {
  "gpt-5.4": "openai:gpt-5.4",
  "gpt-5.4-mini": "openai:gpt-5-mini",
  "gpt-5-mini": "openai:gpt-5-mini",
  "claude-sonnet-4": "anthropic:claude-sonnet-4",
  "claude-sonnet-4-6": "anthropic:claude-sonnet-4",
  "claude-sonnet-4-5-20250929": "anthropic:claude-sonnet-4",
};

export function resolvePricing(model: string): ModelPricing | undefined {
  const key = MODEL_ALIASES[model] ?? MODEL_ALIASES[model.toLowerCase()];
  if (!key) {
    return undefined;
  }
  return PRICING[key];
}

export function supportedModels(): string[] {
  return Object.keys(MODEL_ALIASES).sort();
}

