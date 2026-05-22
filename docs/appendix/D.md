# 附录 D · 内置 Agent 速查表

> 生成脚本：`scripts/gen-agents-table.ts`；source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`

**正表**：源码定义 6 个内置 agent（位于 `tools/AgentTool/built-in/`）。

| id | displayName | modelHint | defaultEnabled | 来源 |
|---|---|---|---|---|
| `claude-code-guide` | Use this agent when the user asks questions ( | `'haiku'` | false | `tools/AgentTool/built-in/claudeCodeGuideAgent.ts:98-205`, `tools/AgentTool/builtInAgents.ts:5-5` |
| `Explore` | Explore | `process.env.USER_TYPE === 'ant' ? 'inherit' : 'haiku'` | false | `tools/AgentTool/built-in/exploreAgent.ts:64-83`, `tools/AgentTool/builtInAgents.ts:6-6` |
| `general-purpose` | General-purpose agent for researching complex questions, searching for code, and | `inherit-default` | true | `tools/AgentTool/built-in/generalPurposeAgent.ts:25-34`, `tools/AgentTool/builtInAgents.ts:7-7` |
| `Plan` | Software architect agent for designing implementation plans | `'inherit'` | false | `tools/AgentTool/built-in/planAgent.ts:73-92`, `tools/AgentTool/builtInAgents.ts:8-8` |
| `statusline-setup` | Use this agent to configure the user | `'sonnet'` | true | `tools/AgentTool/built-in/statuslineSetup.ts:134-144`, `tools/AgentTool/builtInAgents.ts:9-9` |
| `verification` | verification | `'inherit'` | false | `tools/AgentTool/built-in/verificationAgent.ts:134-152`, `tools/AgentTool/builtInAgents.ts:10-10` |

**副表**（运行时可用集合受三类变量影响，见 `tools/AgentTool/builtInAgents.ts`）：

| id | feature_flags | entrypoint_gated | coordinator_required |
|---|---|---|---|
| `claude-code-guide` | — | non-sdk | false |
| `Explore` | BUILTIN_EXPLORE_PLAN_AGENTS, tengu_amber_stoat | — | false |
| `general-purpose` | — | — | false |
| `Plan` | BUILTIN_EXPLORE_PLAN_AGENTS, tengu_amber_stoat | — | false |
| `statusline-setup` | — | — | false |
| `verification` | VERIFICATION_AGENT, tengu_hive_evidence | — | false |
