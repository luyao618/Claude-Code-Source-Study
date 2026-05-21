/**
 * Shared helpers for V2 appendix manifest generators (附录 A–F) and CI
 * lints (`check-source-commits` / `lint-no-fuzzy-quantifiers`).
 *
 * V2-REVISION-SPEC.md §0.3 requires every manifest to ship with
 *   - `generated_at`: ISO-8601 timestamp
 *   - `source_commit`: full git SHA of the CLI source tree
 *   - `items[]`: canonical-id keyed list of facts
 * and §7.4 requires fail-fast diffability between consecutive manifests.
 *
 * Every script reads the CLI source root via `--source <path>` (defaults
 * to `~/work/code/awesome-project/claude-code-cli` per spec §0.1).
 * Run example:
 *   tsx scripts/gen-tool-table.ts \
 *     --source ~/work/code/awesome-project/claude-code-cli \
 *     --out docs/appendix
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import * as path from 'node:path'

export const DEFAULT_SOURCE = path.join(
  homedir(),
  'work',
  'code',
  'awesome-project',
  'claude-code-cli',
)

export const DEFAULT_OUT = path.join('docs', 'appendix')

export interface CliArgs {
  source: string
  out: string
  sourceCommit?: string
  diffSummary: boolean
  checkOrphans: boolean
  raw: Record<string, string | boolean>
}

export function parseArgs(argv: string[]): CliArgs {
  const raw: Record<string, string | boolean> = {}
  for (let i = 2; i < argv.length; i++) {
    const tok = argv[i]
    if (!tok.startsWith('--')) continue
    const key = tok.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      raw[key] = true
    } else {
      raw[key] = next
      i++
    }
  }
  const source =
    typeof raw.source === 'string'
      ? raw.source
      : process.env.CLI_SOURCE
        ? process.env.CLI_SOURCE
        : DEFAULT_SOURCE
  const out = typeof raw.out === 'string' ? raw.out : DEFAULT_OUT
  const sourceCommit =
    typeof raw['source-commit'] === 'string' ? raw['source-commit'] : undefined
  return {
    source,
    out,
    sourceCommit,
    diffSummary: raw['diff-summary'] === true,
    checkOrphans: raw['check-orphans'] === true,
    raw,
  }
}

/** Resolve the canonical CLI source commit either from --source-commit or `git -C <source> rev-parse HEAD`. */
export function resolveSourceCommit(args: CliArgs): string {
  if (args.sourceCommit) return args.sourceCommit
  try {
    return execFileSync('git', ['-C', args.source, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim()
  } catch (err) {
    throw new Error(
      `failed to resolve source_commit at ${args.source}: ${(err as Error).message}`,
    )
  }
}

export function ensureSourceDir(args: CliArgs): void {
  if (!existsSync(args.source) || !statSync(args.source).isDirectory()) {
    throw new Error(
      `source path not found or not a directory: ${args.source} ` +
        `(pass --source <path-to-claude-code-cli>)`,
    )
  }
}

/** List immediate subdirectory names of `dir`, sorted asc. Excludes `.dot` dirs. */
export function listSubdirs(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .map(d => d.name)
    .sort()
}

/** List files matching `predicate` directly inside `dir` (non-recursive), sorted asc. */
export function listFiles(dir: string, predicate: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isFile() && predicate(d.name))
    .map(d => d.name)
    .sort()
}

export interface FileInfo {
  /** Path relative to the CLI source root. */
  rel: string
  /** Absolute path on disk. */
  abs: string
  /** Line count (LF-counted, last partial line counted). */
  lines: number
}

/** Recursively collect every `.ts` / `.tsx` file under `dir`, with line counts. */
export function walkTsFiles(root: string, sub: string): FileInfo[] {
  const out: FileInfo[] = []
  const start = path.join(root, sub)
  if (!existsSync(start)) return out
  const stack: string[] = [start]
  while (stack.length) {
    const cur = stack.pop()!
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      const abs = path.join(cur, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'testing') continue
        stack.push(abs)
        continue
      }
      if (!entry.isFile()) continue
      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      if (/\.test\.(ts|tsx)$/.test(entry.name)) continue
      out.push({
        rel: path.relative(root, abs).split(path.sep).join('/'),
        abs,
        lines: countLines(abs),
      })
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel))
}

export function countLines(abs: string): number {
  const text = readFileSync(abs, 'utf8')
  if (text.length === 0) return 0
  let n = 1
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++
  // If file ends with `\n`, the trailing empty line is not a real line.
  if (text.charCodeAt(text.length - 1) === 10) n--
  return n
}

export function readText(abs: string): string {
  return readFileSync(abs, 'utf8')
}

/** Find the first 1-indexed line number where `needle` appears, or `null` if absent. */
export function findLine(abs: string, needle: string | RegExp): number | null {
  const text = readFileSync(abs, 'utf8').split('\n')
  for (let i = 0; i < text.length; i++) {
    if (typeof needle === 'string') {
      if (text[i].includes(needle)) return i + 1
    } else {
      if (needle.test(text[i])) return i + 1
    }
  }
  return null
}

export interface Manifest {
  generated_at: string
  source_commit: string
  appendix: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  items: ManifestItem[]
}

export interface ManifestItem {
  name: string
  category: string
  source_files: string[]
  feature_flags?: string[]
  wire_type?: string
  default_registered?: boolean
  notes?: string
}

export function writeManifestAndTable(
  args: CliArgs,
  appendix: 'A' | 'B' | 'C' | 'D' | 'E' | 'F',
  manifest: Manifest,
  markdown: string,
): { manifestPath: string; tablePath: string } {
  mkdirSync(args.out, { recursive: true })
  const manifestPath = path.join(args.out, `${appendix}.manifest.json`)
  const tablePath = path.join(args.out, `${appendix}.md`)
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  writeFileSync(tablePath, markdown)
  return { manifestPath, tablePath }
}

export function loadManifest(p: string): Manifest | null {
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8')) as Manifest
}

export function diffSummary(prev: Manifest | null, next: Manifest): string {
  if (!prev) return `+${next.items.length} items (initial)`
  const prevNames = new Set(prev.items.map(i => i.name))
  const nextNames = new Set(next.items.map(i => i.name))
  const added: string[] = []
  const removed: string[] = []
  for (const n of nextNames) if (!prevNames.has(n)) added.push(n)
  for (const n of prevNames) if (!nextNames.has(n)) removed.push(n)
  return `+${added.length} -${removed.length}` +
    (added.length ? ` added=[${added.slice(0, 8).join(',')}${added.length > 8 ? ',…' : ''}]` : '') +
    (removed.length ? ` removed=[${removed.slice(0, 8).join(',')}${removed.length > 8 ? ',…' : ''}]` : '')
}
