import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { OpenClawPatchMode } from "./upstream-note.js";

export interface OpenClawPatchResult {
  repoPath: string;
  mode?: OpenClawPatchMode;
  changed: boolean;
  targetFile: string;
  manifestPath: string;
}

interface PatchManifest {
  version: 1;
  mode: OpenClawPatchMode;
  createdAt: string;
  targetFile: string;
  backupFile: string;
}

const PATCH_MARKER = "tokenpay-feishu-cost-note";
const TARGET_FILE = "extensions/feishu/src/reply-dispatcher.ts";
const MANIFEST_FILE = ".tokenpay/openclaw-feishu-note/manifest.json";
const BACKUP_FILE = ".tokenpay/openclaw-feishu-note/reply-dispatcher.ts.bak";

const ORIGINAL_CARD_NOTE_BLOCK = `/** Build a card note footer from agent identity and model context. */
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
}`;

const ORIGINAL_STREAMING_PROMISE_LINE =
  `  let streamingStartPromise: Promise<void> | null = null;`;

const ORIGINAL_ON_REPLY_START = `      onReplyStart: async () => {
        deliveredFinalTexts.clear();
        if (streamingEnabled && renderMode === "card") {
          startStreaming();
        }
        await typingCallbacks?.onReplyStart?.();
      },`;

const ORIGINAL_CLOSE_STREAMING = `    if (streaming?.isActive()) {
      let text = buildCombinedStreamText(reasoningText, streamText);
      if (mentionTargets?.length) {
        text = buildMentionedCardContent(mentionTargets, text);
      }
      const finalNote = resolveCardNote(agentId, identity, prefixContext.prefixContext);
      await streaming.close(text, { note: finalNote });
    }`;

const ORIGINAL_USE_CARD_BLOCK = `          if (useCard) {
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
          } else {`;

const USE_CARD_BLOCK_PATTERN = /if \(useCard\) \{\n[\s\S]*?\n\s*\} else \{/;

function resolvePaths(repoPath: string): {
  repoRoot: string;
  targetFile: string;
  manifestPath: string;
  backupFile: string;
  gitExcludePath: string;
} {
  const repoRoot = resolve(repoPath);
  return {
    repoRoot,
    targetFile: join(repoRoot, TARGET_FILE),
    manifestPath: join(repoRoot, MANIFEST_FILE),
    backupFile: join(repoRoot, BACKUP_FILE),
    gitExcludePath: join(repoRoot, ".git/info/exclude"),
  };
}

function isPatched(source: string): boolean {
  return source.includes(PATCH_MARKER);
}

function buildCardNoteBlock(mode: OpenClawPatchMode): string {
  const completionLabel = mode === "standalone" ? "已完成" : "Completed";
  const elapsedPrefix = mode === "standalone" ? "耗时 " : "";
  const costPrefix = mode === "standalone" ? "费用 " : "est ";
  const usagePrefix = mode === "standalone" ? "用量 " : "";

  return `/** Build a card note footer from agent identity and model context. */
// ${PATCH_MARKER}
const USAGE_LINE_PATTERN = /(?:\\n|^)(Usage:[^\\n]+)$/;
const ESTIMATED_COST_PATTERN = /est\\s+(\\$[0-9][0-9.,]*)/i;

function splitTrailingUsageLine(text: string): { bodyText: string; usageLine?: string } {
  const match = text.match(USAGE_LINE_PATTERN);
  if (!match || match.index === undefined) {
    return { bodyText: text };
  }

  const usageLine = match[1]?.trim();
  const bodyText = text.slice(0, match.index).replace(/\\n+$/, "");
  return {
    bodyText: bodyText || text,
    usageLine,
  };
}

function formatElapsedDuration(durationMs: number | undefined): string | undefined {
  if (!Number.isFinite(durationMs) || durationMs === undefined || durationMs <= 0) {
    return undefined;
  }

  const totalSeconds = Math.max(Math.round(durationMs / 1000), 1);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return \`\${minutes}m \${seconds}s\`;
  }
  return \`\${seconds}s\`;
}

function extractEstimatedCostLabel(usageLine: string | undefined): string | undefined {
  if (!usageLine) {
    return undefined;
  }
  return usageLine.match(ESTIMATED_COST_PATTERN)?.[1];
}

function normalizeUsageSummary(usageLine: string | undefined): string | undefined {
  if (!usageLine) {
    return undefined;
  }
  return usageLine.replace(/^Usage:\\s*/i, "").trim();
}

function resolveCardNote(
  agentId: string,
  identity: OutboundIdentity | undefined,
  prefixCtx: { model?: string; provider?: string },
  extras?: { elapsedMs?: number; usageLine?: string },
): string {
  const elapsed = formatElapsedDuration(extras?.elapsedMs);
  const costLabel = extractEstimatedCostLabel(extras?.usageLine);
  const usageSummary = normalizeUsageSummary(extras?.usageLine);
  if (elapsed || costLabel || usageSummary) {
    const parts = ["${completionLabel}"];
    if (elapsed) {
      parts.push("${elapsedPrefix}" + elapsed);
    }
    if (costLabel) {
      parts.push("${costPrefix}" + costLabel);
    } else if (usageSummary) {
      parts.push("${usagePrefix}" + usageSummary);
    }
    return parts.join(" · ");
  }

  const name = identity?.name?.trim() || agentId;
  const parts: string[] = [\`Agent: \${name}\`];
  if (prefixCtx.model) {
    parts.push(\`Model: \${prefixCtx.model}\`);
  }
  if (prefixCtx.provider) {
    parts.push(\`Provider: \${prefixCtx.provider}\`);
  }
  return parts.join(" | ");
}`;
}

export function patchOpenClawReplyDispatcher(
  source: string,
  mode: OpenClawPatchMode,
): string {
  let patched = source;
  if (isPatched(patched)) {
    return patched;
  }

  const replacements: Array<[string, string]> = [
    [ORIGINAL_CARD_NOTE_BLOCK, buildCardNoteBlock(mode)],
    [
      ORIGINAL_STREAMING_PROMISE_LINE,
      `${ORIGINAL_STREAMING_PROMISE_LINE}\n  let replyStartedAt: number | null = null;`,
    ],
    [
      ORIGINAL_ON_REPLY_START,
      `      onReplyStart: async () => {\n        deliveredFinalTexts.clear();\n        replyStartedAt = Date.now();\n        if (streamingEnabled && renderMode === "card") {\n          startStreaming();\n        }\n        await typingCallbacks?.onReplyStart?.();\n      },`,
    ],
    [
      ORIGINAL_CLOSE_STREAMING,
      `    if (streaming?.isActive()) {\n      let text = buildCombinedStreamText(reasoningText, streamText);\n      if (mentionTargets?.length) {\n        text = buildMentionedCardContent(mentionTargets, text);\n      }\n      const { bodyText, usageLine } = splitTrailingUsageLine(text);\n      const finalNote = resolveCardNote(agentId, identity, prefixContext.prefixContext, {\n        elapsedMs: replyStartedAt ? Date.now() - replyStartedAt : undefined,\n        usageLine,\n      });\n      await streaming.close(bodyText, { note: finalNote });\n      replyStartedAt = null;\n    }`,
    ],
  ];

  for (const [search, replacement] of replacements) {
    if (!patched.includes(search)) {
      throw new Error(`OpenClaw upstream 结构不匹配，无法找到补丁片段: ${search.slice(0, 48)}...`);
    }
    patched = patched.replace(search, replacement);
  }

  const useCardReplacement = `          if (useCard) {\n            const { bodyText, usageLine } = splitTrailingUsageLine(text);\n            const cardHeader = resolveCardHeader(agentId, identity);\n            const cardNote = resolveCardNote(agentId, identity, prefixContext.prefixContext, {\n              elapsedMs:\n                info?.kind === "final" && replyStartedAt ? Date.now() - replyStartedAt : undefined,\n              usageLine,\n            });\n            await sendChunkedTextReply({\n              text: bodyText,\n              useCard: true,\n              infoKind: info?.kind,\n              sendChunk: async ({ chunk, isFirst }) => {\n                await sendStructuredCardFeishu({\n                  cfg,\n                  to: chatId,\n                  text: chunk,\n                  replyToMessageId: sendReplyToMessageId,\n                  replyInThread: effectiveReplyInThread,\n                  mentions: isFirst ? mentionTargets : undefined,\n                  accountId,\n                  header: cardHeader,\n                  note: cardNote,\n                });\n              },\n            });\n            if (info?.kind === "final") {\n              replyStartedAt = null;\n            }\n          } else {`;

  if (patched.includes(ORIGINAL_USE_CARD_BLOCK)) {
    patched = patched.replace(ORIGINAL_USE_CARD_BLOCK, useCardReplacement);
  } else if (USE_CARD_BLOCK_PATTERN.test(patched)) {
    patched = patched.replace(USE_CARD_BLOCK_PATTERN, useCardReplacement);
  } else {
    throw new Error("OpenClaw upstream 结构不匹配，无法找到 if (useCard) 补丁片段");
  }

  return patched;
}

async function readManifest(manifestPath: string): Promise<PatchManifest | null> {
  try {
    const content = await readFile(manifestPath, "utf8");
    return JSON.parse(content) as PatchManifest;
  } catch {
    return null;
  }
}

async function ensureGitExcludeRule(excludePath: string): Promise<void> {
  try {
    const content = await readFile(excludePath, "utf8");
    if (content.includes(".tokenpay/")) {
      return;
    }
    const next = content.endsWith("\n") ? `${content}.tokenpay/\n` : `${content}\n.tokenpay/\n`;
    await writeFile(excludePath, next, "utf8");
  } catch {
    // Ignore non-git directories or repositories without info/exclude.
  }
}

export async function installOpenClawPatch(
  repoPath: string,
  mode: OpenClawPatchMode,
): Promise<OpenClawPatchResult> {
  const paths = resolvePaths(repoPath);
  const manifest = await readManifest(paths.manifestPath);
  const current = await readFile(paths.targetFile, "utf8");
  const baseSource =
    manifest && isPatched(current) ? await readFile(paths.backupFile, "utf8") : current;
  const next = patchOpenClawReplyDispatcher(baseSource, mode);

  if (current === next && manifest?.mode === mode) {
    return {
      repoPath: paths.repoRoot,
      mode,
      changed: false,
      targetFile: paths.targetFile,
      manifestPath: paths.manifestPath,
    };
  }

  await mkdir(dirname(paths.manifestPath), { recursive: true });
  if (!manifest) {
    await copyFile(paths.targetFile, paths.backupFile);
  }

  await writeFile(paths.targetFile, next, "utf8");
  await ensureGitExcludeRule(paths.gitExcludePath);
  const nextManifest: PatchManifest = {
    version: 1,
    mode,
    createdAt: new Date().toISOString(),
    targetFile: TARGET_FILE,
    backupFile: BACKUP_FILE,
  };
  await writeFile(paths.manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");

  return {
    repoPath: paths.repoRoot,
    mode,
    changed: true,
    targetFile: paths.targetFile,
    manifestPath: paths.manifestPath,
  };
}

export async function uninstallOpenClawPatch(
  repoPath: string,
): Promise<OpenClawPatchResult> {
  const paths = resolvePaths(repoPath);
  const manifest = await readManifest(paths.manifestPath);
  if (!manifest) {
    return {
      repoPath: paths.repoRoot,
      changed: false,
      targetFile: paths.targetFile,
      manifestPath: paths.manifestPath,
    };
  }

  const backup = await readFile(paths.backupFile, "utf8");
  await writeFile(paths.targetFile, backup, "utf8");
  await rm(dirname(paths.manifestPath), { recursive: true, force: true });

  return {
    repoPath: paths.repoRoot,
    changed: true,
    targetFile: paths.targetFile,
    manifestPath: paths.manifestPath,
  };
}
