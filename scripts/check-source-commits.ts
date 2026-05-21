#!/usr/bin/env bun
/**
 * §0.3 闸 · check-source-commits.ts
 *
 * 扫章节头 frontmatter 的 `source_commit` 与 `docs/appendix/*.manifest.json`
 * 的 `source_commit`，必须全部一致；不一致 → fail。
 *
 * 用法：
 *   bun scripts/check-source-commits.ts
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function readFrontmatterField(text: string, key: string): string | undefined {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return undefined;
  const fmRe = new RegExp(`^${key}:\\s*(\\S+)`, "m");
  const f = m[1].match(fmRe);
  return f?.[1];
}

const docsDir = "docs";
const appendixDir = "docs/appendix";

const chapterFiles = existsSync(docsDir)
  ? readdirSync(docsDir)
      .filter((f) => /^\d{2}-.+\.md$/.test(f))
      .map((f) => join(docsDir, f))
  : [];

const manifestFiles = existsSync(appendixDir)
  ? readdirSync(appendixDir)
      .filter((f) => f.endsWith(".manifest.json"))
      .map((f) => join(appendixDir, f))
  : [];

if (chapterFiles.length === 0 && manifestFiles.length === 0) {
  console.log("[check-source-commits] no chapters/appendix manifests found; skip.");
  process.exit(0);
}

type Entry = { file: string; commit: string };
const seen: Entry[] = [];

for (const f of chapterFiles) {
  const text = readFileSync(f, "utf8");
  const sc = readFrontmatterField(text, "source_commit");
  if (sc) seen.push({ file: f, commit: sc });
}

for (const f of manifestFiles) {
  try {
    const j = JSON.parse(readFileSync(f, "utf8")) as { source_commit?: string };
    if (j.source_commit) seen.push({ file: f, commit: j.source_commit });
  } catch {
    console.error(`[check-source-commits] FAIL ${f}: 不是合法 JSON`);
    process.exit(1);
  }
}

if (seen.length === 0) {
  console.log(
    "[check-source-commits] no source_commit fields declared yet; skip.",
  );
  process.exit(0);
}

const groups = new Map<string, string[]>();
for (const e of seen) {
  if (!groups.has(e.commit)) groups.set(e.commit, []);
  groups.get(e.commit)!.push(e.file);
}

if (groups.size > 1) {
  console.error(
    `[check-source-commits] FAIL: 发现 ${groups.size} 个不同的 source_commit：`,
  );
  for (const [commit, files] of groups) {
    console.error(`  ${commit}:`);
    for (const file of files) console.error(`    - ${file}`);
  }
  console.error(
    `  按 V2-REVISION-SPEC.md §0.3，章节头与附录 manifest 的 source_commit 必须一致。`,
  );
  process.exit(1);
}

const [commit] = [...groups.keys()];
console.log(
  `[check-source-commits] OK ${seen.length} 个文件全部指向 ${commit}`,
);
