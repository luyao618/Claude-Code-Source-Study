#!/usr/bin/env bun
/**
 * 附录 D · 内置 Agent 速查表生成器（按 V2-REVISION-SPEC.md §7.5 两段式）。
 *
 *   - 正表（CI 校验）：源码定义的 Agent prompt 文件 + 关键字段
 *     id / displayName / modelHint / defaultEnabled。
 *   - 副表（notes 列）：每个 Agent 受哪些变量影响
 *     feature_flags / entrypoint_gated / coordinator_required。
 *
 * 数据来源：
 *   - tools/AgentTool/built-in/*.ts                — Agent prompt 文件正表
 *   - tools/AgentTool/builtInAgents.ts             — feature flag / entrypoint / coordinator 副表
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
  countLines,
  type ManifestItem,
} from "./_lib.ts";

const { get, has } = parseArgs(process.argv);
const sourcePath = resolveSourcePath(get("--source-path"));
const sourceCommit = getSourceCommit(sourcePath);

const builtInDir = join(sourcePath, "tools/AgentTool/built-in");
const builtInRel = "tools/AgentTool/built-in";
const indexRel = "tools/AgentTool/builtInAgents.ts";
const indexFile = join(sourcePath, indexRel);
const indexText = readFileSync(indexFile, "utf8");

/**
 * 取出 builtInAgents.ts 中 `*_AGENT` 名字所在行号，用于副表行号回链。
 */
function lineOf(needle: string): number | undefined {
  const idx = indexText.indexOf(needle);
  if (idx < 0) return undefined;
  return indexText.slice(0, idx).split("\n").length;
}

/**
 * 给定 prompt 文件源码与 `export const XXX_AGENT: BuiltInAgentDefinition` 的起止行号。
 * 用于 source_files 的 path:line-line 锚点；找不到时退化到整文件区间。
 */
function exportRangeIn(text: string): { start: number; end: number } | null {
  const lines = text.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (
      /^export const [A-Z_]+_AGENT(?:_TYPE)?\b/.test(lines[i]) &&
      /BuiltInAgentDefinition/.test(lines[i])
    ) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return null;
  for (let i = start - 1; i < lines.length; i++) {
    if (lines[i] === "}") return { start, end: i + 1 };
  }
  return { start, end: lines.length };
}

/**
 * 从 prompt 源文件抽取 `agentType: '...'`、`model: '...'` 字段。
 * 字面量优先；若是常量引用（如 `agentType: CLAUDE_CODE_GUIDE_AGENT_TYPE`），
 * 在同文件内查找 `export const CLAUDE_CODE_GUIDE_AGENT_TYPE = '...'`。
 */
function extractStringField(src: string, key: string): string | undefined {
  // 形如 `key: 'value'` 或 `key: "value"`
  const literalRe = new RegExp(`\\b${key}\\s*:\\s*['"]([^'"]+)['"]`);
  const m = src.match(literalRe);
  if (m) return m[1];
  // 形如 `key: CONST_NAME` —— 回查同文件 `export const CONST_NAME = '...'`
  const constRefRe = new RegExp(`\\b${key}\\s*:\\s*([A-Z_][A-Z0-9_]*)\\b`);
  const r = src.match(constRefRe);
  if (!r) return undefined;
  const constName = r[1];
  const constDefRe = new RegExp(
    `\\b(?:export\\s+)?const\\s+${constName}\\s*(?::\\s*[^=]+)?=\\s*['"]([^'"]+)['"]`,
  );
  const c = src.match(constDefRe);
  return c ? c[1] : undefined;
}

/**
 * model 字段可能是字面量、三元表达式或函数调用。直接截取冒号后到逗号/换行的原文。
 */
function extractModelHint(src: string): string | undefined {
  const m = src.match(/\bmodel\s*:\s*([^,\n]+?)(,|\n|$)/);
  if (!m) return undefined;
  return m[1].trim();
}

/**
 * 解析 builtInAgents.ts 中每个 *_AGENT 的运行时门控副表。
 * 返回 agentType → { defaultEnabled, feature_flags, entrypoint_gated, coordinator_required }
 */
type Effects = {
  defaultEnabled: boolean;
  feature_flags?: string[];
  entrypoint_gated?: string[];
  coordinator_required?: boolean;
};

function effectsFor(agentType: string, agentExportName: string): Effects {
  const out: Effects = { defaultEnabled: false };

  // Explore / Plan：areExplorePlanAgentsEnabled() —— feature('BUILTIN_EXPLORE_PLAN_AGENTS') &&
  //   getFeatureValue_CACHED_MAY_BE_STALE('tengu_amber_stoat', true)。
  if (agentType === "Explore" || agentType === "Plan") {
    out.feature_flags = ["BUILTIN_EXPLORE_PLAN_AGENTS", "tengu_amber_stoat"];
  }

  // claude-code-guide：CLAUDE_CODE_ENTRYPOINT !== sdk-{ts,py,cli}。
  if (agentType === "claude-code-guide") {
    out.entrypoint_gated = ["non-sdk"]; // 见 builtInAgents.ts L56-58
  }

  // verification：feature('VERIFICATION_AGENT') && getFeatureValue_CACHED_MAY_BE_STALE('tengu_hive_evidence', false)。
  if (agentType === "verification") {
    out.feature_flags = ["VERIFICATION_AGENT", "tengu_hive_evidence"];
  }

  // 默认装载集合：仅 GENERAL_PURPOSE_AGENT + STATUSLINE_SETUP_AGENT 在
  // const agents: AgentDefinition[] = [ ... ] 这行无条件 push。
  const defaultBlockRe =
    /const agents: AgentDefinition\[\] = \[([\s\S]*?)\]/;
  const block = indexText.match(defaultBlockRe);
  if (block && block[1].includes(agentExportName)) {
    out.defaultEnabled = true;
  }

  // coordinator_required：默认不要求；启用 COORDINATOR_MODE 时由
  // coordinator/workerAgent.ts 重写整个集合。
  if (/COORDINATOR_MODE/.test(indexText)) {
    out.coordinator_required = false;
  }
  return out;
}

const promptFiles = readdirSync(builtInDir)
  .filter((f) => f.endsWith(".ts"))
  .sort();

const items: ManifestItem[] = [];

for (const f of promptFiles) {
  const abs = join(builtInDir, f);
  const src = readFileSync(abs, "utf8");

  const agentType = extractStringField(src, "agentType");
  if (!agentType) continue;

  const modelHint = extractModelHint(src) ?? "inherit-default";
  const range = exportRangeIn(src);
  const totalLines = countLines(abs);
  const rangeStr = range ? `${range.start}-${range.end}` : `1-${totalLines}`;

  // 找到该 prompt 文件在 builtInAgents.ts 里 `export const XXX_AGENT` 的对应导入名
  // ——通过 import 语句反查 export 名。
  const importRe = new RegExp(
    `import\\s+\\{\\s*([A-Z_]+_AGENT)\\s*\\}\\s+from\\s+['"]\\./built-in/${f.replace(/\.ts$/, "")}(\\.js)?['"]`,
  );
  const importMatch = indexText.match(importRe);
  const exportName = importMatch ? importMatch[1] : agentType;

  const effects = effectsFor(agentType, exportName);

  // 该 export 名在 builtInAgents.ts 出现的行号，用于副表回链
  const indexLine = lineOf(exportName);

  // whenToUse：源码 `BuiltInAgentDefinition` 没有独立 displayName 字段；
  // 直接取 whenToUse 全文作为速查表的可读描述（不再截断，避免 OC-R 在 PR1 中
  // 指出的 `claude-code-guide` 在 `Claude...` 处截断的问题）。
  let whenToUseSummary = "";
  let whenToUseRaw: string | undefined;
  // 必须匹配同种引号才能闭合（OC-R 在 PR1 review 中指出 `claude-code-guide` 与
  // `statusline-setup` 的截断 bug：之前用 `['"`]` 三种引号互通闭合，
  // 会被 `("Can Claude...` 或 `user's` 提前截断）。
  const literalM =
    src.match(/whenToUse\s*:\s*`([\s\S]*?)`/) ||
    src.match(/whenToUse\s*:\s*"((?:\\.|[^"\\])*)"/) ||
    src.match(/whenToUse\s*:\s*'((?:\\.|[^'\\])*)'/);
  if (literalM) {
    whenToUseRaw = literalM[1];
  } else {
    const refM = src.match(/whenToUse\s*:\s*([A-Z_][A-Z0-9_]*)\b/);
    if (refM) {
      const constName = refM[1];
      const constDefBacktickRe = new RegExp(
        `\\b(?:export\\s+)?const\\s+${constName}\\s*(?::\\s*[^=]+)?=\\s*\`([\\s\\S]*?)\``,
      );
      const constDefDQRe = new RegExp(
        `\\b(?:export\\s+)?const\\s+${constName}\\s*(?::\\s*[^=]+)?=\\s*"((?:\\\\.|[^"\\\\])*)"`,
      );
      const constDefSQRe = new RegExp(
        `\\b(?:export\\s+)?const\\s+${constName}\\s*(?::\\s*[^=]+)?=\\s*'((?:\\\\.|[^'\\\\])*)'`,
      );
      const here =
        src.match(constDefBacktickRe) ||
        src.match(constDefDQRe) ||
        src.match(constDefSQRe);
      if (here) {
        whenToUseRaw = here[1];
      } else {
        // 在 built-in/ 目录其它文件里找
        for (const sibling of promptFiles) {
          if (sibling === f) continue;
          const siblingSrc = readFileSync(join(builtInDir, sibling), "utf8");
          const sm =
            siblingSrc.match(constDefBacktickRe) ||
            siblingSrc.match(constDefDQRe) ||
            siblingSrc.match(constDefSQRe);
          if (sm) {
            whenToUseRaw = sm[1];
            break;
          }
        }
      }
    }
  }
  if (whenToUseRaw) {
    // 完整保留 whenToUse 文本（折叠空白即可）。源码里多数句子里就含 `.`、`...`、引号，
    // 简单 split('.') 会把 `Use this agent when the user asks questions ("Can Claude...", ...)`
    // 在 `Claude` 处截断——OC-R 已经在 PR1 review 中点名这个问题，必须保留全文。
    // Markdown 表格单元里禁止裸 `|`、`\n`、`<br>` 等会破表，统一转义。
    whenToUseSummary = whenToUseRaw
      .replace(/\r?\n/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\|/g, "\\|")
      .trim();
  }

  const sourceFiles = [
    `${builtInRel}/${f}:${rangeStr}`,
  ];
  if (indexLine !== undefined) {
    sourceFiles.push(`${indexRel}:${indexLine}-${indexLine}`);
  }

  items.push({
    name: agentType,
    category: "built-in-agent",
    source_files: sourceFiles,
    // §7.5 正表四字段（注意：源码 `BuiltInAgentDefinition` 没有 displayName 字段，
    // 这里用 whenToUse 首句节选作为可读描述列）
    id: agentType,
    whenToUseSummary,
    modelHint,
    defaultEnabled: effects.defaultEnabled,
    // §7.5 副表
    feature_flags: effects.feature_flags,
    entrypoint_gated: effects.entrypoint_gated,
    coordinator_required: effects.coordinator_required,
    notes: [
      `defaultEnabled=${effects.defaultEnabled}`,
      effects.feature_flags
        ? `feature_flags=${effects.feature_flags.join("|")}`
        : "",
      effects.entrypoint_gated
        ? `entrypoint_gated=${effects.entrypoint_gated.join("|")}`
        : "",
      effects.coordinator_required !== undefined
        ? `coordinator_required=${effects.coordinator_required}`
        : "",
    ]
      .filter(Boolean)
      .join("; "),
  });
}

items.sort((a, b) => a.name.localeCompare(b.name));

const manifest = {
  source_commit: sourceCommit,
  items,
};

const manifestPath = "docs/appendix/D.manifest.json";
const prev = readManifest(manifestPath);
writeManifest(manifestPath, manifest);

const md = [
  `# 附录 D · 内置 Agent 速查表`,
  ``,
  `> 生成脚本：\`scripts/gen-agents-table.ts\`；source_commit: \`${sourceCommit}\``,
  ``,
  `**正表**：源码定义 ${items.length} 个内置 agent（位于 \`${builtInRel}/\`）。`,
  ``,
  `| id | whenToUse（源码原文，未截断） | modelHint | defaultEnabled | 来源 |`,
  `|---|---|---|---|---|`,
  ...items.map(
    (i) =>
      `| \`${i.id}\` | ${(i as ManifestItem & { whenToUseSummary?: string }).whenToUseSummary ?? ""} | \`${(i as ManifestItem & { modelHint?: string }).modelHint ?? ""}\` | ${(i as ManifestItem & { defaultEnabled?: boolean }).defaultEnabled} | ${(i.source_files ?? []).map((s) => `\`${s}\``).join(", ")} |`,
  ),
  ``,
  `**副表**（运行时可用集合受三类变量影响，见 \`${indexRel}\`）：`,
  ``,
  `| id | feature_flags | entrypoint_gated | coordinator_required |`,
  `|---|---|---|---|`,
  ...items.map((i) => {
    const ii = i as ManifestItem & {
      feature_flags?: string[];
      entrypoint_gated?: string[];
      coordinator_required?: boolean;
    };
    return `| \`${i.id}\` | ${(ii.feature_flags ?? []).join(", ") || "—"} | ${(ii.entrypoint_gated ?? []).join(", ") || "—"} | ${ii.coordinator_required === undefined ? "—" : String(ii.coordinator_required)} |`;
  }),
  ``,
].join("\n");

writeFile("docs/appendix/D.md", md);
if (has("--diff-summary")) printDiffSummary("D", prev, manifest);
console.log(`[D] wrote docs/appendix/D.md + manifest (${items.length} agents)`);
