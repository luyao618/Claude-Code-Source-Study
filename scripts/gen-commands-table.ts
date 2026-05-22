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

// runtime 命令：commands.ts 中常见聚合形态。粗粒度扫描——只为给出 runtime 计数。
const cmdsTs = readFileSync(join(sourcePath, "commands.ts"), "utf8");
const runtimeRefs = new Set<string>();
// 形如 `import { fooCommand } from './commands/foo/...'`
const runtimeImportRe =
  /import\s+\{[^}]+\}\s+from\s+['"]\.\/commands\/([A-Za-z0-9_-]+)/g;
let m: RegExpExecArray | null;
while ((m = runtimeImportRe.exec(cmdsTs)) !== null) runtimeRefs.add(m[1]);

const manifest = {
  source_commit: sourceCommit,
  items,
  runtime_summary: {
    top_level_directories: dirs.length,
    top_level_files: topFiles.length,
    total_top_level: dirs.length + topFiles.length,
    runtime_referenced_in_commands_ts: runtimeRefs.size,
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
  `- \`commands.ts\` 中静态引用到的目录：${runtimeRefs.size}（仅作粗略 runtime 估算）`,
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
].join("\n");

writeFile("docs/appendix/B.md", md);
if (has("--diff-summary")) printDiffSummary("B", prev, manifest);
console.log(
  `[B] wrote docs/appendix/B.md + manifest (dirs=${dirs.length}, files=${topFiles.length})`,
);
