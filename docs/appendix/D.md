# 附录 D · 内置 Agent 速查表

> source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`
> generated_at: `2026-05-21T16:18:51.893Z`
> 共 6 个源码定义的 built-in agent

本表只列「源码定义」的 Agent；运行时是否启用受 feature flag / entrypoint / coordinator 影响——见 `gates` 列。正文 §C15 必须声明这一两段式（spec §7.5）。

| agentType (or symbol) | source_file | gates (feature/entry/coord) | notes |
|---|---|---|---|
| `CLAUDE_CODE_GUIDE_AGENT_TYPE` | tools/AgentTool/built-in/claudeCodeGuideAgent.ts:100 | — | model=haiku |
| `Explore` | tools/AgentTool/built-in/exploreAgent.ts:66 | — | model=process.env.USER_TYPE === 'ant' ? 'inherit' : 'haiku' |
| `general-purpose` | tools/AgentTool/built-in/generalPurposeAgent.ts:27 | — | tools=['*'] |
| `Plan` | tools/AgentTool/built-in/planAgent.ts:75 | — | model=inherit |
| `statusline-setup` | tools/AgentTool/built-in/statuslineSetup.ts:136 | — | model=sonnet; tools=['Read', 'Edit'] |
| `verification` | tools/AgentTool/built-in/verificationAgent.ts:136 | — | model=inherit |
