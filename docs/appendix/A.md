# 附录 A · 工具速查表

> 生成脚本：`scripts/gen-tool-table.ts`；source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`

三列模型：
- **family**：`tools/` 下作为顶层目录出现（12 项）
- **leaf**：`tools.ts` 默认 register 的运行期叶子工具（47 项）
- **feature-gated**：受 `feature(...)` / 环境变量条件装载（0 项）

合计 59 项。

| 名称 | 分类 | 源码位置 (path:line-line) | 说明 |
|---|---|---|---|
| `AgentTool` | leaf | `tools/AgentTool/AgentTool.tsx:1-1398`, `tools.ts:3-3` | tools.ts 默认 register 的运行期叶子工具 |
| `AskUserQuestionTool` | leaf | `tools/AskUserQuestionTool/AskUserQuestionTool.tsx:1-266`, `tools.ts:73-73` | tools.ts 默认 register 的运行期叶子工具 |
| `BashTool` | leaf | `tools/BashTool/BashTool.tsx:1-1144`, `tools.ts:5-5` | tools.ts 默认 register 的运行期叶子工具 |
| `BriefTool` | leaf | `tools/BriefTool/BriefTool.ts:1-205`, `tools.ts:13-13` | tools.ts 默认 register 的运行期叶子工具 |
| `ConfigTool` | leaf | `tools/ConfigTool/ConfigTool.ts:1-468`, `tools.ts:81-81` | tools.ts 默认 register 的运行期叶子工具 |
| `CronCreateTool` | leaf | `tools.ts:31-31` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `CronDeleteTool` | leaf | `tools.ts:32-32` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `CronListTool` | leaf | `tools.ts:33-33` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `CtxInspectTool` | leaf | `tools.ts:110-110` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `EnterPlanModeTool` | leaf | `tools/EnterPlanModeTool/EnterPlanModeTool.ts:1-127`, `tools.ts:78-78` | tools.ts 默认 register 的运行期叶子工具 |
| `EnterWorktreeTool` | leaf | `tools/EnterWorktreeTool/EnterWorktreeTool.ts:1-128`, `tools.ts:79-79` | tools.ts 默认 register 的运行期叶子工具 |
| `ExitPlanModeTool` | family | `tools/ExitPlanModeTool/prompt.ts:1-30` | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `ExitPlanModeV2Tool` | leaf | `tools.ts:57-57` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `ExitWorktreeTool` | leaf | `tools/ExitWorktreeTool/ExitWorktreeTool.ts:1-330`, `tools.ts:80-80` | tools.ts 默认 register 的运行期叶子工具 |
| `FileEditTool` | leaf | `tools/FileEditTool/FileEditTool.ts:1-626`, `tools.ts:6-6` | tools.ts 默认 register 的运行期叶子工具 |
| `FileReadTool` | leaf | `tools/FileReadTool/FileReadTool.ts:1-1184`, `tools.ts:7-7` | tools.ts 默认 register 的运行期叶子工具 |
| `FileWriteTool` | leaf | `tools/FileWriteTool/FileWriteTool.ts:1-435`, `tools.ts:8-8` | tools.ts 默认 register 的运行期叶子工具 |
| `GlobTool` | leaf | `tools/GlobTool/GlobTool.ts:1-199`, `tools.ts:9-9` | tools.ts 默认 register 的运行期叶子工具 |
| `GrepTool` | leaf | `tools/GrepTool/GrepTool.ts:1-578`, `tools.ts:59-59` | tools.ts 默认 register 的运行期叶子工具 |
| `ListMcpResourcesTool` | leaf | `tools/ListMcpResourcesTool/ListMcpResourcesTool.ts:1-124`, `tools.ts:75-75` | tools.ts 默认 register 的运行期叶子工具 |
| `ListPeersTool` | leaf | `tools.ts:126-126` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `LSPTool` | leaf | `tools/LSPTool/LSPTool.ts:1-861`, `tools.ts:74-74` | tools.ts 默认 register 的运行期叶子工具 |
| `McpAuthTool` | family | `tools/McpAuthTool/McpAuthTool.ts:1-216` | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `MCPTool` | family | `tools/MCPTool/MCPTool.ts:1-78` | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `MonitorTool` | leaf | `tools.ts:39-39` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `NotebookEditTool` | leaf | `tools/NotebookEditTool/NotebookEditTool.ts:1-491`, `tools.ts:10-10` | tools.ts 默认 register 的运行期叶子工具 |
| `OverflowTestTool` | leaf | `tools.ts:107-107` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `PowerShellTool` | family | `tools/PowerShellTool/PowerShellTool.tsx:1-1001` | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `PushNotificationTool` | leaf | `tools.ts:45-45` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `ReadMcpResourceTool` | leaf | `tools/ReadMcpResourceTool/ReadMcpResourceTool.ts:1-159`, `tools.ts:76-76` | tools.ts 默认 register 的运行期叶子工具 |
| `RemoteTriggerTool` | family | `tools/RemoteTriggerTool/RemoteTriggerTool.ts:1-162` | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `REPLTool` | family | `tools/REPLTool/constants.ts:1-47` | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `ScheduleCronTool` | family | `tools/ScheduleCronTool/prompt.ts:1-136` | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `SendMessageTool` | family | `tools/SendMessageTool/SendMessageTool.ts:1-918` | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `SendUserFileTool` | leaf | `tools.ts:42-42` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `SkillTool` | leaf | `tools/SkillTool/SkillTool.ts:1-1109`, `tools.ts:4-4` | tools.ts 默认 register 的运行期叶子工具 |
| `SleepTool` | family | `tools/SleepTool/prompt.ts:1-18` | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `SnipTool` | leaf | `tools.ts:123-123` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `SubscribePRTool` | leaf | `tools.ts:50-50` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `SuggestBackgroundPRTool` | leaf | `tools.ts:20-20` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `SyntheticOutputTool` | family | `tools/SyntheticOutputTool/SyntheticOutputTool.ts:1-164` | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `TaskCreateTool` | leaf | `tools/TaskCreateTool/TaskCreateTool.ts:1-139`, `tools.ts:82-82` | tools.ts 默认 register 的运行期叶子工具 |
| `TaskGetTool` | leaf | `tools/TaskGetTool/TaskGetTool.ts:1-129`, `tools.ts:83-83` | tools.ts 默认 register 的运行期叶子工具 |
| `TaskListTool` | leaf | `tools/TaskListTool/TaskListTool.ts:1-117`, `tools.ts:85-85` | tools.ts 默认 register 的运行期叶子工具 |
| `TaskOutputTool` | leaf | `tools/TaskOutputTool/TaskOutputTool.tsx:1-584`, `tools.ts:54-54` | tools.ts 默认 register 的运行期叶子工具 |
| `TaskStopTool` | leaf | `tools/TaskStopTool/TaskStopTool.ts:1-132`, `tools.ts:12-12` | tools.ts 默认 register 的运行期叶子工具 |
| `TaskUpdateTool` | leaf | `tools/TaskUpdateTool/TaskUpdateTool.ts:1-407`, `tools.ts:84-84` | tools.ts 默认 register 的运行期叶子工具 |
| `TeamCreateTool` | family | `tools/TeamCreateTool/TeamCreateTool.ts:1-241` | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `TeamDeleteTool` | family | `tools/TeamDeleteTool/TeamDeleteTool.ts:1-140` | tools/ 目录存在；运行期是否装载受 tools.ts 中 feature/coordinator/SDK 条件影响 |
| `TerminalCaptureTool` | leaf | `tools.ts:113-113` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `TestingPermissionTool` | leaf | `tools.ts:58-58` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `TodoWriteTool` | leaf | `tools/TodoWriteTool/TodoWriteTool.ts:1-116`, `tools.ts:56-56` | tools.ts 默认 register 的运行期叶子工具 |
| `ToolSearchTool` | leaf | `tools/ToolSearchTool/ToolSearchTool.ts:1-472`, `tools.ts:77-77` | tools.ts 默认 register 的运行期叶子工具 |
| `TungstenTool` | leaf | `tools.ts:60-60` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `VerifyPlanExecutionTool` | leaf | `tools.ts:91-91` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `WebBrowserTool` | leaf | `tools.ts:117-117` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
| `WebFetchTool` | leaf | `tools/WebFetchTool/WebFetchTool.ts:1-319`, `tools.ts:11-11` | tools.ts 默认 register 的运行期叶子工具 |
| `WebSearchTool` | leaf | `tools/WebSearchTool/WebSearchTool.ts:1-436`, `tools.ts:55-55` | tools.ts 默认 register 的运行期叶子工具 |
| `WorkflowTool` | leaf | `tools.ts:129-129` | 由 tools.ts 引用、未独占 tools/ 顶层目录 |
