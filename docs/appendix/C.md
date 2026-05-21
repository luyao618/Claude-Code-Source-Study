# 附录 C · Hooks 事件表

> source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`
> generated_at: `2026-05-21T16:18:51.605Z`
> 共 27 个 HOOK_EVENTS + 4 种 hook command

由 `scripts/gen-hooks-table.ts` 扫描 `entrypoints/sdk/coreTypes.ts` (HOOK_EVENTS 字面量) 与 `schemas/hooks.ts`（命令 kind 判别）。正文 §C20 不裸写"27"，引用本表。

## C.1 HOOK_EVENTS

| # | name | source |
|---|---|---|
| 1 | `PreToolUse` | entrypoints/sdk/coreTypes.ts:26 |
| 2 | `PostToolUse` | entrypoints/sdk/coreTypes.ts:27 |
| 3 | `PostToolUseFailure` | entrypoints/sdk/coreTypes.ts:28 |
| 4 | `Notification` | entrypoints/sdk/coreTypes.ts:29 |
| 5 | `UserPromptSubmit` | entrypoints/sdk/coreTypes.ts:30 |
| 6 | `SessionStart` | entrypoints/sdk/coreTypes.ts:31 |
| 7 | `SessionEnd` | entrypoints/sdk/coreTypes.ts:32 |
| 8 | `Stop` | entrypoints/sdk/coreTypes.ts:33 |
| 9 | `StopFailure` | entrypoints/sdk/coreTypes.ts:34 |
| 10 | `SubagentStart` | entrypoints/sdk/coreTypes.ts:35 |
| 11 | `SubagentStop` | entrypoints/sdk/coreTypes.ts:36 |
| 12 | `PreCompact` | entrypoints/sdk/coreTypes.ts:37 |
| 13 | `PostCompact` | entrypoints/sdk/coreTypes.ts:38 |
| 14 | `PermissionRequest` | entrypoints/sdk/coreTypes.ts:39 |
| 15 | `PermissionDenied` | entrypoints/sdk/coreTypes.ts:40 |
| 16 | `Setup` | entrypoints/sdk/coreTypes.ts:41 |
| 17 | `TeammateIdle` | entrypoints/sdk/coreTypes.ts:42 |
| 18 | `TaskCreated` | entrypoints/sdk/coreTypes.ts:43 |
| 19 | `TaskCompleted` | entrypoints/sdk/coreTypes.ts:44 |
| 20 | `Elicitation` | entrypoints/sdk/coreTypes.ts:45 |
| 21 | `ElicitationResult` | entrypoints/sdk/coreTypes.ts:46 |
| 22 | `ConfigChange` | entrypoints/sdk/coreTypes.ts:47 |
| 23 | `WorktreeCreate` | entrypoints/sdk/coreTypes.ts:48 |
| 24 | `WorktreeRemove` | entrypoints/sdk/coreTypes.ts:49 |
| 25 | `InstructionsLoaded` | entrypoints/sdk/coreTypes.ts:50 |
| 26 | `CwdChanged` | entrypoints/sdk/coreTypes.ts:51 |
| 27 | `FileChanged` | entrypoints/sdk/coreTypes.ts:52 |

## C.2 Hook command kinds

| name | source |
|---|---|
| `agent` | schemas/hooks.ts |
| `command` | schemas/hooks.ts |
| `http` | schemas/hooks.ts |
| `prompt` | schemas/hooks.ts |
