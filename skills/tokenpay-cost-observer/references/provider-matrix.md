# Provider Matrix

## Current support

- OpenClaw
  - 输入：JSON / JSONL，包含 `responseUsage` 或 `usage`
  - 输出：每条回复成本事件、OpenClaw footer 文案
- Codex
  - 输入：`~/.codex/sessions/**/*.jsonl`
  - 使用 `turn_context.model` + `token_count.info.last_token_usage`
- Claude Code
  - 输入：`~/.claude/projects/**/*.jsonl`
  - 使用 `message.model` + `message.usage`

## Pricing assumptions

- OpenAI
  - `gpt-5.4`
  - `gpt-5-mini`
- Anthropic
  - `claude-sonnet-4`

模型别名映射写在 `src/core/pricing.ts`。
