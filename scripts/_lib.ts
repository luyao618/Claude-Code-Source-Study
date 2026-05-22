/**
 * 附录生成 / CI 校验脚本共享工具。
 *
 * 设计目标：
 * - 单一来源读取源码路径（CLAUDE_CODE_SOURCE_PATH 环境变量 / --source-path 参数 / 默认 ~/work/code/awesome-project/claude-code-cli）。
 * - 提供 frontmatter / source_commit / manifest IO / diff summary 等公共能力，避免各脚本重复实现。
 * - 不做副作用：调用方决定是否写盘 / 退出码。
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

export type ManifestItem = {
  name: string;
  category?: string;
  source_files?: string[];
  feature_flags?: string[];
  wire_type?: string;
  default_registered?: boolean;
  notes?: string;
  [k: string]: unknown;
};

export type Manifest = {
  source_commit: string;
  items: ManifestItem[];
  [k: string]: unknown;
};

const DEFAULT_SOURCE = join(
  homedir(),
  "work",
  "code",
  "awesome-project",
  "claude-code-cli",
);

export function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const get = (k: string): string | undefined => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const has = (k: string) => args.includes(k);
  return { args, get, has };
}

export function resolveSourcePath(cliPath?: string): string {
  const p = cliPath ?? process.env.CLAUDE_CODE_SOURCE_PATH ?? DEFAULT_SOURCE;
  return resolve(p);
}

export function getSourceCommit(sourcePath: string): string {
  try {
    return execSync(`git -C "${sourcePath}" rev-parse HEAD`, {
      encoding: "utf8",
    }).trim();
  } catch (err) {
    throw new Error(
      `Failed to read git HEAD at ${sourcePath}: ${(err as Error).message}`,
    );
  }
}

export function listTopLevelDirs(sourcePath: string): string[] {
  return readdirSync(sourcePath)
    .filter((n) => !n.startsWith("."))
    .filter((n) => {
      try {
        return statSync(join(sourcePath, n)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

export function listFiles(
  dir: string,
  opts: { recursive?: boolean; extensions?: string[] } = {},
): string[] {
  const out: string[] = [];
  const exts = opts.extensions;
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d)) {
      if (name.startsWith(".")) continue;
      const p = join(d, name);
      let s;
      try {
        s = statSync(p);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        if (opts.recursive) walk(p);
      } else if (s.isFile()) {
        if (!exts || exts.some((e) => name.endsWith(e))) out.push(p);
      }
    }
  };
  walk(dir);
  return out.sort();
}

export function readFileLineRange(file: string): string {
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8");
}

export function countLines(file: string): number {
  if (!existsSync(file)) return 0;
  const s = readFileSync(file, "utf8");
  return s.split("\n").length;
}

export function ensureDir(file: string): void {
  mkdirSync(dirname(file), { recursive: true });
}

export function writeManifest(file: string, manifest: Manifest): void {
  ensureDir(file);
  writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

export function readManifest(file: string): Manifest | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Manifest;
  } catch {
    return null;
  }
}

export function writeFile(file: string, contents: string): void {
  ensureDir(file);
  writeFileSync(file, contents, "utf8");
}

/**
 * 与已有 manifest 做 diff summary，输出到 stdout。
 * 用于 PR 描述里粘贴 manifest diff 摘要（脚本提供 `--diff-summary` flag）。
 */
export function printDiffSummary(
  label: string,
  prev: Manifest | null,
  next: Manifest,
): void {
  const prevNames = new Set((prev?.items ?? []).map((i) => i.name));
  const nextNames = new Set(next.items.map((i) => i.name));
  const added: string[] = [];
  const removed: string[] = [];
  for (const n of nextNames) if (!prevNames.has(n)) added.push(n);
  for (const n of prevNames) if (!nextNames.has(n)) removed.push(n);
  console.log(
    `[${label}] manifest diff: total=${next.items.length} added=${added.length} removed=${removed.length}`,
  );
  if (added.length) console.log(`  + ${added.join(", ")}`);
  if (removed.length) console.log(`  - ${removed.join(", ")}`);
  if (prev && prev.source_commit !== next.source_commit) {
    console.log(
      `  source_commit: ${prev.source_commit} -> ${next.source_commit}`,
    );
  }
}

/**
 * Compute a 1-based [start,end] line range for a regex match in a file.
 */
export function lineRangeFor(text: string, matchIndex: number, matchLen: number): { start: number; end: number } {
  const start = text.slice(0, matchIndex).split("\n").length;
  const end = text.slice(0, matchIndex + matchLen).split("\n").length;
  return { start, end };
}

/**
 * Find a single-line position (1-based) of the first occurrence of `needle` in `text`.
 * Returns undefined if not found.
 */
export function findLine(text: string, needle: string | RegExp): number | undefined {
  if (typeof needle === "string") {
    const idx = text.indexOf(needle);
    if (idx < 0) return undefined;
    return text.slice(0, idx).split("\n").length;
  }
  const m = needle.exec(text);
  if (!m) return undefined;
  return text.slice(0, m.index).split("\n").length;
}
