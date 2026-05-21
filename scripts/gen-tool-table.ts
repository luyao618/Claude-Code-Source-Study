#!/usr/bin/env bun
/**
 * 附录 A · 工具速查表生成器。
 *
 * 输出 docs/appendix/A.md（Markdown 速查表）+ docs/appendix/A.manifest.json
 *（CI 校验依据）。
 *
 * 三列模型：
 *   - family：在 tools/ 下作为顶层目录出现（无论是否在 tools.ts 中默认装载）。
 *   - leaf  ：tools.ts 默认 register 的运行期叶子工具（不依赖 feature flag / 环境变量）。
 *   - feature-gated：tools.ts 中带 `feature(...)`、`process.env.*`、或 `getFeatureValue_*`
 *     条件装载的工具。
 *
 * 数字"X 个工具"由本脚本输出至 manifest，不应在正文中裸写——v1 提到的
 * "42 个工具"统一改为 `附录 A 收录 ${items.length} 项 (${family|leaf|feature-gated 计数})`。
 *
 * 用法：
 *   bun scripts/gen-tool-table.ts [--source-path <claude-code-cli>] [--diff-summary]
 */
import { readFileSync } from "node:fs";
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
  nowIso,
  type ManifestItem,
} from "./_lib.ts";

const { get, has } = parseArgs(process.argv);
const sourcePath = resolveSourcePath(get("--source-path"));
const sourceCommit = getSourceCommit(sourcePath);

const toolsDir = join(sourcePath, "tools");
const familyDirs = listTopLevelDirs(toolsDir).filter(
  (d) => !["shared", "testing"].includes(d),
);

// 解析 tools.ts，提取叶子工具（默认 register 的 + feature-gated 的）。
const toolsTs = readFileSync(join(sourcePath, "tools.ts"), "utf8");

// 抓所有 ToolName 形态：单词以 Tool 结尾且首字母大写。
const toolNameRe = /\b([A-Z][A-Za-z0-9]+Tool)\b/g;
const allToolMentions = new Set<string>();
let m: RegExpExecArray | null;
while ((m = toolNameRe.exec(toolsTs)) !== null) allToolMentions.add(m[1]);

// 识别 feature-gated 工具：扫描 tools.ts 中的"条件 require"块。
// 形态包括：
//   const Foo = feature('X') ? require('./tools/Foo/Foo.js').FooTool : null
//   const Foo = process.env.X === 'y' ? require('./tools/Foo/Foo.js').FooTool : null
//   const Foo = (cond1 || cond2) ? require('./tools/Foo/Foo.js').FooTool : null
//   const cronTools = feature('X') ? [require(...).A, require(...).B] : []
// 用按 `const NAME =` 起的语句切片，再判断该语句中是否同时含 (gate, require, ToolName)。
const featureGatedNames = new Set<string>();
const stmts = toolsTs.split(/^(?=const\s+[A-Za-z])/m);
const gateRe = /feature\(|process\.env\.|getFeatureValue_/;
for (const stmt of stmts) {
  if (!gateRe.test(stmt)) continue;
  const reqRe = /require\(['"][^'"]+['"]\)\.([A-Z][A-Za-z0-9]+Tool)/g;
  let mm: RegExpExecArray | null;
  while ((mm = reqRe.exec(stmt)) !== null) featureGatedNames.add(mm[1]);
}

// 默认叶子：在 tools.ts 顶部 `import { XxxTool } from './tools/XxxTool/...'` 形态。
const importRe =
  /import\s+\{\s*([A-Z][A-Za-z0-9]+Tool)\s*\}\s+from\s+['"]\.\/tools\//g;
const defaultLeafNames = new Set<string>();
while ((m = importRe.exec(toolsTs)) !== null) defaultLeafNames.add(m[1]);

// 整合
const items: ManifestItem[] = [];

// family：所有 tools/ 顶层目录（即便未在 tools.ts 默认装载，也算 family 收录）。
for (const dir of familyDirs) {
  const candidateLeaf = `${dir}`; // 目录名通常即工具名（无 .ts）
  // 优先以叶子身份归类（feature-gated 优先），否则归 family。
  const asTool = `${dir}`; // tools/AgentTool 目录中的 AgentTool 名
  if (featureGatedNames.has(asTool)) {
    items.push({
      name: asTool,
      category: "feature-gated",
      source_files: [`tools/${dir}/`],
      notes: "tools.ts 中按 feature flag / 环境变量条件装载",
    });
  } else if (defaultLeafNames.has(asTool)) {
    items.push({
      name: asTool,
      category: "leaf",
      source_files: [`tools/${dir}/`],
      notes: "tools.ts 默认 register 的运行期叶子工具",
    });
  } else {
    items.push({
      name: asTool,
      category: "family",
      source_files: [`tools/${dir}/`],
      notes:
        "tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响",
    });
  }
}

// 把 tools.ts 中提到但 tools/ 下没有同名目录的工具也补进来（如 ExitPlanModeV2Tool）。
for (const name of allToolMentions) {
  if (items.find((it) => it.name === name)) continue;
  if (familyDirs.includes(name)) continue;
  const cat = featureGatedNames.has(name)
    ? "feature-gated"
    : defaultLeafNames.has(name)
    ? "leaf"
    : "leaf";
  items.push({
    name,
    category: cat,
    source_files: ["tools.ts"],
    notes: "由 tools.ts 引用、未独占 tools/ 顶层目录",
  });
}

items.sort((a, b) => a.name.localeCompare(b.name));

const manifest = {
  generated_at: nowIso(),
  source_commit: sourceCommit,
  items,
};

const manifestPath = "docs/appendix/A.manifest.json";
const prev = readManifest(manifestPath);
writeManifest(manifestPath, manifest);

const familyCount = items.filter((i) => i.category === "family").length;
const leafCount = items.filter((i) => i.category === "leaf").length;
const fgCount = items.filter((i) => i.category === "feature-gated").length;

const md = [
  `# 附录 A · 工具速查表`,
  ``,
  `> 生成脚本：\`scripts/gen-tool-table.ts\`；source_commit: \`${sourceCommit}\`；生成于 ${manifest.generated_at}`,
  ``,
  `三列模型：`,
  `- **family**：\`tools/\` 下作为顶层目录出现（${familyCount} 项）`,
  `- **leaf**：\`tools.ts\` 默认 register 的运行期叶子工具（${leafCount} 项）`,
  `- **feature-gated**：受 \`feature(...)\` / 环境变量条件装载（${fgCount} 项）`,
  ``,
  `合计 ${items.length} 项。`,
  ``,
  `| 名称 | 分类 | 源码位置 | 说明 |`,
  `|---|---|---|---|`,
  ...items.map(
    (i) =>
      `| \`${i.name}\` | ${i.category} | ${(i.source_files ?? []).join(", ")} | ${i.notes ?? ""} |`,
  ),
  ``,
].join("\n");

writeFile("docs/appendix/A.md", md);

if (has("--diff-summary")) printDiffSummary("A", prev, manifest);
console.log(
  `[A] wrote docs/appendix/A.md + manifest (${items.length} items: ${familyCount} family / ${leafCount} leaf / ${fgCount} feature-gated)`,
);
