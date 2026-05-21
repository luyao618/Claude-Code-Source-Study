/**
 * Appendix A · Tool speed-sheet generator (V2-REVISION-SPEC §7.1).
 *
 * Walks `tools/` directly under the CLI source root, classifies each top-level
 * `*Tool/` directory as one of:
 *   - `family`     → the directory contains 2+ leaf `*Tool.ts` files
 *                    (e.g. ScheduleCronTool/{CronCreate,CronDelete,CronList}Tool.ts)
 *   - `runtime-leaf` → registered unconditionally in `tools.ts`
 *   - `feature-gated` → registered behind `feature(...)` / env / user-type guard
 *
 * Source of truth for runtime registration: `tools.ts` at the CLI source root.
 * Spec §C10 explicitly forbids hard-coded "42 / 43" tool counts; numbers in
 * the doc must always be re-derivable from this manifest.
 */

import * as path from 'node:path'
import {
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

const dirs = listSubdirs(toolsRoot).filter(d => d !== 'shared' && d !== 'testing')

const tools: ToolDef[] = []

for (const dir of dirs) {
  const abs = path.join(toolsRoot, dir)
  // Leaf candidates: top-level `*Tool.ts` (or `.tsx`) files inside the dir.
  const leafFiles = listFiles(abs, n => /Tool\.tsx?$/.test(n))
  // All TS files, used for line accounting + family inference.
  const allTs = walkTsFiles(args.source, `tools/${dir}`)
  const allTsRel = allTs.map(f => f.rel)

  // Detect imports of the directory in tools.ts to decide gating.
  const importLine = new RegExp(`from '\\./tools/${dir}/`)
  const isImported = importLine.test(toolsTsText)

  // Feature-flag detection: scan tools.ts for `feature('X')` near a
  // `require('./tools/<dir>/...')` reference — that's the conditional
  // registration shape used in tools.ts.
  const flagRe = new RegExp(
    `feature\\('([A-Z_]+)'\\)[^\\n]*\\n[\\s\\S]{0,200}?require\\('\\.\\/tools\\/${dir}\\/`,
    'g',
  )
  const featureFlags: string[] = []
  let m: RegExpExecArray | null
  while ((m = flagRe.exec(toolsTsText)) !== null) featureFlags.push(m[1])

  // Also detect `process.env.<X>` gates (e.g. `USER_TYPE === 'ant'`).
  const envGateRe = new RegExp(
    `process\\.env\\.([A-Z_]+)[^\\n]*\\n[\\s\\S]{0,200}?require\\('\\.\\/tools\\/${dir}\\/`,
    'g',
  )
  while ((m = envGateRe.exec(toolsTsText)) !== null) {
    featureFlags.push(`env:${m[1]}`)
  }

  // Family vs leaf: a "family" directory exposes 2+ leaf Tool entrypoint
  // files. ScheduleCronTool ships {CronCreate,CronDelete,CronList}Tool.ts.
  const familyLeaves = leafFiles.length >= 2 ? leafFiles : []

  if (familyLeaves.length > 0) {
    // Emit a family parent + each leaf as separate items so callers can
    // count "wire-level" tools off the leaves while still tracking the
    // family abstraction.
    tools.push({
      name: dir,
      category: 'family',
      source_files: allTsRel,
      feature_flags: featureFlags.length ? Array.from(new Set(featureFlags)) : undefined,
      notes: `family of ${familyLeaves.length} leaf tools`,
    })
    for (const leafFile of familyLeaves) {
      const leafName = leafFile.replace(/\.tsx?$/, '')
      tools.push({
        name: leafName,
        category: featureFlags.length ? 'feature-gated' : 'runtime-leaf',
        source_files: [`tools/${dir}/${leafFile}`],
        feature_flags: featureFlags.length ? Array.from(new Set(featureFlags)) : undefined,
        notes: `leaf of ${dir}`,
      })
    }
  } else {
    tools.push({
      name: dir,
      category: featureFlags.length ? 'feature-gated' : isImported ? 'runtime-leaf' : 'feature-gated',
      source_files: allTsRel,
      feature_flags: featureFlags.length ? Array.from(new Set(featureFlags)) : undefined,
      notes: isImported ? undefined : 'not directly imported by tools.ts (likely indirect)',
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
  '本表由 `scripts/gen-tool-table.ts` 扫描 CLI 源码 `tools/` 目录 + `tools.ts` 注册图生成；正文 §C10 引用此表的 leaf 数即可，不要在正文中裸写工具数量。',
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
