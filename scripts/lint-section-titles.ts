#!/usr/bin/env bun
/**
 * §0.5.6 C-4 · 工程化小标题禁词
 *
 * v2 章节小标题不得匹配以下任一正则（来源：§0.5.6 C-4）：
 *   - ^C\d{2}\s*·              （书脊编号渗入正文标题）
 *   - ^§\d+\s+                 （技术参考手册口吻）
 *   - \w+\.tsx?\s+是\s+\w+，?不是\s+\w+   （"X.tsx 是 Y，不是 Z" 句式）
 *   - ^\d+条旁路
 *   - ^\d+\s+条\s+\S+\s*\+\s*\d+\s+条
 *
 * 使用：
 *   bun scripts/lint-section-titles.ts [--files docs/01-...md ...]
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const base = baseIdx >= 0 ? args[baseIdx + 1] : "origin/main";
const filesIdx = args.indexOf("--files");
const explicitFiles = filesIdx >= 0 ? args.slice(filesIdx + 1) : null;

const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: "C编号前缀", re: /^C\d{2}\s*·/ },
  { name: "§编号前缀", re: /^§\d+\s+/ },
  { name: "X是Y不是Z", re: /\w+\.tsx?\s+是\s+\S+，?不是\s+\S+/ },
  { name: "N条旁路", re: /^\d+条旁路/ },
  { name: "N条+M条", re: /^\d+\s*条\s*\S+\s*\+\s*\d+\s*条/ },
];

function getChangedFiles(base: string): string[] {
  try {
    const out = execSync(`git -c core.quotepath=false diff --name-only ${base}...HEAD -- 'docs/*.md'`, {
      encoding: "utf8",
    }).trim();
    return out ? out.split("\n") : [];
  } catch {
    return [];
  }
}

function extractTitles(text: string): { line: number; title: string }[] {
  const out: { line: number; title: string }[] = [];
  const lines = text.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^```/.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = lines[i].match(/^#{1,6}\s+(.+?)\s*$/);
    if (m) out.push({ line: i + 1, title: m[1].trim() });
  }
  return out;
}

const files = (explicitFiles ?? getChangedFiles(base)).filter(
  (f) => f.startsWith("docs/") && f.endsWith(".md") && f !== "docs/archive/V2-REVISION-SPEC.md",
);

if (files.length === 0) {
  console.log("[C-4] no docs changed; skip.");
  process.exit(0);
}

let failed = false;
for (const file of files) {
  let txt: string;
  try {
    txt = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const titles = extractTitles(txt);
  let fileFailed = false;
  for (const { line, title } of titles) {
    for (const { name, re } of FORBIDDEN) {
      if (re.test(title)) {
        console.error(
          `[C-4] FAIL ${file}:${line}: 命中禁用模式「${name}」: ${title}`,
        );
        fileFailed = true;
        failed = true;
      }
    }
  }
  if (!fileFailed) console.log(`[C-4] OK   ${file}: ${titles.length} 个标题全部合规`);
}

process.exit(failed ? 1 : 0);
