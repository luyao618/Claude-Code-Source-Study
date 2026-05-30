# English Translation Standards — `docs-en/`

This directory holds the English edition of *Deep Dive into Claude Code Source*. The Chinese original lives in [`../docs/`](../docs/) and remains the source of truth. This README defines the rules every chapter translation MUST follow, so that parallel translators produce a consistent book rather than 34 disjointed essays.

If you are picking up a translation issue, **read this file first**. It is the contract.

---

## 1. Directory layout

```
docs-en/
├── README.md                        # this file
├── 00-table-of-contents.md          # mirrors docs/00-目录与阅读指引.md
├── 01-project-overview-and-four-entrypoints.md
├── 02-startup-pipeline-and-cold-start.md
├── ...                              # one file per Chinese chapter, same number
├── 34-architecture-patterns-summary.md
└── appendix/
    ├── A.md … F.md                  # mirror docs/appendix/*.md
    └── A.manifest.json … F.manifest.json   # copied verbatim, not translated
```

Rules:

- **One-to-one file mapping.** Every file in `docs/` (except `docs/archive/`) gets exactly one counterpart in `docs-en/` with the same numeric prefix. No splitting, no merging.
- **`docs/archive/` is NOT translated.** It is historical material and out of scope.
- **`appendix/*.manifest.json` is copied verbatim — no translation, including description fields.** These are machine-readable indexes consumed by tooling; keeping them byte-identical avoids drift between the Chinese and English trees and lets the build cross-reference either edition.
- **Asset paths stay relative to the file.** Images, diagrams, and code snippets referenced by the Chinese chapter must resolve from the English chapter too — copy or symlink assets into a sibling location if the original used a relative path that no longer resolves.

## 2. File naming rule

Format: `<two-digit-number>-<kebab-case-english-slug>.md`

- Keep the **same two-digit prefix** as the Chinese file. This preserves ordering and makes cross-references trivial.
- The slug is **lowercase kebab-case**, ASCII only, no trailing punctuation.
- Keep slugs **short but recognizable** — target 3–7 words, never exceed 80 characters total filename length.
- Preserve well-known identifiers as-is inside the slug (e.g. `mcp`, `lsp`, `ipc`, `cli`, `sdk`, `bash`, `vim`). Do not "translate" acronyms.
- When the Chinese title mixes a product/code name with prose, keep the code name in its canonical casing inside the slug, but lowercase it (e.g. `QueryEngine` → `queryengine` in the slug, `QueryEngine` in the body).

### Canonical filename map

| # | Chinese file | English file |
|---|---|---|
| 00 | `00-目录与阅读指引.md` | `00-table-of-contents.md` |
| 01 | `01-项目全景与四种入口形态.md` | `01-project-overview-and-four-entrypoints.md` |
| 02 | `02-启动链路与冷启动优化.md` | `02-startup-pipeline-and-cold-start.md` |
| 03 | `03-配置体系与企业MDM.md` | `03-configuration-system-and-enterprise-mdm.md` |
| 04 | `04-配置迁移即代码.md` | `04-configuration-migration-as-code.md` |
| 05 | `05-QueryEngine与对话主循环.md` | `05-queryengine-and-conversation-main-loop.md` |
| 06 | `06-SystemPrompt与OutputStyle注入.md` | `06-system-prompt-and-output-style-injection.md` |
| 07 | `07-上下文压缩家族.md` | `07-context-compaction-family.md` |
| 08 | `08-PromptCache横切.md` | `08-prompt-cache-cross-cutting.md` |
| 09 | `09-Thinking-Effort-与-Advisor.md` | `09-thinking-effort-and-advisor.md` |
| 10 | `10-工具协议-注册与-ToolSearch.md` | `10-tool-protocol-registration-and-toolsearch.md` |
| 11 | `11-BashTool-PowerShellTool-双shell.md` | `11-bashtool-powershelltool-dual-shell.md` |
| 12 | `12-文件-代码-与-LSP-协作族.md` | `12-file-code-and-lsp-collaboration-family.md` |
| 13 | `13-通信调度问询与合成工具.md` | `13-communication-scheduling-questioning-and-synthetic-tools.md` |
| 14 | `14-Agent系统与SubAgent调用.md` | `14-agent-system-and-subagent-invocation.md` |
| 15 | `15-内置Agent设计模式.md` | `15-built-in-agent-design-patterns.md` |
| 16 | `16-任务模型与TaskType谱系.md` | `16-task-model-and-tasktype-lineage.md` |
| 17 | `17-Coordinator-Cron-与定时调度.md` | `17-coordinator-cron-and-scheduled-execution.md` |
| 18 | `18-MCP协议实现.md` | `18-mcp-protocol-implementation.md` |
| 19 | `19-权限系统与远程权限回灌.md` | `19-permission-system-and-remote-permission-back-propagation.md` |
| 20 | `20-Hooks系统.md` | `20-hooks-system.md` |
| 21 | `21-Skill-Plugin-OutputStyle三扩展点.md` | `21-skill-plugin-outputstyle-three-extension-points.md` |
| 22 | `22-FeatureFlag与编译期优化.md` | `22-feature-flag-and-compile-time-optimization.md` |
| 23 | `23-客户端传输与API重试.md` | `23-client-transport-and-api-retry.md` |
| 24 | `24-Bridge-IPC-与远程会话.md` | `24-bridge-ipc-and-remote-sessions.md` |
| 25 | `25-DirectConnect-与上游代理.md` | `25-directconnect-and-upstream-proxy.md` |
| 26 | `26-Ink框架深度定制.md` | `26-ink-framework-deep-customization.md` |
| 27 | `27-组件与设计系统.md` | `27-components-and-design-system.md` |
| 28 | `28-Keybindings-Vim与Voice输入.md` | `28-keybindings-vim-and-voice-input.md` |
| 29 | `29-Buddy宠物.md` | `29-buddy-pet.md` |
| 30 | `30-Doctor屏与OutputStyle体验.md` | `30-doctor-screen-and-output-style-experience.md` |
| 31 | `31-Memory子系统全景.md` | `31-memory-subsystem-overview.md` |
| 32 | `32-命令系统全景.md` | `32-command-system-overview.md` |
| 33 | `33-状态管理与跨进程桥.md` | `33-state-management-and-cross-process-bridge.md` |
| 34 | `34-架构模式总结.md` | `34-architecture-patterns-summary.md` |
| A–F | `appendix/A.md`–`F.md` | `appendix/A.md`–`F.md` (same letter) |

If a translator believes a name in this table is wrong, raise a comment on the parent translation issue **before** renaming. Renames cascade into every cross-reference and break review history.

## 3. Terminology glossary

The left column is the Chinese term as it appears in the original. The right column is the **only acceptable English rendering** for this book. When the term appears for the first time in a chapter, write it as `English term (中文原词)`; after that, use the English term alone.

### Core book vocabulary

| Chinese | English | Notes |
|---|---|---|
| 源码学习 | source-code study | Title of the book genre. Do not use "source reading". |
| 对话主循环 | conversation main loop | Refers to `query()` / `QueryEngine`. Capitalize only at sentence start. |
| 上下文压缩 | context compaction | Not "compression". Compaction is the term used in the code (`autoCompact`, `microCompact`). |
| 横切 | cross-cutting | As in `Prompt Cache cross-cutting`. Hyphenate. |
| 权限回灌 | permission back-propagation | Specifically the `bridgePermissionCallbacks` flow. |
| 合成工具 | synthetic tool | Tools that are composed from other tools (e.g. WebSearch). |
| 内置 Agent | built-in agent | Lowercase "agent" unless starting a sentence or part of a proper name. |
| 任务模型 | task model | The `TaskType` abstraction. |
| 定时调度 | scheduled execution | Use this for `cron` / `Coordinator` scheduling. "Cron scheduling" is acceptable when explicitly discussing cron. |
| 跨进程桥 | cross-process bridge | The Bridge IPC layer. |
| 启动链路 | startup pipeline | Not "boot chain". |
| 冷启动优化 | cold-start optimization | Hyphenate `cold-start` when used as an adjective. |
| 入口形态 | entrypoint form | "Four entrypoint forms" = CLI / SDK / MCP server / Sandbox runner. |
| 编排 | orchestration | Multi-agent orchestration. |
| 子模块 | submodule | Lowercase. |
| 门面 | facade | As in "the QueryEngine facade". |
| 内核 | kernel | As in "the `query` kernel". |
| 注册 | registration | Tool registration. |
| 谱系 | lineage | TaskType lineage. |
| 回合 | turn | "One turn of the conversation". |
| 链路 | pipeline / flow | Prefer "pipeline" for staged execution, "flow" for control flow. |
| 全景 | overview | Not "panorama". |
| 总结 | summary | |
| 修订说明 | changelog | |

### Domain / Claude Code terms (keep as-is)

These are never translated. Use the exact spelling and casing below.

`Claude Code`, `Anthropic`, `System Prompt`, `Output Style`, `Skill`, `Plugin`, `Hook`, `Tool`, `SubAgent`, `Agent`, `Coordinator`, `Cron`, `MCP`, `LSP`, `IPC`, `SSE`, `WebSocket`, `Bridge`, `DirectConnect`, `GrowthBook`, `feature flag`, `Bun`, `bundler`, `DCE` (Dead Code Elimination), `Ink`, `Yoga`, `ANSI`, `Vim`, `REPL`, `MDM`, `policyLimits`, `settingsSync`, `remoteManaged`.

Code identifiers — function names, file paths, type names, env vars — are **always** kept verbatim in backticks: `QueryEngine`, `autoCompact`, `microCompact`, `apiMicrocompact`, `sessionMemoryCompact`, `bridgePermissionCallbacks`, `channelAllowlist`, `SdkControlTransport`, `HybridTransport`, `withRetry`, `ThinkingConfig`, `Effort`, `ultrathink`, `Advisor`, `AgentDefinition`, `runAgent`, `AgentSummary`, `TaskType`, `HOOK_EVENTS`, `stopHooks`, `notifs`, `replBridge`, `remoteControl`, `feature()`, `CacheSafeParams`, `Dynamic Boundary`.

### Recurring phrases

| Chinese | English |
|---|---|
| 本章 | this chapter |
| 后文 | later in this chapter / later chapters (disambiguate) |
| 见 X 章 | see chapter X |
| 代码引用格式：`文件路径:行号范围` | code references use the format `file/path:line-range` |
| 一句话上下文 | one-sentence primer |
| 主线 | main thread (of the narrative); do not use for git branches |
| 进阶话题 | advanced topic |
| 目标读者 | target audience |
| 阅读约定 | reading conventions |

### Extending the glossary

If you hit a high-frequency term not listed here, **add it in the same PR** as the chapter that first needed it. Do not invent a one-off translation in the body and move on — the next translator will pick a different one and the book will drift.

Order of operations:
1. Search this README for the term first.
2. If absent, propose the English form in your PR description.
3. Add the row to the table above in the same PR.
4. Reviewer approves the addition before the chapter merges.

## 4. Mermaid diagram and table localization

Mermaid blocks and Markdown tables contain a mix of natural-language labels and source-code identifiers. The rule is:

**Translate prose labels. Preserve code identifiers verbatim.**

### What you MUST translate

- Node labels that are descriptive English/Chinese prose (e.g. `用户输入` → `user input`).
- Edge labels describing relationships (`触发` → `triggers`).
- Diagram titles and subgraph names that are prose.
- Table header cells that are prose (`核心主题` → `core topic`).
- Table body cells that are prose descriptions.
- Image alt text and figure captions.

### What you MUST preserve verbatim

- Function names, type names, file paths, env vars, CLI flags, npm package names.
- Anything inside backticks.
- Strings that match a `[A-Za-z][A-Za-z0-9_]*` identifier and appear in code context (e.g. a node labeled `QueryEngine`).
- Filenames and directory names (e.g. `services/mcp/`, `01-...md`).
- Numbers, version strings, hash prefixes.
- Lines inside ` ```ts ` / ` ```bash ` / ` ```json ` code fences — **never translate code**, including comments inside code blocks unless the comment is plain prose explaining behavior to the reader (in which case translate just the comment text, keep code).
- URLs and link targets. Anchor text may be translated; the URL stays.

### Mixed nodes

A node like `QueryEngine 主循环` becomes `QueryEngine main loop` — keep the identifier, translate the prose around it.

### Tables that link to chapter files

When a table cell links to another chapter, **update the link target** to the English filename from the canonical map in §2, and translate the anchor text. Example:

```markdown
[项目全景与四种入口形态](./01-项目全景与四种入口形态.md)
→
[Project overview and four entrypoint forms](./01-project-overview-and-four-entrypoints.md)
```

If the target chapter has not been translated yet, still link to the future English filename — do not link back to the Chinese file. A reviewer will flag broken links, but a stale Chinese link is worse because it silently bilingualizes the book.

## 5. Per-chapter acceptance criteria

A chapter translation PR is "done" when ALL of the following hold:

1. **File exists at the canonical path** from §2, with the same number of top-level sections as the Chinese source.
2. **No untranslated Chinese characters** remain outside of:
   - Code blocks where the original code contains Chinese strings.
   - Quoted source comments where the original was Chinese (in which case add an English gloss in parentheses).
   - The first-occurrence parenthetical for glossary terms (`English term (中文原词)`).
3. **Glossary compliance**: every term in §3 that appears uses the prescribed English rendering. Code identifiers are unchanged.
4. **Cross-reference compliance**: every link to another chapter points at the English filename from §2.
5. **Diagram & table compliance**: rules from §4 applied; no source-code identifiers translated, no prose left in Chinese.
6. **Code references intact**: `file/path:line-range` citations match the source unchanged. If the chapter cites line numbers, the reviewer assumes the translator verified the line numbers still resolve in the current `package.json` version.
7. **No new content**: translation must not add explanations, examples, or sections that are not in the Chinese source. If the original is ambiguous or wrong, file a follow-up issue against `docs/`; do not patch only the English edition.
8. **No content dropped**: every Chinese paragraph has an English counterpart. Reordering for English readability is allowed within a section, but no section may be silently elided.
9. **New glossary terms registered**: any term added under §3 in the same PR as the chapter that needed it.
10. **Chapter front matter preserved**: title (`#`), epigraph blockquote, target-audience callouts, and `>` admonitions all carry over with the same Markdown shape.

## 6. Reviewer checklist

Reviewers can mechanically work through this list. A "fail" on any item is a blocking change request.

### Structure
- [ ] Filename matches the canonical map in §2.
- [ ] Section headings (`#`, `##`, `###`) appear in the same order and at the same depth as the Chinese source.
- [ ] Code blocks, blockquotes, tables, and Mermaid diagrams appear at the same positions.
- [ ] No Chinese chapter content is missing; no English content is invented.

### Terminology
- [ ] Every entry from §3 that appears in the chapter uses the prescribed rendering.
- [ ] Domain terms (Claude Code, MCP, LSP, etc.) are spelled and cased exactly as listed.
- [ ] Code identifiers are unchanged and remain inside backticks.
- [ ] First-occurrence glossary terms include the `(中文原词)` parenthetical.
- [ ] Any new high-frequency term has been added to §3 in this PR.

### Cross-references
- [ ] Every `./NN-*.md` link points at the English filename from §2.
- [ ] No link points back into `docs/` (the Chinese tree) except deliberate "see Chinese edition" pointers (rare).
- [ ] `file/path:line-range` citations match the original; line numbers were not silently dropped.

### Diagrams & tables
- [ ] Prose labels translated; code identifiers preserved.
- [ ] Diagram structure (nodes, edges, subgraphs) unchanged.
- [ ] Table shape (column count, header semantics) unchanged.
- [ ] Code fences untouched except for prose-only comments.

### Language quality
- [ ] Reads as native technical English, not literal word-for-word transliteration.
- [ ] Sentence-level rephrasing for clarity is fine; paragraph-level rewrites that change emphasis are not.
- [ ] Voice is consistent with the rest of `docs-en/` (instructional, second-person where the Chinese uses 「你」, neutral otherwise).
- [ ] No untranslated Chinese characters outside the allowed exceptions in §5.2.

### Acceptance
- [ ] All 10 acceptance criteria in §5 satisfied.
- [ ] No new chapters, appendices, or sections introduced.
- [ ] No `docs/archive/` content translated.

If every box is checked, the reviewer approves. If any box fails, the reviewer leaves a comment naming the specific item (e.g. "§6 Terminology #3: `QueryEngine` was rendered as `query-engine` in §5.2") so the fix is mechanical.

## 7. Workflow for a single chapter

1. Pick up the chapter's translation issue and move it to `In Progress`.
2. Re-read this README. The standards may have evolved since you last translated.
3. Translate, following §1–§5.
4. Self-check against §6 before requesting review.
5. Open the PR. In the PR body, list:
   - Source file path
   - Target file path
   - Any new glossary terms added to this README in the same PR
   - Anything you were unsure about (point reviewer at it)
6. On approval, merge and mark the issue `Done`. Do not bundle multiple chapters in one PR — one chapter per PR keeps review tractable.

## 8. Out of scope (for this standards issue)

- Translating any chapter body. That is the scope of the per-chapter translation issues.
- Translating `docs/archive/`.
- Restructuring chapter order or merging chapters.
- Changing the Chinese original. Errors in the source go to a separate `docs/` issue.

---

Questions about these standards should be raised as a comment on issue YAO-158 before merging anything that bends a rule. The whole point of this document is to keep parallel translators from drifting; ad-hoc local decisions defeat that.
