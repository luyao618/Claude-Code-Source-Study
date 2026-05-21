# 附录 A · 工具速查表

> source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`
> generated_at: `2026-05-21T17:10:03.796Z`
> 共 43 项（family=1 / runtime-leaf=19 / feature-gated=23）

本表由 `scripts/gen-tool-table.ts` 扫描 CLI 源码 `tools/` 目录 + `tools.ts` 注册图（含 `getAllBaseTools()` 内联 gate）生成；正文 §C10 引用此表的 leaf 数即可，不要在正文中裸写工具数量。

| name | category | feature_flags | source_files |
|---|---|---|---|
| `AgentTool` | runtime-leaf | — | tools/AgentTool/agentColorManager.ts:1-66, tools/AgentTool/agentDisplay.ts:1-104, tools/AgentTool/agentMemory.ts:1-177 …(+17) |
| `AskUserQuestionTool` | runtime-leaf | — | tools/AskUserQuestionTool/AskUserQuestionTool.tsx:1-266, tools/AskUserQuestionTool/prompt.ts:1-44 |
| `BashTool` | runtime-leaf | — | tools/BashTool/bashCommandHelpers.ts:1-265, tools/BashTool/bashPermissions.ts:1-2621, tools/BashTool/bashSecurity.ts:1-2592 …(+15) |
| `BriefTool` | runtime-leaf | — | tools/BriefTool/attachments.ts:1-110, tools/BriefTool/BriefTool.ts:1-204, tools/BriefTool/prompt.ts:1-22 …(+2) |
| `ConfigTool` | feature-gated | env:USER_TYPE | tools/ConfigTool/ConfigTool.ts:1-467, tools/ConfigTool/constants.ts:1-1, tools/ConfigTool/prompt.ts:1-93 …(+2) |
| `EnterPlanModeTool` | runtime-leaf | — | tools/EnterPlanModeTool/constants.ts:1-1, tools/EnterPlanModeTool/EnterPlanModeTool.ts:1-126, tools/EnterPlanModeTool/prompt.ts:1-170 …(+1) |
| `EnterWorktreeTool` | feature-gated | fn:isWorktreeModeEnabled | tools/EnterWorktreeTool/constants.ts:1-1, tools/EnterWorktreeTool/EnterWorktreeTool.ts:1-127, tools/EnterWorktreeTool/prompt.ts:1-30 …(+1) |
| `ExitPlanModeTool` | runtime-leaf | — | tools/ExitPlanModeTool/constants.ts:1-2, tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts:1-493, tools/ExitPlanModeTool/prompt.ts:1-29 …(+1) |
| `ExitWorktreeTool` | feature-gated | fn:isWorktreeModeEnabled | tools/ExitWorktreeTool/constants.ts:1-1, tools/ExitWorktreeTool/ExitWorktreeTool.ts:1-329, tools/ExitWorktreeTool/prompt.ts:1-32 …(+1) |
| `FileEditTool` | runtime-leaf | — | tools/FileEditTool/constants.ts:1-11, tools/FileEditTool/FileEditTool.ts:1-625, tools/FileEditTool/prompt.ts:1-28 …(+3) |
| `FileReadTool` | runtime-leaf | — | tools/FileReadTool/FileReadTool.ts:1-1183, tools/FileReadTool/imageProcessor.ts:1-94, tools/FileReadTool/limits.ts:1-92 …(+2) |
| `FileWriteTool` | runtime-leaf | — | tools/FileWriteTool/FileWriteTool.ts:1-434, tools/FileWriteTool/prompt.ts:1-18, tools/FileWriteTool/UI.tsx:1-405 |
| `GlobTool` | feature-gated | — | tools/GlobTool/GlobTool.ts:1-198, tools/GlobTool/prompt.ts:1-7, tools/GlobTool/UI.tsx:1-63 |
| `GrepTool` | feature-gated | — | tools/GrepTool/GrepTool.ts:1-577, tools/GrepTool/prompt.ts:1-18, tools/GrepTool/UI.tsx:1-201 |
| `LSPTool` | feature-gated | env:ENABLE_LSP_TOOL | tools/LSPTool/formatters.ts:1-592, tools/LSPTool/LSPTool.ts:1-860, tools/LSPTool/prompt.ts:1-21 …(+3) |
| `ListMcpResourcesTool` | runtime-leaf | — | tools/ListMcpResourcesTool/ListMcpResourcesTool.ts:1-123, tools/ListMcpResourcesTool/prompt.ts:1-20, tools/ListMcpResourcesTool/UI.tsx:1-29 |
| `MCPTool` | feature-gated | — | tools/MCPTool/classifyForCollapse.ts:1-604, tools/MCPTool/MCPTool.ts:1-77, tools/MCPTool/prompt.ts:1-3 …(+1) |
| `McpAuthTool` | feature-gated | — | tools/McpAuthTool/McpAuthTool.ts:1-215 |
| `NotebookEditTool` | runtime-leaf | — | tools/NotebookEditTool/constants.ts:1-2, tools/NotebookEditTool/NotebookEditTool.ts:1-490, tools/NotebookEditTool/prompt.ts:1-3 …(+1) |
| `PowerShellTool` | feature-gated | fn:isPowerShellToolEnabled, fn:getPowerShellTool | tools/PowerShellTool/clmTypes.ts:1-211, tools/PowerShellTool/commandSemantics.ts:1-142, tools/PowerShellTool/commonParameters.ts:1-30 …(+11) |
| `REPLTool` | feature-gated | env:USER_TYPE | tools/REPLTool/constants.ts:1-46, tools/REPLTool/primitiveTools.ts:1-39 |
| `ReadMcpResourceTool` | runtime-leaf | — | tools/ReadMcpResourceTool/prompt.ts:1-16, tools/ReadMcpResourceTool/ReadMcpResourceTool.ts:1-158, tools/ReadMcpResourceTool/UI.tsx:1-37 |
| `RemoteTriggerTool` | feature-gated | AGENT_TRIGGERS_REMOTE | tools/RemoteTriggerTool/prompt.ts:1-15, tools/RemoteTriggerTool/RemoteTriggerTool.ts:1-161, tools/RemoteTriggerTool/UI.tsx:1-17 |
| `ScheduleCronTool` | family | AGENT_TRIGGERS | tools/ScheduleCronTool/CronCreateTool.ts:1-157, tools/ScheduleCronTool/CronDeleteTool.ts:1-95, tools/ScheduleCronTool/CronListTool.ts:1-97 …(+2) |
| `CronCreateTool` | feature-gated | AGENT_TRIGGERS | tools/ScheduleCronTool/CronCreateTool.ts:1-157 |
| `CronDeleteTool` | feature-gated | AGENT_TRIGGERS | tools/ScheduleCronTool/CronDeleteTool.ts:1-95 |
| `CronListTool` | feature-gated | AGENT_TRIGGERS | tools/ScheduleCronTool/CronListTool.ts:1-97 |
| `SendMessageTool` | runtime-leaf | — | tools/SendMessageTool/constants.ts:1-1, tools/SendMessageTool/prompt.ts:1-49, tools/SendMessageTool/SendMessageTool.ts:1-917 …(+1) |
| `SkillTool` | runtime-leaf | — | tools/SkillTool/constants.ts:1-1, tools/SkillTool/prompt.ts:1-241, tools/SkillTool/SkillTool.ts:1-1108 …(+1) |
| `SleepTool` | feature-gated | PROACTIVE, KAIROS | tools/SleepTool/prompt.ts:1-17 |
| `SyntheticOutputTool` | feature-gated | — | tools/SyntheticOutputTool/SyntheticOutputTool.ts:1-163 |
| `TaskCreateTool` | feature-gated | fn:isTodoV2Enabled | tools/TaskCreateTool/constants.ts:1-1, tools/TaskCreateTool/prompt.ts:1-56, tools/TaskCreateTool/TaskCreateTool.ts:1-138 |
| `TaskGetTool` | feature-gated | fn:isTodoV2Enabled | tools/TaskGetTool/constants.ts:1-1, tools/TaskGetTool/prompt.ts:1-24, tools/TaskGetTool/TaskGetTool.ts:1-128 |
| `TaskListTool` | feature-gated | fn:isTodoV2Enabled | tools/TaskListTool/constants.ts:1-1, tools/TaskListTool/prompt.ts:1-49, tools/TaskListTool/TaskListTool.ts:1-116 |
| `TaskOutputTool` | runtime-leaf | — | tools/TaskOutputTool/constants.ts:1-1, tools/TaskOutputTool/TaskOutputTool.tsx:1-584 |
| `TaskStopTool` | runtime-leaf | — | tools/TaskStopTool/prompt.ts:1-8, tools/TaskStopTool/TaskStopTool.ts:1-131, tools/TaskStopTool/UI.tsx:1-41 |
| `TaskUpdateTool` | feature-gated | fn:isTodoV2Enabled | tools/TaskUpdateTool/constants.ts:1-1, tools/TaskUpdateTool/prompt.ts:1-77, tools/TaskUpdateTool/TaskUpdateTool.ts:1-406 |
| `TeamCreateTool` | feature-gated | fn:isAgentSwarmsEnabled | tools/TeamCreateTool/constants.ts:1-1, tools/TeamCreateTool/prompt.ts:1-113, tools/TeamCreateTool/TeamCreateTool.ts:1-240 …(+1) |
| `TeamDeleteTool` | feature-gated | fn:isAgentSwarmsEnabled | tools/TeamDeleteTool/constants.ts:1-1, tools/TeamDeleteTool/prompt.ts:1-16, tools/TeamDeleteTool/TeamDeleteTool.ts:1-139 …(+1) |
| `TodoWriteTool` | runtime-leaf | — | tools/TodoWriteTool/constants.ts:1-1, tools/TodoWriteTool/prompt.ts:1-184, tools/TodoWriteTool/TodoWriteTool.ts:1-115 |
| `ToolSearchTool` | feature-gated | — | tools/ToolSearchTool/constants.ts:1-1, tools/ToolSearchTool/prompt.ts:1-121, tools/ToolSearchTool/ToolSearchTool.ts:1-471 |
| `WebFetchTool` | runtime-leaf | — | tools/WebFetchTool/preapproved.ts:1-166, tools/WebFetchTool/prompt.ts:1-46, tools/WebFetchTool/UI.tsx:1-72 …(+2) |
| `WebSearchTool` | runtime-leaf | — | tools/WebSearchTool/prompt.ts:1-34, tools/WebSearchTool/UI.tsx:1-101, tools/WebSearchTool/WebSearchTool.ts:1-435 |
