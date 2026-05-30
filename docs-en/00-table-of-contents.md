# Deep Dive into Claude Code Source: Full-Stack Engineering for AI Agent Applications

> **Learn how to build full-stack AI Agent applications from the source of a real AI product.**

## About this book

This book is an in-depth technical analysis of Anthropic's **Claude Code**, based on its complete source. Claude Code is an AI-powered command-line programming assistant; its source covers a complete technology stack — System Prompt engineering, multi-agent orchestration, the tool system, the terminal UI, Bridge IPC, remote sessions, enterprise proxying, and more.

We approach this real, production-grade AI product the way you would approach a source-code study (源码学习): module by module. The whole book is organized around the **runtime lifecycle** as its main thread — before you enter the software → the kernel of a single turn → the tool families → agents, tasks, and orchestration → protocols, security, and extension points → networking and remote collaboration → the terminal UI and multimodal input → memory, extensions, and summary. From this we distill design patterns and engineering practices you can carry into your own projects.

> 📝 For the revision history of this book, see the [changelog (修订说明)](../V2-CHANGELOG.md) in the repository root.

### Target audience

- Programmers with 1–3 years of experience who know TypeScript
- People interested in AI application development who want to learn from a real product
- Anyone who wants to understand the architecture of a large AI CLI product

> **A note on depth matching.** Some chapters touch on more advanced topics: the Bun bundler, Dead Code Elimination, GrowthBook feature flags, Prompt Cache byte alignment, and the like. If a particular topic is unfamiliar, feel free to skip that section — the main thread will still hold together; come back when you want to go deeper. Every advanced topic carries a one-sentence primer so you do not need to know it ahead of time.

### Reading conventions

- The body text is in English; technical terms are kept in their original form (Agent, Tool, System Prompt, and so on).
- Code references use the format `file/path:line-range`.
- Each chapter can be read on its own, but reading in order is recommended — the chapter order is itself the pipeline of one session, from startup to output.

---

## Table of contents

### Part 1 · Before you enter the software

| # | Title | Core topic |
|---|---|---|
| 01 | [Project overview and four entrypoint forms](./01-project-overview-and-four-entrypoints.md) | One source tree = CLI + SDK + MCP server + Sandbox runner |
| 02 | [Startup pipeline and cold-start optimization](./02-startup-pipeline-and-cold-start.md) | Side-effect hoisting, DCE, lazy loading, bundled vs dev |
| 03 | [Configuration system and enterprise MDM](./03-configuration-system-and-enterprise-mdm.md) | 7-dimension configuration merge, `remoteManaged`, `settingsSync`, `policyLimits` |
| 04 | [Configuration migration as code](./04-configuration-migration-as-code.md) | The 11 files under `migrations/`, model renames, the full `replBridge`→`remoteControl` evolution |

### Part 2 · The kernel of a single turn

| # | Title | Core topic |
|---|---|---|
| 05 | [QueryEngine and the conversation main loop](./05-queryengine-and-conversation-main-loop.md) | The `QueryEngine` facade + the `query` kernel + 4 submodules |
| 06 | [System Prompt and Output Style injection](./06-system-prompt-and-output-style-injection.md) | Segmented construction, cache boundaries, Output Style injection |
| 07 | [The context compaction family](./07-context-compaction-family.md) | Six compaction pipelines: `autoCompact` / `microCompact` / `apiMicrocompact` / `sessionMemoryCompact` |
| 08 | [Prompt Cache as a cross-cutting concern](./08-prompt-cache-cross-cutting.md) | `CacheSafeParams`, Dynamic Boundary, cross-module cross-cutting |
| 09 | [Thinking, Effort, and Advisor](./09-thinking-effort-and-advisor.md) | `ThinkingConfig`, `Effort`, `ultrathink`, `Advisor` |

### Part 3 · The tool families

| # | Title | Core topic |
|---|---|---|
| 10 | [Tool protocol, registration, and ToolSearch](./10-tool-protocol-registration-and-toolsearch.md) | The Tool interface, `buildTool`, the three-column model: family / runtime leaf / feature-gated |
| 11 | [BashTool / PowerShellTool dual shell](./11-bashtool-powershelltool-dual-shell.md) | Safety analysis, sandbox, output handling, Windows path mapping |
| 12 | [File, code, and LSP collaboration family](./12-file-code-and-lsp-collaboration-family.md) | `FileRead`/`Write`/`Edit`, `NotebookEdit`, `Glob`, `Grep`, `LSPTool`, `REPLTool` |
| 13 | [Communication, scheduling, questioning, and synthetic tools](./13-communication-scheduling-questioning-and-synthetic-tools.md) | Ten tools: `WebFetch` / `WebSearch` / `ScheduleCron` / `SendMessage` / `AskUserQuestion` and friends |

### Part 4 · Agents, tasks, and orchestration

| # | Title | Core topic |
|---|---|---|
| 14 | [The Agent system and SubAgent invocation](./14-agent-system-and-subagent-invocation.md) | `AgentDefinition`, `runAgent`, `AgentSummary`, context isolation |
| 15 | [Design patterns of the built-in agents](./15-built-in-agent-design-patterns.md) | Prompt design of the 6 built-in agents; source definitions vs runtime availability |
| 16 | [The task model and TaskType lineage](./16-task-model-and-tasktype-lineage.md) | 7 wire `TaskType`s = 4 defaults + 2 feature-gated + 1 special case |
| 17 | [Coordinator, Cron, and scheduled execution](./17-coordinator-cron-and-scheduled-execution.md) | The multi-agent orchestration layer + scheduled triggers |

### Part 5 · Protocols, security, and extension points

| # | Title | Core topic |
|---|---|---|
| 18 | [MCP protocol implementation](./18-mcp-protocol-implementation.md) | The 23 files under `services/mcp/`, `SdkControlTransport`, `channelAllowlist` |
| 19 | [Permission system and remote permission back-propagation](./19-permission-system-and-remote-permission-back-propagation.md) | The rule chain, AI Classifier, `bridgePermissionCallbacks` |
| 20 | [The Hooks system](./20-hooks-system.md) | 27 `HOOK_EVENTS`, 4 hook command types, `stopHooks`, `notifs` |
| 21 | [Skill / Plugin / Output Style: three extension points](./21-skill-plugin-outputstyle-three-extension-points.md) | Custom agents/skills, Plugin architecture, Output Style as an extension path |
| 22 | [Feature flags and compile-time optimization](./22-feature-flag-and-compile-time-optimization.md) | `feature()`, DCE, GrowthBook |

### Part 6 · The network layer and remote collaboration

| # | Title | Core topic |
|---|---|---|
| 23 | [Client transport and API retry](./23-client-transport-and-api-retry.md) | `withRetry`, fallback, `HybridTransport` / SSE / WebSocket |
| 24 | [Bridge IPC and remote sessions](./24-bridge-ipc-and-remote-sessions.md) | The full pipeline: phone / web / desktop driving the local CLI |
| 25 | [DirectConnect and the upstream proxy](./25-directconnect-and-upstream-proxy.md) | `server/`, `upstreamproxy/`, enterprise proxy topology |

### Part 7 · The terminal UI and multimodal input

| # | Title | Core topic |
|---|---|---|
| 26 | [Deep customization of the Ink framework](./26-ink-framework-deep-customization.md) | Reconciler, Yoga layout, ANSI, native-ts |
| 27 | [Components and the design system](./27-components-and-design-system.md) | `ThemedText`, the theme system, tool UI |
| 28 | [Keybindings, Vim mode, and Voice input](./28-keybindings-vim-and-voice-input.md) | Three ways to interpret "what does this keystroke mean" |
| 29 | [The Buddy pet](./29-buddy-pet.md) | Raising a randomly generated little animal next to the `PromptInput` |
| 30 | [The Doctor screen and the Output Style experience](./30-doctor-screen-and-output-style-experience.md) | A self-diagnostic dashboard + a wardrobe system |

### Part 8 · Memory, extensions, and summary

| # | Title | Core topic |
|---|---|---|
| 31 | [Memory subsystem overview](./31-memory-subsystem-overview.md) | Four dimensions: session / project / team / long-term |
| 32 | [Command system overview](./32-command-system-overview.md) | 101 top-level entries: built-in / Skill / Plugin / Workflow |
| 33 | [State management and the cross-process bridge](./33-state-management-and-cross-process-bridge.md) | A minimalist Store, `AppState`, `bridgePointer` |
| 34 | [Architecture patterns summary](./34-architecture-patterns-summary.md) | Reusable patterns: Bridge IPC, Coordinator-Agent, Migration-as-Code, Output-Style-as-Plugin, and more |

### Appendices

| # | Contents |
|---|---|
| [Appendix A](./appendix/A.md) | Tool quick-reference (three columns: family / runtime leaf / feature-gated) |
| [Appendix B](./appendix/B.md) | Commands quick-reference (top-level directories / top-level files / runtime commands) |
| [Appendix C](./appendix/C.md) | Hooks event table (27 `HOOK_EVENTS` + 4 hook command types) |
| [Appendix D](./appendix/D.md) | Built-in agent quick-reference (source definitions vs runtime availability) |
| [Appendix E](./appendix/E.md) | `TaskType` lineage (7 wire / 4 default / 2 feature-gated / 1 special case) |
| [Appendix F](./appendix/F.md) | Module × chapter bidirectional matrix + orphan directories |

---

## Reading suggestions

1. **Getting-started route** (7 chapters): 1 → 2 → 33 → 5 → 10 → 14 → 34. From the overview to startup to state, then along the main spine of query → tools → agent → summary to build a global picture.
2. **AI engineering route** (9 chapters): 1 → 33 → 6 → 5 → 7 → 9 → 10 → 14 → 15. First establish the runtime context, then dive into the AI-core design of prompt / query / compaction / thinking / agent. (Chapter 8 on Prompt Cache is a cross-cutting topic that runs through the caching strategies of chapters 6 / 5 / 7; we recommend reading it after the main spine.)
3. **Remote and enterprise route** (5 chapters): 3 → 4 → 23 → 24 → 25. From configuration merge and migration-as-code, through client transport, Bridge IPC, and DirectConnect / upstream proxy — see how a CLI survives inside an enterprise topology.
4. **Full route** (34 chapters): read in order for the most complete understanding.
