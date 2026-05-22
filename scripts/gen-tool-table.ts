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
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
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
  countLines,
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
const toolsTsPath = join(sourcePath, "tools.ts");
const toolsTs = readFileSync(toolsTsPath, "utf8");
const toolsTsLineArr = toolsTs.split("\n");

// 抓所有 ToolName 形态：单词以 Tool 结尾且首字母大写。
const toolNameRe = /\b([A-Z][A-Za-z0-9]+Tool)\b/g;
const allToolMentions = new Set<string>();
let m: RegExpExecArray | null;
while ((m = toolNameRe.exec(toolsTs)) !== null) allToolMentions.add(m[1]);

// 识别 feature-gated 工具：扫描 tools.ts 中的"条件 require"块。
// 用按 `const NAME =` 起的语句切片，再判断该语句中是否同时含 (gate, require, ToolName)。
// 同时记录该语句在 tools.ts 中的起止行号，用于生成 path:line-line。
type GateInfo = { start: number; end: number };
const featureGatedNames = new Map<string, GateInfo>();
{
  // 按 `^const NAME =` 切片，但保留每片在原文中的起始字符偏移以便算行号。
  const splitRe = /^(?=const\s+[A-Za-z])/m;
  // RegExp.split 丢偏移，所以手工扫一次。
  const heads: number[] = [];
  const lineHeadRe = /^const\s+[A-Za-z]/gm;
  let mm: RegExpExecArray | null;
  while ((mm = lineHeadRe.exec(toolsTs)) !== null) heads.push(mm.index);
  heads.push(toolsTs.length);
  const gateRe = /feature\(|process\.env\.|getFeatureValue_/;
  const reqToolRe = /([A-Z][A-Za-z0-9]+Tool)/g;
  for (let i = 0; i < heads.length - 1; i++) {
    const seg = toolsTs.slice(heads[i], heads[i + 1]);
    if (!gateRe.test(seg)) continue;
    const startLine = toolsTs.slice(0, heads[i]).split("\n").length;
    // 段末（去掉尾随空行）
    const segTrim = seg.replace(/\s*$/, "");
    const endLine =
      toolsTs.slice(0, heads[i] + segTrim.length).split("\n").length;
    let tm: RegExpExecArray | null;
    while ((tm = reqToolRe.exec(seg)) !== null) {
      // 仅记录 require(...).XxxTool 形态；避免把变量名（const FooTool = ...）当工具。
      const around = seg.slice(Math.max(0, tm.index - 30), tm.index);
      if (/require\(['"][^'"]+['"]\)\.$/.test(around)) {
        featureGatedNames.set(tm[1], { start: startLine, end: endLine });
      }
    }
  }
}

// 默认叶子：在 tools.ts 顶部 `import { XxxTool } from './tools/XxxTool/...'` 形态。
// 同时记录每个 import 行号。
const defaultLeafLines = new Map<string, number>();
{
  const importRe =
    /import\s+\{\s*([A-Z][A-Za-z0-9]+Tool)\s*\}\s+from\s+['"]\.\/tools\//g;
  let mm: RegExpExecArray | null;
  while ((mm = importRe.exec(toolsTs)) !== null) {
    const line = toolsTs.slice(0, mm.index).split("\n").length;
    defaultLeafLines.set(mm[1], line);
  }
}

// 给定 tools/<dir>/，挑一个主源码文件做 path:line-line 锚点。
// 优先级：tools/<dir>/<dir>.tsx > tools/<dir>/<dir>.ts > tools/<dir>/index.ts
// > tools/<dir>/prompt.ts > 第一个 .ts/.tsx 文件。
function primarySourceFor(dir: string): string | null {
  const candidates = [
    `tools/${dir}/${dir}.tsx`,
    `tools/${dir}/${dir}.ts`,
    `tools/${dir}/index.tsx`,
    `tools/${dir}/index.ts`,
    `tools/${dir}/prompt.ts`,
    `tools/${dir}/constants.ts`,
  ];
  for (const rel of candidates) {
    if (existsSync(join(sourcePath, rel))) return rel;
  }
  // 退化：取目录下首个 .ts/.tsx 文件。
  const dirAbs = join(sourcePath, "tools", dir);
  if (!existsSync(dirAbs)) return null;
  for (const name of readdirSync(dirAbs).sort()) {
    if (/\.tsx?$/.test(name)) {
      try {
        if (statSync(join(dirAbs, name)).isFile()) return `tools/${dir}/${name}`;
      } catch {
        // ignore
      }
    }
  }
  return null;
}

function sourceFilesForFamilyDir(dir: string, name: string): string[] {
  const out: string[] = [];
  const primary = primarySourceFor(dir);
  if (primary) {
    const total = countLines(join(sourcePath, primary));
    if (total > 0) out.push(`${primary}:1-${total}`);
    else out.push(primary);
  }
  // 追加 tools.ts 中与该工具相关的行号锚点
  const importLine = defaultLeafLines.get(name);
  if (importLine !== undefined) {
    out.push(`tools.ts:${importLine}-${importLine}`);
  }
  const gate = featureGatedNames.get(name);
  if (gate) {
    out.push(`tools.ts:${gate.start}-${gate.end}`);
  }
  return out;
}

function sourceFilesForToolsTsOnly(name: string): string[] {
  const out: string[] = [];
  const importLine = defaultLeafLines.get(name);
  if (importLine !== undefined) {
    out.push(`tools.ts:${importLine}-${importLine}`);
  }
  const gate = featureGatedNames.get(name);
  if (gate) {
    out.push(`tools.ts:${gate.start}-${gate.end}`);
  }
  if (out.length === 0) {
    // 找第一处出现的行号，作为最后兜底。
    const idx = toolsTs.indexOf(name);
    if (idx >= 0) {
      const line = toolsTs.slice(0, idx).split("\n").length;
      out.push(`tools.ts:${line}-${line}`);
    } else {
      out.push(`tools.ts:1-${toolsTsLineArr.length}`);
    }
  }
  return out;
}

// 整合
const items: ManifestItem[] = [];

// family：所有 tools/ 顶层目录（即便未在 tools.ts 默认装载，也算 family 收录）。
for (const dir of familyDirs) {
  const asTool = dir; // 目录名通常即工具名
  if (featureGatedNames.has(asTool)) {
    items.push({
      name: asTool,
      category: "feature-gated",
      source_files: sourceFilesForFamilyDir(dir, asTool),
      notes: "tools.ts 中按 feature flag / 环境变量条件装载",
    });
  } else if (defaultLeafLines.has(asTool)) {
    items.push({
      name: asTool,
      category: "leaf",
      source_files: sourceFilesForFamilyDir(dir, asTool),
      notes: "tools.ts 默认 register 的运行期叶子工具",
    });
  } else {
    items.push({
      name: asTool,
      category: "family",
      source_files: sourceFilesForFamilyDir(dir, asTool),
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
    : defaultLeafLines.has(name)
    ? "leaf"
    : "leaf";
  items.push({
    name,
    category: cat,
    source_files: sourceFilesForToolsTsOnly(name),
    notes: "由 tools.ts 引用、未独占 tools/ 顶层目录",
  });
}

items.sort((a, b) => a.name.localeCompare(b.name));

const manifest = {
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
  `> 生成脚本：\`scripts/gen-tool-table.ts\`；source_commit: \`${sourceCommit}\``,
  ``,
  `三列模型：`,
  `- **family**：\`tools/\` 下作为顶层目录出现（${familyCount} 项）`,
  `- **leaf**：\`tools.ts\` 默认 register 的运行期叶子工具（${leafCount} 项）`,
  `- **feature-gated**：受 \`feature(...)\` / 环境变量条件装载（${fgCount} 项）`,
  ``,
  `合计 ${items.length} 项。`,
  ``,
  `| 名称 | 分类 | 源码位置 (path:line-line) | 说明 |`,
  `|---|---|---|---|`,
  ...items.map(
    (i) =>
      `| \`${i.name}\` | ${i.category} | ${(i.source_files ?? []).map((s) => `\`${s}\``).join(", ")} | ${i.notes ?? ""} |`,
  ),
  ``,
].join("\n");

writeFile("docs/appendix/A.md", md);

if (has("--diff-summary")) printDiffSummary("A", prev, manifest);
console.log(
  `[A] wrote docs/appendix/A.md + manifest (${items.length} items: ${familyCount} family / ${leafCount} leaf / ${fgCount} feature-gated)`,
);
