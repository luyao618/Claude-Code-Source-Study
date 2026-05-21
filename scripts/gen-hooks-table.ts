/**
 * Appendix C · Hooks event table generator (V2-REVISION-SPEC §7.1).
 *
 * Two distinct surfaces:
 *   1. The wire-level event names exported as `HOOK_EVENTS` (currently 27)
 *      from `entrypoints/sdk/coreTypes.ts`.
 *   2. The hook *command* shape — declared by `schemas/hooks.ts` and the
 *      `hooks/` runtime — currently 4 kinds: `command` / `prompt` / `http` /
 *      `agent`.
 *
 * Spec §C20 requires the doc to lock both surfaces against this manifest.
 */

import * as path from 'node:path'
import {
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

const eventsFile = path.join(args.source, 'entrypoints/sdk/coreTypes.ts')
const eventsText = readText(eventsFile)

// Locate `export const HOOK_EVENTS = [ … ] as const` and parse the literal
// list. We do not eval; we slice between `[` and `]` and pull single-quoted
// identifiers.
function extractEvents(text: string): { name: string; line: number }[] {
  const startMatch = text.match(/export const HOOK_EVENTS = \[/)
  if (!startMatch) {
    throw new Error('HOOK_EVENTS literal not found in coreTypes.ts')
  }
  const startIdx = startMatch.index! + startMatch[0].length
  const endIdx = text.indexOf(']', startIdx)
  if (endIdx === -1) throw new Error('unterminated HOOK_EVENTS literal')
  const slice = text.slice(startIdx, endIdx)
  const lines = text.slice(0, startIdx).split('\n').length
  const out: { name: string; line: number }[] = []
  const sliceLines = slice.split('\n')
  for (let i = 0; i < sliceLines.length; i++) {
    const m = sliceLines[i].match(/'([A-Za-z0-9_]+)'/)
    if (m) out.push({ name: m[1], line: lines + i })
  }
  return out
}

const events = extractEvents(eventsText)

// Hook command kinds: enumerate by inspecting `schemas/hooks.ts` for kind
// discriminator string literals — the schema uses
// `z.discriminatedUnion('type', […])` per command. Pull every `type: z.literal('X')`.
const schemasFile = path.join(args.source, 'schemas/hooks.ts')
const schemasText = readText(schemasFile)
const kindRe = /type:\s*z\.literal\(['"]([a-z_]+)['"]\)/g
const kindSet = new Set<string>()
let km: RegExpExecArray | null
while ((km = kindRe.exec(schemasText)) !== null) kindSet.add(km[1])
const kinds = Array.from(kindSet).sort()

const items: ManifestItem[] = []
for (const ev of events) {
  items.push({
    name: ev.name,
    category: 'event',
    source_files: [`entrypoints/sdk/coreTypes.ts:${ev.line}`],
    wire_type: 'hook_event',
  })
}
for (const k of kinds) {
  items.push({
    name: k,
    category: 'command-kind',
    source_files: [`schemas/hooks.ts`],
    wire_type: 'hook_command',
  })
}

const manifest: Manifest = {
  generated_at: new Date().toISOString(),
  source_commit: sourceCommit,
  appendix: 'C',
  items,
}

const md = [
  '# 附录 C · Hooks 事件表',
  '',
  `> source_commit: \`${sourceCommit}\``,
  `> generated_at: \`${manifest.generated_at}\``,
  `> 共 ${events.length} 个 HOOK_EVENTS + ${kinds.length} 种 hook command`,
  '',
  '由 `scripts/gen-hooks-table.ts` 扫描 `entrypoints/sdk/coreTypes.ts` (HOOK_EVENTS 字面量) 与 `schemas/hooks.ts`（命令 kind 判别）。正文 §C20 不裸写"27"，引用本表。',
  '',
  '## C.1 HOOK_EVENTS',
  '',
  '| # | name | source |',
  '|---|---|---|',
  ...events.map((e, i) => `| ${i + 1} | \`${e.name}\` | entrypoints/sdk/coreTypes.ts:${e.line} |`),
  '',
  '## C.2 Hook command kinds',
  '',
  '| name | source |',
  '|---|---|',
  ...kinds.map(k => `| \`${k}\` | schemas/hooks.ts |`),
  '',
].join('\n')

const prev = loadManifest(path.join(args.out, 'C.manifest.json'))
const { manifestPath, tablePath } = writeManifestAndTable(args, 'C', manifest, md)

if (args.diffSummary) {
  process.stdout.write(`appendix-C: ${diffSummary(prev, manifest)}\n`)
}
process.stderr.write(`wrote ${manifestPath} (${items.length} items)\nwrote ${tablePath}\n`)
