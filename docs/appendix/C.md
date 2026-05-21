# 附录 C · Hooks 事件表

> 生成脚本：`scripts/gen-hooks-table.ts`；source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`；生成于 2026-05-21T20:04:54.962Z

- HOOK_EVENTS：27 个
- Hook command type：4 类

## HOOK_EVENTS（来源：`entrypoints/sdk/coreSchemas.ts`）

| 事件名 |
|---|
| `PreToolUse` |
| `PostToolUse` |
| `PostToolUseFailure` |
| `Notification` |
| `UserPromptSubmit` |
| `SessionStart` |
| `SessionEnd` |
| `Stop` |
| `StopFailure` |
| `SubagentStart` |
| `SubagentStop` |
| `PreCompact` |
| `PostCompact` |
| `PermissionRequest` |
| `PermissionDenied` |
| `Setup` |
| `TeammateIdle` |
| `TaskCreated` |
| `TaskCompleted` |
| `Elicitation` |
| `ElicitationResult` |
| `ConfigChange` |
| `WorktreeCreate` |
| `WorktreeRemove` |
| `InstructionsLoaded` |
| `CwdChanged` |
| `FileChanged` |

## Hook command type（来源：`schemas/hooks.ts`）

| 类型 |
|---|
| `agent` |
| `command` |
| `http` |
| `prompt` |
