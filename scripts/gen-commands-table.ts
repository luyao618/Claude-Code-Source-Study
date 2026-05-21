/**
 * Appendix B · Commands speed-sheet generator (V2-REVISION-SPEC §7.1).
 *
 * Walks `commands/` under the CLI source root and partitions entries into:
 *   - `top-level-dir`  : a subdirectory holding a command implementation
 *   - `top-level-file` : a single `.ts` / `.tsx` file in `commands/`
 *   - `runtime-cmd`    : commands explicitly enumerated by `commands.ts`
 *
 * Spec §C32 forbids hard-coding "X runtime commands" in the doc; the appendix
 * stays the single source of truth.
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
  writeManifestAndTable,
  type Manifest,
  type ManifestItem,
} from './lib/util.js'

const args = parseArgs(process.argv)
ensureSourceDir(args)
const sourceCommit = resolveSourceCommit(args)

const commandsRoot = path.join(args.source, 'commands')
const commandsTs = path.join(args.source, 'commands.ts')
const commandsTsText = readText(commandsTs)

const dirs = listSubdirs(commandsRoot)
const topLevelFiles = listFiles(commandsRoot, n => /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n))

// Collect symbol-style command identifiers referenced by commands.ts. The
// CLI registers commands by importing files like `./commands/foo/foo.js` or
// directly by symbol; we extract both shapes to mark `runtime-cmd`.
const importPathRe = /from '\.\/commands\/([A-Za-z0-9._-]+)(?:\/([A-Za-z0-9._-]+))?/g
const referenced: Set<string> = new Set()
let m: RegExpExecArray | null
while ((m = importPathRe.exec(commandsTsText)) !== null) {
  referenced.add(m[1])
}

const items: ManifestItem[] = []

function fileWithLines(rel: string, abs: string): string {
  const lines = countLines(abs)
  return `${rel}:1-${Math.max(lines, 1)}`
}

for (const dir of dirs) {
  const isReferenced = referenced.has(dir)
  const subFiles = listFiles(path.join(commandsRoot, dir), n => /\.(ts|tsx)$/.test(n))
  items.push({
    name: dir,
    category: isReferenced ? 'runtime-cmd' : 'top-level-dir',
    source_files: subFiles.map(f =>
      fileWithLines(`commands/${dir}/${f}`, path.join(commandsRoot, dir, f)),
    ),
    notes: isReferenced ? 'imported by commands.ts' : undefined,
  })
}

for (const file of topLevelFiles) {
  const base = file.replace(/\.(ts|tsx)$/, '')
  // commands.ts itself is the registry, not a command; skip if it wandered in.
  if (file === 'commands.ts' || file === 'commands.tsx') continue
  items.push({
    name: base,
    category: 'top-level-file',
    source_files: [fileWithLines(`commands/${file}`, path.join(commandsRoot, file))],
  })
}

// Stable sort: dirs first by name, then files by name.
items.sort((a, b) => {
  if (a.category !== b.category) {
    if (a.category === 'top-level-dir' || a.category === 'runtime-cmd') return -1
    return 1
  }
  return a.name.localeCompare(b.name)
})

const manifest: Manifest = {
  generated_at: new Date().toISOString(),
  source_commit: sourceCommit,
  appendix: 'B',
  items,
}

const counts = {
  dir: items.filter(i => i.category === 'top-level-dir').length,
  runtime: items.filter(i => i.category === 'runtime-cmd').length,
  file: items.filter(i => i.category === 'top-level-file').length,
}

const md = [
  '# 附录 B · Commands 速查表',
  '',
  `> source_commit: \`${sourceCommit}\``,
  `> generated_at: \`${manifest.generated_at}\``,
  `> 共 ${items.length} 项（top-level-dir=${counts.dir} / runtime-cmd=${counts.runtime} / top-level-file=${counts.file}）`,
  '',
  '由 `scripts/gen-commands-table.ts` 扫描 `commands/` 一级目录、`commands/*.ts` 一级文件，并交叉 `commands.ts` 注册图。正文 §C32 引用本表，不裸写命令数。',
  '',
  '| name | category | source_files |',
  '|---|---|---|',
  ...items.map(i =>
    `| \`${i.name}\` | ${i.category} | ${i.source_files.slice(0, 3).join(', ')}${i.source_files.length > 3 ? ` …(+${i.source_files.length - 3})` : ''} |`,
  ),
  '',
].join('\n')

const prev = loadManifest(path.join(args.out, 'B.manifest.json'))
const { manifestPath, tablePath } = writeManifestAndTable(args, 'B', manifest, md)

if (args.diffSummary) {
  process.stdout.write(`appendix-B: ${diffSummary(prev, manifest)}\n`)
}
process.stderr.write(`wrote ${manifestPath} (${items.length} items)\nwrote ${tablePath}\n`)
