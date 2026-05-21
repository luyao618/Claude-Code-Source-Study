#!/usr/bin/env bun
/**
 * §0.5.6 C-1 · Diff 体积闸
 *
 * 仅对"勘误保留"与"迭代重写"档章节生效：在 PR diff 中检查中文段落的
 * 替换比例。对每个 v1→v2 文件，比较 base ref 与 HEAD 的版本，按字符
 * 留存率（原文中字符在新文中的命中比例）给出留存率；< 50% 视为越界。
 *
 * 使用：
 *   bun scripts/check-prose-diff-ratio.ts [--base origin/main] [--files docs/01-...md ...]
 *
 * 退出：0 通过 / 1 失败。
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const base = baseIdx >= 0 ? args[baseIdx + 1] : "origin/main";
const filesIdx = args.indexOf("--files");
const explicitFiles = filesIdx >= 0 ? args.slice(filesIdx + 1) : null;

// "勘误保留" 与 "迭代重写" 档（来源：§5 与 §6.1 矩阵手工同步；新增 / 拆分合并 / 保留档不在闸口范围内）
const PROTECTED_DOCS = new Set<string>([
  "docs/01-项目全景.md",
  "docs/02-启动优化.md",
  "docs/03-状态管理.md",
  "docs/04-System-Prompt-工程.md",
  "docs/05-对话循环.md",
  "docs/06-上下文管理.md",
  "docs/07-Prompt-Cache.md",
  "docs/08-Thinking-与推理控制.md",
  "docs/11-命令系统.md",
  "docs/12-Agent-系统.md",
  "docs/13-内置Agent设计模式.md",
  "docs/14-任务系统.md",
  "docs/15-MCP-协议实现.md",
  "docs/16-权限系统.md",
  "docs/18-Hooks系统.md",
  "docs/21-Ink框架深度定制.md",
  "docs/23-Memory系统.md",
  "docs/24-Skill-Plugin开发实战.md",
  "docs/25-架构模式总结.md",
]);

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

function isCJK(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 0x3400 && c <= 0x9fff;
}

function retentionRatio(oldText: string, newText: string): number {
  // 以 8 字 CJK 滑窗作为段落特征，计算 old 中有多少窗口在 new 中仍可命中。
  const W = 8;
  const oldChars = Array.from(oldText).filter(isCJK);
  if (oldChars.length < W) return 1;
  const newSet = new Set<string>();
  const newChars = Array.from(newText).filter(isCJK);
  for (let i = 0; i + W <= newChars.length; i++) {
    newSet.add(newChars.slice(i, i + W).join(""));
  }
  let hit = 0,
    total = 0;
  for (let i = 0; i + W <= oldChars.length; i += W) {
    total++;
    const win = oldChars.slice(i, i + W).join("");
    if (newSet.has(win)) hit++;
  }
  return total === 0 ? 1 : hit / total;
}

function frontmatterAllowsRewrite(text: string): boolean {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return false;
  return /骨架重排:\s*yes/.test(m[1]);
}

const files = (explicitFiles ?? getChangedFiles(base)).filter((f) =>
  PROTECTED_DOCS.has(f),
);

if (files.length === 0) {
  console.log("[C-1] no protected docs changed; skip.");
  process.exit(0);
}

let failed = false;
for (const file of files) {
  const base0 = getBaseContent(base, file);
  if (base0 === null) {
    console.log(`[C-1] ${file}: new file, skip.`);
    continue;
  }
  if (!existsSync(file)) {
    console.error(
      `[C-1] FAIL ${file}: protected v1 文档在 v2 worktree 中缺失（删除或改名），不允许绕过守卫。` +
        ` 如确属合法迁移，请在 PR 中显式新增同名/继任文件并申请人工 review。`,
    );
    failed = true;
    continue;
  }
  const head0 = readFileSync(file, "utf8");
  if (frontmatterAllowsRewrite(head0)) {
    console.log(`[C-1] ${file}: 骨架重排=yes, bypass.`);
    continue;
  }
  const ratio = retentionRatio(base0, head0);
  const pct = (ratio * 100).toFixed(1);
  if (ratio < 0.5) {
    console.error(`[C-1] FAIL ${file}: 中文段落留存率 ${pct}% < 50%`);
    failed = true;
  } else {
    console.log(`[C-1] OK   ${file}: 中文段落留存率 ${pct}%`);
  }
}

process.exit(failed ? 1 : 0);
