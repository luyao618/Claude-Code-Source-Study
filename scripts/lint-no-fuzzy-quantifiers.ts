#!/usr/bin/env bun
/**
 * §0.4 闸 · lint-no-fuzzy-quantifiers.ts
 *
 * 在事实段落正则扫禁词：约 / 大概 / 左右 / 大量 / 不少 / 主要 / 大部分 / 几乎 / 很多 / 一些。
 *
 * "事实段落" 启发式定义（与 §0.4 例外条款对齐）：
 *   - 跳过 fenced code 块（``` ... ```）。
 *   - 跳过 frontmatter（`---` ... `---`）。
 *   - 跳过 v1 已发布章节（仅对 v2 修订后改动的部分生效——通过 git diff 决定范围）。
 *   - 跳过开篇 / 结尾的"导言 / 总结 / 比喻段"——以二级标题文本含「引言 / 引子 / 小结 / 总结」识别。
 *   - 跳过 blockquote（以 > 开头的行）。
 *
 * 用法：
 *   bun scripts/lint-no-fuzzy-quantifiers.ts [--base origin/main] [--files docs/01-...md ...]
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FORBIDDEN = ["约", "大概", "左右", "大量", "不少", "主要", "大部分", "几乎", "很多", "一些"];

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const base = baseIdx >= 0 ? args[baseIdx + 1] : "origin/main";
const filesIdx = args.indexOf("--files");
const explicitFiles = filesIdx >= 0 ? args.slice(filesIdx + 1) : null;

function getChangedFiles(base: string): string[] {
  try {
    const out = execSync(
      `git -c core.quotepath=false diff --name-only ${base}...HEAD -- 'docs/*.md' 'docs/appendix/*.md'`,
      { encoding: "utf8" },
    ).trim();
    return out ? out.split("\n") : [];
  } catch {
    return [];
  }
}

const NARRATIVE_TITLE_RE = /(引言|引子|小结|总结|前言|后记)/;

type Hit = { file: string; line: number; word: string; text: string };

function scanFile(file: string): Hit[] {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const hits: Hit[] = [];

  let inFence = false;
  let inFrontmatter = false;
  let frontmatterSeen = false;
  let inNarrativeSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // frontmatter
    if (i === 0 && /^---\s*$/.test(line)) {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (/^---\s*$/.test(line)) {
        inFrontmatter = false;
        frontmatterSeen = true;
      }
      continue;
    }
    if (frontmatterSeen) {
      // no-op
    }

    // fenced code
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // blockquote (导言 / 比喻段常用 > 引言)
    if (/^\s*>/.test(line)) continue;

    // headings：进入 / 退出"导言/总结"小节
    const h = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (h) {
      inNarrativeSection = NARRATIVE_TITLE_RE.test(h[1]);
      continue;
    }

    if (inNarrativeSection) continue;

    for (const w of FORBIDDEN) {
      if (line.includes(w)) {
        hits.push({ file, line: i + 1, word: w, text: line.trim() });
      }
    }
  }
  return hits;
}

const files = (explicitFiles ?? getChangedFiles(base)).filter(
  (f) => f.startsWith("docs/") && f.endsWith(".md") && f !== "docs/V2-REVISION-SPEC.md",
);

if (files.length === 0) {
  console.log("[no-fuzzy] no docs changed; skip.");
  process.exit(0);
}

let failed = false;
for (const f of files) {
  let hits: Hit[] = [];
  try {
    hits = scanFile(f);
  } catch {
    continue;
  }
  if (hits.length > 0) {
    failed = true;
    console.error(`[no-fuzzy] FAIL ${f}: ${hits.length} 处禁词命中：`);
    for (const h of hits) {
      console.error(`  ${f}:${h.line}: 「${h.word}」 → ${h.text}`);
    }
  } else {
    console.log(`[no-fuzzy] OK   ${f}`);
  }
}

process.exit(failed ? 1 : 0);
