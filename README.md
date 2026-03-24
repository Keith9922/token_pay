# TokenPay

TokenPay 是一个可移植的对话费用观测工具，优先包装成可复用的 skill，同时提供统一 CLI、OpenClaw footer 渲染器和本地 dashboard。

当前能力：

- 统一解析 OpenClaw / Codex / Claude Code 的本地 usage 数据
- 按官方模型单价估算 API 等价成本
- 生成 OpenClaw 飞书 footer 文案
- 给任意 OpenClaw 仓库安装或回滚 Feishu note 费用补丁
- 启动本地 dashboard 汇总最近会话费用
- 提供可直接被 Codex skill 调用的脚本封装

## 快速开始

```bash
npm install
npm run build
node dist/src/cli.js dashboard
```

常用命令：

```bash
node dist/src/cli.js events --provider codex --input ~/.codex/sessions
node dist/src/cli.js events --provider claude-code --input ~/.claude/projects
node dist/src/cli.js footer --provider openclaw --input test/fixtures/openclaw/response.json
node dist/src/cli.js dashboard --provider all --input test/fixtures/openclaw/response.json
node dist/src/cli.js openclaw-patch --repo ~/code/openclaw --mode standalone
```

给本地 OpenClaw 安装可测试补丁：

```bash
node dist/src/cli.js openclaw-patch --repo /path/to/openclaw --mode standalone
```

回滚补丁：

```bash
node dist/src/cli.js openclaw-patch --repo /path/to/openclaw --revert
```

如果要准备一份更适合上游提交的改动分支：

```bash
node dist/src/cli.js openclaw-patch --repo /path/to/openclaw --mode pr
```

## 定价口径

第一版只做 `API equivalent` 估算：

- OpenAI / Codex 使用 OpenAI 官方 API pricing
- Claude / Claude Code 使用 Anthropic 官方 API pricing
- OpenClaw 根据底层模型名映射到 OpenAI / Anthropic 单价估算

价格表更新时间和来源写在 [`src/core/pricing.ts`](/Users/ronggang/code/funcode/tokenpay/src/core/pricing.ts)。

## OpenClaw 双轨交付

- `standalone` 模式：给你自己的 OpenClaw 仓库打本地补丁，Feishu 卡片 note 会优先显示 `已完成 · 耗时 1m 1s · 费用 $0.0300`
- `pr` 模式：更偏上游提交语气，默认显示 `Completed · 1m 1s · est $0.0300`

两种模式都只改 OpenClaw 的 Feishu `reply-dispatcher.ts`：把正文末尾 `Usage: ...` 小尾巴提到 Feishu card `note`，并在最终卡片上追加耗时/费用信息。
