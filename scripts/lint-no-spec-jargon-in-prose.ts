#!/usr/bin/env bun
/**
 * §0.5.5 闸 · lint-no-spec-jargon-in-prose.ts
 *
 * 起因（YAO-99 回灌）：C01 修订时正文出现了三处工程化外漏：
 *   ①「附：本章源码引用清单」整节（一长串 file:line）；
 *   ②「上面目录树漏掉的顶层目录 —— 本书后续章节映射」反向矩阵清单；
 *   ③ 散落的「spec §x.x」「反向矩阵」「required_anchors」「manifest」
 *     「CI 闸」「章节映射」等 squad 内部沟通用词。
 *
 * 这些都是 CC-Dev / OC-PM / OC-R / 麻薯 之间对 CI 交账的脚手架——
 * 读者翻开书是不需要看到的。一旦正文里出现这些词，说明 writer 把
 * 「向 CI 兑现」当成了「向读者解释」，与 §0.5 文体硬约束相违。
 *
 * 本闸扫描章节 markdown 的散文段（不含 frontmatter / 代码块 / blockquote），
 * 命中下列 squad 内部术语 → fail。
 *
 * 扫描范围：默认只扫 PR diff 中**新增 / 改动的行**（与 lint-no-fuzzy-quantifiers
 * 的 diff 模式同口径），避免对 v1 已存在段落产生 false positive。需要全文件
 * 复核传 `--files <path...>`。
 *
 * 用法：
 *   bun scripts/lint-no-spec-jargon-in-prose.ts [--base origin/main] [--files docs/01-...md ...]
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// squad 内部沟通用词。命中即 fail（不像 §0.4 那样降级 warning——这些词
// 是「这本书是给读者看的」与「这是对 CI 交账」之间的界线，没有灰度空间）。
//
// 设计原则：
//   - 词条必须是几乎只在 squad 沟通里出现、不会在叙事书正文里自然产生的术语。
//   - 普通词（如「映射」「清单」）单独不命中；只看复合术语。
//   - 大小写敏感：spec 章节号写法 `§0.1` / `§5` 都要捕获。
const FORBIDDEN: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /spec\s*§/i, label: "spec §x.x" },
  { pattern: /反向矩阵/, label: "反向矩阵" },
  { pattern: /正向矩阵/, label: "正向矩阵" },
  { pattern: /迁移矩阵/, label: "迁移矩阵" },
  { pattern: /章节映射/, label: "章节映射" },
  { pattern: /required_anchors/, label: "required_anchors" },
  { pattern: /manifest\s*(diff|摘要|json)/i, label: "manifest diff/摘要/json" },
  // standalone `manifest`（YAO-99 OC-R 复审补漏）：§0.5.5 item 9 / C-6 文案明确把
  // 「manifest」列为 squad 内部术语。但 `manifest` 是一个通用词——npm plugin / MCP
  // 等领域的 `Plugin Manifest`、`manifest schema`、`PluginManifestSchema` 都是合法
  // 术语（见 docs/24-Skill-Plugin开发实战.md）。所以这里**只**命中 squad 内部用法：
  // 即 manifest 前面挂着「外部 / 附录 / 章节 / 源码 / spec」这类把 manifest 当
  // 「向 CI 交账的脚手架」用的修饰词，或后面跟「文件 / 清单 / 约定」明显指 spec
  // 附录脚手架的搭配。读者域的 `Plugin manifest` / `manifest schema` 不命中。
  {
    pattern: /(外部|附录|章节|源码|spec)\s*manifest/i,
    label: "外部/附录/章节 manifest (squad 脚手架用法)",
  },
  {
    pattern: /manifest\s*(文件|清单|约定)/,
    label: "manifest 文件/清单/约定 (squad 脚手架用法)",
  },
  // §0.5.5 item 9 反例明确点名「来自源码目录列」——§6.2 反向矩阵的列名外漏到正文。
  { pattern: /来自源码目录列/, label: "来自源码目录列" },
  { pattern: /CI\s*闸/, label: "CI 闸" },
  { pattern: /CI\s*lint/, label: "CI lint" },
  { pattern: /骨架重排/, label: "骨架重排" },
  { pattern: /风格双亲/, label: "风格双亲" },
  { pattern: /勘误保留/, label: "勘误保留" },
  { pattern: /拆分合并/, label: "拆分合并" },
  { pattern: /判定档/, label: "判定档" },
  { pattern: /工作量级/, label: "工作量级" },
  { pattern: /全新增比例/, label: "全新增比例" },
  { pattern: /estimated_words/, label: "estimated_words" },
  { pattern: /chapter_id/, label: "chapter_id" },
  { pattern: /source_commit/, label: "source_commit" },
  { pattern: /is_new_chapter/, label: "is_new_chapter" },
  // 附录 / 章节源码引用清单这类「向 CI 兑现」的章节标题
  { pattern: /^#+\s*附[：:]\s*本章源码引用清单/, label: "附：本章源码引用清单 (整节)" },
  { pattern: /^#+\s*本章源码引用清单/, label: "本章源码引用清单 (整节)" },
];

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const base = baseIdx >= 0 ? args[baseIdx + 1] : "origin/main";
const filesIdx = args.indexOf("--files");
const explicitFiles = filesIdx >= 0 ? args.slice(filesIdx + 1) : null;

function getChangedFiles(base: string): string[] {
  try {
    const out = execSync(
      `git -c core.quotepath=false diff --name-only ${base}...HEAD -- 'docs/*.md'`,
      { encoding: "utf8" },
    ).trim();
    return out ? out.split("\n") : [];
  } catch {
    return [];
  }
}

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
      // no advance
    } else if (line.startsWith(" ")) {
      headLine += 1;
    }
  }
  return added;
}

type Hit = { file: string; line: number; label: string; text: string };

function scanFile(file: string, lineFilter: Set<number> | null): Hit[] {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const hits: Hit[] = [];

  let inFence = false;
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (i === 0 && /^---\s*$/.test(line)) {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (/^---\s*$/.test(line)) inFrontmatter = false;
      continue;
    }

    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // blockquote 段（引文 / 比喻）——保守地跳过
    if (/^\s*>/.test(line)) continue;

    if (lineFilter && !lineFilter.has(i + 1)) continue;

    for (const { pattern, label } of FORBIDDEN) {
      if (pattern.test(line)) {
        hits.push({ file, line: i + 1, label, text: line.trim() });
      }
    }
  }
  return hits;
}

const useExplicit = explicitFiles !== null;
// spec 元文档不扫——它的工作就是讨论这些 squad 内部术语。
const files = (explicitFiles ?? getChangedFiles(base)).filter(
  (f) => f.startsWith("docs/") && f.endsWith(".md") && f !== "docs/V2-REVISION-SPEC.md",
);

if (files.length === 0) {
  console.log("[no-spec-jargon] no docs changed; skip.");
  process.exit(0);
}

console.log(
  useExplicit
    ? "[no-spec-jargon] explicit --files mode: scanning full file contents."
    : `[no-spec-jargon] diff mode: scanning only lines added/changed vs ${base}.`,
);

let failed = false;
for (const f of files) {
  let hits: Hit[] = [];
  try {
    const lineFilter = useExplicit ? null : getAddedLineNumbers(base, f);
    if (!useExplicit && lineFilter.size === 0) {
      console.log(`[no-spec-jargon] OK   ${f} (no added lines)`);
      continue;
    }
    hits = scanFile(f, lineFilter);
  } catch {
    continue;
  }
  if (hits.length > 0) {
    failed = true;
    console.error(`[no-spec-jargon] FAIL ${f}: ${hits.length} 处 squad 内部术语外漏到正文：`);
    for (const h of hits) {
      console.error(`  ${f}:${h.line}: 「${h.label}」 → ${h.text}`);
    }
  } else {
    console.log(`[no-spec-jargon] OK   ${f}`);
  }
}

if (failed) {
  console.error(
    "[no-spec-jargon] 章节正文出现 squad 内部术语，违反 §0.5.5。这些词只活在 PR 描述 / issue / spec / 外部 manifest 里，不进书。删掉或改写后重试。",
  );
  process.exit(1);
}
process.exit(0);
