# OpenClaw Integration

当前仓库里已经有三类可直接复用的 OpenClaw 能力：

- `src/adapters/openclaw.ts`
  - 把 OpenClaw 的 `responseUsage` / `usage` 风格对象归一化成 `CostEvent`
- `src/openclaw/feishu-footer.ts`
  - 把 `CostEvent` 渲染成飞书 footer 小字
- `src/openclaw/patcher.ts`
  - 给真实 OpenClaw 仓库打可回滚的 Feishu note 补丁

推荐接入方式：

1. 如果你控制 OpenClaw 源码：
   - 直接用 `tokenpay openclaw-patch --repo <path> --mode standalone`
   - 它会改 `extensions/feishu/src/reply-dispatcher.ts`
   - 最终把正文末尾 `Usage: ...` 提到 Feishu 卡片 `note` 里
2. 如果你只是在做自己的 fork 或准备提 PR：
   - 用 `tokenpay openclaw-patch --repo <path> --mode pr`
   - 文案会偏上游提交风格
3. 如果你是在做更深的自定义接入：
   - 在 OpenClaw 回复生成后拿到当前消息上下文对象
   - 调用 `parseOpenClawValue(rawContext)` 提取最新 `CostEvent`
   - 调用 `renderOpenClawFeishuFooter(event)` 输出 footer 字符串
   - 把返回值接到你自己的 Feishu footer/note 渲染链上

默认文案类似：

```text
已完成 · 耗时 1m 1s · 费用 $0.0285
```

PR 模式文案类似：

```text
Completed · 1m 1s · est $0.0285
```

当前仓库里的建议接法：

- 现有 footer 文案作为 `baseFooter`
- 调用 `appendOpenClawFeishuFooterSegment(baseFooter, event)`
- 返回值会变成 `已完成 · 耗时 1m 1s · 费用 $0.0285`
