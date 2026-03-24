# TokenPay

TokenPay 是一个面向 AI 编码工具的对话费用观测器。

它的目标不是做“账单系统”，而是做一层可移植的成本观察层：从本地日志或运行时 usage 中提取 `model + tokens`，按官方 API 价格估算当前回复或当前会话的成本，然后把结果显示到你真正关心的位置。

当前第一阶段重点支持：

- OpenClaw：Feishu 卡片底部小字显示费用
- Codex：本地日志解析 + dashboard
- Claude Code：本地 transcript 解析 + dashboard

## 当前能力

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| OpenClaw usage 解析 | 已完成 | 解析 `responseUsage` / `usage` 风格数据 |
| OpenClaw Feishu footer 文案 | 已完成 | 生成 `费用 $0.0300` 或详细模式文案 |
| OpenClaw 本地补丁安装/回滚 | 已完成 | 直接 patch 目标 OpenClaw 仓库 |
| OpenClaw PR 模式补丁 | 已完成 | 生成更适合上游提交的 note 文案 |
| Codex 日志解析 | 已完成 | 读取 `~/.codex/sessions/**/*.jsonl` |
| Claude Code 日志解析 | 已完成 | 读取 `~/.claude/projects/**/*.jsonl` |
| 本地 dashboard | 已完成 | 汇总事件与 session 成本 |
| 人民币切换 | 未完成 | 当前仅支持 USD |
| 真实账单口径 | 未完成 | 当前是 API 等价估算 |

## 最终效果

OpenClaw 的目标效果是把原本正文里末尾的 usage 行，挪到 Feishu 卡片底部 note 区域。

本地使用模式：

```text
已完成 · 耗时 1m 1s · 费用 $0.0300
```

PR 提交模式：

```text
Completed · 1m 1s · est $0.0300
```

## 核心思路

统一流程只有一条：

1. 从不同工具的日志或响应对象里提取 usage
2. 归一化成统一事件结构 `CostEvent`
3. 用模型定价表计算 USD 成本
4. 输出到不同渲染层

当前统一事件结构定义在 [src/core/types.ts](./src/core/types.ts)。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 编译

```bash
npm run build
```

### 3. 运行测试

```bash
npm test
```

## CLI 用法

### 查看归一化事件

```bash
node dist/src/cli.js events --provider openclaw --input ./path/to/response.json
node dist/src/cli.js events --provider codex --input ~/.codex/sessions
node dist/src/cli.js events --provider claude-code --input ~/.claude/projects
```

### 生成 OpenClaw footer 文案

紧凑模式：

```bash
node dist/src/cli.js footer --provider openclaw --input test/fixtures/openclaw/response.json
```

输出示例：

```text
费用 $0.0300
```

详细模式：

```bash
node dist/src/cli.js footer --provider openclaw --input test/fixtures/openclaw/response.json --style detailed
```

输出示例：

```text
费用 $0.0300 · in 12.0k / cache 6.0k / out 900 · gpt-5.4
```

### 启动 dashboard

```bash
node dist/src/cli.js dashboard --provider all
```

或只看 OpenClaw：

```bash
node dist/src/cli.js dashboard --provider openclaw --input ./path/to/openclaw-log.json
```

## OpenClaw：本地补丁模式

OpenClaw 目前没有一个明确开放的“Feishu footer 插件插槽”，所以第一阶段采用可回滚 patch 的方式接入。

补丁目标文件：

```text
extensions/feishu/src/reply-dispatcher.ts
```

补丁会做三件事：

1. 把正文末尾的 `Usage: ...` 拆出来
2. 把它放进 Feishu card `note`
3. 在最终卡片 note 里增加耗时和费用文案

### 安装本地可用补丁

```bash
node dist/src/cli.js openclaw-patch --repo /path/to/openclaw --mode standalone
```

或直接用 skill 脚本：

```bash
skills/tokenpay-cost-observer/scripts/install-openclaw-patch.sh --repo /path/to/openclaw --mode standalone
```

### 回滚补丁

```bash
node dist/src/cli.js openclaw-patch --repo /path/to/openclaw --revert
```

或：

```bash
skills/tokenpay-cost-observer/scripts/uninstall-openclaw-patch.sh --repo /path/to/openclaw
```

### 为上游 PR 准备分支

```bash
skills/tokenpay-cost-observer/scripts/prepare-openclaw-pr-branch.sh --repo /path/to/openclaw
```

默认会创建：

```text
tokenpay/feishu-note-cost
```

并用 `pr` 模式打补丁。

## OpenClaw：补丁的安全策略

补丁器不是直接暴力覆盖。

它会：

- 先备份原始 `reply-dispatcher.ts`
- 把备份和 manifest 放到目标仓库的 `.tokenpay/`
- 自动把 `.tokenpay/` 加到目标仓库的 `.git/info/exclude`
- 支持一键回滚

补丁器实现在 [src/openclaw/patcher.ts](./src/openclaw/patcher.ts)。

## Codex / Claude Code

这两端当前先做“旁路显示”，不碰官方 UI。

### Codex

- 读取 `~/.codex/sessions/**/*.jsonl`
- 提取当前 turn 的模型和 token usage
- 用 OpenAI 定价表估算 turn 成本

实现见 [src/adapters/codex.ts](./src/adapters/codex.ts)。

### Claude Code

- 读取 `~/.claude/projects/**/*.jsonl`
- 提取 assistant message 的 usage
- 用 Anthropic 定价表估算成本

实现见 [src/adapters/claude.ts](./src/adapters/claude.ts)。

## Skill 形态

项目已经带了一个可移植 skill：

```text
skills/tokenpay-cost-observer
```

适合两种用法：

1. 直接在当前仓库运行脚本
2. 复制到 Codex skills 目录中复用

入口文档见 [SKILL.md](./skills/tokenpay-cost-observer/SKILL.md)。

常用脚本：

- [render-openclaw-footer.sh](./skills/tokenpay-cost-observer/scripts/render-openclaw-footer.sh)
- [run-dashboard.sh](./skills/tokenpay-cost-observer/scripts/run-dashboard.sh)
- [install-openclaw-patch.sh](./skills/tokenpay-cost-observer/scripts/install-openclaw-patch.sh)
- [uninstall-openclaw-patch.sh](./skills/tokenpay-cost-observer/scripts/uninstall-openclaw-patch.sh)
- [prepare-openclaw-pr-branch.sh](./skills/tokenpay-cost-observer/scripts/prepare-openclaw-pr-branch.sh)

## 定价口径

当前一律使用 `API equivalent estimate`。

这意味着它会按官方 API 单价来估算，不保证和以下场景的真实费用完全一致：

- ChatGPT 订阅内包含的 Codex 使用
- Claude Code 的订阅额度
- OpenClaw 的 OAuth / 非 API key 场景
- 第三方搜索、抓取、嵌入等额外工具费用

价格表定义在 [src/core/pricing.ts](./src/core/pricing.ts)。

当前重点覆盖：

- OpenAI：`gpt-5.4`、`gpt-5-mini`
- Anthropic：`claude-sonnet-4`

并包含一层模型别名映射，方便兼容不同日志里的模型名。

## 目录结构

```text
tokenpay/
├── src/
│   ├── adapters/          # OpenClaw / Codex / Claude Code 解析器
│   ├── core/              # 统一类型、定价表、成本计算
│   ├── dashboard/         # 本地 Web 仪表盘
│   └── openclaw/          # Feishu footer 与 OpenClaw patch 逻辑
├── skills/
│   └── tokenpay-cost-observer/
│       ├── SKILL.md
│       ├── scripts/
│       └── references/
└── test/
    └── fixtures/
```

## 开发命令

```bash
npm run build
npm test
npm run dashboard
```

## 已知限制

- 当前只支持 USD，不支持 CNY
- 当前没有实时汇率
- 当前没有真实账单对账能力
- OpenClaw patch 依赖上游 `reply-dispatcher.ts` 的结构稳定
- Codex / Claude Code 还没有做到原生 UI 内嵌

## 下一步计划

- 增加 USD / CNY 切换
- 增加 session 累计和项目累计
- 给 OpenClaw 整理一版可直接提 upstream 的 PR 说明
- 给 Codex / Claude Code 增加更完整的 dashboard 展示
