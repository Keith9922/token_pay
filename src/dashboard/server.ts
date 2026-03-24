import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseClaudePath } from "../adapters/claude.js";
import { parseCodexPath } from "../adapters/codex.js";
import { parseOpenClawPath } from "../adapters/openclaw.js";
import type { CostEvent, DashboardPayload, ProviderKind } from "../core/types.js";

export interface DashboardOptions {
  port: number;
  provider: ProviderKind | "all";
  inputs: string[];
}

async function loadEvents(options: DashboardOptions): Promise<CostEvent[]> {
  const tasks: Promise<CostEvent[]>[] = [];

  if (options.provider === "all" || options.provider === "codex") {
    tasks.push(parseCodexPath("/Users/ronggang/.codex/sessions"));
  }
  if (options.provider === "all" || options.provider === "claude-code") {
    tasks.push(parseClaudePath("/Users/ronggang/.claude/projects"));
  }
  if (options.provider === "all" || options.provider === "openclaw") {
    for (const input of options.inputs) {
      tasks.push(parseOpenClawPath(input));
    }
  }

  const settled = await Promise.allSettled(tasks);
  return settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

function summarize(events: CostEvent[]): DashboardPayload["summary"] {
  return events.reduce(
    (summary, event) => {
      summary.totalUsd += event.cost.totalUsd;
      summary.totalInputTokens += event.usage.inputTokens;
      summary.totalOutputTokens += event.usage.outputTokens;
      summary.totalEvents += 1;
      return summary;
    },
    {
      totalUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalEvents: 0,
    },
  );
}

export async function startDashboard(options: DashboardOptions): Promise<void> {
  const publicDir = join(process.cwd(), "src/dashboard/public");

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (url.pathname === "/api/events") {
      const events = await loadEvents(options);
      const payload: DashboardPayload = {
        generatedAt: new Date().toISOString(),
        providerFilter: options.provider,
        events,
        summary: summarize(events),
      };
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(payload));
      return;
    }

    const filePath = url.pathname === "/" ? join(publicDir, "index.html") : join(publicDir, url.pathname);
    try {
      const content = await readFile(filePath);
      const contentType = filePath.endsWith(".html")
        ? "text/html; charset=utf-8"
        : "text/plain; charset=utf-8";
      response.writeHead(200, { "content-type": contentType });
      response.end(content);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port, "127.0.0.1", () => resolve());
  });

  // eslint-disable-next-line no-console
  console.log(
    `TokenPay dashboard running at http://127.0.0.1:${options.port} (provider=${options.provider})`,
  );
}

