/**
 * Appendix E · TaskType 谱系生成器 (V2-REVISION-SPEC §7.1).
 *
 * Authority for the wire-level TaskType union: `Task.ts:6-13` (the
 * `export type TaskType = | 'local_bash' | …` literal). Default vs
 * feature-gated registration: `tasks.ts` `getAllTasks()` body.
 *
 * Spec §C16 calls for a "7 wire / 4 default + 2 feature-gated + 1 in-process
 * special" classification — this script extracts that classification from
 * source rather than asserting it.
 */

import { existsSync } from 'node:fs'
import * as path from 'node:path'
import {
  countLines,
  diffSummary,
  ensureSourceDir,
  loadManifest,
  parseArgs,
  readText,
  resolveSourceCommit,
  writeManifestAndTable,
  type Manifest,
  type ManifestItem,
} from './lib/util.js'

const args = parseArgs(process.argv)
ensureSourceDir(args)
const sourceCommit = resolveSourceCommit(args)

const taskTsAbs = path.join(args.source, 'Task.ts')
const tasksTsAbs = path.join(args.source, 'tasks.ts')
const taskTs = readText(taskTsAbs)
const tasksTs = readText(tasksTsAbs)

// Pull wire types from the `TaskType` union literal. The union has no
// trailing `;` (TS allows the implicit terminator before a blank line),
// so we slice from the start marker until the next blank line.
const unionStart = taskTs.search(/export type TaskType =/)
if (unionStart === -1) throw new Error('TaskType declaration not found in Task.ts')
const unionEnd = taskTs.indexOf('\n\n', unionStart)
if (unionEnd === -1) throw new Error('TaskType union has no terminating blank line')
const unionBody = taskTs.slice(unionStart, unionEnd)
// 1-indexed start/end line of the union literal in Task.ts (used as
// `Task.ts:start-end` anchor for every wire type entry below).
const unionStartLine = taskTs.slice(0, unionStart).split('\n').length
const unionEndLine = taskTs.slice(0, unionEnd).split('\n').length
const taskTsAnchor = `Task.ts:${unionStartLine}-${unionEndLine}`
const wireTypes: string[] = []
const lit = unionBody
const litRe = /'([a-z_]+)'/g
let lm: RegExpExecArray | null
while ((lm = litRe.exec(lit)) !== null) wireTypes.push(lm[1])

// Find which task implementations are unconditionally pushed in
// `getAllTasks()` vs guarded by `feature(...)`.
function isFeatureGated(typeName: string, body: string): { gated: boolean; flag?: string } {
  // Search for `feature('FLAG')` lines that conditionally assign the task.
  // tasks.ts pattern: `const LocalWorkflowTask: Task | null = feature('WORKFLOW_SCRIPTS')`
  const camel = typeNameToClass(typeName)
  if (!camel) return { gated: false }
  const re = new RegExp(`const ${camel}.*?=\\s*feature\\('([A-Z_]+)'\\)`)
  const m = body.match(re)
  if (m) return { gated: true, flag: m[1] }
  return { gated: false }
}

function typeNameToClass(typeName: string): string | null {
  // Map wire type names → class symbols imported / required by tasks.ts.
  const map: Record<string, string> = {
    local_bash: 'LocalShellTask',
    local_agent: 'LocalAgentTask',
    remote_agent: 'RemoteAgentTask',
    in_process_teammate: 'InProcessTeammateTask',
    local_workflow: 'LocalWorkflowTask',
    monitor_mcp: 'MonitorMcpTask',
    dream: 'DreamTask',
  }
  return map[typeName] ?? null
}

function findInProcessSpecial(typeName: string): boolean {
  // in_process_teammate is the documented in-process special: it is *not*
  // in `getAllTasks()` (no Task implementation pushed) but appears in the
  // wire union and has its own task class file.
  return typeName === 'in_process_teammate'
}

function resolveTaskFile(typeName: string): string {
  // Map wire type → on-disk implementation file when the convention holds:
  // `tasks/<Class>/<Class>.ts`. If the file is missing (e.g. wire-only
  // entries with no separate Task class), anchor to the Task.ts union
  // literal so the manifest still meets §7.3's `path:line-line` contract.
  const cls = typeNameToClass(typeName)
  if (cls) {
    const rel = `tasks/${cls}/${cls}.ts`
    const abs = path.join(args.source, rel)
    if (existsSync(abs)) {
      const lines = countLines(abs)
      return `${rel}:1-${Math.max(lines, 1)}`
    }
  }
  return taskTsAnchor
}

const items: ManifestItem[] = wireTypes.map(t => {
  const sourceAnchor = resolveTaskFile(t)
  if (findInProcessSpecial(t)) {
    return {
      name: t,
      category: 'in-process-special',
      source_files: [sourceAnchor],
      wire_type: t,
      default_registered: false,
      notes: 'wire type only; runs in-process via teammate path, not via getAllTasks()',
    }
  }
  const gate = isFeatureGated(t, tasksTs)
  if (gate.gated) {
    return {
      name: t,
      category: 'feature-gated',
      source_files: [sourceAnchor],
      wire_type: t,
      default_registered: false,
      feature_flags: gate.flag ? [gate.flag] : undefined,
    }
  }
  return {
    name: t,
    category: 'default',
    source_files: [sourceAnchor],
    wire_type: t,
    default_registered: true,
  }
})

const counts = {
  total: items.length,
  default: items.filter(i => i.category === 'default').length,
  gated: items.filter(i => i.category === 'feature-gated').length,
  inproc: items.filter(i => i.category === 'in-process-special').length,
}

const manifest: Manifest = {
  generated_at: new Date().toISOString(),
  source_commit: sourceCommit,
  appendix: 'E',
  items,
}

const md = [
  '# 附录 E · TaskType 谱系',
  '',
  `> source_commit: \`${sourceCommit}\``,
  `> generated_at: \`${manifest.generated_at}\``,
  `> 共 ${counts.total} 个 wire TaskType（default=${counts.default} / feature-gated=${counts.gated} / in-process-special=${counts.inproc}）`,
  '',
  '由 `scripts/gen-tasktypes-table.ts` 解析 `Task.ts` 的 `TaskType` union 字面量与 `tasks.ts` 的 `getAllTasks()` 注册体。正文 §C16 引用本表，禁止裸写 4/2/1。',
  '',
  '| name | category | feature_flags | default_registered | source_file | notes |',
  '|---|---|---|---|---|---|',
  ...items.map(i =>
    `| \`${i.name}\` | ${i.category} | ${(i.feature_flags ?? []).join(', ') || '—'} | ${String(i.default_registered)} | ${i.source_files[0]} | ${i.notes ?? '—'} |`,
  ),
  '',
].join('\n')

const prev = loadManifest(path.join(args.out, 'E.manifest.json'))
const { manifestPath, tablePath } = writeManifestAndTable(args, 'E', manifest, md)

if (args.diffSummary) {
  process.stdout.write(`appendix-E: ${diffSummary(prev, manifest)}\n`)
}
process.stderr.write(`wrote ${manifestPath} (${items.length} items)\nwrote ${tablePath}\n`)
