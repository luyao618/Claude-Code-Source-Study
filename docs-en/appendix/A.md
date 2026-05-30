# Appendix A · Tool Quick Reference

> Generator script: `scripts/gen-tool-table.ts`; source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`

Two orthogonal axes (family and register do not imply each other):
- **family**: whether a top-level directory of the same name exists under `tools/`. **40** family entries in total (excluding `shared/` and `testing/`), and **19** entries are only referenced inside `tools.ts`.
- **register**: how the tool is loaded in `tools.ts`.
  - `default`: loaded by a top-level `import` statement, **31** entries.
  - `feature-gated`: loaded conditionally via `feature(...)` / `process.env.*` / `getFeatureValue_*`, **19** entries.
  - `—`: no loading detected in `tools.ts` (mostly `family-only`: the directory under `tools/` exists, but at runtime the tool is injected separately by the coordinator or an SDK subset), **9** entries.

59 entries in total.

| Name | family | register | Source location (path:line-line) | Notes |
|---|---|---|---|---|
| `AgentTool` | ✓ | default | `tools/AgentTool/AgentTool.tsx:1-1398`, `tools.ts:3-3` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `AskUserQuestionTool` | ✓ | default | `tools/AskUserQuestionTool/AskUserQuestionTool.tsx:1-266`, `tools.ts:73-73` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `BashTool` | ✓ | default | `tools/BashTool/BashTool.tsx:1-1144`, `tools.ts:5-5` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `BriefTool` | ✓ | default | `tools/BriefTool/BriefTool.ts:1-205`, `tools.ts:13-13` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `ConfigTool` | ✓ | default | `tools/ConfigTool/ConfigTool.ts:1-468`, `tools.ts:81-81` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `CronCreateTool` | — | feature-gated | `tools.ts:29-35` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `CronDeleteTool` | — | feature-gated | `tools.ts:29-35` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `CronListTool` | — | feature-gated | `tools.ts:29-35` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `CtxInspectTool` | — | feature-gated | `tools.ts:110-112` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `EnterPlanModeTool` | ✓ | default | `tools/EnterPlanModeTool/EnterPlanModeTool.ts:1-127`, `tools.ts:78-78` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `EnterWorktreeTool` | ✓ | default | `tools/EnterWorktreeTool/EnterWorktreeTool.ts:1-128`, `tools.ts:79-79` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `ExitPlanModeTool` | ✓ | — | `tools/ExitPlanModeTool/prompt.ts:1-30` | family=top-level directory of the same name under tools/; register=no loading detected in tools.ts (likely injected separately by the coordinator or an SDK subset) |
| `ExitPlanModeV2Tool` | — | default | `tools.ts:57-57` | family=no (only referenced inside tools.ts); register=loaded by top-level `import` in tools.ts |
| `ExitWorktreeTool` | ✓ | default | `tools/ExitWorktreeTool/ExitWorktreeTool.ts:1-330`, `tools.ts:80-80` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `FileEditTool` | ✓ | default | `tools/FileEditTool/FileEditTool.ts:1-626`, `tools.ts:6-6` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `FileReadTool` | ✓ | default | `tools/FileReadTool/FileReadTool.ts:1-1184`, `tools.ts:7-7` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `FileWriteTool` | ✓ | default | `tools/FileWriteTool/FileWriteTool.ts:1-435`, `tools.ts:8-8` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `GlobTool` | ✓ | default | `tools/GlobTool/GlobTool.ts:1-199`, `tools.ts:9-9` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `GrepTool` | ✓ | default | `tools/GrepTool/GrepTool.ts:1-578`, `tools.ts:59-59` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `ListMcpResourcesTool` | ✓ | default | `tools/ListMcpResourcesTool/ListMcpResourcesTool.ts:1-124`, `tools.ts:75-75` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `ListPeersTool` | — | feature-gated | `tools.ts:126-128` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `LSPTool` | ✓ | default | `tools/LSPTool/LSPTool.ts:1-861`, `tools.ts:74-74` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `McpAuthTool` | ✓ | — | `tools/McpAuthTool/McpAuthTool.ts:1-216` | family=top-level directory of the same name under tools/; register=no loading detected in tools.ts (likely injected separately by the coordinator or an SDK subset) |
| `MCPTool` | ✓ | — | `tools/MCPTool/MCPTool.ts:1-78` | family=top-level directory of the same name under tools/; register=no loading detected in tools.ts (likely injected separately by the coordinator or an SDK subset) |
| `MonitorTool` | — | feature-gated | `tools.ts:39-41` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `NotebookEditTool` | ✓ | default | `tools/NotebookEditTool/NotebookEditTool.ts:1-491`, `tools.ts:10-10` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `OverflowTestTool` | — | feature-gated | `tools.ts:107-109` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `PowerShellTool` | ✓ | — | `tools/PowerShellTool/PowerShellTool.tsx:1-1001` | family=top-level directory of the same name under tools/; register=no loading detected in tools.ts (likely injected separately by the coordinator or an SDK subset) |
| `PushNotificationTool` | — | feature-gated | `tools.ts:45-49` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `ReadMcpResourceTool` | ✓ | default | `tools/ReadMcpResourceTool/ReadMcpResourceTool.ts:1-159`, `tools.ts:76-76` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `RemoteTriggerTool` | ✓ | feature-gated | `tools/RemoteTriggerTool/RemoteTriggerTool.ts:1-162`, `tools.ts:36-38` | family=top-level directory of the same name under tools/; register=conditionally loaded in tools.ts via feature/env/coordinator |
| `REPLTool` | ✓ | feature-gated | `tools/REPLTool/constants.ts:1-47`, `tools.ts:16-19` | family=top-level directory of the same name under tools/; register=conditionally loaded in tools.ts via feature/env/coordinator |
| `ScheduleCronTool` | ✓ | — | `tools/ScheduleCronTool/prompt.ts:1-136` | family=top-level directory of the same name under tools/; register=no loading detected in tools.ts (likely injected separately by the coordinator or an SDK subset) |
| `SendMessageTool` | ✓ | — | `tools/SendMessageTool/SendMessageTool.ts:1-918` | family=top-level directory of the same name under tools/; register=no loading detected in tools.ts (likely injected separately by the coordinator or an SDK subset) |
| `SendUserFileTool` | — | feature-gated | `tools.ts:42-44` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `SkillTool` | ✓ | default | `tools/SkillTool/SkillTool.ts:1-1109`, `tools.ts:4-4` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `SleepTool` | ✓ | feature-gated | `tools/SleepTool/prompt.ts:1-18`, `tools.ts:25-28` | family=top-level directory of the same name under tools/; register=conditionally loaded in tools.ts via feature/env/coordinator |
| `SnipTool` | — | feature-gated | `tools.ts:123-125` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `SubscribePRTool` | — | feature-gated | `tools.ts:50-62` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `SuggestBackgroundPRTool` | — | feature-gated | `tools.ts:20-24` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `SyntheticOutputTool` | ✓ | — | `tools/SyntheticOutputTool/SyntheticOutputTool.ts:1-164` | family=top-level directory of the same name under tools/; register=no loading detected in tools.ts (likely injected separately by the coordinator or an SDK subset) |
| `TaskCreateTool` | ✓ | default | `tools/TaskCreateTool/TaskCreateTool.ts:1-139`, `tools.ts:82-82` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `TaskGetTool` | ✓ | default | `tools/TaskGetTool/TaskGetTool.ts:1-129`, `tools.ts:83-83` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `TaskListTool` | ✓ | default | `tools/TaskListTool/TaskListTool.ts:1-117`, `tools.ts:85-85` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `TaskOutputTool` | ✓ | default | `tools/TaskOutputTool/TaskOutputTool.tsx:1-584`, `tools.ts:54-54` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `TaskStopTool` | ✓ | default | `tools/TaskStopTool/TaskStopTool.ts:1-132`, `tools.ts:12-12` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `TaskUpdateTool` | ✓ | default | `tools/TaskUpdateTool/TaskUpdateTool.ts:1-407`, `tools.ts:84-84` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `TeamCreateTool` | ✓ | — | `tools/TeamCreateTool/TeamCreateTool.ts:1-241` | family=top-level directory of the same name under tools/; register=no loading detected in tools.ts (likely injected separately by the coordinator or an SDK subset) |
| `TeamDeleteTool` | ✓ | — | `tools/TeamDeleteTool/TeamDeleteTool.ts:1-140` | family=top-level directory of the same name under tools/; register=no loading detected in tools.ts (likely injected separately by the coordinator or an SDK subset) |
| `TerminalCaptureTool` | — | feature-gated | `tools.ts:113-116` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `TestingPermissionTool` | — | default | `tools.ts:58-58` | family=no (only referenced inside tools.ts); register=loaded by top-level `import` in tools.ts |
| `TodoWriteTool` | ✓ | default | `tools/TodoWriteTool/TodoWriteTool.ts:1-116`, `tools.ts:56-56` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `ToolSearchTool` | ✓ | default | `tools/ToolSearchTool/ToolSearchTool.ts:1-472`, `tools.ts:77-77` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `TungstenTool` | — | default | `tools.ts:60-60` | family=no (only referenced inside tools.ts); register=loaded by top-level `import` in tools.ts |
| `VerifyPlanExecutionTool` | — | feature-gated | `tools.ts:91-106` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `WebBrowserTool` | — | feature-gated | `tools.ts:117-119` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
| `WebFetchTool` | ✓ | default | `tools/WebFetchTool/WebFetchTool.ts:1-319`, `tools.ts:11-11` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `WebSearchTool` | ✓ | default | `tools/WebSearchTool/WebSearchTool.ts:1-436`, `tools.ts:55-55` | family=top-level directory of the same name under tools/; register=loaded by top-level `import` in tools.ts |
| `WorkflowTool` | — | feature-gated | `tools.ts:129-149` | family=no (only referenced inside tools.ts); register=conditionally loaded in tools.ts via feature/env/coordinator |
