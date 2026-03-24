import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { calculateCost } from "../src/core/cost-engine.js";
import { parseClaudePath } from "../src/adapters/claude.js";
import { parseCodexPath } from "../src/adapters/codex.js";
import { parseOpenClawPath } from "../src/adapters/openclaw.js";
import { patchOpenClawReplyDispatcher } from "../src/openclaw/patcher.js";
import {
  appendOpenClawFeishuFooterSegment,
  renderOpenClawFeishuFooter,
} from "../src/openclaw/feishu-footer.js";
import {
  renderPatchedFeishuCardNote,
  splitTrailingUsageLine,
} from "../src/openclaw/upstream-note.js";

test("OpenAI cached input is billed separately", () => {
  const cost = calculateCost("gpt-5.4", {
    inputTokens: 100_000,
    cachedInputTokens: 40_000,
    outputTokens: 10_000,
  });

  assert.equal(cost.inputUsd, 0.15);
  assert.equal(cost.cachedInputUsd, 0.01);
  assert.equal(cost.outputUsd, 0.15);
  assert.equal(cost.totalUsd, 0.31);
});

test("parse codex session log", async () => {
  const events = await parseCodexPath(
    resolve("test/fixtures/codex/session.jsonl"),
  );

  assert.equal(events.length, 1);
  assert.equal(events[0]?.provider, "codex");
  assert.equal(events[0]?.model, "gpt-5.4");
  assert.equal(events[0]?.usage.cachedInputTokens, 1200);
});

test("parse claude transcript log", async () => {
  const events = await parseClaudePath(
    resolve("test/fixtures/claude/session.jsonl"),
  );

  assert.equal(events.length, 1);
  assert.equal(events[0]?.provider, "claude-code");
  assert.equal(events[0]?.usage.cacheReadInputTokens, 3000);
  assert.equal(events[0]?.cost.totalUsd > 0, true);
});

test("parse openclaw response and render footer", async () => {
  const events = await parseOpenClawPath(
    resolve("test/fixtures/openclaw/response.json"),
  );

  assert.equal(events.length, 1);
  const compactFooter = renderOpenClawFeishuFooter(events[0]!);
  assert.equal(compactFooter, "费用 $0.0300");

  const detailedFooter = renderOpenClawFeishuFooter(events[0]!, {
    style: "detailed",
  });
  assert.match(detailedFooter, /费用 \$0\./);
  assert.match(detailedFooter, /gpt-5\.4/);

  const appended = appendOpenClawFeishuFooterSegment("已完成 · 耗时 1m 1s", events[0]!);
  assert.equal(appended, "已完成 · 耗时 1m 1s · 费用 $0.0300");
});

test("render standalone patched feishu note", () => {
  const note = renderPatchedFeishuCardNote({
    mode: "standalone",
    agentName: "OpenClaw",
    model: "gpt-5.4",
    provider: "openai",
    elapsedMs: 61_000,
    usageLine: "Usage: 12.0k in / 900 out · est $0.0300",
  });

  assert.equal(note, "已完成 · 耗时 1m 1s · 费用 $0.0300");
});

test("split trailing usage line keeps message body", () => {
  const value = splitTrailingUsageLine("回答正文\nUsage: 8.9k in / 337 out · est $0.0184");
  assert.equal(value.bodyText, "回答正文");
  assert.equal(value.usageLine, "Usage: 8.9k in / 337 out · est $0.0184");
});

test("patch openclaw reply dispatcher for standalone mode", () => {
  const source = `import { foo } from "./foo.js";

/** Build a card note footer from agent identity and model context. */
function resolveCardNote(
  agentId: string,
  identity: OutboundIdentity | undefined,
  prefixCtx: { model?: string; provider?: string },
): string {
  const name = identity?.name?.trim() || agentId;
  const parts: string[] = [\`Agent: \${name}\`];
  if (prefixCtx.model) {
    parts.push(\`Model: \${prefixCtx.model}\`);
  }
  if (prefixCtx.provider) {
    parts.push(\`Provider: \${prefixCtx.provider}\`);
  }
  return parts.join(" | ");
}

export function createFeishuReplyDispatcher(params: CreateFeishuReplyDispatcherParams) {
  let streamingStartPromise: Promise<void> | null = null;
  const closeStreaming = async () => {
    if (streaming?.isActive()) {
      let text = buildCombinedStreamText(reasoningText, streamText);
      if (mentionTargets?.length) {
        text = buildMentionedCardContent(mentionTargets, text);
      }
      const finalNote = resolveCardNote(agentId, identity, prefixContext.prefixContext);
      await streaming.close(text, { note: finalNote });
    }
  };
  const { dispatcher, replyOptions, markDispatchIdle } =
    core.channel.reply.createReplyDispatcherWithTyping({
      onReplyStart: async () => {
        deliveredFinalTexts.clear();
        if (streamingEnabled && renderMode === "card") {
          startStreaming();
        }
        await typingCallbacks?.onReplyStart?.();
      },
      deliver: async (payload: ReplyPayload, info) => {
        if (useCard) {
          const cardHeader = resolveCardHeader(agentId, identity);
          const cardNote = resolveCardNote(agentId, identity, prefixContext.prefixContext);
          await sendChunkedTextReply({
            text,
            useCard: true,
            infoKind: info?.kind,
            sendChunk: async ({ chunk, isFirst }) => {
              await sendStructuredCardFeishu({
                cfg,
                to: chatId,
                text: chunk,
                replyToMessageId: sendReplyToMessageId,
                replyInThread: effectiveReplyInThread,
                mentions: isFirst ? mentionTargets : undefined,
                accountId,
                header: cardHeader,
                note: cardNote,
              });
            },
          });
          } else {
            return;
          }
      },
    });
}`;

  const patched = patchOpenClawReplyDispatcher(source, "standalone");
  assert.match(patched, /tokenpay-feishu-cost-note/);
  assert.match(patched, /replyStartedAt = Date\.now\(\)/);
  assert.match(patched, /已完成/);
  assert.match(patched, /splitTrailingUsageLine/);
});
