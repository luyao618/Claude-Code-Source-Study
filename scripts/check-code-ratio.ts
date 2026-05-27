#!/usr/bin/env bun
/**
 * §0.5.6 C-3 · 代码块占比闸
 *
 * 范围：仅对 v2 新增章节生效（8 篇 v1 完全没有的章节：C04 / C13 / C17 / C24 /
 * C25 / C28 / C29 / C30）。
 *
 * **新章识别口径（YAO-99 / YAO-135 仲裁）**：
 *
 * 旧实现（pre-YAO-135）以章节文件 frontmatter 的 `新增章节: yes` 作为唯一判据，
 * 与 §0.1.1（章节文件**禁止任何 frontmatter**，CI C-5 强制）互锁——任何新章
 * 写了 frontmatter 在 C-3 通过的同时被 C-5 杀。spec §6.2 行 569（YAO-99）已经
 * 明写「识别新章的判据由 §6.2 反向矩阵的 `全新增比例` 列、或附录 manifest 的
 * 章节清单提供」，但脚本一直没跟上。
 *
 * 本次（YAO-135）把脚本切到 spec 口径：维护一个**显式新章落地文件路径集合**
 * `NEW_CHAPTER_FILES`，与 spec §9.3 的「新章落地文件名表」逐字对应。新章身份
 * 仅由「PR 改动到的文件路径是否落在该集合中」判定——不读 frontmatter，不再
 * 维护 NN 前缀集合。新章的 NN 槽位与 v1 已发布章节的 NN 不会冲突（v1 占 00–25，
 * 新章自 26 起追加），由 spec §9.3 表格约束。
 *
 * **判定范围（OC-R PR #17 反馈收窄）**：候选文件限制为顶层章节文件
 * `docs/NN-标题.md`（两位数字前缀），由 `CHAPTER_FILE_RE` 控制。
 * `docs/appendix/{A..F}.md`（自动生成附录）、`docs/V2-REVISION-SPEC.md`
 * （spec 本体）以及任何子目录散页都不进入新章判定。
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

/**
 * v2 新增章节的**落地文件路径**集合，与 V2-REVISION-SPEC.md §9.3「新章落地
 * 文件名表」逐字对应。新章自 NN=26 起追加，避开 v1 已占用的 00–25 槽位。
 *
 * 表（spec §9.3）：
 *   C04 配置迁移即代码                    → docs/26-配置迁移即代码.md
 *   C13 通信、调度、问询与合成工具         → docs/27-通信调度问询与合成工具.md
 *   C17 Coordinator、Cron 与定时调度       → docs/<NN>-…md （同上）
 *   C24 Bridge IPC 与远程会话              → docs/<NN>-…md
 *   C25 DirectConnect 与上游代理           → docs/<NN>-…md
 *   C28 Keybindings、Vim 与 Voice 输入     → docs/<NN>-…md
 *   C29 Buddy 人格                         → docs/<NN>-…md
 *   C30 Doctor 屏与 Output Style 体验      → docs/<NN>-…md
 *
 * 仅 C04 / C13 在 YAO-135 仲裁中被显式落槽；其余 6 篇的 NN 在各自 issue 启动时由
 * OC-Dev 在 spec §9.3 表格中追加，**同时**更新本集合。集合与 spec 表格保持
 * 一一对应是硬约束——任何新章下笔前若 NN 未在此集合中登记，CI 会 fail（缺
 * `is_new_chapter` 身份导致 25% 占比闸 skip = 漏判）。
 */
const NEW_CHAPTER_FILES = new Set<string>([
  "docs/26-配置迁移即代码.md",
  "docs/27-通信调度问询与合成工具.md",
  "docs/28-Coordinator-Cron-与定时调度.md",
  "docs/29-Bridge-IPC-与远程会话.md",
  "docs/30-DirectConnect-与上游代理.md",
  "docs/31-Keybindings-Vim-与-Voice-输入.md",
  // 其余 2 篇（C29/C30）在各自 issue 启动时追加。
]);

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

/**
 * 章节文件命名约定：`docs/NN-标题.md`（NN 为两位数字）。v1 占 00–25，
 * 新章自 26 起追加（见 NEW_CHAPTER_FILES）。
 */
const CHAPTER_FILE_RE = /^docs\/(\d{2})-[^/]+\.md$/;

const candidates = (explicitFiles ?? getChangedFiles(base)).filter(
  (f) => CHAPTER_FILE_RE.test(f),
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
  if (!NEW_CHAPTER_FILES.has(file)) {
    console.log(`[C-3] skip ${file}: 非 v2 新增章节（不在 spec §9.3 新章落地文件表中），C-3 不适用`);
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
