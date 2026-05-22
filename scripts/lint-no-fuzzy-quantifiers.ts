#!/usr/bin/env bun
/**
 * §0.4 闸 · lint-no-fuzzy-quantifiers.ts
 *
 * 在事实段落正则扫禁词：约 / 大概 / 左右 / 大量 / 几乎 / 很多。
 * （YAO-99 调整：移除「不少 / 主要 / 大部分 / 一些」四个纯定性语气词，叙事段
 *   几乎必现，保留下来只剩与「X 行/个/种」数值断言相关的对冲词；同时本闸由
 *   fail 降为 warning，命中只打印不阻塞 CI，由 reviewer 在 review 中复核。）
 *
 * "事实段落" 启发式定义（与 §0.4 例外条款对齐）：
 *   - 跳过 fenced code 块（``` ... ```）。
 *   - 跳过 frontmatter（`---` ... `---`）。
 *   - 跳过 v1 已发布章节（仅对 v2 修订后改动的部分生效——通过 git diff 决定范围）。
 *   - 跳过开篇 / 结尾的"导言 / 总结 / 比喻段"——以二级标题文本含「引言 / 引子 / 小结 / 总结」识别。
 *   - 跳过 blockquote（以 > 开头的行）。
 *
 * 扫描范围：默认只扫描 PR diff 中**新增 / 修改的行**（base...HEAD 的 added lines）。
 * v1 已存在的、本次未触碰的事实段落 baseline 命中不再阻塞 CI——这是 §0.4 与 §0.5 共同
 * 要求的口径（详见 YAO-134 仲裁）。需要全文件扫时显式传 `--files <path...>`，例如本地复核。
 *
 * 用法：
 *   bun scripts/lint-no-fuzzy-quantifiers.ts [--base origin/main] [--files docs/01-...md ...]
 *   bun scripts/lint-no-fuzzy-quantifiers.ts --files docs/01-...md   # 全文件扫（本地复核用）
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FORBIDDEN = ["约", "大概", "左右", "大量", "几乎", "很多"];

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

/**
 * 提取 PR diff 中某个文件的「新增行」在 HEAD 中的 1-based 行号集合。
 * 解析标准 unified diff 的 hunk header（`@@ -a,b +c,d @@`），逐行推进。
 *  - 以 `+` 开头（非 `+++`）的行：HEAD 新行号自增 1 并加入集合。
 *  - 以 `-` 开头（非 `---`）的行：HEAD 行号不动。
 *  - 上下文行（` `）：HEAD 行号自增 1。
 */
function getAddedLineNumbers(base: string, file: string): Set<number> {
  const added = new Set<number>();
  let diff: string;
  try {
    diff = execSync(
      `git -c core.quotepath=false diff --unified=0 --no-color ${base}...HEAD -- "${file}"`,
      { encoding: "utf8" },
    );
  } catch {
    return added;
  }
  if (!diff) return added;

  const lines = diff.split("\n");
  let headLine = 0;
  let inHunk = false;
  for (const line of lines) {
    if (line.startsWith("@@")) {
      // @@ -a,b +c,d @@
      const m = line.match(/@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
      if (m) {
        headLine = parseInt(m[1], 10);
        inHunk = true;
      } else {
        inHunk = false;
      }
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) {
      added.add(headLine);
      headLine += 1;
    } else if (line.startsWith("-")) {
      // deletion: no advance in HEAD
    } else if (line.startsWith(" ")) {
      headLine += 1;
    } else if (line === "") {
      // empty context line in --unified=0 is rare; treat as no-op
    }
  }
  return added;
}

const NARRATIVE_TITLE_RE = /(引言|引子|小结|总结|前言|后记)/;

type Hit = { file: string; line: number; word: string; text: string };

/**
 * 扫描文件中的禁词命中。
 *  - 若 `lineFilter` 非 null：只对 `lineFilter` 包含的行号（HEAD 1-based）报告命中。
 *    用于 PR diff 扫描——v1 baseline 命中不报。
 *  - 若 `lineFilter` 为 null：扫描全文件（`--files` 显式模式 / 本地复核）。
 */
function scanFile(file: string, lineFilter: Set<number> | null): Hit[] {
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

    // diff 模式：跳过未被本次 PR 改动的行（v1 baseline）
    if (lineFilter && !lineFilter.has(i + 1)) continue;

    for (const w of FORBIDDEN) {
      if (line.includes(w)) {
        hits.push({ file, line: i + 1, word: w, text: line.trim() });
      }
    }
  }
  return hits;
}

const useExplicit = explicitFiles !== null;
const files = (explicitFiles ?? getChangedFiles(base)).filter(
  (f) => f.startsWith("docs/") && f.endsWith(".md") && f !== "docs/V2-REVISION-SPEC.md",
);

if (files.length === 0) {
  console.log("[no-fuzzy] no docs changed; skip.");
  process.exit(0);
}

console.log(
  useExplicit
    ? "[no-fuzzy] explicit --files mode: scanning full file contents."
    : `[no-fuzzy] diff mode: scanning only lines added/changed vs ${base}.`,
);

let warned = false;
for (const f of files) {
  let hits: Hit[] = [];
  try {
    const lineFilter = useExplicit ? null : getAddedLineNumbers(base, f);
    if (!useExplicit && lineFilter.size === 0) {
      // 文件出现在 --name-only 列表里但无新增行（例如纯删除）—— 没有新内容要扫
      console.log(`[no-fuzzy] OK   ${f} (no added lines)`);
      continue;
    }
    hits = scanFile(f, lineFilter);
  } catch {
    continue;
  }
  if (hits.length > 0) {
    warned = true;
    console.warn(`[no-fuzzy] WARN ${f}: ${hits.length} 处禁词命中（仅新增 / 改动行，由 reviewer 复核，不阻塞 CI）：`);
    for (const h of hits) {
      console.warn(`  ${f}:${h.line}: 「${h.word}」 → ${h.text}`);
    }
  } else {
    console.log(`[no-fuzzy] OK   ${f}`);
  }
}

if (warned) {
  console.warn("[no-fuzzy] 闸已降为 warning（YAO-99）：命中只打印不 fail，由 reviewer 在 review 中复核。");
}
process.exit(0);
