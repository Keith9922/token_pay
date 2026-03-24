#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseClaudePath } from "./adapters/claude.js";
import { parseCodexPath } from "./adapters/codex.js";
import { parseOpenClawPath } from "./adapters/openclaw.js";
import type { CostEvent, ProviderKind } from "./core/types.js";
import { renderOpenClawFeishuFooter } from "./openclaw/feishu-footer.js";
import {
  installOpenClawPatch,
  uninstallOpenClawPatch,
} from "./openclaw/patcher.js";
import { startDashboard } from "./dashboard/server.js";

interface ParsedArgs {
  positionals: string[];
  flags: Map<string, string[]>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Map<string, string[]>();
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, ["true"]);
      continue;
    }
    const existing = flags.get(key) ?? [];
    existing.push(next);
    flags.set(key, existing);
    index += 1;
  }

  return { positionals, flags };
}

function flag(args: ParsedArgs, key: string, fallback?: string): string | undefined {
  return args.flags.get(key)?.at(-1) ?? fallback;
}

function repeatedFlag(args: ParsedArgs, key: string): string[] {
  return args.flags.get(key) ?? [];
}

async function loadEvents(provider: ProviderKind, inputs: string[]): Promise<CostEvent[]> {
  if (provider === "codex") {
    const path = inputs[0] ?? "/Users/ronggang/.codex/sessions";
    return parseCodexPath(resolve(path));
  }
  if (provider === "claude-code") {
    const path = inputs[0] ?? "/Users/ronggang/.claude/projects";
    return parseClaudePath(resolve(path));
  }
  if (inputs.length === 0) {
    throw new Error("openclaw 模式需要至少一个 --input 路径");
  }
  const events = await Promise.all(inputs.map((input) => parseOpenClawPath(resolve(input))));
  return events.flat();
}

function printHelp(): void {
  console.log(`TokenPay CLI

Usage:
  tokenpay events --provider <openclaw|codex|claude-code> [--input <path>...]
  tokenpay footer --provider openclaw --input <path>
  tokenpay dashboard [--provider <all|openclaw|codex|claude-code>] [--input <path>...] [--port 3210]
  tokenpay openclaw-patch --repo <path> [--mode <standalone|pr>] [--revert]

Examples:
  tokenpay events --provider codex --input ~/.codex/sessions
  tokenpay footer --provider openclaw --input test/fixtures/openclaw/response.json
  tokenpay dashboard --provider openclaw --input ./logs/openclaw-response.json
  tokenpay openclaw-patch --repo ~/code/openclaw --mode standalone
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0];

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "dashboard") {
    const provider = (flag(args, "provider", "all") as
      | ProviderKind
      | "all");
    const port = Number(flag(args, "port", "3210"));
    const inputs = repeatedFlag(args, "input").map((input) => resolve(input));
    await startDashboard({ provider, port, inputs });
    return;
  }

  if (command === "events") {
    const provider = flag(args, "provider") as ProviderKind | undefined;
    if (!provider) {
      throw new Error("events 命令需要 --provider");
    }
    const inputs = repeatedFlag(args, "input");
    const events = await loadEvents(provider, inputs);
    console.log(JSON.stringify(events, null, 2));
    return;
  }

  if (command === "footer") {
    const provider = flag(args, "provider") as ProviderKind | undefined;
    if (provider !== "openclaw") {
      throw new Error("footer 命令当前只支持 --provider openclaw");
    }
    const inputs = repeatedFlag(args, "input");
    const events = await loadEvents(provider, inputs);
    const latest = events.sort((left, right) => left.timestamp.localeCompare(right.timestamp)).at(-1);
    if (!latest) {
      throw new Error("没有找到可渲染的 OpenClaw 费用事件");
    }
    const detailed = flag(args, "style") === "detailed";
    const footer = renderOpenClawFeishuFooter(latest, {
      style: detailed ? "detailed" : "compact",
    });
    const outputFile = flag(args, "output");
    if (outputFile) {
      await writeFile(resolve(outputFile), footer, "utf8");
    }
    console.log(footer);
    return;
  }

  if (command === "openclaw-patch") {
    const repoPath = flag(args, "repo");
    if (!repoPath) {
      throw new Error("openclaw-patch 命令需要 --repo");
    }

    if (flag(args, "revert") === "true") {
      const result = await uninstallOpenClawPatch(repoPath);
      console.log(
        result.changed
          ? `已回滚 OpenClaw 补丁: ${result.targetFile}`
          : `没有检测到已安装的 OpenClaw 补丁: ${result.repoPath}`,
      );
      return;
    }

    const modeFlag = flag(args, "mode", "standalone");
    if (modeFlag !== "standalone" && modeFlag !== "pr") {
      throw new Error("--mode 只支持 standalone 或 pr");
    }

    const result = await installOpenClawPatch(repoPath, modeFlag);
    console.log(
      result.changed
        ? `已安装 OpenClaw 补丁(${modeFlag}): ${result.targetFile}`
        : `OpenClaw 补丁已是最新状态(${modeFlag}): ${result.targetFile}`,
    );
    return;
  }

  throw new Error(`未知命令: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
