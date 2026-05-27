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

// 识别 feature-gated 工具：扫描 tools.ts 中所有 `require('./tools/<Dir>/<File>.js').XxxTool`，
// 并判断该 require 的语句段内是否含 gate 关键字 (`feature(...)`、`process.env.*`、
// `getFeatureValue_*`)。同时记录该语句在 tools.ts 中的起止行号。
type GateInfo = { start: number; end: number };
const featureGatedNames = new Map<string, GateInfo>();
{
  // 切片：以行首 `const NAME =` 为段起点（覆盖 `const X = feature(...) ? require(...).Y : null`
  // 及 `const xs = feature(...) ? [require(...).A, require(...).B] : []` 两种形态）。
  const heads: number[] = [];
  const lineHeadRe = /^const\s+[A-Za-z]/gm;
  let mm: RegExpExecArray | null;
  while ((mm = lineHeadRe.exec(toolsTs)) !== null) heads.push(mm.index);
  heads.push(toolsTs.length);
  const gateRe = /\bfeature\(|\bprocess\.env\.|\bgetFeatureValue_/;
  // require('./tools/<dir>/<file>.js').XxxTool —— 直接捕获工具名（属性访问位置）。
  const reqToolRe =
    /require\(\s*['"]\.\/tools\/[^'"]+['"]\s*\)\s*\.\s*([A-Z][A-Za-z0-9]+Tool)\b/g;
  for (let i = 0; i < heads.length - 1; i++) {
    const seg = toolsTs.slice(heads[i], heads[i + 1]);
    if (!gateRe.test(seg)) continue;
    const startLine = toolsTs.slice(0, heads[i]).split("\n").length;
    const segTrim = seg.replace(/\s*$/, "");
    const endLine =
      toolsTs.slice(0, heads[i] + segTrim.length).split("\n").length;
    let tm: RegExpExecArray | null;
    reqToolRe.lastIndex = 0;
    while ((tm = reqToolRe.exec(seg)) !== null) {
      featureGatedNames.set(tm[1], { start: startLine, end: endLine });
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

// 整合：采用正交两维口径，避免 OC-R 在 PR1 review 中点名的 family/leaf/feature-gated
// 三选一互斥引发的歧义（feature-gated 工具也可能有 tools/<Dir>/ 顶层目录）。
//   - family    ：bool，是否在 tools/ 下有同名顶层目录。
//   - register  ：枚举（"default" | "feature-gated" | "—"）—— tools.ts 中的装载路径。
type Register = "default" | "feature-gated" | "—";
type Row = {
  name: string;
  family: boolean;
  register: Register;
  source_files: string[];
  notes: string;
};
const rows: Row[] = [];

function registerOf(name: string): Register {
  if (featureGatedNames.has(name)) return "feature-gated";
  if (defaultLeafLines.has(name)) return "default";
  return "—";
}

function noteOf(family: boolean, reg: Register): string {
  const fam = family
    ? "family=tools/ 下有顶层同名目录"
    : "family=否（仅 tools.ts 内引用）";
  const r =
    reg === "default"
      ? "register=tools.ts 顶部 `import` 默认装载"
      : reg === "feature-gated"
      ? "register=tools.ts 中 feature/env/coordinator 条件装载"
      : "register=未在 tools.ts 中检测到装载（可能由 coordinator/SDK 子集另行注入）";
  return `${fam}；${r}`;
}

// family 行：所有 tools/ 顶层目录（family=true）。
for (const dir of familyDirs) {
  const name = dir;
  const reg = registerOf(name);
  rows.push({
    name,
    family: true,
    register: reg,
    source_files: sourceFilesForFamilyDir(dir, name),
    notes: noteOf(true, reg),
  });
}

// 把 tools.ts 中提到但 tools/ 下没有同名目录的工具补进来（family=false）。
for (const name of allToolMentions) {
  if (rows.find((r) => r.name === name)) continue;
  if (familyDirs.includes(name)) continue;
  const reg = registerOf(name);
  rows.push({
    name,
    family: false,
    register: reg,
    source_files: sourceFilesForToolsTsOnly(name),
    notes: noteOf(false, reg),
  });
}

rows.sort((a, b) => a.name.localeCompare(b.name));

const items: ManifestItem[] = rows.map((r) => ({
  name: r.name,
  category: r.family
    ? r.register === "feature-gated"
      ? "family+feature-gated"
      : r.register === "default"
      ? "family+default"
      : "family"
    : r.register === "feature-gated"
    ? "feature-gated"
    : r.register === "default"
    ? "leaf"
    : "—",
  source_files: r.source_files,
  notes: r.notes,
}));

const manifest = {
  source_commit: sourceCommit,
  items,
};

const manifestPath = "docs/appendix/A.manifest.json";
const prev = readManifest(manifestPath);
writeManifest(manifestPath, manifest);

const familyCount = rows.filter((r) => r.family).length;
const defaultRegisterCount = rows.filter((r) => r.register === "default").length;
const fgCount = rows.filter((r) => r.register === "feature-gated").length;
const noRegisterCount = rows.filter((r) => r.register === "—").length;

const md = [
  `# 附录 A · 工具速查表`,
  ``,
  `> 生成脚本：\`scripts/gen-tool-table.ts\`；source_commit: \`${sourceCommit}\``,
  ``,
  `正交两维口径（family 与 register 互不强制）：`,
  `- **family**：是否在 \`tools/\` 下有同名顶层目录。共 **${familyCount}** 项 family（不含 \`shared/\`、\`testing/\`），**${rows.length - familyCount}** 项仅在 \`tools.ts\` 内被引用。`,
  `- **register**：\`tools.ts\` 中的装载路径。`,
  `  - \`default\`：顶部 \`import\` 默认装载，共 **${defaultRegisterCount}** 项。`,
  `  - \`feature-gated\`：受 \`feature(...)\` / \`process.env.*\` / \`getFeatureValue_*\` 条件装载，共 **${fgCount}** 项。`,
  `  - \`—\`：未在 \`tools.ts\` 中检测到装载（多为 \`family-only\`：tools/ 目录存在但运行期由 coordinator/SDK 子集另行注入），共 **${noRegisterCount}** 项。`,
  ``,
  `合计 ${rows.length} 项。`,
  ``,
  `| 名称 | family | register | 源码位置 (path:line-line) | 说明 |`,
  `|---|---|---|---|---|`,
  ...rows.map(
    (r) =>
      `| \`${r.name}\` | ${r.family ? "✓" : "—"} | ${r.register} | ${r.source_files.map((s) => `\`${s}\``).join(", ")} | ${r.notes} |`,
  ),
  ``,
].join("\n");

writeFile("docs/appendix/A.md", md);

if (has("--diff-summary")) printDiffSummary("A", prev, manifest);
console.log(
  `[A] wrote docs/appendix/A.md + manifest (${rows.length} items: family=${familyCount}, register: default=${defaultRegisterCount} / feature-gated=${fgCount} / —=${noRegisterCount})`,
);
