#!/usr/bin/env bun
/**
 * 附录 F · 模块 × 章节双向矩阵 + 孤儿目录扫描。
 *
 * - 正表：v2 34 章 → 覆盖的源码一级目录 / 文件（与 V2-REVISION-SPEC.md §6.2 对齐）。
 * - 反查：源码一级目录 → 覆盖它的章节集合。
 * - `--check-orphans`：扫源码一级目录与"v2 章节覆盖目录集合"做差集；非空 → exit 1。
 *   白名单文件：`scripts/orphan-allowlist.txt`，每行一个目录名（# 开头注释）。
 *
 * 用法：
 *   bun scripts/gen-module-matrix.ts [--source-path <claude-code-cli>] [--diff-summary]
 *   bun scripts/gen-module-matrix.ts --check-orphans
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseArgs,
  resolveSourcePath,
  getSourceCommit,
  listTopLevelDirs,
  writeManifest,
  writeFile,
  readManifest,
  printDiffSummary,
} from "./_lib.ts";

const { get, has } = parseArgs(process.argv);
const sourcePath = resolveSourcePath(get("--source-path"));
const sourceCommit = getSourceCommit(sourcePath);

/**
 * v2 34 章 → 覆盖的源码一级目录集合（与 V2-REVISION-SPEC.md §6.2 对齐）。
 * 仅追踪一级目录；进一步的 file:line 引用在每章正文与 §0.1 源码锚点中给出。
 */
const CHAPTER_COVERAGE: { id: string; title: string; dirs: string[] }[] = [
  { id: "C01", title: "项目全景与四种入口形态", dirs: ["entrypoints"] },
  { id: "C02", title: "启动链路与冷启动优化", dirs: ["entrypoints", "screens"] },
  { id: "C03", title: "配置体系与企业 MDM", dirs: ["services", "utils"] },
  { id: "C04", title: "配置迁移即代码", dirs: ["migrations"] },
  {
    id: "C05",
    title: "QueryEngine 与对话主循环",
    dirs: ["query"],
  },
  {
    id: "C06",
    title: "System Prompt 与 Output Style 注入",
    dirs: ["constants", "outputStyles"],
  },
  { id: "C07", title: "上下文压缩家族", dirs: ["services"] },
  { id: "C08", title: "Prompt Cache 横切", dirs: ["services"] },
  {
    id: "C09",
    title: "Thinking、Effort 与 Advisor",
    dirs: ["commands", "services"],
  },
  { id: "C10", title: "工具协议、注册与 ToolSearch", dirs: ["tools"] },
  { id: "C11", title: "BashTool / PowerShellTool 双 shell", dirs: ["tools"] },
  { id: "C12", title: "文件、代码与 LSP 协作族", dirs: ["tools", "services"] },
  { id: "C13", title: "通信、调度、问询与合成工具", dirs: ["tools"] },
  { id: "C14", title: "Agent 系统与 Sub-Agent 调用", dirs: ["tools", "services", "commands"] },
  { id: "C15", title: "内置 Agent 设计模式", dirs: ["tools"] },
  { id: "C16", title: "任务模型与 TaskType 谱系", dirs: ["tasks", "tools"] },
  {
    id: "C17",
    title: "Coordinator、Cron 与定时调度",
    dirs: ["coordinator", "tools", "hooks"],
  },
  { id: "C18", title: "MCP 协议实现", dirs: ["services", "tools"] },
  {
    id: "C19",
    title: "权限系统与远程权限回灌",
    dirs: ["hooks", "bridge", "remote"],
  },
  { id: "C20", title: "Hooks 系统", dirs: ["schemas", "hooks", "query"] },
  {
    id: "C21",
    title: "Skill / Plugin / Output Style 三扩展点",
    dirs: ["skills", "services", "plugins", "outputStyles"],
  },
  {
    id: "C22",
    title: "Feature Flag 与编译期优化",
    dirs: ["utils", "constants"],
  },
  { id: "C23", title: "客户端传输与 API 重试", dirs: ["services", "cli"] },
  {
    id: "C24",
    title: "Bridge IPC 与远程会话",
    dirs: ["bridge", "remote", "commands"],
  },
  {
    id: "C25",
    title: "DirectConnect 与上游代理",
    dirs: ["server", "upstreamproxy", "hooks"],
  },
  { id: "C26", title: "Ink 框架深度定制", dirs: ["ink", "native-ts"] },
  { id: "C27", title: "组件与设计系统", dirs: ["components"] },
  {
    id: "C28",
    title: "Keybindings、Vim、Voice 输入",
    dirs: ["keybindings", "vim", "voice", "services", "hooks", "commands"],
  },
  { id: "C29", title: "Buddy 人格", dirs: ["buddy"] },
  {
    id: "C30",
    title: "Doctor 屏与 Output Style UX",
    dirs: ["screens", "outputStyles", "commands"],
  },
  {
    id: "C31",
    title: "Memory 子系统全景",
    dirs: ["memdir", "services", "assistant"],
  },
  { id: "C32", title: "命令系统全景", dirs: ["commands"] },
  { id: "C33", title: "状态管理与跨进程桥", dirs: ["state", "bridge"] },
  { id: "C34", title: "架构模式总结", dirs: [] },
];

const allTopDirs = listTopLevelDirs(sourcePath);

const allowlistPath = "scripts/orphan-allowlist.txt";
function loadAllowlist(): Set<string> {
  if (!existsSync(allowlistPath)) return new Set();
  const lines = readFileSync(allowlistPath, "utf8").split("\n");
  const out = new Set<string>();
  for (const raw of lines) {
    const line = raw.replace(/#.*/, "").trim();
    if (line) out.add(line);
  }
  return out;
}
const allowlist = loadAllowlist();

const coveredDirs = new Set<string>();
for (const ch of CHAPTER_COVERAGE) for (const d of ch.dirs) coveredDirs.add(d);

const orphans = allTopDirs.filter(
  (d) => !coveredDirs.has(d) && !allowlist.has(d),
);

// 反查表：dir -> chapters
const dirToChapters: Record<string, string[]> = {};
for (const d of allTopDirs) dirToChapters[d] = [];
for (const ch of CHAPTER_COVERAGE) {
  for (const d of ch.dirs) {
    if (!dirToChapters[d]) dirToChapters[d] = [];
    dirToChapters[d].push(ch.id);
  }
}

const manifest = {
  source_commit: sourceCommit,
  items: CHAPTER_COVERAGE.map((ch) => ({
    name: ch.id,
    category: "chapter",
    notes: ch.title,
    source_files: ch.dirs.map((d) => `${d}/`),
  })),
  reverse_index: dirToChapters,
  orphans,
  allowlisted: Array.from(allowlist).sort(),
};

const manifestPath = "docs/appendix/F.manifest.json";
const prev = readManifest(manifestPath);
writeManifest(manifestPath, manifest);

if (has("--check-orphans")) {
  if (orphans.length > 0) {
    console.error(
      `[F] FAIL orphan dirs (${orphans.length}): ${orphans.join(", ")}`,
    );
    console.error(
      `    若属预期未覆盖，请加入 scripts/orphan-allowlist.txt（每行一项，可 # 注释）。`,
    );
    process.exit(1);
  }
  console.log(
    `[F] OK no orphan dirs (covered=${coveredDirs.size}, allowlisted=${allowlist.size})`,
  );
  process.exit(0);
}

const md = [
  `# 附录 F · 模块 × 章节双向矩阵`,
  ``,
  `> 生成脚本：\`scripts/gen-module-matrix.ts\`；source_commit: \`${sourceCommit}\``,
  ``,
  `## 正表：章节 → 覆盖目录`,
  ``,
  `| 章节 | 标题 | 覆盖一级目录 |`,
  `|---|---|---|`,
  ...CHAPTER_COVERAGE.map(
    (ch) =>
      `| ${ch.id} | ${ch.title} | ${ch.dirs.map((d) => `\`${d}/\``).join(", ") || "（横切）"} |`,
  ),
  ``,
  `## 反查：目录 → 覆盖章节`,
  ``,
  `| 一级目录 | 覆盖章节 |`,
  `|---|---|`,
  ...allTopDirs.map(
    (d) =>
      `| \`${d}/\` | ${dirToChapters[d].length ? dirToChapters[d].join(", ") : "—（孤儿或入白名单）"} |`,
  ),
  ``,
  `## 孤儿目录`,
  ``,
  orphans.length === 0
    ? `当前 commit 下无孤儿目录（白名单：${allowlist.size} 项）。`
    : `孤儿目录 ${orphans.length} 个：${orphans.map((d) => `\`${d}/\``).join(", ")}`,
  ``,
].join("\n");

writeFile("docs/appendix/F.md", md);
if (has("--diff-summary")) printDiffSummary("F", prev, manifest);
console.log(
  `[F] wrote docs/appendix/F.md + manifest (chapters=${CHAPTER_COVERAGE.length}, top_dirs=${allTopDirs.length}, orphans=${orphans.length})`,
);
