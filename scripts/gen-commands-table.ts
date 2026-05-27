#!/usr/bin/env bun
/**
 * 附录 B · Commands 速查表生成器。
 *
 * 三段：
 *   - 一级目录（commands/<name>/）
 *   - 一级文件（commands/<name>.ts(x)）
 *   - runtime 命令：commands.ts 中聚合的注册项（粗粒度静态扫描）
 *
 * 用法：
 *   bun scripts/gen-commands-table.ts [--source-path <claude-code-cli>] [--diff-summary]
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  parseArgs,
  resolveSourcePath,
  getSourceCommit,
  listTopLevelDirs,
  listFiles,
  writeManifest,
  writeFile,
  readManifest,
  printDiffSummary,
  type ManifestItem,
} from "./_lib.ts";

const { get, has } = parseArgs(process.argv);
const sourcePath = resolveSourcePath(get("--source-path"));
const sourceCommit = getSourceCommit(sourcePath);

const cmdDir = join(sourcePath, "commands");
const dirs = listTopLevelDirs(cmdDir);
const topFiles = listFiles(cmdDir, { recursive: false, extensions: [".ts", ".tsx"] }).map(
  (p) => p.slice(cmdDir.length + 1),
);

const items: ManifestItem[] = [];

for (const d of dirs) {
  items.push({
    name: d,
    category: "directory",
    source_files: [`commands/${d}/`],
    notes: "一级命令目录",
  });
}
for (const f of topFiles) {
  items.push({
    name: f.replace(/\.tsx?$/, ""),
    category: "file",
    source_files: [`commands/${f}`],
    notes: "一级命令文件",
  });
}

// runtime 命令：commands.ts 中常见聚合形态。粗粒度扫描——给出静态/动态装载计数。
const cmdsTs = readFileSync(join(sourcePath, "commands.ts"), "utf8");
const staticRefs = new Set<string>();
const dynamicRefs = new Set<string>();
// 静态 import：兼容 default / named / mixed 三种形态。
// 形如 `import foo from './commands/foo/...'`、`import { a, b } from './commands/foo/...'`、
//      `import foo, { a } from './commands/foo/...'`。
// 同时也覆盖 `import './commands/foo/...'` 这种纯副作用 import。
const staticImportRe =
  /import\s+(?:[^'";]+?\s+from\s+)?['"]\.\/commands\/([A-Za-z0-9_-]+)/g;
// 动态 require：`require('./commands/foo/...')` 通常用于条件装载。
const dynamicRequireRe =
  /require\(\s*['"]\.\/commands\/([A-Za-z0-9_-]+)/g;
let m: RegExpExecArray | null;
while ((m = staticImportRe.exec(cmdsTs)) !== null) staticRefs.add(m[1]);
while ((m = dynamicRequireRe.exec(cmdsTs)) !== null) dynamicRefs.add(m[1]);
// 仅在 require 出现、import 未出现的目录算 "纯动态装载"。
const dynamicOnly = new Set(
  Array.from(dynamicRefs).filter((d) => !staticRefs.has(d)),
);
// 一级目录中未在 commands.ts 任意 import/require 中出现的：可能由 plugin 注册或为遗留目录。
const unreferencedDirs = dirs.filter(
  (d) => !staticRefs.has(d) && !dynamicRefs.has(d),
);

const manifest = {
  source_commit: sourceCommit,
  items,
  runtime_summary: {
    top_level_directories: dirs.length,
    top_level_files: topFiles.length,
    total_top_level: dirs.length + topFiles.length,
    static_imported_in_commands_ts: staticRefs.size,
    dynamically_required_in_commands_ts: dynamicRefs.size,
    dynamically_required_only: Array.from(dynamicOnly).sort(),
    dirs_not_referenced_in_commands_ts: unreferencedDirs,
  },
};

const manifestPath = "docs/appendix/B.manifest.json";
const prev = readManifest(manifestPath);
writeManifest(manifestPath, manifest);

const md = [
  `# 附录 B · Commands 速查表`,
  ``,
  `> 生成脚本：\`scripts/gen-commands-table.ts\`；source_commit: \`${sourceCommit}\``,
  ``,
  `- 一级目录：${dirs.length}`,
  `- 一级文件：${topFiles.length}`,
  `- 一级条目合计：${dirs.length + topFiles.length}`,
  `- \`commands.ts\` 中静态 import 引用到的目录：${staticRefs.size}`,
  `- \`commands.ts\` 中条件 require 装载的目录：${dynamicRefs.size}（其中 ${dynamicOnly.size} 个仅以 require 形态装载）`,
  `- 未被 \`commands.ts\` 任意 import/require 引用的一级目录：${unreferencedDirs.length}${unreferencedDirs.length ? `（${unreferencedDirs.map((d) => `\`${d}\``).join(", ")}；可能通过 plugin 注册或为遗留目录）` : ""}`,
  ``,
  `## 一级目录`,
  ``,
  `| 名称 | 路径 |`,
  `|---|---|`,
  ...dirs.map((d) => `| \`${d}\` | \`commands/${d}/\` |`),
  ``,
  `## 一级文件`,
  ``,
  `| 名称 | 路径 |`,
  `|---|---|`,
  ...topFiles.map((f) => `| \`${f.replace(/\.tsx?$/, "")}\` | \`commands/${f}\` |`),
  ``,
  `## 条件 require 装载的目录（${dynamicOnly.size}）`,
  ``,
  dynamicOnly.size === 0
    ? `无：所有 \`require('./commands/...')\` 调用涉及的目录都同时被静态 \`import\` 引用。`
    : [
        `| 名称 | 路径 |`,
        `|---|---|`,
        ...Array.from(dynamicOnly)
          .sort()
          .map((d) => `| \`${d}\` | \`commands/${d}/\` |`),
      ].join("\n"),
  ``,
].join("\n");

writeFile("docs/appendix/B.md", md);
if (has("--diff-summary")) printDiffSummary("B", prev, manifest);
console.log(
  `[B] wrote docs/appendix/B.md + manifest (dirs=${dirs.length}, files=${topFiles.length})`,
);
