import type { CostBreakdown, ModelPricing, UsageBreakdown } from "./types.js";
import { resolvePricing } from "./pricing.js";
import { sumDefined } from "./utils.js";

function millionRate(tokens: number, usdPer1M: number | undefined): number {
  if (!usdPer1M || tokens <= 0) {
    return 0;
  }
  return (tokens / 1_000_000) * usdPer1M;
}

export function calculateCostFromPricing(
  pricing: ModelPricing,
  usage: UsageBreakdown,
): CostBreakdown {
  const outputUsd = millionRate(usage.outputTokens, pricing.outputUsdPer1M);

  if (pricing.provider === "openai") {
    const cachedInputTokens = usage.cachedInputTokens ?? 0;
    const uncachedInputTokens = Math.max(usage.inputTokens - cachedInputTokens, 0);
    const inputUsd = millionRate(uncachedInputTokens, pricing.inputUsdPer1M);
    const cachedInputUsd = millionRate(
      cachedInputTokens,
      pricing.cachedInputUsdPer1M,
    );
    const totalUsd = inputUsd + cachedInputUsd + outputUsd;
    return {
      inputUsd,
      cachedInputUsd,
      outputUsd,
      totalUsd,
    };
  }

  const inputUsd = millionRate(usage.inputTokens, pricing.inputUsdPer1M);
  const cacheReadUsd = millionRate(
    usage.cacheReadInputTokens ?? 0,
    pricing.cacheReadUsdPer1M,
  );
  const cacheWrite5mUsd = millionRate(
    usage.cacheWrite5mInputTokens ?? 0,
    pricing.cacheWrite5mUsdPer1M,
  );
  const cacheWrite1hUsd = millionRate(
    usage.cacheWrite1hInputTokens ?? 0,
    pricing.cacheWrite1hUsdPer1M,
  );
  const totalUsd = sumDefined([
    inputUsd,
    cacheReadUsd,
    cacheWrite5mUsd,
    cacheWrite1hUsd,
    outputUsd,
  ]);

  return {
    inputUsd,
    cacheReadUsd,
    cacheWrite5mUsd,
    cacheWrite1hUsd,
    outputUsd,
    totalUsd,
  };
}

export function calculateCost(model: string, usage: UsageBreakdown): CostBreakdown {
  const pricing = resolvePricing(model);
  if (!pricing) {
    return {
      inputUsd: 0,
      outputUsd: 0,
      totalUsd: 0,
    };
  }
  return calculateCostFromPricing(pricing, usage);
}

