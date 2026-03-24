import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";

export async function readJson(filePath: string): Promise<unknown> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

export async function readJsonLines(filePath: string): Promise<unknown[]> {
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter(Boolean)
    .map((line: string) => JSON.parse(line));
}

export async function collectFiles(
  rootPath: string,
  extensions = new Set([".json", ".jsonl"]),
): Promise<string[]> {
  const rootStat = await stat(rootPath);
  if (rootStat.isFile()) {
    return [rootPath];
  }

  const queue = [rootPath];
  const files: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(nextPath);
        continue;
      }
      if (extensions.has(extname(entry.name))) {
        files.push(nextPath);
      }
    }
  }

  return files.sort();
}
