export type ProviderKind = "openclaw" | "codex" | "claude-code";

export type PricingProvider = "openai" | "anthropic";

export interface UsageBreakdown {
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
  reasoningOutputTokens?: number;
  cacheReadInputTokens?: number;
  cacheWrite5mInputTokens?: number;
  cacheWrite1hInputTokens?: number;
}

export interface CostBreakdown {
  inputUsd: number;
  cachedInputUsd?: number;
  cacheReadUsd?: number;
  cacheWrite5mUsd?: number;
  cacheWrite1hUsd?: number;
  outputUsd: number;
  totalUsd: number;
}

export interface CostEvent {
  provider: ProviderKind;
  sessionId: string;
  messageId?: string;
  turnId?: string;
  model: string;
  timestamp: string;
  usage: UsageBreakdown;
  cost: CostBreakdown;
  source: "provider_usage" | "local_log" | "derived";
  rawFile?: string;
}

export interface ModelPricing {
  canonicalModel: string;
  provider: PricingProvider;
  effectiveDate: string;
  sourceUrl: string;
  inputUsdPer1M: number;
  cachedInputUsdPer1M?: number;
  cacheReadUsdPer1M?: number;
  cacheWrite5mUsdPer1M?: number;
  cacheWrite1hUsdPer1M?: number;
  outputUsdPer1M: number;
}

export interface DashboardPayload {
  generatedAt: string;
  providerFilter: ProviderKind | "all";
  events: CostEvent[];
  summary: {
    totalUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalEvents: number;
  };
}

export interface FooterOptions {
  enabled?: boolean;
  showModel?: boolean;
  showTokenBreakdown?: boolean;
  showUsd?: boolean;
  style?: "compact" | "detailed";
}
