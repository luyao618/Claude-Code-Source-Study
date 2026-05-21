/**
 * CI lint #2 — `lint-no-fuzzy-quantifiers` (V2-REVISION-SPEC §0.4, §7.4).
 *
 * Forbidden words inside FACT paragraphs:
 *   约 / 大概 / 左右 / 大量 / 不少 / 主要 / 大部分 / 几乎 / 很多 / 一些
 *
 * "Fact paragraph" definition (per §0.4):
 *   - All paragraphs after the chapter's `## 源码锚点` header.
 *   - EXCLUDING any section whose heading is labeled
 *     `导言` / `引言` / `前言` / `总结` / `结语` / `小结` / `比喻`
 *     (these are the §0.4 exception zones — descriptive copy, no facts).
 *
 * Within a fact paragraph, fenced code blocks (```…```) are excluded — the
 * forbidden words can legitimately appear inside source quotations.
 *
 * Exit 1 with a list of `<file>:<line> "<offending-line>"` on any hit.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import * as path from 'node:path'

const repoRoot = process.cwd()
const docsDir = path.join(repoRoot, 'docs')

const FORBIDDEN = ['约', '大概', '左右', '大量', '不少', '主要', '大部分', '几乎', '很多', '一些']

const EXCEPTION_HEADINGS = ['导言', '引言', '前言', '总结', '结语', '小结', '比喻']

interface Hit {
  file: string
  line: number
  text: string
  word: string
}

const hits: Hit[] = []

function walk(dir: string): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(abs)
      continue
    }
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.md')) continue
    // V2-REVISION-SPEC.md itself is a meta-document; skip.
    if (entry.name === 'V2-REVISION-SPEC.md') continue
    // Appendix tables are auto-generated; skip the canned wording.
    if (abs.includes(`${path.sep}appendix${path.sep}`)) continue
    scan(abs)
  }
}

function scan(abs: string): void {
  const text = readFileSync(abs, 'utf8')
  const lines = text.split('\n')

  // Locate `## 源码锚点` — only chapters that opt into §0 公约 are linted.
  const anchorIdx = lines.findIndex(l => /^##\s*源码锚点/.test(l))
  if (anchorIdx === -1) return // chapter has not adopted §0.1 yet — skip

  let inException = false
  let inFence = false
  let exceptionLevel = 0

  for (let i = anchorIdx + 1; i < lines.length; i++) {
    const line = lines[i]

    // Toggle code fence (``` ... ```)
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    // Detect heading transitions. `##` and deeper.
    const h = line.match(/^(#{2,6})\s+(.*?)\s*$/)
    if (h) {
      const level = h[1].length
      const title = h[2]
      const isException = EXCEPTION_HEADINGS.some(k => title.includes(k))
      if (isException) {
        inException = true
        exceptionLevel = level
      } else if (inException && level <= exceptionLevel) {
        // Sibling or higher heading exits the exception zone.
        inException = false
      }
      continue
    }

    if (inException) continue
    if (!line.trim()) continue
    // Skip table separator lines (|---|---|).
    if (/^\s*\|[-:|\s]+\|\s*$/.test(line)) continue

    for (const w of FORBIDDEN) {
      if (line.includes(w)) {
        hits.push({
          file: path.relative(repoRoot, abs),
          line: i + 1,
          text: line.trim(),
          word: w,
        })
      }
    }
  }
}

walk(docsDir)

if (hits.length === 0) {
  process.stderr.write('lint-no-fuzzy-quantifiers OK — no §0.4 violations in fact paragraphs\n')
  process.exit(0)
}

process.stderr.write(
  `lint-no-fuzzy-quantifiers FAIL — ${hits.length} forbidden-word hits (§0.4):\n` +
    hits.slice(0, 50).map(h => `  ${h.file}:${h.line}  「${h.word}」  ${truncate(h.text, 120)}\n`).join('') +
    (hits.length > 50 ? `  …(+${hits.length - 50} more)\n` : '') +
    `\nMove the wording to an 导言/总结/比喻 sub-section or replace with a precise number citing the appendix manifest.\n`,
)
process.exit(1)

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}
