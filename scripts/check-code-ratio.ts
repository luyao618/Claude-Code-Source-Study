#!/usr/bin/env bun
/**
 * §0.5.6 C-3 · 代码块占比闸
 *
 * 范围：仅对 v2 新增章节生效。**判定唯一来源**：文件 frontmatter 含
 * `新增章节: yes`。理由：v2 实际落地命名采用 `NN-标题.md`（与 v1 保持一致），
 * 不再嵌入 `C04 / C13` 这类书脊编号；旧版基于文件名正则的白名单已失效。
 * §0.5.4 与 §9.3 模板（V2-REVISION-SPEC.md §9.3）现强制要求 8 篇新章在
 * frontmatter 中显式声明 `新增章节: yes`，CI 据此识别。
 *
 * **frontmatter presence enforcement（OC-R 反馈修复）**：仅靠 frontmatter
 * 判定会留一个绕过口子——writer 新建一篇文件、忘写（或故意不写）
 * `新增章节: yes`，本闸就 skip 放行。为闭环，本脚本维护 v1 已发布章节的
 * 已知文件清单 `V1_DOC_FILES`；任何 **不在 v1 清单内** 的 `docs/*.md` 候选
 * 文件都被视为"规划中的新章节路径"（含 §9.3 列出的 8 篇 C04 / C13 / C17 /
 * C24 / C25 / C28 / C29 / C30，以及未来可能新增的章节），若 frontmatter 缺
 * `新增章节: yes` → **fail**（不再 skip）。在 v1 清单内的文件保留原行为
 * （无 frontmatter 时 skip，因为 v1 章节本就不适用 C-3）。
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

function frontmatterIsNewChapter(text: string): boolean {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return false;
  return /新增章节:\s*yes/.test(m[1]);
}

/**
 * v1 已发布章节的文件清单。任何 **不在此清单内** 的 `docs/*.md` 候选文件都
 * 被视为"规划中的新章节路径"，必须在 frontmatter 中声明 `新增章节: yes`，
 * 否则 C-3 闸 fail（见文件头注释）。
 *
 * 与 V2-REVISION-SPEC.md §6.1 正向矩阵的 v1 25 篇 + 目录页对齐。
 */
const V1_DOC_FILES = new Set<string>([
  "docs/00-目录与阅读指引.md",
  "docs/01-项目全景.md",
  "docs/02-启动优化.md",
  "docs/03-状态管理.md",
  "docs/04-System-Prompt-工程.md",
  "docs/05-对话循环.md",
  "docs/06-上下文管理.md",
  "docs/07-Prompt-Cache.md",
  "docs/08-Thinking-与推理控制.md",
  "docs/09-工具系统设计.md",
  "docs/10-BashTool-深度剖析.md",
  "docs/11-命令系统.md",
  "docs/12-Agent-系统.md",
  "docs/13-内置Agent设计模式.md",
  "docs/14-任务系统.md",
  "docs/15-MCP-协议实现.md",
  "docs/16-权限系统.md",
  "docs/17-Settings-系统.md",
  "docs/18-Hooks系统.md",
  "docs/19-Feature-Flag与编译期优化.md",
  "docs/20-API调用与错误恢复.md",
  "docs/21-Ink框架深度定制.md",
  "docs/22-设计系统.md",
  "docs/23-Memory系统.md",
  "docs/24-Skill-Plugin开发实战.md",
  "docs/25-架构模式总结.md",
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
  if (!frontmatterIsNewChapter(txt)) {
    if (!V1_DOC_FILES.has(file)) {
      console.error(
        `[C-3] FAIL ${file}: 未在 v1 已发布清单内（视为规划中的新章节路径），但 frontmatter 缺少 \`新增章节: yes\`。新章须显式声明（见 V2-REVISION-SPEC.md §9.3）。`,
      );
      failed = true;
      continue;
    }
    console.log(`[C-3] skip ${file}: v1 已发布章节，C-3 不适用`);
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

