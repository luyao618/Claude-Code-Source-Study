#!/usr/bin/env bun
/**
 * §0.1 闸 · check-no-frontmatter-in-chapters.ts
 *
 * 起因（YAO-99 回灌）：C01 修订过程中，writer 把 `chapter_id / source_commit /
 * 风格双亲 / 判定 / 骨架重排 / title` 等 squad 内部记账字段全部塞进了
 * `docs/01-项目全景.md` 的 YAML frontmatter，逼读者从一段 6 行黄色金属牌
 * 开始阅读这本书。前后改了三轮才彻底删干净。
 *
 * 根因：spec §0 早期版本只约束「正文不出现 spec 术语」，没明确禁止 frontmatter
 * 本身。一旦允许了 frontmatter，writer 就会把章节元数据往里塞。
 *
 * 硬约束：`docs/` 下所有面向读者的章节 markdown（即 `docs/*.md`）**不允许**
 * 出现任何 YAML frontmatter。所有 chapter 元数据只活在 PR 描述、issue body、
 * `docs/V2-REVISION-SPEC.md` 内部、或 `scripts/` 外部 manifest 里——这些位置
 * 读者根本不会看到。
 *
 * 例外白名单（必须在文件首列出原因）：
 *   - docs/V2-REVISION-SPEC.md  —— 这是 spec 元文档，不是面向读者的书章节。
 *
 * 检测口径：文件第一行 + 第二行（去除 BOM 后）若出现 `^---\s*$`，直接 fail。
 *   ——这与 markdown 工具链对 YAML frontmatter 的识别口径一致；不试图区分
 *   「真 frontmatter」与「裸 horizontal rule」，因为合法章节几乎不会以一对
 *   闭合的 `---` 行块开篇。
 *
 * 退出码：
 *   - 0 = 全部干净；
 *   - 1 = 至少一个章节文件命中 frontmatter。
 *
 * 用法：
 *   bun scripts/check-no-frontmatter-in-chapters.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DOCS_DIR = "docs";

// 例外白名单：spec 元文档允许 frontmatter；章节正文不允许。
const ALLOWLIST = new Set<string>(["docs/V2-REVISION-SPEC.md"]);

function listChapterFiles(): string[] {
  const out: string[] = [];
  for (const name of readdirSync(DOCS_DIR)) {
    const p = join(DOCS_DIR, name);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (!s.isFile()) continue;
    if (!name.endsWith(".md")) continue;
    if (ALLOWLIST.has(p)) continue;
    out.push(p);
  }
  return out.sort();
}

function hasFrontmatter(file: string): boolean {
  const raw = readFileSync(file, "utf8");
  // strip BOM
  const text = raw.replace(/^\uFEFF/, "");
  const lines = text.split("\n");
  if (lines.length < 2) return false;
  // 第一行必须是 `---`（可有尾空格），且后续某一行也有闭合 `---`——典型 YAML frontmatter。
  if (!/^---\s*$/.test(lines[0])) return false;
  // 找闭合 `---`（合理范围：前 50 行内）
  for (let i = 1; i < Math.min(lines.length, 50); i++) {
    if (/^---\s*$/.test(lines[i])) return true;
  }
  // 首行是 `---` 但没找到闭合 —— 大概率是裸 horizontal rule 开篇，宽容放过。
  return false;
}

const files = listChapterFiles();
if (files.length === 0) {
  console.log("[no-frontmatter] no chapter files in docs/; skip.");
  process.exit(0);
}

let failed = false;
for (const f of files) {
  if (hasFrontmatter(f)) {
    failed = true;
    console.error(`[no-frontmatter] FAIL ${f}: chapter file starts with YAML frontmatter.`);
    console.error(
      `  章节正文不允许 frontmatter（§0.1 硬约束）。chapter 元数据（title / chapter_id / source_commit / 风格双亲 / 判定 / 骨架重排 等）只活在 PR 描述、issue、spec 本身、外部 manifest 里——读者看到的 markdown 文件本身不带任何 YAML 头。`,
    );
  } else {
    console.log(`[no-frontmatter] OK   ${f}`);
  }
}

if (failed) {
  console.error("[no-frontmatter] 至少一个章节文件含 frontmatter，CI 阻塞。删除 frontmatter 后重试。");
  process.exit(1);
}
process.exit(0);
