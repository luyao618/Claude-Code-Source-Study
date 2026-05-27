#!/usr/bin/env bun
/**
 * 附录 E · TaskType 谱系生成器。
 *
 * 解析：
 *   - Task.ts 中 `export type TaskType = ...` 联合类型 → 7 个 wire 字面量
 *   - tasks.ts 中 getAllTasks() 默认 push 的 4 个 + 2 个 feature-gated Task
 *   - in_process_teammate 不通过 tasks.ts 注册（特例，由 InProcessTeammateTask 单独装载）
 *
 * 用法：
 *   bun scripts/gen-tasktypes-table.ts [--source-path <claude-code-cli>] [--diff-summary]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseArgs,
  resolveSourcePath,
  getSourceCommit,
  writeManifest,
  writeFile,
  readManifest,
  printDiffSummary,
  type ManifestItem,
} from "./_lib.ts";

const { get, has } = parseArgs(process.argv);
const sourcePath = resolveSourcePath(get("--source-path"));
const sourceCommit = getSourceCommit(sourcePath);

const taskTs = readFileSync(join(sourcePath, "Task.ts"), "utf8");
const tasksTs = readFileSync(join(sourcePath, "tasks.ts"), "utf8");

function extractWireTypes(text: string): string[] {
  // 联合类型块：从 `export type TaskType =` 起至下一个 `export` 之前结束
  // （TS 联合类型常不带分号收尾，原始正则 `=([\s\S]*?);` 会贪婪吃到后续语句）。
  const m = text.match(/export type TaskType\s*=([\s\S]*?)(?=\n\s*export\s)/);
  if (!m) return [];
  return Array.from(m[1].matchAll(/['"]([a-z_]+)['"]/g)).map((x) => x[1]);
}

const wireTypes = extractWireTypes(taskTs);

// 默认装载（getAllTasks 主体数组）
const defaultListMatch = tasksTs.match(/const tasks: Task\[\] = \[([\s\S]*?)\]/);
const defaultClasses = defaultListMatch
  ? Array.from(defaultListMatch[1].matchAll(/([A-Z][A-Za-z]+Task)/g)).map((x) => x[1])
  : [];

// feature-gated（顶部 `const X = feature('FLAG') ? require(...).XTask : null` 形态）。
// 按 `const NAME =` 起始切片，再在每片内独立匹配 feature 与 require，避免
// 跨语句的贪婪 `[\s\S]*?` 失配。
const featureGated: { className: string; flag: string }[] = [];
const stmts = tasksTs.split(/^(?=const\s+[A-Za-z])/m);
for (const stmt of stmts) {
  const flagM = stmt.match(/feature\(['"]([A-Z_]+)['"]\)/);
  if (!flagM) continue;
  const reqRe = /require\(['"][^'"]+['"]\)\.([A-Z][A-Za-z]+Task)/g;
  let mm: RegExpExecArray | null;
  while ((mm = reqRe.exec(stmt)) !== null) {
    featureGated.push({ className: mm[1], flag: flagM[1] });
  }
}

// className → wire type 映射（按命名约定）
const CLASS_TO_WIRE: Record<string, string> = {
  LocalShellTask: "local_bash",
  LocalAgentTask: "local_agent",
  RemoteAgentTask: "remote_agent",
  DreamTask: "dream",
  LocalWorkflowTask: "local_workflow",
  MonitorMcpTask: "monitor_mcp",
  InProcessTeammateTask: "in_process_teammate",
};

const items: ManifestItem[] = wireTypes.map((wire): ManifestItem => {
  let className: string | undefined;
  for (const [c, w] of Object.entries(CLASS_TO_WIRE)) if (w === wire) className = c;
  const isDefault = !!className && defaultClasses.includes(className);
  const fg = featureGated.find((x) => x.className === className);
  let category: string;
  let notes: string;
  if (isDefault) {
    category = "default-registered";
    notes = `${className} 在 tasks.ts getAllTasks() 主体数组中默认装载`;
  } else if (fg) {
    category = "feature-gated";
    notes = `${className} 在 tasks.ts 中受 feature('${fg.flag}') 条件装载`;
  } else if (wire === "in_process_teammate") {
    category = "in-process";
    notes = "InProcessTeammateTask 不通过 tasks.ts 注册，属于 in-process 特例";
  } else {
    category = "unknown";
    notes = "wire 字面量在 Task.ts 中声明，但当前未在 tasks.ts 中静态识别到注册路径";
  }
  return {
    name: wire,
    category,
    wire_type: wire,
    default_registered: isDefault,
    feature_flags: fg ? [fg.flag] : undefined,
    source_files: [
      "Task.ts",
      "tasks.ts",
      ...(className ? [`tasks/${className}/`] : []),
    ],
    notes,
  };
});

const manifest = {
  source_commit: sourceCommit,
  items,
  counts: {
    wire_total: wireTypes.length,
    default_registered: items.filter((i) => i.default_registered).length,
    feature_gated: items.filter((i) => i.category === "feature-gated").length,
    in_process: items.filter((i) => i.category === "in-process").length,
  },
};

const manifestPath = "docs/appendix/E.manifest.json";
const prev = readManifest(manifestPath);
writeManifest(manifestPath, manifest);

const md = [
  `# 附录 E · TaskType 谱系`,
  ``,
  `> 生成脚本：\`scripts/gen-tasktypes-table.ts\`；source_commit: \`${sourceCommit}\``,
  `>`,
  `> 详细叙事：见 [第 16 章 · 任务模型与 TaskType 谱系](../16-任务模型与TaskType谱系.md)。本附录是速查表，C16 是叙事。`,
  ``,
  `wire 字面量合计 ${wireTypes.length} 个 = ${manifest.counts.default_registered} 默认注册 + ${manifest.counts.feature_gated} feature-gated + ${manifest.counts.in_process} in-process 特例。`,
  ``,
  `| wire 字面量 | 分类 | feature_flags | notes |`,
  `|---|---|---|---|`,
  ...items.map(
    (i) =>
      `| \`${i.name}\` | ${i.category} | ${(i.feature_flags ?? []).join(", ") || "—"} | ${
        i.notes ?? ""
      } |`,
  ),
  ``,
].join("\n");

writeFile("docs/appendix/E.md", md);
if (has("--diff-summary")) printDiffSummary("E", prev, manifest);
console.log(
  `[E] wrote docs/appendix/E.md + manifest (wire=${wireTypes.length}, default=${manifest.counts.default_registered}, fg=${manifest.counts.feature_gated})`,
);
