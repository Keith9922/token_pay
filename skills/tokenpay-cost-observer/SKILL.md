---
name: tokenpay-cost-observer
description: Use when you need to estimate per-conversation or per-message token costs for OpenClaw, Codex, or Claude Code, render OpenClaw footer text, or launch a local usage dashboard from local logs.
---

# TokenPay Cost Observer

Use this skill when the user wants to:

- 看每次对话或每条回复大概花了多少钱
- 在 OpenClaw 里生成飞书 footer 小字
- 给 OpenClaw 仓库直接打上 Feishu 费用 note 补丁
- 从 Codex / Claude Code / OpenClaw 本地日志汇总成本
- 启动本地 dashboard 核对 usage 与费用

## Workflow

1. Build the repo if `dist/` is missing:

```bash
npm run build
```

2. Pick the right entrypoint:

- OpenClaw footer:
  - `skills/tokenpay-cost-observer/scripts/render-openclaw-footer.sh --input <path>`
- OpenClaw patch install:
  - `skills/tokenpay-cost-observer/scripts/install-openclaw-patch.sh --repo <path> [--mode standalone|pr]`
- OpenClaw patch uninstall:
  - `skills/tokenpay-cost-observer/scripts/uninstall-openclaw-patch.sh --repo <path>`
- OpenClaw PR branch prep:
  - `skills/tokenpay-cost-observer/scripts/prepare-openclaw-pr-branch.sh --repo <path> [--branch tokenpay/feishu-note-cost]`
- Dashboard:
  - `skills/tokenpay-cost-observer/scripts/run-dashboard.sh --provider <all|openclaw|codex|claude-code> [--input <path>]`
- Raw event dump:
  - `node dist/src/cli.js events --provider <provider> --input <path>`

3. If the user asks for integration details:

- For OpenClaw/Feishu integration notes, read `references/openclaw-integration.md`
- For supported providers and pricing assumptions, read `references/provider-matrix.md`

## Notes

- 第一版默认只显示 USD
- 口径是 API 等价估算，不保证等于订阅/OAuth 真账单
- Codex 当前只支持旁路 dashboard，不支持官方对话区内嵌
- OpenClaw 没有独立插件插槽时，优先用 patch 安装器对目标仓库做可回滚改造
