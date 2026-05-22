#!/usr/bin/env bun
/**
 * Lint: no revision codenames in reader-facing prose.
 *
 * 背景：v1 / v2 是内部修订代号（见 docs/V2-REVISION-SPEC.md），不应渗入读者侧成书正文。
 * 本 lint 扫描 docs/**\/*.md 的正文，拦截把 v1 / v2 当作书内身份称呼的写法。
 *
 * 默认禁词正则（大小写不敏感）：
 *   - \bv1\b / \bv2\b                        — 单独出现的 v1/v2 词
 *   - V1 版本 / V2 版本                       — 显式称作"版本"
 *   - v1 章节 / V1 章节 / v2 章节 / V2 章节   — 显式称作"章节"
 *
 * 排除规则（按顺序应用，先排除后判禁）：
 *   1) frontmatter（首尾 --- 之间）整体豁免；
 *   2) HTML 注释 <!-- ... --> 整体豁免（含跨行）；
 *   3) docs/V2-REVISION-SPEC.md 整体豁免（它本身就在讨论 v1/v2 流程）；
 *   4) docs/appendix/*.manifest.json 的 notes 字段不在扫描范围（本脚本只扫 .md）；
 *      docs/appendix/*.md 仍受扫描，命中需进白名单；
 *   5) 代码块 ``` fence 内整体豁免；
 *   6) API 版本号形态（前缀为 /、.、字母数字）：如 `api/v1/...`、`v2.1.8` 不算命中；
 *   7) 白名单 scripts/revision-codename-allowlist.txt：
 *        path:line         精确豁免该行
 *        path:regex:<re>   该文件中匹配该正则的行全部豁免
 *
 * 用法：
 *   bun scripts/lint-no-revision-codenames.ts
 *   bun scripts/lint-no-revision-codenames.ts --files docs/foo.md docs/bar.md
 *
 * 退出码：命中且未豁免则非 0；否则 0。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const ALLOWLIST_PATH = join(REPO_ROOT, "scripts", "revision-codename-allowlist.txt");
const DOCS_DIR = join(REPO_ROOT, "docs");
const SPEC_PATH_REL = "docs/V2-REVISION-SPEC.md";

type Hit = { file: string; line: number; col: number; rule: string; text: string };

type AllowEntry =
  | { kind: "line"; file: string; line: number }
  | { kind: "regex"; file: string; re: RegExp };

const FORBIDDEN: { name: string; re: RegExp }[] = [
  // 单独 v1/v2 词（大小写不敏感）。API 版本号形态在 isSafeContext 中再剔除。
  { name: "bare-v1", re: /\bv1\b/gi },
  { name: "bare-v2", re: /\bv2\b/gi },
  // 中文显式称呼
  { name: "V版本", re: /\bv[12]\s*版本/gi },
  { name: "V章节", re: /\bv[12]\s*章节/gi },
];

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const filesIdx = args.indexOf("--files");
  const explicit = filesIdx >= 0 ? args.slice(filesIdx + 1) : null;
  return { explicit };
}

function loadAllowlist(): AllowEntry[] {
  if (!existsSync(ALLOWLIST_PATH)) return [];
  const out: AllowEntry[] = [];
  const raw = readFileSync(ALLOWLIST_PATH, "utf8");
  let lineNo = 0;
  for (const rawLine of raw.split("\n")) {
    lineNo++;
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    // path:regex:<re>
    const regexMarker = ":regex:";
    const ri = line.indexOf(regexMarker);
    if (ri > 0) {
      const file = line.slice(0, ri).trim();
      const reSrc = line.slice(ri + regexMarker.length).trim();
      try {
        out.push({ kind: "regex", file, re: new RegExp(reSrc) });
      } catch (err) {
        console.error(`[lint-no-revision-codenames] allowlist:${lineNo} bad regex: ${(err as Error).message}`);
        process.exit(2);
      }
      continue;
    }
    // path:line
    const ci = line.lastIndexOf(":");
    if (ci < 0) {
      console.error(`[lint-no-revision-codenames] allowlist:${lineNo} malformed: ${rawLine}`);
      process.exit(2);
    }
    const file = line.slice(0, ci).trim();
    const lineStr = line.slice(ci + 1).trim();
    const n = Number(lineStr);
    if (!Number.isInteger(n) || n <= 0) {
      console.error(`[lint-no-revision-codenames] allowlist:${lineNo} bad line number: ${rawLine}`);
      process.exit(2);
    }
    out.push({ kind: "line", file, line: n });
  }
  return out;
}

function listDocsMarkdown(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".")) continue;
      const p = join(dir, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (s.isFile() && name.endsWith(".md")) out.push(p);
    }
  };
  walk(DOCS_DIR);
  return out.sort();
}

/**
 * 把整篇 markdown 切成「正文 mask」：true 表示该字符位置属于读者侧正文，
 * false 表示位于 frontmatter / HTML 注释 / 代码块 fence 中，应跳过。
 */
function buildBodyMask(src: string): boolean[] {
  const mask = new Array<boolean>(src.length).fill(true);

  // Frontmatter: 文件以 "---\n" 开头时，到下一行单独 "---" 为止。
  if (src.startsWith("---\n")) {
    const end = src.indexOf("\n---\n", 4);
    const endAlt = src.indexOf("\n---", 4);
    const stop = end >= 0 ? end + "\n---\n".length : (endAlt >= 0 ? endAlt + "\n---".length : -1);
    if (stop > 0) for (let i = 0; i < stop; i++) mask[i] = false;
  }

  // HTML 注释 <!-- ... -->
  const commentRe = /<!--[\s\S]*?-->/g;
  for (let m; (m = commentRe.exec(src)); ) {
    for (let i = m.index; i < m.index + m[0].length; i++) mask[i] = false;
  }

  // 代码块 fence ``` ... ```
  const lines = src.split("\n");
  let offset = 0;
  let inFence = false;
  for (const line of lines) {
    const isFence = /^\s*```/.test(line);
    if (isFence) {
      // fence 行本身也算非正文
      for (let i = offset; i < offset + line.length; i++) mask[i] = false;
      inFence = !inFence;
    } else if (inFence) {
      for (let i = offset; i < offset + line.length; i++) mask[i] = false;
    }
    offset += line.length + 1; // +1 for \n
  }

  return mask;
}

/**
 * 命中位置的字符前缀是否构成"API 版本号形态"，应豁免。
 * 例：`api/v1/...`、`v2.1.8`、`Bun v1.2.3`（前缀字母 + 数字混排）。
 *
 * 规则：
 *   - 前一个字符是 `/`、`.` → 豁免（路径段 / semver 续段）。
 *   - 后一个字符是 `.` 紧跟数字 → 豁免（semver 如 v2.1）。
 *   - 后一个字符是字母数字 → 不应进到这里（\b 已守住）。
 */
function isApiVersionContext(text: string, matchIndex: number, matchLen: number): boolean {
  const prev = matchIndex > 0 ? text[matchIndex - 1] : "";
  if (prev === "/" || prev === ".") return true;
  const after = text.slice(matchIndex + matchLen);
  if (/^\.\d/.test(after)) return true;
  return false;
}

function lineColAt(text: string, index: number): { line: number; col: number } {
  const before = text.slice(0, index);
  const nl = before.split("\n");
  return { line: nl.length, col: nl[nl.length - 1].length + 1 };
}

function isAllowed(relPath: string, lineNo: number, lineText: string, allow: AllowEntry[]): boolean {
  for (const a of allow) {
    if (a.file !== relPath) continue;
    if (a.kind === "line" && a.line === lineNo) return true;
    if (a.kind === "regex" && a.re.test(lineText)) return true;
  }
  return false;
}

function scanFile(absPath: string, allow: AllowEntry[]): Hit[] {
  const relPath = relative(REPO_ROOT, absPath);
  if (relPath === SPEC_PATH_REL) return [];
  const src = readFileSync(absPath, "utf8");
  const mask = buildBodyMask(src);
  const lines = src.split("\n");
  const hits: Hit[] = [];

  for (const { name, re } of FORBIDDEN) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(src)); ) {
      const idx = m.index;
      const len = m[0].length;
      // 检查 mask（所有匹配字符都应在正文中）
      let inBody = true;
      for (let i = idx; i < idx + len; i++) {
        if (!mask[i]) { inBody = false; break; }
      }
      if (!inBody) continue;
      if (isApiVersionContext(src, idx, len)) continue;
      const { line, col } = lineColAt(src, idx);
      const lineText = lines[line - 1] ?? "";
      if (isAllowed(relPath, line, lineText, allow)) continue;
      hits.push({ file: relPath, line, col, rule: name, text: lineText.trim() });
    }
  }

  // 去重：同一 (file,line,col,rule) 只报一次
  const seen = new Set<string>();
  const dedup: Hit[] = [];
  for (const h of hits) {
    const k = `${h.file}:${h.line}:${h.col}:${h.rule}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(h);
  }
  return dedup;
}

function main() {
  const { explicit } = parseArgs(process.argv);
  const allow = loadAllowlist();

  let files: string[];
  if (explicit && explicit.length > 0) {
    files = explicit
      .map((f) => (f.startsWith("/") ? f : join(REPO_ROOT, f)))
      .filter((p) => existsSync(p) && p.endsWith(".md"));
  } else {
    files = listDocsMarkdown();
  }

  let total = 0;
  for (const f of files) {
    const hits = scanFile(f, allow);
    if (hits.length === 0) continue;
    total += hits.length;
    for (const h of hits) {
      console.error(`[no-revision-codenames] FAIL ${h.file}:${h.line}:${h.col} 命中「${h.rule}」: ${h.text}`);
    }
  }

  if (total === 0) {
    console.log(`[no-revision-codenames] OK   ${files.length} 个 md 文件，无 v1/v2 修订代号泄漏`);
    process.exit(0);
  }
  console.error(`[no-revision-codenames] ${total} 处命中。如确属合理引用，请加入 scripts/revision-codename-allowlist.txt`);
  process.exit(1);
}

main();
