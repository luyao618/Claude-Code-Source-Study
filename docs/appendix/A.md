# 附录 A · 工具速查表

> 生成脚本：`scripts/gen-tool-table.ts`；source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`

正交两维口径（family 与 register 互不强制）：
- **family**：是否在 `tools/` 下有同名顶层目录。共 **40** 项 family（不含 `shared/`、`testing/`），**19** 项仅在 `tools.ts` 内被引用。
- **register**：`tools.ts` 中的装载路径。
  - `default`：顶部 `import` 默认装载，共 **31** 项。
  - `feature-gated`：受 `feature(...)` / `process.env.*` / `getFeatureValue_*` 条件装载，共 **19** 项。
  - `—`：未在 `tools.ts` 中检测到装载（多为 `family-only`：tools/ 目录存在但运行期由 coordinator/SDK 子集另行注入），共 **9** 项。

合计 59 项。

| 名称 | family | register | 源码位置 (path:line-line) | 说明 |
|---|---|---|---|---|
| `AgentTool` | ✓ | default | `tools/AgentTool/AgentTool.tsx:1-1398`, `tools.ts:3-3` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `AskUserQuestionTool` | ✓ | default | `tools/AskUserQuestionTool/AskUserQuestionTool.tsx:1-266`, `tools.ts:73-73` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `BashTool` | ✓ | default | `tools/BashTool/BashTool.tsx:1-1144`, `tools.ts:5-5` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `BriefTool` | ✓ | default | `tools/BriefTool/BriefTool.ts:1-205`, `tools.ts:13-13` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `ConfigTool` | ✓ | default | `tools/ConfigTool/ConfigTool.ts:1-468`, `tools.ts:81-81` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `CronCreateTool` | — | feature-gated | `tools.ts:29-35` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `CronDeleteTool` | — | feature-gated | `tools.ts:29-35` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `CronListTool` | — | feature-gated | `tools.ts:29-35` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `CtxInspectTool` | — | feature-gated | `tools.ts:110-112` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `EnterPlanModeTool` | ✓ | default | `tools/EnterPlanModeTool/EnterPlanModeTool.ts:1-127`, `tools.ts:78-78` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `EnterWorktreeTool` | ✓ | default | `tools/EnterWorktreeTool/EnterWorktreeTool.ts:1-128`, `tools.ts:79-79` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `ExitPlanModeTool` | ✓ | — | `tools/ExitPlanModeTool/prompt.ts:1-30` | family=tools/ 下有顶层同名目录；register=未在 tools.ts 中检测到装载（可能由 coordinator/SDK 子集另行注入） |
| `ExitPlanModeV2Tool` | — | default | `tools.ts:57-57` | family=否（仅 tools.ts 内引用）；register=tools.ts 顶部 `import` 默认装载 |
| `ExitWorktreeTool` | ✓ | default | `tools/ExitWorktreeTool/ExitWorktreeTool.ts:1-330`, `tools.ts:80-80` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `FileEditTool` | ✓ | default | `tools/FileEditTool/FileEditTool.ts:1-626`, `tools.ts:6-6` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `FileReadTool` | ✓ | default | `tools/FileReadTool/FileReadTool.ts:1-1184`, `tools.ts:7-7` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `FileWriteTool` | ✓ | default | `tools/FileWriteTool/FileWriteTool.ts:1-435`, `tools.ts:8-8` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `GlobTool` | ✓ | default | `tools/GlobTool/GlobTool.ts:1-199`, `tools.ts:9-9` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `GrepTool` | ✓ | default | `tools/GrepTool/GrepTool.ts:1-578`, `tools.ts:59-59` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `ListMcpResourcesTool` | ✓ | default | `tools/ListMcpResourcesTool/ListMcpResourcesTool.ts:1-124`, `tools.ts:75-75` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `ListPeersTool` | — | feature-gated | `tools.ts:126-128` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `LSPTool` | ✓ | default | `tools/LSPTool/LSPTool.ts:1-861`, `tools.ts:74-74` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `McpAuthTool` | ✓ | — | `tools/McpAuthTool/McpAuthTool.ts:1-216` | family=tools/ 下有顶层同名目录；register=未在 tools.ts 中检测到装载（可能由 coordinator/SDK 子集另行注入） |
| `MCPTool` | ✓ | — | `tools/MCPTool/MCPTool.ts:1-78` | family=tools/ 下有顶层同名目录；register=未在 tools.ts 中检测到装载（可能由 coordinator/SDK 子集另行注入） |
| `MonitorTool` | — | feature-gated | `tools.ts:39-41` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `NotebookEditTool` | ✓ | default | `tools/NotebookEditTool/NotebookEditTool.ts:1-491`, `tools.ts:10-10` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `OverflowTestTool` | — | feature-gated | `tools.ts:107-109` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `PowerShellTool` | ✓ | — | `tools/PowerShellTool/PowerShellTool.tsx:1-1001` | family=tools/ 下有顶层同名目录；register=未在 tools.ts 中检测到装载（可能由 coordinator/SDK 子集另行注入） |
| `PushNotificationTool` | — | feature-gated | `tools.ts:45-49` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `ReadMcpResourceTool` | ✓ | default | `tools/ReadMcpResourceTool/ReadMcpResourceTool.ts:1-159`, `tools.ts:76-76` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `RemoteTriggerTool` | ✓ | feature-gated | `tools/RemoteTriggerTool/RemoteTriggerTool.ts:1-162`, `tools.ts:36-38` | family=tools/ 下有顶层同名目录；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `REPLTool` | ✓ | feature-gated | `tools/REPLTool/constants.ts:1-47`, `tools.ts:16-19` | family=tools/ 下有顶层同名目录；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `ScheduleCronTool` | ✓ | — | `tools/ScheduleCronTool/prompt.ts:1-136` | family=tools/ 下有顶层同名目录；register=未在 tools.ts 中检测到装载（可能由 coordinator/SDK 子集另行注入） |
| `SendMessageTool` | ✓ | — | `tools/SendMessageTool/SendMessageTool.ts:1-918` | family=tools/ 下有顶层同名目录；register=未在 tools.ts 中检测到装载（可能由 coordinator/SDK 子集另行注入） |
| `SendUserFileTool` | — | feature-gated | `tools.ts:42-44` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `SkillTool` | ✓ | default | `tools/SkillTool/SkillTool.ts:1-1109`, `tools.ts:4-4` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `SleepTool` | ✓ | feature-gated | `tools/SleepTool/prompt.ts:1-18`, `tools.ts:25-28` | family=tools/ 下有顶层同名目录；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `SnipTool` | — | feature-gated | `tools.ts:123-125` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `SubscribePRTool` | — | feature-gated | `tools.ts:50-62` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `SuggestBackgroundPRTool` | — | feature-gated | `tools.ts:20-24` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `SyntheticOutputTool` | ✓ | — | `tools/SyntheticOutputTool/SyntheticOutputTool.ts:1-164` | family=tools/ 下有顶层同名目录；register=未在 tools.ts 中检测到装载（可能由 coordinator/SDK 子集另行注入） |
| `TaskCreateTool` | ✓ | default | `tools/TaskCreateTool/TaskCreateTool.ts:1-139`, `tools.ts:82-82` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `TaskGetTool` | ✓ | default | `tools/TaskGetTool/TaskGetTool.ts:1-129`, `tools.ts:83-83` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `TaskListTool` | ✓ | default | `tools/TaskListTool/TaskListTool.ts:1-117`, `tools.ts:85-85` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `TaskOutputTool` | ✓ | default | `tools/TaskOutputTool/TaskOutputTool.tsx:1-584`, `tools.ts:54-54` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `TaskStopTool` | ✓ | default | `tools/TaskStopTool/TaskStopTool.ts:1-132`, `tools.ts:12-12` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `TaskUpdateTool` | ✓ | default | `tools/TaskUpdateTool/TaskUpdateTool.ts:1-407`, `tools.ts:84-84` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `TeamCreateTool` | ✓ | — | `tools/TeamCreateTool/TeamCreateTool.ts:1-241` | family=tools/ 下有顶层同名目录；register=未在 tools.ts 中检测到装载（可能由 coordinator/SDK 子集另行注入） |
| `TeamDeleteTool` | ✓ | — | `tools/TeamDeleteTool/TeamDeleteTool.ts:1-140` | family=tools/ 下有顶层同名目录；register=未在 tools.ts 中检测到装载（可能由 coordinator/SDK 子集另行注入） |
| `TerminalCaptureTool` | — | feature-gated | `tools.ts:113-116` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `TestingPermissionTool` | — | default | `tools.ts:58-58` | family=否（仅 tools.ts 内引用）；register=tools.ts 顶部 `import` 默认装载 |
| `TodoWriteTool` | ✓ | default | `tools/TodoWriteTool/TodoWriteTool.ts:1-116`, `tools.ts:56-56` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `ToolSearchTool` | ✓ | default | `tools/ToolSearchTool/ToolSearchTool.ts:1-472`, `tools.ts:77-77` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `TungstenTool` | — | default | `tools.ts:60-60` | family=否（仅 tools.ts 内引用）；register=tools.ts 顶部 `import` 默认装载 |
| `VerifyPlanExecutionTool` | — | feature-gated | `tools.ts:91-106` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `WebBrowserTool` | — | feature-gated | `tools.ts:117-119` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
| `WebFetchTool` | ✓ | default | `tools/WebFetchTool/WebFetchTool.ts:1-319`, `tools.ts:11-11` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `WebSearchTool` | ✓ | default | `tools/WebSearchTool/WebSearchTool.ts:1-436`, `tools.ts:55-55` | family=tools/ 下有顶层同名目录；register=tools.ts 顶部 `import` 默认装载 |
| `WorkflowTool` | — | feature-gated | `tools.ts:129-149` | family=否（仅 tools.ts 内引用）；register=tools.ts 中 feature/env/coordinator 条件装载 |
