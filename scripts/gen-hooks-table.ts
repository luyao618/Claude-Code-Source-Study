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
  type ManifestItem,
} from "./_lib.ts";

const { get, has } = parseArgs(process.argv);
const sourcePath = resolveSourcePath(get("--source-path"));
const sourceCommit = getSourceCommit(sourcePath);

const coreSchemasPath = join(sourcePath, "entrypoints/sdk/coreSchemas.ts");
const hooksSchemaPath = join(sourcePath, "schemas/hooks.ts");

function extractHookEvents(text: string): { events: string[]; start: number; end: number } {
  const m = text.match(/export const HOOK_EVENTS\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
  if (!m) return { events: [], start: 0, end: 0 };
  const startIdx = text.indexOf(m[0]);
  const endIdx = startIdx + m[0].length;
  const startLine = text.slice(0, startIdx).split("\n").length;
  const endLine = text.slice(0, endIdx).split("\n").length;
  const events: string[] = [];
  const re = /['"]([A-Za-z]+)['"]/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(m[1])) !== null) events.push(mm[1]);
  return { events, start: startLine, end: endLine };
}

function extractHookCommandTypes(text: string): { name: string; line: number }[] {
  const out: { name: string; line: number }[] = [];
  const re = /type:\s*z\.literal\(['"]([A-Za-z]+)['"]\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const line = text.slice(0, m.index).split("\n").length;
    out.push({ name: m[1], line });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const coreText = readFileSync(coreSchemasPath, "utf8");
const hooksText = readFileSync(hooksSchemaPath, "utf8");
const eventInfo = extractHookEvents(coreText);
const cmdTypes = extractHookCommandTypes(hooksText);

const items: ManifestItem[] = [
  ...eventInfo.events.map(
    (e): ManifestItem => ({
      name: e,
      category: "event",
      wire_type: e,
      source_files: [`entrypoints/sdk/coreSchemas.ts:${eventInfo.start}-${eventInfo.end}`],
    }),
  ),
  ...cmdTypes.map(
    (t): ManifestItem => ({
      name: t.name,
      category: "command_type",
      source_files: [`schemas/hooks.ts:${t.line}-${t.line}`],
    }),
  ),
];

const manifest = {
  source_commit: sourceCommit,
  items,
  counts: { events: eventInfo.events.length, command_types: cmdTypes.length },
};

const manifestPath = "docs/appendix/C.manifest.json";
const prev = readManifest(manifestPath);
writeManifest(manifestPath, manifest);

const md = [
  `# 附录 C · Hooks 事件表`,
  ``,
  `> 生成脚本：\`scripts/gen-hooks-table.ts\`；source_commit: \`${sourceCommit}\``,
  ``,
  `- HOOK_EVENTS：${eventInfo.events.length} 个`,
  `- Hook command type：${cmdTypes.length} 类`,
  ``,
  `## HOOK_EVENTS（来源：\`entrypoints/sdk/coreSchemas.ts:${eventInfo.start}-${eventInfo.end}\`）`,
  ``,
  `| 事件名 |`,
  `|---|`,
  ...eventInfo.events.map((e) => `| \`${e}\` |`),
  ``,
  `## Hook command type（来源：\`schemas/hooks.ts\`）`,
  ``,
  `| 类型 | 行号 |`,
  `|---|---|`,
  ...cmdTypes.map((t) => `| \`${t.name}\` | ${t.line} |`),
  ``,
].join("\n");

writeFile("docs/appendix/C.md", md);
if (has("--diff-summary")) printDiffSummary("C", prev, manifest);
console.log(
  `[C] wrote docs/appendix/C.md + manifest (events=${eventInfo.events.length}, cmd_types=${cmdTypes.length})`,
);
