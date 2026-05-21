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
 * `新增章节: yes`，本闸就 skip 放行。为闭环，本脚本基于 V2-REVISION-SPEC
 * §5 章节树 / §9.3 frontmatter 强制条款维护一个 **显式新增章节集合**
 * `NEW_CHAPTER_NN`（即 v2 中 v1 完全没有的 8 篇：C04 / C13 / C17 / C24 /
 * C25 / C28 / C29 / C30，对应 docs/NN-*.md 中 NN ∈ {04,13,17,24,25,28,29,30}）。
 * 文件命名按 §9.3 规定为 `NN-标题.md`，CI 仅以 NN 前缀 + frontmatter 为判据：
 *   - 若文件 NN 属于 NEW_CHAPTER_NN：必须声明 `新增章节: yes`，否则 fail；
 *     声明后再走 25% 代码占比检查。
 *   - 否则（v1 保留 / v1 迭代重写 / v2 拆分合并 / v2 改名后的非新增章节）：
 *     C-3 不适用，skip。
 *
 * **判定范围（OC-R PR #17 反馈收窄）**：候选文件限制为顶层章节文件
 * `docs/NN-标题.md`（两位数字前缀），由 `CHAPTER_FILE_RE` 控制。
 * `docs/appendix/{A..F}.md`（自动生成的附录）、`docs/V2-REVISION-SPEC.md`
 * （spec 本体）以及任何子目录散页都不进入新章判定，避免误判为"缺标记"。
 *
 * **OC-R PR #17 二次反馈修复**：早先实现把"不在 V1_DOC_FILES 内"等价为
 * "新增章节"，会误伤 v2 改名后的非新增章节（例如 v1-04 改名为
 * `docs/06-System-Prompt-与-Output-Style-注入.md` 对应 C06，仍是非新增）。
 * 现改为基于 §5/§9.3 维护的 explicit `NEW_CHAPTER_NN` 集合分类。
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
 * v2 新增章节的 NN 前缀集合（与 V2-REVISION-SPEC.md §5 章节树 / §9.3
 * frontmatter 强制条款一致）。仅这 8 篇 v1 完全没有的章节强制要求
 * frontmatter 中显式声明 `新增章节: yes`；CI 据此识别"新章"并应用 25%
 * 代码占比闸。
 *
 * 映射来源（V2-REVISION-SPEC.md §5）：
 *   C04 → docs/04-*.md   配置迁移即代码
 *   C13 → docs/13-*.md   通信、调度、问询与合成工具
 *   C17 → docs/17-*.md   Coordinator、Cron 与定时调度
 *   C24 → docs/24-*.md   Bridge IPC 与远程会话
 *   C25 → docs/25-*.md   DirectConnect 与上游代理
 *   C28 → docs/28-*.md   Keybindings、Vim 模式与 Voice 输入
 *   C29 → docs/29-*.md   Buddy 人格
 *   C30 → docs/30-*.md   Doctor 屏与 Output Style 体验
 *
 * 注意：v1 的 04/13/17/24 等同 NN 前缀文件在 v2 中已让位给新章
 *（v1-04 System Prompt → v2 C06；v1-13 内置 Agent → v2 C15 等）。当前 v1
 * 落地文件名（`V1_FILE_NAMES`，下方）与新 NN 前缀不存在冲突，未来若有
 * 真正的同前缀冲突需在 spec 中显式裁决。
 */
const NEW_CHAPTER_NN = new Set<string>([
  "04",
  "13",
  "17",
  "24",
  "25",
  "28",
  "29",
  "30",
]);

/**
 * v1 已发布 25 篇 + 目录页文件清单（与 §6.1 正向矩阵对齐），仅用于诊断信息
 * （让 skip 日志能区分"v1 保留章节"与"v2 改名后的非新增章节"）。分类不再
 * 依赖此集合。
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

/**
 * 章节文件命名约定：`docs/NN-标题.md`（NN 为两位数字，与 v1 25 篇及未来 v2
 * 新章命名一致）。其他路径（如 `docs/appendix/{A..F}.md` 自动生成附录、
 * `docs/V2-REVISION-SPEC.md` spec 自身、未来可能新增的非章节散页）一律
 * **不参与** C-3 新章判定。
 *
 * OC-R 反馈（PR #17）：旧实现把 docs 下所有 .md 全部视为新章候选，会把规划中
 * 的 `docs/appendix/A..F.md` 误判为缺 `新增章节: yes` 标记。现收窄到
 * 「顶层 `docs/NN-XX.md` 章节文件」，与 V2-REVISION-SPEC.md §9.3 一致。
 */
const CHAPTER_FILE_RE = /^docs\/(\d{2})-[^/]+\.md$/;

/**
 * 提取 `docs/NN-标题.md` 的 NN 前缀，用于查 NEW_CHAPTER_NN。
 */
function chapterNN(file: string): string | null {
  const m = file.match(CHAPTER_FILE_RE);
  return m ? m[1] : null;
}

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
  const nn = chapterNN(file);
  // V1_DOC_FILES 优先：v1 已发布章节即便 NN 前缀落在 NEW_CHAPTER_NN 上
  // （例如 v1 docs/04-System-Prompt-工程.md，v2 中 04 槽位将让位给新增的
  // C04 配置迁移即代码），在 v1 文件被重命名/移除之前仍按 v1 处理。
  if (V1_DOC_FILES.has(file)) {
    console.log(`[C-3] skip ${file}: v1 已发布章节，C-3 不适用`);
    continue;
  }
  const isNewChapter = nn !== null && NEW_CHAPTER_NN.has(nn);
  if (!isNewChapter) {
    console.log(`[C-3] skip ${file}: 非新增 v2 章节，C-3 不适用`);
    continue;
  }
  if (!frontmatterIsNewChapter(txt)) {
    console.error(
      `[C-3] FAIL ${file}: 属于 v2 新增章节（NN=${nn}，见 V2-REVISION-SPEC.md §5/§9.3），但 frontmatter 缺少 \`新增章节: yes\`。`,
    );
    failed = true;
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
