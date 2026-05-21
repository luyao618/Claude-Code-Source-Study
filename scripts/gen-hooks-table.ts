#!/usr/bin/env bun
/**
 * 附录 C · Hooks 事件表生成器。
 *
 * - 解析 entrypoints/sdk/coreSchemas.ts 中的 `HOOK_EVENTS` 数组（27 个事件）。
 * - 解析 schemas/hooks.ts 中四种 hook command type（command / prompt / http / agent）。
 *
 * 用法：
 *   bun scripts/gen-hooks-table.ts [--source-path <claude-code-cli>] [--diff-summary]
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
  nowIso,
  type ManifestItem,
} from "./_lib.ts";

const { get, has } = parseArgs(process.argv);
const sourcePath = resolveSourcePath(get("--source-path"));
const sourceCommit = getSourceCommit(sourcePath);

const coreSchemasPath = join(sourcePath, "entrypoints/sdk/coreSchemas.ts");
const hooksSchemaPath = join(sourcePath, "schemas/hooks.ts");

function extractHookEvents(text: string): string[] {
  const m = text.match(/export const HOOK_EVENTS\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
  if (!m) return [];
  const out: string[] = [];
  const re = /['"]([A-Za-z]+)['"]/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(m[1])) !== null) out.push(mm[1]);
  return out;
}

function extractHookCommandTypes(text: string): string[] {
  const out = new Set<string>();
  // 形如 `type: z.literal('command')` / `type: z.literal('http')` 等。
  const re = /type:\s*z\.literal\(['"]([A-Za-z]+)['"]\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return Array.from(out).sort();
}

const events = extractHookEvents(readFileSync(coreSchemasPath, "utf8"));
const cmdTypes = extractHookCommandTypes(readFileSync(hooksSchemaPath, "utf8"));

const items: ManifestItem[] = [
  ...events.map(
    (e): ManifestItem => ({
      name: e,
      category: "event",
      wire_type: e,
      source_files: ["entrypoints/sdk/coreSchemas.ts"],
    }),
  ),
  ...cmdTypes.map(
    (t): ManifestItem => ({
      name: t,
      category: "command_type",
      source_files: ["schemas/hooks.ts"],
    }),
  ),
];

const manifest = {
  generated_at: nowIso(),
  source_commit: sourceCommit,
  items,
  counts: { events: events.length, command_types: cmdTypes.length },
};

const manifestPath = "docs/appendix/C.manifest.json";
const prev = readManifest(manifestPath);
writeManifest(manifestPath, manifest);

const md = [
  `# 附录 C · Hooks 事件表`,
  ``,
  `> 生成脚本：\`scripts/gen-hooks-table.ts\`；source_commit: \`${sourceCommit}\`；生成于 ${manifest.generated_at}`,
  ``,
  `- HOOK_EVENTS：${events.length} 个`,
  `- Hook command type：${cmdTypes.length} 类`,
  ``,
  `## HOOK_EVENTS（来源：\`entrypoints/sdk/coreSchemas.ts\`）`,
  ``,
  `| 事件名 |`,
  `|---|`,
  ...events.map((e) => `| \`${e}\` |`),
  ``,
  `## Hook command type（来源：\`schemas/hooks.ts\`）`,
  ``,
  `| 类型 |`,
  `|---|`,
  ...cmdTypes.map((t) => `| \`${t}\` |`),
  ``,
].join("\n");

writeFile("docs/appendix/C.md", md);
if (has("--diff-summary")) printDiffSummary("C", prev, manifest);
console.log(
  `[C] wrote docs/appendix/C.md + manifest (events=${events.length}, cmd_types=${cmdTypes.length})`,
);
