# Appendix E · `TaskType` Lineage

> Generator script: `scripts/gen-tasktypes-table.ts`; source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`
>
> Narrative detail: see [Chapter 16 · Task model and TaskType lineage](../16-task-model-and-tasktype-lineage.md). This appendix is the quick reference; C16 is the narrative.

7 wire literals in total = 4 default-registered + 2 feature-gated + 1 in-process special case.

| wire literal | Category | feature_flags | Notes |
|---|---|---|---|
| `local_bash` | default-registered | — | `LocalShellTask` is loaded by default in the main array of `tasks.ts` `getAllTasks()` |
| `local_agent` | default-registered | — | `LocalAgentTask` is loaded by default in the main array of `tasks.ts` `getAllTasks()` |
| `remote_agent` | default-registered | — | `RemoteAgentTask` is loaded by default in the main array of `tasks.ts` `getAllTasks()` |
| `in_process_teammate` | in-process | — | `InProcessTeammateTask` is not registered via `tasks.ts`; it is an in-process special case |
| `local_workflow` | feature-gated | WORKFLOW_SCRIPTS | `LocalWorkflowTask` is loaded conditionally in `tasks.ts` under `feature('WORKFLOW_SCRIPTS')` |
| `monitor_mcp` | feature-gated | MONITOR_TOOL | `MonitorMcpTask` is loaded conditionally in `tasks.ts` under `feature('MONITOR_TOOL')` |
| `dream` | default-registered | — | `DreamTask` is loaded by default in the main array of `tasks.ts` `getAllTasks()` |
