/**
 * CI lint #1 — `check-source-commits` (V2-REVISION-SPEC §0.3, §7.4).
 *
 * Walks every chapter file under `docs/` and every appendix manifest under
 * `docs/appendix/`. Pulls the declared `source_commit` from each:
 *   - chapter `*.md` → YAML frontmatter `source_commit:` field
 *     (or §0.1 「源码锚点」block: `源码版本：<sha>` / `source_commit: <sha>`)
 *   - manifest `.json` → `source_commit` JSON field
 *
 * Fail when the declared commits diverge across files. Spec wording:
 * 「正文与 manifest 引用必须指向同一 commit」.
 *
 * Exit code 1 on mismatch; informative table on stderr.
 *
 * Allowed exception: chapter files that have not yet been authored may omit
 * the field; we simply skip them. Once a chapter declares any commit it
 * must match the rest.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import * as path from 'node:path'

const repoRoot = process.cwd()
const docsDir = path.join(repoRoot, 'docs')
const appendixDir = path.join(docsDir, 'appendix')

interface Decl {
  file: string
  commit: string
}

const decls: Decl[] = []

function walkDocs(dir: string): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'appendix') continue // handled separately
      walkDocs(abs)
      continue
    }
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.md')) continue
    const text = readFileSync(abs, 'utf8')
    // YAML frontmatter
    const fm = text.match(/^---\n([\s\S]*?)\n---/)
    if (fm) {
      const sm = fm[1].match(/^source_commit:\s*([0-9a-f]{7,40})/m)
      if (sm) {
        decls.push({ file: path.relative(repoRoot, abs), commit: sm[1] })
        continue
      }
    }
    // §0.1 「源码版本：<sha>」 / 「source_commit: <sha>」 inline
    const inline =
      text.match(/源码版本[：:]\s*`?([0-9a-f]{7,40})/) ||
      text.match(/source_commit[：:]\s*`?([0-9a-f]{7,40})/)
    if (inline) {
      decls.push({ file: path.relative(repoRoot, abs), commit: inline[1] })
    }
  }
}

walkDocs(docsDir)

if (existsSync(appendixDir)) {
  for (const entry of readdirSync(appendixDir)) {
    if (!entry.endsWith('.manifest.json')) continue
    const abs = path.join(appendixDir, entry)
    const json = JSON.parse(readFileSync(abs, 'utf8')) as { source_commit?: string }
    if (json.source_commit) {
      decls.push({ file: path.relative(repoRoot, abs), commit: json.source_commit })
    }
  }
}

if (decls.length === 0) {
  process.stderr.write('check-source-commits: no source_commit declarations found (skipping)\n')
  process.exit(0)
}

// Group by canonical commit (take min length as canonical for short-vs-full
// SHA matches: full prefix-equality wins).
const groups = new Map<string, string[]>()
for (const d of decls) {
  groups.set(d.commit, [...(groups.get(d.commit) ?? []), d.file])
}

// Two distinct full commits → fail. But short-prefix of long is allowed.
const longest = [...groups.keys()].sort((a, b) => b.length - a.length)[0]
let bad: string[] = []
for (const [commit, files] of groups) {
  if (!longest.startsWith(commit) && !commit.startsWith(longest)) {
    bad.push(`commit ${commit} (${files.length} files): ${files.slice(0, 4).join(', ')}${files.length > 4 ? `, +${files.length - 4}` : ''}`)
  }
}

if (bad.length > 0) {
  process.stderr.write(
    `check-source-commits FAIL — multiple incompatible source_commit values:\n` +
      `  canonical: ${longest}\n` +
      bad.map(b => `  divergent: ${b}\n`).join('') +
      `Spec §0.3 forbids per-file commit drift; open one PR to bump every chapter + manifest together.\n`,
  )
  process.exit(1)
}

process.stderr.write(
  `check-source-commits OK — ${decls.length} declarations all align with ${longest}\n`,
)
