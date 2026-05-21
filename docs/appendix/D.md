# 附录 D · 内置 Agent 速查表

> 生成脚本：`scripts/gen-agents-table.ts`；source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`；生成于 2026-05-21T20:04:54.990Z

**正表**：源码定义 5 个内置 agent（位于 `tools/AgentTool/built-in/`）。

运行时可用集合受三类变量影响（见每行 notes）：
- `feature_flags`：来自 `utils/betas.ts` / `constants/betas.ts` / Growthbook 实验
- `entrypoint_gated`：CLI / SDK / MCP / Sandbox 入口差异
- `coordinator_required`：启用 `COORDINATOR_MODE` 时由 `coordinator/workerAgent.ts` 接管整个集合

| agentType | 来源文件 | feature_flags | notes |
|---|---|---|---|
| `Explore` | tools/AgentTool/built-in/exploreAgent.ts | — | coordinator_required=false |
| `general-purpose` | tools/AgentTool/built-in/generalPurposeAgent.ts | — | tools=*; coordinator_required=false |
| `Plan` | tools/AgentTool/built-in/planAgent.ts | — | model=inherit; coordinator_required=false |
| `statusline-setup` | tools/AgentTool/built-in/statuslineSetup.ts | — | tools=Read|Edit; model=sonnet; color=orange; coordinator_required=false |
| `verification` | tools/AgentTool/built-in/verificationAgent.ts | VERIFICATION_AGENT, tengu_hive_evidence | model=inherit; color=red; coordinator_required=false |
