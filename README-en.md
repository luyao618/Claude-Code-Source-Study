# Deep Dive into Claude Code Source

> **Learn full-stack AI agent engineering by reading the source of Anthropic's AI coding assistant.**

Claude Code is Anthropic's AI command-line coding assistant — and one of the strongest AI coding products shipping today. Its source code is a tour through the whole stack you need to build a real agent: system-prompt engineering, multi-agent orchestration, a tool system, permission and safety layers, Bridge IPC, remote sessions, enterprise proxying, and a terminal UI.

**This is a 34-chapter, file-by-file walkthrough of every core module.**

It is not an architecture overview waving at the system from a thousand feet up. Every chapter is grounded in specific files and functions, cites exact line ranges, embeds the code that matters, and ends with design patterns you can lift into your own project. The book is organized around the **runtime lifecycle**: before you enter the program → the kernel of one turn → the tool family → agents, tasks, and orchestration → protocols, safety, and extension points → networking and remote work → the terminal UI and multimodal input → memory, extensions, and wrap-up.

## Why read it?

- 🔍 **A real product, not a demo** — learn from a production-grade AI product instead of a toy
- 🏗️ **Full-stack coverage** — compile-time optimization, runtime state management, Prompt Cache, Bridge IPC, terminal rendering
- 🎯 **Built for practice** — the chapter order mirrors the path a session takes from launch to output, and every chapter distills patterns you can reuse directly

## Table of contents

> 📂 All chapters live under [`docs-en/`](./docs-en/). For the full table of contents and a reading guide, see [00 · Table of contents](./docs-en/00-table-of-contents.md).
>
> 📝 Curious why this is v2 and what changed since v1? See the [V2 changelog](./V2-CHANGELOG.md).

### Part I · Before you enter the program

| # | Chapter | What you'll learn |
|---|---------|-------------------|
| 01 | [Project overview and four entrypoint forms](./docs-en/01-project-overview-and-four-entrypoints.md) | One codebase = CLI + SDK + MCP server + Sandbox runner |
| 02 | [Startup pipeline and cold-start optimization](./docs-en/02-startup-pipeline-and-cold-start.md) | Millisecond CLI startup: side-effect hoisting, DCE, bundled vs dev |
| 03 | [Configuration system and enterprise MDM](./docs-en/03-configuration-system-and-enterprise-mdm.md) | 7-dimension config merge, `remoteManaged`, `settingsSync`, `policyLimits` |
| 04 | [Configuration migration as code](./docs-en/04-configuration-migration-as-code.md) | `migrations/` (11 files), model renames, the full `replBridge` → `remoteControl` history |

### Part II · The kernel of one turn

| # | Chapter | What you'll learn |
|---|---------|-------------------|
| 05 | [QueryEngine and the conversation main loop](./docs-en/05-queryengine-and-conversation-main-loop.md) | The `QueryEngine` facade + the `query` kernel + 4 submodules |
| 06 | [System Prompt and Output Style injection](./docs-en/06-system-prompt-and-output-style-injection.md) | Segmented construction, cache boundaries, Output Style injection |
| 07 | [The context compaction family](./docs-en/07-context-compaction-family.md) | `autoCompact` / `microCompact` / `sessionMemoryCompact` — six compaction paths |
| 08 | [Prompt Cache as a cross-cutting concern](./docs-en/08-prompt-cache-cross-cutting.md) | `CacheSafeParams`, Dynamic Boundary, cross-module cache hygiene |
| 09 | [Thinking, Effort, and Advisor](./docs-en/09-thinking-effort-and-advisor.md) | `ThinkingConfig`, Effort levels, `ultrathink`, the Advisor pattern |

### Part III · The tool family

| # | Chapter | What you'll learn |
|---|---------|-------------------|
| 10 | [Tool protocol, registration, and ToolSearch](./docs-en/10-tool-protocol-registration-and-toolsearch.md) | The Tool interface, the `buildTool()` builder, the family / runtime-leaf / feature-gated three-column model |
| 11 | [BashTool / PowerShellTool — the dual shell](./docs-en/11-bashtool-powershelltool-dual-shell.md) | Four layers of safety, sandboxed execution, Windows path parity |
| 12 | [File, code, and LSP collaboration family](./docs-en/12-file-code-and-lsp-collaboration-family.md) | `FileRead`/`Write`/`Edit`, `NotebookEdit`, `Glob`, `Grep`, `LSPTool`, `REPLTool` |
| 13 | [Communication, scheduling, questioning, and synthetic tools](./docs-en/13-communication-scheduling-questioning-and-synthetic-tools.md) | `WebFetch` / `ScheduleCron` / `SendMessage` / `AskUserQuestion` and seven more |

### Part IV · Agents, tasks, and orchestration

| # | Chapter | What you'll learn |
|---|---------|-------------------|
| 14 | [Agent system and SubAgent invocation](./docs-en/14-agent-system-and-subagent-invocation.md) | `AgentDefinition`, `runAgent`, `AgentSummary`, context isolation |
| 15 | [Built-in agent design patterns](./docs-en/15-built-in-agent-design-patterns.md) | Six built-in agents: prompt design, source definition vs runtime availability |
| 16 | [Task model and the TaskType lineage](./docs-en/16-task-model-and-tasktype-lineage.md) | 7 wire `TaskType`s = 4 default + 2 feature-gated + 1 special case |
| 17 | [Coordinator, Cron, and scheduled execution](./docs-en/17-coordinator-cron-and-scheduled-execution.md) | The multi-agent orchestration layer + scheduled triggers |

### Part V · Protocols, safety, and extension points

| # | Chapter | What you'll learn |
|---|---------|-------------------|
| 18 | [MCP protocol implementation](./docs-en/18-mcp-protocol-implementation.md) | `services/mcp/` (23 files), `SdkControlTransport`, `channelAllowlist` |
| 19 | [Permission system and remote permission back-propagation](./docs-en/19-permission-system-and-remote-permission-back-propagation.md) | Rule chains, AI classifier, `bridgePermissionCallbacks` |
| 20 | [Hooks system](./docs-en/20-hooks-system.md) | 27 `HOOK_EVENTS`, four hook-command types, `stopHooks`, `notifs` |
| 21 | [Skill / Plugin / Output Style — three extension points](./docs-en/21-skill-plugin-outputstyle-three-extension-points.md) | Custom agents and Skills, Plugin architecture, Output Style as an extension surface |
| 22 | [Feature flags and compile-time optimization](./docs-en/22-feature-flag-and-compile-time-optimization.md) | `feature()` DCE, GrowthBook, one codebase shipping two products |

### Part VI · Networking and remote collaboration

| # | Chapter | What you'll learn |
|---|---------|-------------------|
| 23 | [Client transport and API retry](./docs-en/23-client-transport-and-api-retry.md) | `withRetry`, overload handling, `HybridTransport` / SSE / WebSocket |
| 24 | [Bridge IPC and remote sessions](./docs-en/24-bridge-ipc-and-remote-sessions.md) | The full path from phone / web / desktop down to the local CLI |
| 25 | [DirectConnect and the upstream proxy](./docs-en/25-directconnect-and-upstream-proxy.md) | `server/`, `upstreamproxy/`, enterprise proxy topology |

### Part VII · Terminal UI and multimodal input

| # | Chapter | What you'll learn |
|---|---------|-------------------|
| 26 | [Deep customization of the Ink framework](./docs-en/26-ink-framework-deep-customization.md) | A custom React reconciler, Yoga layout, native-ts acceleration |
| 27 | [Components and design system](./docs-en/27-components-and-design-system.md) | `ThemedText`, theme system, the tool UI protocol |
| 28 | [Keybindings, Vim mode, and Voice input](./docs-en/28-keybindings-vim-and-voice-input.md) | Three ways to interpret "what does this keystroke mean?" |
| 29 | [The Buddy pet](./docs-en/29-buddy-pet.md) | Keep a procedurally generated critter next to your PromptInput |
| 30 | [The Doctor screen and the Output Style experience](./docs-en/30-doctor-screen-and-output-style-experience.md) | A self-check dashboard + the costume-changer system |

### Part VIII · Memory, extensions, and wrap-up

| # | Chapter | What you'll learn |
|---|---------|-------------------|
| 31 | [Memory subsystem overview](./docs-en/31-memory-subsystem-overview.md) | Four scopes: session / project / team / long-term |
| 32 | [Command system overview](./docs-en/32-command-system-overview.md) | 101 top-level entries: built-in / Skill / Plugin / Workflow |
| 33 | [State management and the cross-process bridge](./docs-en/33-state-management-and-cross-process-bridge.md) | A 35-line minimalist Store, `AppState`, `bridgePointer` across processes |
| 34 | [Architecture patterns summary](./docs-en/34-architecture-patterns-summary.md) | A pattern catalog you can lift into your own project |

### Appendix

| # | Contents |
|---|----------|
| [Appendix A](./docs-en/appendix/A.md) | Tool quick reference (family / runtime leaf / feature-gated, three columns) |
| [Appendix B](./docs-en/appendix/B.md) | Commands quick reference (top-level directories / top-level files / runtime commands) |
| [Appendix C](./docs-en/appendix/C.md) | Hook events table (27 `HOOK_EVENTS` + 4 hook-command types) |
| [Appendix D](./docs-en/appendix/D.md) | Built-in agents quick reference (source definition vs runtime availability) |
| [Appendix E](./docs-en/appendix/E.md) | `TaskType` lineage (7 wire / 4 default / 2 feature-gated / 1 special case) |
| [Appendix F](./docs-en/appendix/F.md) | Module × chapter cross-reference matrix + orphaned directories |

## Suggested reading paths

| Path | Chapters | Best for |
|------|----------|----------|
| ⚡ **Quick start** | 7 | Build a mental model fast: 1 → 2 → 33 → 5 → 10 → 14 → 34 |
| 🤖 **AI engineering** | 9 | Go deep on the AI core: 1 → 33 → 6 → 5 → 7 → 9 → 10 → 14 → 15 |
| 🏢 **Remote & enterprise** | 5 | How a CLI survives an enterprise topology: 3 → 4 → 23 → 24 → 25 |
| 📚 **The full read** | 34 | Read in order for the most complete picture |

## Star history

If this project helped you, please leave a ⭐ — it really does help.

## License

MIT
