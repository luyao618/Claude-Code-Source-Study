/**
 * Appendix F · 模块 × 章节 双向矩阵 + 孤儿目录反向校验
 * (V2-REVISION-SPEC §7.1, §7.6).
 *
 * Two outputs in one manifest:
 *   1. Forward map: each v2 chapter → list of CLI top-level directories /
 *      files it owns. Hard-coded here from V2-REVISION-SPEC.md §6.2 because
 *      the chapter→module mapping is an authoring contract, not a fact you
 *      can derive from the source tree.
 *   2. Reverse map / orphan check: every top-level directory in the CLI
 *      source must be claimed by ≥ 1 chapter. Difference set is the orphan
 *      list; an allowlist file `scripts/orphan-allowlist.txt` (one entry per
 *      line, `#` comments) suppresses known exceptions.
 *
 * Spec §7.6: orphan list non-empty (after allowlist) → `--check-orphans` exit 1.
 */

import { existsSync, readFileSync } from 'node:fs'
import * as path from 'node:path'
import {
  diffSummary,
  ensureSourceDir,
  listFiles,
  listSubdirs,
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

// Encoded from V2-REVISION-SPEC.md §5 + §6.2 reverse matrix.
// Each entry: chapter → list of top-level directory names OR top-level file
// names (with extension) that the chapter is the canonical owner of.
const CHAPTER_TO_MODULES: Record<string, string[]> = {
  C01: [
    'entrypoints', 'bridge', 'remote', 'coordinator', 'buddy',
    'upstreamproxy', 'server', 'migrations', 'native-ts', 'screens',
    'outputStyles', 'memdir', 'assistant', 'schemas',
  ],
  C02: ['bootstrap', 'main.tsx', 'replLauncher.tsx', 'dialogLaunchers.tsx', 'interactiveHelpers.tsx'],
  C03: ['services'],
  C04: ['migrations'],
  C05: ['QueryEngine.ts', 'query.ts', 'query'],
  C06: ['constants', 'outputStyles'],
  C07: ['services'],
  C08: ['services'],
  C09: ['commands', 'services'],
  C10: ['Tool.ts', 'tools.ts', 'tools'],
  C11: ['tools'],
  C12: ['tools', 'services'],
  C13: ['tools'],
  C14: ['tools', 'services', 'commands'],
  C15: ['tools', 'services'],
  C16: ['Task.ts', 'tasks.ts', 'tasks', 'tools'],
  C17: ['coordinator', 'tools', 'hooks'],
  C18: ['services', 'tools'],
  C19: ['Tool.ts', 'hooks', 'bridge', 'remote'],
  C20: ['schemas', 'hooks', 'query'],
  C21: ['skills', 'services', 'plugins', 'outputStyles'],
  C22: ['utils', 'constants'],
  C23: ['services', 'cli'],
  C24: ['bridge', 'remote', 'commands'],
  C25: ['server', 'upstreamproxy', 'hooks'],
  C26: ['ink', 'native-ts'],
  C27: ['components'],
  C28: ['keybindings', 'vim', 'voice', 'services', 'hooks', 'commands'],
  C29: ['buddy'],
  C30: ['screens', 'outputStyles', 'commands'],
  C31: ['memdir', 'services', 'assistant'],
  C32: ['commands.ts', 'commands'],
  C33: ['state', 'bridge'],
  C34: [],
  // Cross-cutting / runtime-glue files that belong to no single chapter
  // but must still be claimed to keep the orphan check honest:
  CROSSCUT: [
    'context', 'context.ts', 'cost-tracker.ts', 'costHook.ts',
    'history.ts', 'ink.ts', 'projectOnboardingState.ts', 'setup.ts',
    'types', 'utils', 'moreright',
  ],
}

// Build forward + reverse views.
const claimed = new Set<string>()
for (const mods of Object.values(CHAPTER_TO_MODULES)) {
  for (const m of mods) claimed.add(m)
}

// Discover the actual top-level entries of the CLI source root.
const cliRoot = args.source
const topDirs = listSubdirs(cliRoot)
const topFiles = listFiles(cliRoot, n => /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n))
const topEntries = [...topDirs, ...topFiles]

// Allowlist for orphan check.
const allowlistPath = path.join('scripts', 'orphan-allowlist.txt')
const allowlist: string[] = existsSync(allowlistPath)
  ? readFileSync(allowlistPath, 'utf8')
      .split('\n')
      .map(l => l.replace(/#.*$/, '').trim())
      .filter(Boolean)
  : []

const orphans = topEntries.filter(e => !claimed.has(e) && !allowlist.includes(e))

const items: ManifestItem[] = []
for (const [chapter, mods] of Object.entries(CHAPTER_TO_MODULES)) {
  items.push({
    name: chapter,
    category: 'chapter',
    source_files: mods,
  })
}
for (const orphan of orphans) {
  items.push({
    name: orphan,
    category: 'orphan',
    source_files: [orphan],
    notes: 'no v2 chapter claims this directory/file',
  })
}

const manifest: Manifest = {
  generated_at: new Date().toISOString(),
  source_commit: sourceCommit,
  appendix: 'F',
  items,
}

const md = [
  '# 附录 F · 模块 × 章节 双向矩阵',
  '',
  `> source_commit: \`${sourceCommit}\``,
  `> generated_at: \`${manifest.generated_at}\``,
  `> 章节 ${Object.keys(CHAPTER_TO_MODULES).length} 项；CLI 一级条目 ${topEntries.length} 个；孤儿 ${orphans.length} 个（allowlist=${allowlist.length}）`,
  '',
  '由 `scripts/gen-module-matrix.ts` 生成。Spec §7.6：`--check-orphans` 在 orphans 数 > 0 时 fail。allowlist 见 `scripts/orphan-allowlist.txt`。',
  '',
  '## F.1 章节 → 源码一级目录（正向）',
  '',
  '| chapter | claimed top-level entries |',
  '|---|---|',
  ...Object.entries(CHAPTER_TO_MODULES).map(([c, mods]) => `| ${c} | ${mods.length ? mods.map(m => `\`${m}\``).join(', ') : '— (横切)'} |`),
  '',
  '## F.2 反向矩阵 + 孤儿',
  '',
  orphans.length === 0
    ? '✅ 所有 CLI 一级条目均已被章节认领。'
    : ['❌ 以下条目尚未被任何章节认领：', '', ...orphans.map(o => `- \`${o}\``)].join('\n'),
  '',
].join('\n')

const prev = loadManifest(path.join(args.out, 'F.manifest.json'))
const { manifestPath, tablePath } = writeManifestAndTable(args, 'F', manifest, md)

if (args.diffSummary) {
  process.stdout.write(`appendix-F: ${diffSummary(prev, manifest)}\n`)
}
process.stderr.write(`wrote ${manifestPath} (${items.length} items, orphans=${orphans.length})\nwrote ${tablePath}\n`)

if (args.checkOrphans) {
  if (orphans.length > 0) {
    process.stderr.write(
      `gen-module-matrix --check-orphans FAIL: ${orphans.length} orphan top-level entries:\n` +
        orphans.map(o => `  - ${o}`).join('\n') +
        '\nAdd a chapter claim or list it in scripts/orphan-allowlist.txt with a comment.\n',
    )
    process.exit(1)
  }
  process.stderr.write('gen-module-matrix --check-orphans OK (0 orphans)\n')
}
