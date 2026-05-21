# 附录 A · 工具速查表

> source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`
> generated_at: `2026-05-21T15:49:27.157Z`
> 共 43 项（family=1 / runtime-leaf=30 / feature-gated=12）

本表由 `scripts/gen-tool-table.ts` 扫描 CLI 源码 `tools/` 目录 + `tools.ts` 注册图生成；正文 §C10 引用此表的 leaf 数即可，不要在正文中裸写工具数量。

| name | category | feature_flags | source_files |
|---|---|---|---|
| `AgentTool` | runtime-leaf | — | tools/AgentTool/agentColorManager.ts, tools/AgentTool/agentDisplay.ts, tools/AgentTool/agentMemory.ts …(+17) |
| `AskUserQuestionTool` | runtime-leaf | — | tools/AskUserQuestionTool/AskUserQuestionTool.tsx, tools/AskUserQuestionTool/prompt.ts |
| `BashTool` | runtime-leaf | — | tools/BashTool/bashCommandHelpers.ts, tools/BashTool/bashPermissions.ts, tools/BashTool/bashSecurity.ts …(+15) |
| `BriefTool` | runtime-leaf | — | tools/BriefTool/attachments.ts, tools/BriefTool/BriefTool.ts, tools/BriefTool/prompt.ts …(+2) |
| `ConfigTool` | runtime-leaf | — | tools/ConfigTool/ConfigTool.ts, tools/ConfigTool/constants.ts, tools/ConfigTool/prompt.ts …(+2) |
| `EnterPlanModeTool` | runtime-leaf | — | tools/EnterPlanModeTool/constants.ts, tools/EnterPlanModeTool/EnterPlanModeTool.ts, tools/EnterPlanModeTool/prompt.ts …(+1) |
| `EnterWorktreeTool` | runtime-leaf | — | tools/EnterWorktreeTool/constants.ts, tools/EnterWorktreeTool/EnterWorktreeTool.ts, tools/EnterWorktreeTool/prompt.ts …(+1) |
| `ExitPlanModeTool` | runtime-leaf | — | tools/ExitPlanModeTool/constants.ts, tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts, tools/ExitPlanModeTool/prompt.ts …(+1) |
| `ExitWorktreeTool` | runtime-leaf | — | tools/ExitWorktreeTool/constants.ts, tools/ExitWorktreeTool/ExitWorktreeTool.ts, tools/ExitWorktreeTool/prompt.ts …(+1) |
| `FileEditTool` | runtime-leaf | — | tools/FileEditTool/constants.ts, tools/FileEditTool/FileEditTool.ts, tools/FileEditTool/prompt.ts …(+3) |
| `FileReadTool` | runtime-leaf | — | tools/FileReadTool/FileReadTool.ts, tools/FileReadTool/imageProcessor.ts, tools/FileReadTool/limits.ts …(+2) |
| `FileWriteTool` | runtime-leaf | — | tools/FileWriteTool/FileWriteTool.ts, tools/FileWriteTool/prompt.ts, tools/FileWriteTool/UI.tsx |
| `GlobTool` | runtime-leaf | — | tools/GlobTool/GlobTool.ts, tools/GlobTool/prompt.ts, tools/GlobTool/UI.tsx |
| `GrepTool` | runtime-leaf | — | tools/GrepTool/GrepTool.ts, tools/GrepTool/prompt.ts, tools/GrepTool/UI.tsx |
| `LSPTool` | runtime-leaf | — | tools/LSPTool/formatters.ts, tools/LSPTool/LSPTool.ts, tools/LSPTool/prompt.ts …(+3) |
| `ListMcpResourcesTool` | runtime-leaf | — | tools/ListMcpResourcesTool/ListMcpResourcesTool.ts, tools/ListMcpResourcesTool/prompt.ts, tools/ListMcpResourcesTool/UI.tsx |
| `MCPTool` | feature-gated | — | tools/MCPTool/classifyForCollapse.ts, tools/MCPTool/MCPTool.ts, tools/MCPTool/prompt.ts …(+1) |
| `McpAuthTool` | feature-gated | — | tools/McpAuthTool/McpAuthTool.ts |
| `NotebookEditTool` | runtime-leaf | — | tools/NotebookEditTool/constants.ts, tools/NotebookEditTool/NotebookEditTool.ts, tools/NotebookEditTool/prompt.ts …(+1) |
| `PowerShellTool` | feature-gated | — | tools/PowerShellTool/clmTypes.ts, tools/PowerShellTool/commandSemantics.ts, tools/PowerShellTool/commonParameters.ts …(+11) |
| `REPLTool` | feature-gated | env:USER_TYPE | tools/REPLTool/constants.ts, tools/REPLTool/primitiveTools.ts |
| `ReadMcpResourceTool` | runtime-leaf | — | tools/ReadMcpResourceTool/prompt.ts, tools/ReadMcpResourceTool/ReadMcpResourceTool.ts, tools/ReadMcpResourceTool/UI.tsx |
| `RemoteTriggerTool` | feature-gated | AGENT_TRIGGERS_REMOTE | tools/RemoteTriggerTool/prompt.ts, tools/RemoteTriggerTool/RemoteTriggerTool.ts, tools/RemoteTriggerTool/UI.tsx |
| `ScheduleCronTool` | family | PROACTIVE | tools/ScheduleCronTool/CronCreateTool.ts, tools/ScheduleCronTool/CronDeleteTool.ts, tools/ScheduleCronTool/CronListTool.ts …(+2) |
| `CronCreateTool` | feature-gated | PROACTIVE | tools/ScheduleCronTool/CronCreateTool.ts |
| `CronDeleteTool` | feature-gated | PROACTIVE | tools/ScheduleCronTool/CronDeleteTool.ts |
| `CronListTool` | feature-gated | PROACTIVE | tools/ScheduleCronTool/CronListTool.ts |
| `SendMessageTool` | feature-gated | — | tools/SendMessageTool/constants.ts, tools/SendMessageTool/prompt.ts, tools/SendMessageTool/SendMessageTool.ts …(+1) |
| `SkillTool` | runtime-leaf | — | tools/SkillTool/constants.ts, tools/SkillTool/prompt.ts, tools/SkillTool/SkillTool.ts …(+1) |
| `SleepTool` | feature-gated | PROACTIVE, env:USER_TYPE | tools/SleepTool/prompt.ts |
| `SyntheticOutputTool` | runtime-leaf | — | tools/SyntheticOutputTool/SyntheticOutputTool.ts |
| `TaskCreateTool` | runtime-leaf | — | tools/TaskCreateTool/constants.ts, tools/TaskCreateTool/prompt.ts, tools/TaskCreateTool/TaskCreateTool.ts |
| `TaskGetTool` | runtime-leaf | — | tools/TaskGetTool/constants.ts, tools/TaskGetTool/prompt.ts, tools/TaskGetTool/TaskGetTool.ts |
| `TaskListTool` | runtime-leaf | — | tools/TaskListTool/constants.ts, tools/TaskListTool/prompt.ts, tools/TaskListTool/TaskListTool.ts |
| `TaskOutputTool` | runtime-leaf | — | tools/TaskOutputTool/constants.ts, tools/TaskOutputTool/TaskOutputTool.tsx |
| `TaskStopTool` | runtime-leaf | — | tools/TaskStopTool/prompt.ts, tools/TaskStopTool/TaskStopTool.ts, tools/TaskStopTool/UI.tsx |
| `TaskUpdateTool` | runtime-leaf | — | tools/TaskUpdateTool/constants.ts, tools/TaskUpdateTool/prompt.ts, tools/TaskUpdateTool/TaskUpdateTool.ts |
| `TeamCreateTool` | feature-gated | — | tools/TeamCreateTool/constants.ts, tools/TeamCreateTool/prompt.ts, tools/TeamCreateTool/TeamCreateTool.ts …(+1) |
| `TeamDeleteTool` | feature-gated | — | tools/TeamDeleteTool/constants.ts, tools/TeamDeleteTool/prompt.ts, tools/TeamDeleteTool/TeamDeleteTool.ts …(+1) |
| `TodoWriteTool` | runtime-leaf | — | tools/TodoWriteTool/constants.ts, tools/TodoWriteTool/prompt.ts, tools/TodoWriteTool/TodoWriteTool.ts |
| `ToolSearchTool` | runtime-leaf | — | tools/ToolSearchTool/constants.ts, tools/ToolSearchTool/prompt.ts, tools/ToolSearchTool/ToolSearchTool.ts |
| `WebFetchTool` | runtime-leaf | — | tools/WebFetchTool/preapproved.ts, tools/WebFetchTool/prompt.ts, tools/WebFetchTool/UI.tsx …(+2) |
| `WebSearchTool` | runtime-leaf | — | tools/WebSearchTool/prompt.ts, tools/WebSearchTool/UI.tsx, tools/WebSearchTool/WebSearchTool.ts |
