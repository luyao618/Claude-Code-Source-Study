# 附录 E · TaskType 谱系

> 生成脚本：`scripts/gen-tasktypes-table.ts`；source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`
>
> 详细叙事：见 [第 16 章 · 任务模型与 TaskType 谱系](../16-任务模型与TaskType谱系.md)。本附录是速查表，C16 是叙事。

wire 字面量合计 7 个 = 4 默认注册 + 2 feature-gated + 1 in-process 特例。

| wire 字面量 | 分类 | feature_flags | notes |
|---|---|---|---|
| `local_bash` | default-registered | — | LocalShellTask 在 tasks.ts getAllTasks() 主体数组中默认装载 |
| `local_agent` | default-registered | — | LocalAgentTask 在 tasks.ts getAllTasks() 主体数组中默认装载 |
| `remote_agent` | default-registered | — | RemoteAgentTask 在 tasks.ts getAllTasks() 主体数组中默认装载 |
| `in_process_teammate` | in-process | — | InProcessTeammateTask 不通过 tasks.ts 注册，属于 in-process 特例 |
| `local_workflow` | feature-gated | WORKFLOW_SCRIPTS | LocalWorkflowTask 在 tasks.ts 中受 feature('WORKFLOW_SCRIPTS') 条件装载 |
| `monitor_mcp` | feature-gated | MONITOR_TOOL | MonitorMcpTask 在 tasks.ts 中受 feature('MONITOR_TOOL') 条件装载 |
| `dream` | default-registered | — | DreamTask 在 tasks.ts getAllTasks() 主体数组中默认装载 |
