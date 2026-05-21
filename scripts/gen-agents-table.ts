#!/usr/bin/env bun
/**
 * 附录 D · 内置 Agent 速查表生成器。
 *
 * 两段式：
 *   - 正表：扫描 tools/AgentTool/built-in/*.ts，提取 `agentType / source / baseDir / model`。
 *   - 副表（notes）：根据 builtInAgents.ts 中的 feature flag / entrypoint / coordinator
 *     条件给每个 agent 标注影响变量（feature_flags / entrypoint_gated / coordinator_required）。
 *
 * 用法：
 *   bun scripts/gen-agents-table.ts [--source-path <claude-code-cli>] [--diff-summary]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  parseArgs,
  resolveSourcePath,
  getSourceCommit,
  writeManifest,
  writeFile,
  readManifest,
  printDiffSummary,
  nowIso,
  type ManifestItem,
} from "./_lib.ts";

const { get, has } = parseArgs(process.argv);
const sourcePath = resolveSourcePath(get("--source-path"));
const sourceCommit = getSourceCommit(sourcePath);

const builtInDir = join(sourcePath, "tools/AgentTool/built-in");
const indexFile = join(sourcePath, "tools/AgentTool/builtInAgents.ts");

const indexText = readFileSync(indexFile, "utf8");

function extractField(src: string, key: string): string | undefined {
  const re = new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`);
  const m = src.match(re);
  return m ? m[1] : undefined;
}

function extractFieldArray(src: string, key: string): string[] | undefined {
  const re = new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`);
  const m = src.match(re);
  if (!m) return undefined;
  return Array.from(m[1].matchAll(/['"]([^'"]+)['"]/g)).map((x) => x[1]);
}

function notesFor(agentType: string): {
  feature_flags?: string[];
  entrypoint_gated?: string[];
  coordinator_required?: boolean;
} {
  const out: {
    feature_flags?: string[];
    entrypoint_gated?: string[];
    coordinator_required?: boolean;
  } = {};
  if (agentType === "explore" || agentType === "plan") {
    out.feature_flags = ["BUILTIN_EXPLORE_PLAN_AGENTS", "tengu_amber_stoat"];
  }
  if (agentType === "claude-code-guide") {
    out.entrypoint_gated = ["non-sdk"]; // 见 builtInAgents.ts 中的 CLAUDE_CODE_ENTRYPOINT 判断
  }
  if (agentType === "verification") {
    out.feature_flags = ["VERIFICATION_AGENT", "tengu_hive_evidence"];
  }
  // coordinator 模式接管时，所有内置 agent 集合被 coordinator/workerAgent.ts 替换。
  if (/COORDINATOR_MODE/.test(indexText)) {
    out.coordinator_required = false; // 默认运行不要求 coordinator；启用时集合改写
  }
  return out;
}

const agentFiles = readdirSync(builtInDir).filter((f) => f.endsWith(".ts"));
const items: ManifestItem[] = [];

for (const f of agentFiles) {
  const src = readFileSync(join(builtInDir, f), "utf8");
  const agentType = extractField(src, "agentType");
  if (!agentType) continue;
  const tools = extractFieldArray(src, "tools");
  const model = extractField(src, "model");
  const color = extractField(src, "color");
  const note = notesFor(agentType);
  items.push({
    name: agentType,
    category: "built-in",
    source_files: [`tools/AgentTool/built-in/${f}`],
    feature_flags: note.feature_flags,
    notes: [
      tools ? `tools=${tools.join("|")}` : "",
      model ? `model=${model}` : "",
      color ? `color=${color}` : "",
      note.entrypoint_gated
        ? `entrypoint_gated=${note.entrypoint_gated.join("|")}`
        : "",
      note.coordinator_required !== undefined
        ? `coordinator_required=${note.coordinator_required}`
        : "",
    ]
      .filter(Boolean)
      .join("; "),
  });
}

items.sort((a, b) => a.name.localeCompare(b.name));

const manifest = {
  generated_at: nowIso(),
  source_commit: sourceCommit,
  items,
};

const manifestPath = "docs/appendix/D.manifest.json";
const prev = readManifest(manifestPath);
writeManifest(manifestPath, manifest);

const md = [
  `# 附录 D · 内置 Agent 速查表`,
  ``,
  `> 生成脚本：\`scripts/gen-agents-table.ts\`；source_commit: \`${sourceCommit}\`；生成于 ${manifest.generated_at}`,
  ``,
  `**正表**：源码定义 ${items.length} 个内置 agent（位于 \`tools/AgentTool/built-in/\`）。`,
  ``,
  `运行时可用集合受三类变量影响（见每行 notes）：`,
  `- \`feature_flags\`：来自 \`utils/betas.ts\` / \`constants/betas.ts\` / Growthbook 实验`,
  `- \`entrypoint_gated\`：CLI / SDK / MCP / Sandbox 入口差异`,
  `- \`coordinator_required\`：启用 \`COORDINATOR_MODE\` 时由 \`coordinator/workerAgent.ts\` 接管整个集合`,
  ``,
  `| agentType | 来源文件 | feature_flags | notes |`,
  `|---|---|---|---|`,
  ...items.map(
    (i) =>
      `| \`${i.name}\` | ${(i.source_files ?? []).join(", ")} | ${
        (i.feature_flags ?? []).join(", ") || "—"
      } | ${i.notes ?? ""} |`,
  ),
  ``,
].join("\n");

writeFile("docs/appendix/D.md", md);
if (has("--diff-summary")) printDiffSummary("D", prev, manifest);
console.log(`[D] wrote docs/appendix/D.md + manifest (${items.length} agents)`);
