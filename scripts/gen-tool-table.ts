/**
 * Appendix A · Tool speed-sheet generator (V2-REVISION-SPEC §7.1).
 *
 * Walks `tools/` directly under the CLI source root, classifies each top-level
 * `*Tool/` directory as one of:
 *   - `family`     → the directory contains 2+ leaf `*Tool.ts` files
 *                    (e.g. ScheduleCronTool/{CronCreate,CronDelete,CronList}Tool.ts)
 *   - `runtime-leaf` → registered unconditionally in `getAllBaseTools()`
 *   - `feature-gated` → registered behind `feature(...)` / `process.env...` /
 *     `isXxxEnabled()` / a conditionally-required symbol
 *
 * Source of truth for runtime registration: `tools.ts` at the CLI source
 * root. Both top-level `const FooTool = feature(...) ? require(...) : null`
 * declarations *and* inline `getAllBaseTools()` spreads
 * (`...(GATE ? [Tool] : [])`) are treated as runtime gates so a directly
 * imported tool that is only conditionally added (e.g. `ConfigTool`,
 * `LSPTool`) is correctly classified `feature-gated`, not `runtime-leaf`.
 *
 * Spec §C10 explicitly forbids hard-coded "42 / 43" tool counts; numbers
 * in the doc must always be re-derivable from this manifest.
 *
 * Manifest §7.3 contract: `source_files` entries are `"path:line-line"`
 * (1-indexed, inclusive) so chapter facts can anchor on `file:line`.
 */

import * as path from 'node:path'
import {
  countLines,
  diffSummary,
  ensureSourceDir,
  listFiles,
  listSubdirs,
  loadManifest,
  parseArgs,
  readText,
  resolveSourceCommit,
  walkTsFiles,
  writeManifestAndTable,
  type Manifest,
  type ManifestItem,
} from './lib/util.js'

const args = parseArgs(process.argv)
ensureSourceDir(args)
const sourceCommit = resolveSourceCommit(args)

const toolsRoot = path.join(args.source, 'tools')
const toolsTs = path.join(args.source, 'tools.ts')
const toolsTsText = readText(toolsTs)

interface ToolDef {
  name: string
  category: 'family' | 'runtime-leaf' | 'feature-gated'
  source_files: string[]
  feature_flags?: string[]
  notes?: string
}

// ---------------------------------------------------------------------------
// Phase 1 · Parse tools.ts to learn (a) which tool symbols map to which
// `tools/<dir>` directory, and (b) what gate (if any) each symbol carries.
// We honor two declaration shapes:
//   - `const FooTool = feature('X') ? require('./tools/Foo/FooTool.js').FooTool : null`
//   - `const FooTool = process.env.X === 'y' ? require('./tools/Foo/...').FooTool : null`
// and import-style symbols (`import { FooTool } from './tools/Foo/FooTool.js'`)
// which have no declaration-level gate.
// ---------------------------------------------------------------------------

interface SymbolInfo {
  /** `tools/<dir>` this symbol resolves into (best-effort). */
  dir: string | null
  /** Declaration-level gate flags (`feature` / `env:` / `fn:` / null if unconditional). */
  declGates: string[]
}

const symbolToInfo = new Map<string, SymbolInfo>()

function recordSymbol(symbol: string, dir: string | null, gates: string[]): void {
  const cur = symbolToInfo.get(symbol)
  if (cur) {
    if (dir && !cur.dir) cur.dir = dir
    for (const g of gates) if (!cur.declGates.includes(g)) cur.declGates.push(g)
  } else {
    symbolToInfo.set(symbol, { dir, declGates: gates.slice() })
  }
}

// Plain `import { X } from './tools/<dir>/<file>.js'` — no gate.
const importRe = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+'\.\/tools\/([A-Za-z0-9_-]+)\//g
{
  let m: RegExpExecArray | null
  while ((m = importRe.exec(toolsTsText)) !== null) {
    const dir = m[2]
    for (const sym of m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
      recordSymbol(sym, dir, [])
    }
  }
}

// Conditional `const Sym = <gate> ? require('./tools/<dir>/...') : ...`.
// We snip multi-line declarations between `const Sym` and a terminator
// (next blank line, top-level `const`, or `import`/`export`).
const declRe = /^const\s+([A-Za-z0-9_]+)\s*(?::\s*[^=]+)?=\s*([\s\S]*?)(?=\n(?:const|import|export|\s*\/\*|\s*$))/gm
{
  let m: RegExpExecArray | null
  while ((m = declRe.exec(toolsTsText)) !== null) {
    const sym = m[1]
    const body = m[2]
    if (!/require\('\.\/tools\//.test(body) && !/require\('\.\/coordinator/.test(body)) continue
    // Pick the first `tools/<dir>` that the require touches.
    const dirMatch = body.match(/require\('\.\/tools\/([A-Za-z0-9_-]+)\//)
    const dir = dirMatch ? dirMatch[1] : null
    const gates: string[] = []
    for (const fm of body.matchAll(/feature\('([A-Z_]+)'\)/g)) gates.push(fm[1])
    for (const em of body.matchAll(/process\.env\.([A-Z_]+)/g)) gates.push(`env:${em[1]}`)
    if (gates.length === 0) {
      // No gate detected but require() is unconditional → treat as plain require.
      recordSymbol(sym, dir, [])
    } else {
      recordSymbol(sym, dir, gates)
    }
  }
}

// `const getXxxTool = () => require('./tools/<dir>/...')` is a lazy unconditional
// import (used only to break circular deps). The runtime gate, if any, lives
// in the inline spread inside `getAllBaseTools()`.
const lazyRe = /^const\s+(get[A-Za-z0-9_]+Tool)\s*=\s*\(\)\s*=>[\s\S]*?require\('\.\/tools\/([A-Za-z0-9_-]+)\//gm
{
  let m: RegExpExecArray | null
  while ((m = lazyRe.exec(toolsTsText)) !== null) {
    recordSymbol(m[1], m[2], [])
  }
}

// ---------------------------------------------------------------------------
// Phase 2 · Parse `getAllBaseTools()` body. For each entry we record which
// symbol(s) get added and what *inline* gate (if any) wraps them. Inline
// gates compose with declaration gates.
// ---------------------------------------------------------------------------

const fnStart = toolsTsText.search(/export function getAllBaseTools\(\)/)
if (fnStart === -1) throw new Error('getAllBaseTools() not found in tools.ts')
// Find `return [` after the function header, then walk balanced brackets to `]`.
const retIdx = toolsTsText.indexOf('return [', fnStart)
if (retIdx === -1) throw new Error('getAllBaseTools(): no `return [` body')
let depth = 1
let i = retIdx + 'return ['.length
for (; i < toolsTsText.length && depth > 0; i++) {
  const ch = toolsTsText[i]
  if (ch === '[') depth++
  else if (ch === ']') depth--
}
if (depth !== 0) throw new Error('getAllBaseTools(): unbalanced return list')
const fnBody = toolsTsText.slice(retIdx + 'return ['.length, i - 1)

interface InlineEntry {
  /** Symbols added by this entry (e.g. `['ConfigTool']` or `['TaskCreateTool', …]`). */
  symbols: string[]
  /** Inline gate flags for this entry, e.g. `['env:USER_TYPE', 'fn:isTodoV2Enabled']`. */
  gates: string[]
}

const inlineEntries: InlineEntry[] = []

// Split the body into top-level array entries. Entries are comma-separated
// at depth 0; spreads `...(...)` may carry parens — we track paren/bracket
// depth.
function splitEntries(body: string): string[] {
  const out: string[] = []
  let buf = ''
  let pdepth = 0
  let bdepth = 0
  for (let k = 0; k < body.length; k++) {
    const ch = body[k]
    if (ch === '(') pdepth++
    else if (ch === ')') pdepth--
    else if (ch === '[') bdepth++
    else if (ch === ']') bdepth--
    if (ch === ',' && pdepth === 0 && bdepth === 0) {
      out.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) out.push(buf.trim())
  return out.filter(Boolean)
}

for (const raw of splitEntries(fnBody)) {
  // Match `...(<gate> ? [<list>] : [])` — the canonical conditional spread.
  const spread = raw.match(/^\.\.\.\(([\s\S]*?)\?\s*\[([\s\S]*?)\]\s*:\s*\[\s*\]\)$/)
  if (spread) {
    const gateExpr = spread[1]
    const list = spread[2]
    const gates: string[] = []
    for (const fm of gateExpr.matchAll(/feature\('([A-Z_]+)'\)/g)) gates.push(fm[1])
    for (const em of gateExpr.matchAll(/process\.env\.([A-Z_]+)/g)) gates.push(`env:${em[1]}`)
    for (const fnm of gateExpr.matchAll(/\b(is[A-Z][A-Za-z0-9_]*(?:Enabled|EnabledOptimistic))\(/g)) gates.push(`fn:${fnm[1]}`)
    // `getPowerShellTool()`-style getters embed an `isXxxEnabled()` check
    // in their body. We surface the getter call itself as a marker so the
    // dir is correctly classified as gated even when the inline expression
    // doesn't name a flag.
    for (const gm of gateExpr.matchAll(/\b(get[A-Z][A-Za-z0-9_]*Tool)\(\)/g)) {
      // Look up the getter body in tools.ts and pull out any
      // `isXxxEnabled` it references.
      const getterRe = new RegExp(
        `const\\s+${gm[1]}\\s*=\\s*\\(\\)\\s*=>\\s*\\{[\\s\\S]*?\\}`,
      )
      const body = toolsTsText.match(getterRe)?.[0] ?? ''
      for (const fnm of body.matchAll(/\b(is[A-Z][A-Za-z0-9_]*(?:Enabled|EnabledOptimistic))\(/g)) gates.push(`fn:${fnm[1]}`)
      for (const em of body.matchAll(/process\.env\.([A-Z_]+)/g)) gates.push(`env:${em[1]}`)
      // Even if we couldn't extract a named flag, the getter itself is the
      // gate; mark it so the dir is feature-gated rather than runtime-leaf.
      gates.push(`fn:${gm[1]}`)
    }
    // Detect bare-symbol truthy gates: the gate expression is just a symbol
    // (e.g. `OverflowTestTool ? [OverflowTestTool] : []`). The symbol carries
    // its declaration-level gate; we surface it by name so phase 3 can join.
    const bareSym = gateExpr.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)$/)
    if (bareSym && gates.length === 0) gates.push(`sym:${bareSym[1]}`)
    const symbols = list
      .split(',')
      .map(s => s.trim())
      .filter(s => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s))
    inlineEntries.push({ symbols, gates })
    continue
  }
  // `...spreadAlias` — e.g. `...cronTools`. The alias carries its own decl gate.
  const aliasSpread = raw.match(/^\.\.\.([A-Za-z_][A-Za-z0-9_]*)$/)
  if (aliasSpread) {
    inlineEntries.push({ symbols: [aliasSpread[1]], gates: [] })
    continue
  }
  // `getXxxTool() ? [getXxxTool()] : []` style with parens — already covered above.
  // Bare entry like `BashTool` or a call like `getSendMessageTool()` → unconditional.
  const bareCall = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)\(\)$/)
  if (bareCall) {
    inlineEntries.push({ symbols: [bareCall[1]], gates: [] })
    continue
  }
  const bareTok = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)$/)
  if (bareTok) {
    inlineEntries.push({ symbols: [bareTok[1]], gates: [] })
    continue
  }
  // Skip anything we can't parse (comments etc.) — they cannot register a tool.
}

// ---------------------------------------------------------------------------
// Phase 3 · For each tool dir, fold inline + declaration gates together.
// ---------------------------------------------------------------------------

const dirToGates = new Map<string, Set<string>>()
const dirIsRegistered = new Set<string>()

function noteDir(dir: string | null, gates: string[]): void {
  if (!dir) return
  dirIsRegistered.add(dir)
  let s = dirToGates.get(dir)
  if (!s) {
    s = new Set<string>()
    dirToGates.set(dir, s)
  }
  for (const g of gates) s.add(g)
}

for (const entry of inlineEntries) {
  // Compose effective gates: inline gates ∪ each symbol's decl gates.
  const effective = new Set<string>()
  for (const g of entry.gates) {
    if (g.startsWith('sym:')) {
      const refSym = g.slice('sym:'.length)
      const info = symbolToInfo.get(refSym)
      if (info) for (const dg of info.declGates) effective.add(dg)
      // If the symbol is declared with no gate (plain import), `sym:X` falling
      // through to no flags would mis-classify as runtime-leaf. Keep the raw
      // marker so we still treat it as gated (e.g. `OverflowTestTool` is
      // declared with `feature(...)`, but the marker survives even if we
      // failed to parse a flag).
      effective.add(g)
    } else {
      effective.add(g)
    }
  }
  for (const sym of entry.symbols) {
    const info = symbolToInfo.get(sym)
    const dir = info?.dir ?? null
    const gates: string[] = Array.from(effective)
    if (info) for (const dg of info.declGates) gates.push(dg)
    noteDir(dir, gates)
  }
}

// ---------------------------------------------------------------------------
// Phase 4 · Walk `tools/` and emit one ManifestItem per directory + leaf.
// ---------------------------------------------------------------------------

const dirs = listSubdirs(toolsRoot).filter(d => d !== 'shared' && d !== 'testing')

const tools: ToolDef[] = []

function fileWithLines(rel: string, abs: string): string {
  const lines = countLines(abs)
  return `${rel}:1-${Math.max(lines, 1)}`
}

for (const dir of dirs) {
  const abs = path.join(toolsRoot, dir)
  // Leaf candidates: top-level `*Tool.ts` (or `.tsx`) files inside the dir.
  const leafFiles = listFiles(abs, n => /Tool\.tsx?$/.test(n))
  // All TS files under the directory, used for source_files line spans.
  const allTs = walkTsFiles(args.source, `tools/${dir}`)
  const allTsAnchored = allTs.map(f => `${f.rel}:1-${Math.max(f.lines, 1)}`)

  const gates = Array.from(dirToGates.get(dir) ?? [])
  const isRegistered = dirIsRegistered.has(dir)
  // `sym:` markers are gate evidence even when their referenced symbol has no
  // resolvable flag — drop them from the user-visible flag list once we have
  // already used them to classify the dir as feature-gated.
  const flags = gates.filter(g => !g.startsWith('sym:'))

  // Family vs leaf: a "family" directory exposes 2+ leaf Tool entrypoint
  // files. ScheduleCronTool ships {CronCreate,CronDelete,CronList}Tool.ts.
  const familyLeaves = leafFiles.length >= 2 ? leafFiles : []

  if (familyLeaves.length > 0) {
    tools.push({
      name: dir,
      category: 'family',
      source_files: allTsAnchored,
      feature_flags: flags.length ? flags : undefined,
      notes: `family of ${familyLeaves.length} leaf tools`,
    })
    for (const leafFile of familyLeaves) {
      const leafName = leafFile.replace(/\.tsx?$/, '')
      const leafRel = `tools/${dir}/${leafFile}`
      const leafAbs = path.join(toolsRoot, dir, leafFile)
      tools.push({
        name: leafName,
        category: gates.length ? 'feature-gated' : 'runtime-leaf',
        source_files: [fileWithLines(leafRel, leafAbs)],
        feature_flags: flags.length ? flags : undefined,
        notes: `leaf of ${dir}`,
      })
    }
  } else {
    let category: ToolDef['category']
    if (gates.length) category = 'feature-gated'
    else if (isRegistered) category = 'runtime-leaf'
    else category = 'feature-gated'
    tools.push({
      name: dir,
      category,
      source_files: allTsAnchored,
      feature_flags: flags.length ? flags : undefined,
      notes: isRegistered ? undefined : 'not directly imported by tools.ts (likely indirect)',
    })
  }
}

const items: ManifestItem[] = tools.map(t => ({
  name: t.name,
  category: t.category,
  source_files: t.source_files,
  feature_flags: t.feature_flags,
  notes: t.notes,
}))

const manifest: Manifest = {
  generated_at: new Date().toISOString(),
  source_commit: sourceCommit,
  appendix: 'A',
  items,
}

const counts = {
  family: items.filter(i => i.category === 'family').length,
  leaf: items.filter(i => i.category === 'runtime-leaf').length,
  gated: items.filter(i => i.category === 'feature-gated').length,
}

const md = [
  '# 附录 A · 工具速查表',
  '',
  `> source_commit: \`${sourceCommit}\``,
  `> generated_at: \`${manifest.generated_at}\``,
  `> 共 ${items.length} 项（family=${counts.family} / runtime-leaf=${counts.leaf} / feature-gated=${counts.gated}）`,
  '',
  '本表由 `scripts/gen-tool-table.ts` 扫描 CLI 源码 `tools/` 目录 + `tools.ts` 注册图（含 `getAllBaseTools()` 内联 gate）生成；正文 §C10 引用此表的 leaf 数即可，不要在正文中裸写工具数量。',
  '',
  '| name | category | feature_flags | source_files |',
  '|---|---|---|---|',
  ...items.map(i =>
    `| \`${i.name}\` | ${i.category} | ${(i.feature_flags ?? []).join(', ') || '—'} | ${i.source_files.slice(0, 3).join(', ')}${i.source_files.length > 3 ? ` …(+${i.source_files.length - 3})` : ''} |`,
  ),
  '',
].join('\n')

const prev = loadManifest(path.join(args.out, 'A.manifest.json'))
const { manifestPath, tablePath } = writeManifestAndTable(args, 'A', manifest, md)

if (args.diffSummary) {
  process.stdout.write(`appendix-A: ${diffSummary(prev, manifest)}\n`)
}
process.stderr.write(`wrote ${manifestPath} (${items.length} items)\nwrote ${tablePath}\n`)
