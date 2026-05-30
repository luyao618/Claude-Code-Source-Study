# Appendix F · Module × Chapter Bidirectional Matrix

> Generator script: `scripts/gen-module-matrix.ts`; source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`

## Forward: chapter → directories covered

| Chapter | Title | Top-level directories covered |
|---|---|---|
| C01 | Project overview and four entrypoint forms | `entrypoints/` |
| C02 | Startup pipeline and cold-start optimization | `entrypoints/`, `screens/` |
| C03 | Configuration system and enterprise MDM | `services/`, `utils/` |
| C04 | Configuration migration as code | `migrations/` |
| C05 | QueryEngine and the conversation main loop | `query/` |
| C06 | System Prompt and Output Style injection | `constants/`, `outputStyles/` |
| C07 | Context compaction family | `services/` |
| C08 | Prompt Cache cross-cutting | `services/` |
| C09 | Thinking, Effort, and Advisor | `commands/`, `services/` |
| C10 | Tool protocol, registration, and ToolSearch | `tools/` |
| C11 | BashTool / PowerShellTool dual shell | `tools/` |
| C12 | File, code, and LSP collaboration family | `tools/`, `services/` |
| C13 | Communication, scheduling, questioning, and synthetic tools | `tools/` |
| C14 | Agent system and Sub-Agent invocation | `tools/`, `services/`, `commands/` |
| C15 | Built-in agent design patterns | `tools/` |
| C16 | Task model and TaskType lineage | `tasks/`, `tools/` |
| C17 | Coordinator, Cron, and scheduled execution | `coordinator/`, `tools/`, `hooks/` |
| C18 | MCP protocol implementation | `services/`, `tools/` |
| C19 | Permission system and remote permission back-propagation | `hooks/`, `bridge/`, `remote/` |
| C20 | Hooks system | `schemas/`, `hooks/`, `query/` |
| C21 | Skill / Plugin / Output Style — three extension points | `skills/`, `services/`, `plugins/`, `outputStyles/` |
| C22 | Feature flag and compile-time optimization | `utils/`, `constants/` |
| C23 | Client transport and API retry | `services/`, `cli/` |
| C24 | Bridge IPC and remote sessions | `bridge/`, `remote/`, `commands/` |
| C25 | DirectConnect and upstream proxy | `server/`, `upstreamproxy/`, `hooks/` |
| C26 | Ink framework deep customization | `ink/`, `native-ts/` |
| C27 | Components and design system | `components/` |
| C28 | Keybindings, Vim, and Voice input | `keybindings/`, `vim/`, `voice/`, `services/`, `hooks/`, `commands/` |
| C29 | Buddy persona | `buddy/` |
| C30 | Doctor screen and Output Style UX | `screens/`, `outputStyles/`, `commands/` |
| C31 | Memory subsystem overview | `memdir/`, `services/`, `assistant/` |
| C32 | Command system overview | `commands/` |
| C33 | State management and the cross-process bridge | `state/`, `bridge/` |
| C34 | Architecture patterns summary | (cross-cutting) |

## Reverse: directory → chapters covered

| Top-level directory | Chapters covered |
|---|---|
| `assistant/` | C31 |
| `bootstrap/` | — |
| `bridge/` | C19, C24, C33 |
| `buddy/` | C29 |
| `cli/` | C23 |
| `commands/` | C09, C14, C24, C28, C30, C32 |
| `components/` | C27 |
| `constants/` | C06, C22 |
| `context/` | — |
| `coordinator/` | C17 |
| `entrypoints/` | C01, C02 |
| `hooks/` | C17, C19, C20, C25, C28 |
| `ink/` | C26 |
| `keybindings/` | C28 |
| `memdir/` | C31 |
| `migrations/` | C04 |
| `moreright/` | — |
| `native-ts/` | C26 |
| `outputStyles/` | C06, C21, C30 |
| `plugins/` | C21 |
| `query/` | C05, C20 |
| `remote/` | C19, C24 |
| `schemas/` | C20 |
| `screens/` | C02, C30 |
| `server/` | C25 |
| `services/` | C03, C07, C08, C09, C12, C14, C18, C21, C23, C28, C31 |
| `skills/` | C21 |
| `state/` | C33 |
| `tasks/` | C16 |
| `tools/` | C10, C11, C12, C13, C14, C15, C16, C17, C18 |
| `types/` | — |
| `upstreamproxy/` | C25 |
| `utils/` | C03, C22 |
| `vim/` | C28 |
| `voice/` | C28 |

## Orphan directories

At the current commit, orphans=0 (the orphan count already excludes entries listed in `scripts/orphan-allowlist.txt`).

The allowlist (`scripts/orphan-allowlist.txt`) has 5 entries: `bootstrap/`, `context/`, `moreright/`, `types/`, `utils/`.

> Note: the `—` marker in the reverse table flags **any top-level directory not directly covered by a finished chapter** (i.e. `reverse_index[dir]` is empty), independent of whether the directory is on the allowlist. The orphan count (`orphans`) = the set of directories with a `—` marker minus the entries in `scripts/orphan-allowlist.txt`. Allowlist entries such as `utils/` are in fact covered by chapter narratives, so the reverse table still shows specific chapter numbers and no `—` appears — this is the "allowlist provides a backstop but is not actually needed" case, and is not a contradiction.
