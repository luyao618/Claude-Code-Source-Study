# 附录 E · TaskType 谱系

> source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`
> generated_at: `2026-05-21T16:18:20.023Z`
> 共 7 个 wire TaskType（default=4 / feature-gated=2 / in-process-special=1）

由 `scripts/gen-tasktypes-table.ts` 解析 `Task.ts` 的 `TaskType` union 字面量与 `tasks.ts` 的 `getAllTasks()` 注册体。正文 §C16 引用本表，禁止裸写 4/2/1。

| name | category | feature_flags | default_registered | source_file | notes |
|---|---|---|---|---|---|
| `local_bash` | default | — | true | Task.ts:6-13 | — |
| `local_agent` | default | — | true | Task.ts:6-13 | — |
| `remote_agent` | default | — | true | Task.ts:6-13 | — |
| `in_process_teammate` | in-process-special | — | false | Task.ts:6-13 | wire type only; runs in-process via teammate path, not via getAllTasks() |
| `local_workflow` | feature-gated | WORKFLOW_SCRIPTS | false | Task.ts:6-13 | — |
| `monitor_mcp` | feature-gated | MONITOR_TOOL | false | Task.ts:6-13 | — |
| `dream` | default | — | true | tasks/DreamTask/DreamTask.ts:1-157 | — |
