#!/usr/bin/env bun
/**
 * 附录 C · Hooks 事件表生成器。
 *
 * - 解析 entrypoints/sdk/coreSchemas.ts 中的 `HOOK_EVENTS` 数组（27 个事件）。
 * - 解析 schemas/hooks.ts 中四种 hook command type（command / prompt / http / agent）。
 * - 合并 scripts/data/hooks-trigger-map.json 手工库的触发时机 + payload 字段。
 *
 * 用法：
 *   bun scripts/gen-hooks-table.ts [--source-path <claude-code-cli>] [--diff-summary]
 */
import { readFileSync, existsSync } from "node:fs";
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
const triggerMapPath = "scripts/data/hooks-trigger-map.json";

type TriggerEntry = {
  trigger: string;
  payload: string[];
  schema_source: string;
  dispatch_source: string;
  call_sites: string[];
};

type TriggerMap = {
  source_commit: string;
  events: Record<string, TriggerEntry>;
};

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

function loadTriggerMap(): TriggerMap {
  if (!existsSync(triggerMapPath)) {
    throw new Error(
      `Missing trigger map at ${triggerMapPath}; needed to render trigger/payload columns.`,
    );
  }
  return JSON.parse(readFileSync(triggerMapPath, "utf8")) as TriggerMap;
}

const coreText = readFileSync(coreSchemasPath, "utf8");
const hooksText = readFileSync(hooksSchemaPath, "utf8");
const eventInfo = extractHookEvents(coreText);
const cmdTypes = extractHookCommandTypes(hooksText);
const triggerMap = loadTriggerMap();

// Drift gate: warn loudly when source_commit or event set diverges. Do not
// silently render stale data — leaving a TODO in the rendered table is safer
// than pretending the manual map matches the bundled source.
const driftWarnings: string[] = [];
if (triggerMap.source_commit !== sourceCommit) {
  driftWarnings.push(
    `trigger-map source_commit ${triggerMap.source_commit} != current ${sourceCommit}; verify map is still accurate`,
  );
}
const missingFromMap = eventInfo.events.filter((e) => !triggerMap.events[e]);
const extraInMap = Object.keys(triggerMap.events).filter(
  (e) => !eventInfo.events.includes(e),
);
if (missingFromMap.length > 0) {
  driftWarnings.push(`events missing from trigger map: ${missingFromMap.join(", ")}`);
}
if (extraInMap.length > 0) {
  driftWarnings.push(`events in trigger map but not in HOOK_EVENTS: ${extraInMap.join(", ")}`);
}

const items: ManifestItem[] = [
  ...eventInfo.events.map((e): ManifestItem => {
    const entry = triggerMap.events[e];
    return {
      name: e,
      category: "event",
      wire_type: e,
      source_files: entry
        ? [entry.schema_source, entry.dispatch_source, ...entry.call_sites]
        : [`entrypoints/sdk/coreSchemas.ts:${eventInfo.start}-${eventInfo.end}`],
      trigger: entry?.trigger ?? "TODO: 待补 trigger",
      payload: entry?.payload ?? ["TODO: 待补 payload"],
    };
  }),
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
  counts: {
    events: eventInfo.events.length,
    command_types: cmdTypes.length,
    events_with_trigger: eventInfo.events.filter((e) => triggerMap.events[e]).length,
  },
};

const manifestPath = "docs/appendix/C.manifest.json";
const prev = readManifest(manifestPath);
writeManifest(manifestPath, manifest);

function renderPayloadCell(payload: string[]): string {
  // Escape pipes for markdown table cells and join with <br/> so each field
  // sits on its own visual line without breaking the row.
  return payload
    .map((p) => p.replace(/\|/g, "\\|"))
    .map((p) => `\`${p}\``)
    .join("<br/>");
}

function renderTriggerCell(trigger: string): string {
  return trigger.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function renderSourcesCell(entry?: TriggerEntry): string {
  if (!entry) return "—";
  const lines = [
    `schema: \`${entry.schema_source}\``,
    `dispatch: \`${entry.dispatch_source}\``,
    ...entry.call_sites.map((s) => `call: \`${s}\``),
  ];
  return lines.join("<br/>");
}

const md = [
  `# 附录 C · Hooks 事件表`,
  ``,
  `> 生成脚本：\`scripts/gen-hooks-table.ts\`；source_commit: \`${sourceCommit}\``,
  ``,
  `- HOOK_EVENTS：${eventInfo.events.length} 个`,
  `- Hook command type：${cmdTypes.length} 类`,
  `- 已补齐 trigger/payload：${manifest.counts.events_with_trigger}/${eventInfo.events.length}`,
  ``,
  ...(driftWarnings.length > 0
    ? [
        `> ⚠️ 触发表与源码可能存在漂移：`,
        ...driftWarnings.map((w) => `> - ${w}`),
        ``,
      ]
    : []),
  `## HOOK_EVENTS（来源：\`entrypoints/sdk/coreSchemas.ts:${eventInfo.start}-${eventInfo.end}\`）`,
  ``,
  `| 事件名 | 触发时机 | Payload 字段 | 源码位置 |`,
  `|---|---|---|---|`,
  ...eventInfo.events.map((e) => {
    const entry = triggerMap.events[e];
    const trigger = entry ? renderTriggerCell(entry.trigger) : "TODO: 待补 trigger";
    const payload = entry ? renderPayloadCell(entry.payload) : "TODO: 待补 payload";
    return `| \`${e}\` | ${trigger} | ${payload} | ${renderSourcesCell(entry)} |`;
  }),
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
if (driftWarnings.length > 0) {
  for (const w of driftWarnings) console.warn(`[C] drift: ${w}`);
}
console.log(
  `[C] wrote docs/appendix/C.md + manifest (events=${eventInfo.events.length}, cmd_types=${cmdTypes.length}, with_trigger=${manifest.counts.events_with_trigger})`,
);
