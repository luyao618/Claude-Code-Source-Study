# 附录 A · 工具速查表

> 生成脚本：`scripts/gen-tool-table.ts`；source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`；生成于 2026-05-21T20:04:54.904Z

三列模型：
- **family**：`tools/` 下作为顶层目录出现（9 项）
- **leaf**：`tools.ts` 默认 register 的运行期叶子工具（35 项）
- **feature-gated**：受 `feature(...)` / 环境变量条件装载（15 项）

合计 59 项。

| 名称 | 分类 | 源码位置 | 说明 |
|---|---|---|---|
| `AgentTool` | leaf | tools/AgentTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `AskUserQuestionTool` | leaf | tools/AskUserQuestionTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `BashTool` | leaf | tools/BashTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `BriefTool` | leaf | tools/BriefTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `ConfigTool` | leaf | tools/ConfigTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `CronCreateTool` | feature-gated | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `CronDeleteTool` | feature-gated | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `CronListTool` | feature-gated | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `CtxInspectTool` | feature-gated | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `EnterPlanModeTool` | leaf | tools/EnterPlanModeTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `EnterWorktreeTool` | leaf | tools/EnterWorktreeTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `ExitPlanModeTool` | family | tools/ExitPlanModeTool/ | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `ExitPlanModeV2Tool` | leaf | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `ExitWorktreeTool` | leaf | tools/ExitWorktreeTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `FileEditTool` | leaf | tools/FileEditTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `FileReadTool` | leaf | tools/FileReadTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `FileWriteTool` | leaf | tools/FileWriteTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `GlobTool` | leaf | tools/GlobTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `GrepTool` | leaf | tools/GrepTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `ListMcpResourcesTool` | leaf | tools/ListMcpResourcesTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `ListPeersTool` | feature-gated | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `LSPTool` | leaf | tools/LSPTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `McpAuthTool` | family | tools/McpAuthTool/ | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `MCPTool` | family | tools/MCPTool/ | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `MonitorTool` | feature-gated | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `NotebookEditTool` | leaf | tools/NotebookEditTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `OverflowTestTool` | feature-gated | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `PowerShellTool` | family | tools/PowerShellTool/ | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `PushNotificationTool` | leaf | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `ReadMcpResourceTool` | leaf | tools/ReadMcpResourceTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `RemoteTriggerTool` | feature-gated | tools/RemoteTriggerTool/ | tools.ts 中按 feature flag / 环境变量条件装载 |
| `REPLTool` | feature-gated | tools/REPLTool/ | tools.ts 中按 feature flag / 环境变量条件装载 |
| `ScheduleCronTool` | family | tools/ScheduleCronTool/ | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `SendMessageTool` | family | tools/SendMessageTool/ | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `SendUserFileTool` | feature-gated | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `SkillTool` | leaf | tools/SkillTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `SleepTool` | feature-gated | tools/SleepTool/ | tools.ts 中按 feature flag / 环境变量条件装载 |
| `SnipTool` | feature-gated | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `SubscribePRTool` | feature-gated | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `SuggestBackgroundPRTool` | leaf | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `SyntheticOutputTool` | family | tools/SyntheticOutputTool/ | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `TaskCreateTool` | leaf | tools/TaskCreateTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `TaskGetTool` | leaf | tools/TaskGetTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `TaskListTool` | leaf | tools/TaskListTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `TaskOutputTool` | leaf | tools/TaskOutputTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `TaskStopTool` | leaf | tools/TaskStopTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `TaskUpdateTool` | leaf | tools/TaskUpdateTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `TeamCreateTool` | family | tools/TeamCreateTool/ | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `TeamDeleteTool` | family | tools/TeamDeleteTool/ | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `TerminalCaptureTool` | leaf | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `TestingPermissionTool` | leaf | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `TodoWriteTool` | leaf | tools/TodoWriteTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `ToolSearchTool` | leaf | tools/ToolSearchTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `TungstenTool` | leaf | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `VerifyPlanExecutionTool` | leaf | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `WebBrowserTool` | feature-gated | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `WebFetchTool` | leaf | tools/WebFetchTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `WebSearchTool` | leaf | tools/WebSearchTool/ | tools.ts 默认 register 的运行期叶子工具 |
| `WorkflowTool` | feature-gated | tools.ts | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
