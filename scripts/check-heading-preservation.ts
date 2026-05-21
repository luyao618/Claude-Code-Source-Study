#!/usr/bin/env bun
/**
 * §0.5.6 C-2 · 标题保留闸
 *
 * v1 章节的一级 / 二级 markdown 标题集合必须是 v2 版本标题集合的子集
 * （允许新增小节，不允许删 / 改名）。frontmatter 含 `骨架重排: yes` 时
 * 显式放行。
 *
 * 使用：
 *   bun scripts/check-heading-preservation.ts [--base origin/main] [--files docs/01-...md ...]
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const base = baseIdx >= 0 ? args[baseIdx + 1] : "origin/main";
const filesIdx = args.indexOf("--files");
const explicitFiles = filesIdx >= 0 ? args.slice(filesIdx + 1) : null;

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

function getBaseContent(base: string, file: string): string | null {
  try {
    return execSync(`git -c core.quotepath=false show ${base}:"${file}"`, { encoding: "utf8" });
  } catch {
    return null;
  }
}

function extractHeadings(text: string): { level: number; title: string }[] {
  const out: { level: number; title: string }[] = [];
  // 跳过 fenced code 块
  const lines = text.split("\n");
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,2})\s+(.+?)\s*$/);
    if (m) out.push({ level: m[1].length, title: m[2].trim() });
  }
  return out;
}

function frontmatterAllowsRewrite(text: string): boolean {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return false;
  return /骨架重排:\s*yes/.test(m[1]);
}

const files = (explicitFiles ?? getChangedFiles(base)).filter(
  (f) => f.startsWith("docs/") && f.endsWith(".md") && f !== "docs/V2-REVISION-SPEC.md",
);

if (files.length === 0) {
  console.log("[C-2] no docs changed; skip.");
  process.exit(0);
}

let failed = false;
for (const file of files) {
  const base0 = getBaseContent(base, file);
  if (base0 === null) {
    console.log(`[C-2] ${file}: new file, skip.`);
    continue;
  }
  if (!existsSync(file)) {
    console.error(
      `[C-2] FAIL ${file}: v1 中存在的文档在 v2 worktree 中缺失（删除或改名），违反标题保留闸（v1 标题集合不可能成为空集合的子集）。` +
        ` 若属合法迁移，请保留同名占位或显式拆分新文件。`,
    );
    failed = true;
    continue;
  }
  const head0 = readFileSync(file, "utf8");
  if (frontmatterAllowsRewrite(head0)) {
    console.log(`[C-2] ${file}: 骨架重排=yes, bypass.`);
    continue;
  }
  const baseHeadings = extractHeadings(base0);
  const headSet = new Set(extractHeadings(head0).map((h) => `${h.level}:${h.title}`));
  const missing = baseHeadings.filter(
    (h) => !headSet.has(`${h.level}:${h.title}`),
  );
  if (missing.length > 0) {
    console.error(
      `[C-2] FAIL ${file}: ${missing.length} v1 一/二级标题缺失或被改名:`,
    );
    for (const h of missing) console.error(`        ${"#".repeat(h.level)} ${h.title}`);
    failed = true;
  } else {
    console.log(`[C-2] OK   ${file}: 全部 ${baseHeadings.length} 个 v1 标题保留`);
  }
}

process.exit(failed ? 1 : 0);
