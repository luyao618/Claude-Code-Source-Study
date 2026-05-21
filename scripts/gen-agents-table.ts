/**
 * Appendix D · Built-in Agent speed-sheet (V2-REVISION-SPEC §7.1, §7.5).
 *
 * Two-tier model per §7.5:
 *   1. Positive table — every Agent **defined in source**: scan
 *      `tools/AgentTool/built-in/*Agent*.ts` and `coordinator/workerAgent.ts`,
 *      pull `agentType` / `model` / `tools` from the literal export.
 *   2. Side-table notes — for each agent, list the variables that affect
 *      runtime availability (feature flags, entrypoint gate, coordinator).
 *      `getBuiltInAgents()` in `tools/AgentTool/builtInAgents.ts` is the
 *      authority for these conditions.
 */

import { existsSync, readFileSync } from 'node:fs'
import * as path from 'node:path'
import {
  diffSummary,
  ensureSourceDir,
  listFiles,
  loadManifest,
  parseArgs,
  resolveSourceCommit,
  writeManifestAndTable,
  type Manifest,
  type ManifestItem,
} from './lib/util.js'

const args = parseArgs(process.argv)
ensureSourceDir(args)
const sourceCommit = resolveSourceCommit(args)

const builtInDir = path.join(args.source, 'tools/AgentTool/built-in')
const registryFile = path.join(args.source, 'tools/AgentTool/builtInAgents.ts')
const registryText = existsSync(registryFile) ? readFileSync(registryFile, 'utf8') : ''

interface AgentRecord {
  symbol: string                // exported const name, e.g. GENERAL_PURPOSE_AGENT
  rel: string                   // relative path
  agentType: string | null
  model: string | null
  tools: string | null
  whenToUseLine: number | null
}

function pullField(text: string, field: string): string | null {
  // Match `field: 'value'` or `field: "value"` at start of any line.
  const re = new RegExp(`^\\s*${field}:\\s*(?:'([^']*)'|"([^"]*)"|([^,\\n]+))`, 'm')
  const m = text.match(re)
  if (!m) return null
  return (m[1] ?? m[2] ?? (m[3] ?? '').trim().replace(/[,]+$/, '')) || null
}

function findExportedSymbol(text: string): string | null {
  const m = text.match(/export const ([A-Z_][A-Z0-9_]*)\s*:/)
  return m ? m[1] : null
}

const agentFiles = listFiles(builtInDir, n => /\.ts$/.test(n))
const agents: AgentRecord[] = []

for (const f of agentFiles) {
  const abs = path.join(builtInDir, f)
  const text = readFileSync(abs, 'utf8')
  const sym = findExportedSymbol(text)
  if (!sym) continue
  const agentType = pullField(text, 'agentType')
  const model = pullField(text, 'model')
  // tools is an array literal — capture verbatim, sliced.
  const toolsM = text.match(/^\s*tools:\s*\[([^\]]*)\]/m)
  const tools = toolsM ? toolsM[1].trim() : null
  // Locate the line `whenToUse:` for source citation.
  let whenToUseLine: number | null = null
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*whenToUse:/.test(lines[i])) {
      whenToUseLine = i + 1
      break
    }
  }
  agents.push({
    symbol: sym,
    rel: `tools/AgentTool/built-in/${f}`,
    agentType,
    model,
    tools,
    whenToUseLine,
  })
}

// Cross-reference with builtInAgents.ts to determine gating.
const gateRules: { symbol: string; gates: string[] }[] = []
for (const a of agents) {
  const gates: string[] = []
  // Default-on agents listed unconditionally in `agents` array literal.
  // Conservative detection: search registry text for the symbol context.
  const idx = registryText.indexOf(a.symbol)
  if (idx === -1) {
    // Imported but never pushed → likely coordinator-only or unused.
    gates.push('not-default')
  } else {
    // Walk backward to find nearest `feature(` or `if (` clause within ~400 chars.
    const window = registryText.slice(Math.max(0, idx - 400), idx)
    const featRe = /feature\('([A-Z_]+)'\)/g
    let fm: RegExpExecArray | null
    while ((fm = featRe.exec(window)) !== null) gates.push(`feature:${fm[1]}`)
    if (/CLAUDE_CODE_ENTRYPOINT/.test(window)) gates.push('entrypoint:non-sdk')
    if (/CLAUDE_CODE_COORDINATOR_MODE/.test(window)) gates.push('coordinator-mode')
    if (/areExplorePlanAgentsEnabled/.test(window)) gates.push('feature:BUILTIN_EXPLORE_PLAN_AGENTS')
  }
  gateRules.push({ symbol: a.symbol, gates: Array.from(new Set(gates)) })
}

const items: ManifestItem[] = agents.map((a, i) => ({
  name: a.agentType ?? a.symbol,
  category: 'built-in',
  source_files: [
    a.whenToUseLine ? `${a.rel}:${a.whenToUseLine}` : a.rel,
  ],
  feature_flags: gateRules[i].gates.length ? gateRules[i].gates : undefined,
  notes: [
    a.model ? `model=${a.model}` : null,
    a.tools !== null ? `tools=[${a.tools}]` : null,
  ]
    .filter(Boolean)
    .join('; ') || undefined,
}))

const manifest: Manifest = {
  generated_at: new Date().toISOString(),
  source_commit: sourceCommit,
  appendix: 'D',
  items,
}

const md = [
  '# 附录 D · 内置 Agent 速查表',
  '',
  `> source_commit: \`${sourceCommit}\``,
  `> generated_at: \`${manifest.generated_at}\``,
  `> 共 ${items.length} 个源码定义的 built-in agent`,
  '',
  '本表只列「源码定义」的 Agent；运行时是否启用受 feature flag / entrypoint / coordinator 影响——见 `gates` 列。正文 §C15 必须声明这一两段式（spec §7.5）。',
  '',
  '| agentType (or symbol) | source_file | gates (feature/entry/coord) | notes |',
  '|---|---|---|---|',
  ...items.map(i =>
    `| \`${i.name}\` | ${i.source_files[0]} | ${(i.feature_flags ?? []).join(', ') || '—'} | ${i.notes ?? '—'} |`,
  ),
  '',
].join('\n')

const prev = loadManifest(path.join(args.out, 'D.manifest.json'))
const { manifestPath, tablePath } = writeManifestAndTable(args, 'D', manifest, md)

if (args.diffSummary) {
  process.stdout.write(`appendix-D: ${diffSummary(prev, manifest)}\n`)
}
process.stderr.write(`wrote ${manifestPath} (${items.length} items)\nwrote ${tablePath}\n`)
