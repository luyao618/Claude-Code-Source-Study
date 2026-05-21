#!/usr/bin/env bun
/**
 * §0.5.6 C-3 · 代码块占比闸
 *
 * 范围：仅对 v2 新增章节（§0.5.4 列出的 8 篇 + 任何标记 `新增章节: yes`
 * frontmatter 的文件）生效。理由：v1 老章节天然带有大量 mermaid / ts 代码
 * 块，对其强制 25% 反而会阻塞 minimal-diff 修订；§0.5.4 #3 明确把 C-3
 * 写在"新章"规则下。
 *
 * 仅统计源码 fenced block：`ts / tsx / js / jsx / bash / sh / typescript /
 * javascript`。`mermaid / json / yaml / md / text` 等图示与配置不计入"代码"。
 *
 * 单章源码 fenced block 字符数 / 全章字符数 > 25% → fail。
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const base = baseIdx >= 0 ? args[baseIdx + 1] : "origin/main";
const filesIdx = args.indexOf("--files");
const explicitFiles = filesIdx >= 0 ? args.slice(filesIdx + 1) : null;

// §0.5.4 + §5 列出的 8 篇新增章节文件名（writer 落地时按 v2 命名约定建立）。
// 当文件还未落地时，集合为空也无影响——脚本只会跳过。
const NEW_CHAPTER_PATTERNS: RegExp[] = [
  /\b(C04|c04)\b/,
  /\b(C13|c13)\b/,
  /\b(C17|c17)\b/,
  /\b(C24|c24)\b/,
  /\b(C25|c25)\b/,
  /\b(C28|c28)\b/,
  /\b(C29|c29)\b/,
  /\b(C30|c30)\b/,
];

function getChangedFiles(base: string): string[] {
  try {
    const out = execSync(`git diff --name-only ${base}...HEAD -- 'docs/*.md'`, {
      encoding: "utf8",
    }).trim();
    return out ? out.split("\n") : [];
  } catch {
    return [];
  }
}

function frontmatterIsNewChapter(text: string): boolean {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return false;
  return /新增章节:\s*yes/.test(m[1]);
}

function isNewChapterPath(file: string): boolean {
  return NEW_CHAPTER_PATTERNS.some((re) => re.test(file));
}

const SOURCE_LANGS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "typescript",
  "javascript",
  "bash",
  "sh",
  "shell",
  "zsh",
]);

function codeRatio(
  text: string,
): { ratio: number; codeChars: number; total: number } {
  const total = text.length;
  let codeChars = 0;
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (SOURCE_LANGS.has((m[1] ?? "").toLowerCase())) codeChars += m[0].length;
  }
  return { ratio: total === 0 ? 0 : codeChars / total, codeChars, total };
}

const candidates = (explicitFiles ?? getChangedFiles(base)).filter(
  (f) => f.startsWith("docs/") && f.endsWith(".md") && f !== "docs/V2-REVISION-SPEC.md",
);

if (candidates.length === 0) {
  console.log("[C-3] no docs changed; skip.");
  process.exit(0);
}

let failed = false;
for (const file of candidates) {
  let txt: string;
  try {
    txt = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!isNewChapterPath(file) && !frontmatterIsNewChapter(txt)) {
    console.log(`[C-3] skip ${file}: 非 v2 新增章节，C-3 不适用`);
    continue;
  }
  const { ratio, codeChars, total } = codeRatio(txt);
  const pct = (ratio * 100).toFixed(1);
  if (ratio > 0.25) {
    console.error(
      `[C-3] FAIL ${file}: 源码块占比 ${pct}% (${codeChars}/${total}) > 25%`,
    );
    failed = true;
  } else {
    console.log(`[C-3] OK   ${file}: 源码块占比 ${pct}%`);
  }
}

process.exit(failed ? 1 : 0);

