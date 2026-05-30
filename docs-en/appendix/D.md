# Appendix D · Built-in Agent Quick Reference

> Generator script: `scripts/gen-agents-table.ts`; source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`

**Primary table**: the source defines 6 built-in agents (located under `tools/AgentTool/built-in/`).

| id | whenToUse (verbatim from source, not truncated) | modelHint | defaultEnabled | Source |
|---|---|---|---|---|
| `claude-code-guide` | Use this agent when the user asks questions ("Can Claude...", "Does Claude...", "How do I...") about: (1) Claude Code (the CLI tool) - features, hooks, slash commands, MCP servers, settings, IDE integrations, keyboard shortcuts; (2) Claude Agent SDK - building custom agents; (3) Claude API (formerly Anthropic API) - API usage, tool use, Anthropic SDK usage. **IMPORTANT:** Before spawning a new agent, check if there is already a running or recently completed claude-code-guide agent that you can continue via ${SEND_MESSAGE_TOOL_NAME}. | `'haiku'` | false | `tools/AgentTool/built-in/claudeCodeGuideAgent.ts:98-205`, `tools/AgentTool/builtInAgents.ts:5-5` |
| `Explore` | Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns (eg. "src/components/**/*.tsx"), search code for keywords (eg. "API endpoints"), or answer questions about the codebase (eg. "how do API endpoints work?"). When calling this agent, specify the desired thoroughness level: "quick" for basic searches, "medium" for moderate exploration, or "very thorough" for comprehensive analysis across multiple locations and naming conventions. | `process.env.USER_TYPE === 'ant' ? 'inherit' : 'haiku'` | false | `tools/AgentTool/built-in/exploreAgent.ts:64-83`, `tools/AgentTool/builtInAgents.ts:6-6` |
| `general-purpose` | General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you. | `inherit-default` | true | `tools/AgentTool/built-in/generalPurposeAgent.ts:25-34`, `tools/AgentTool/builtInAgents.ts:7-7` |
| `Plan` | Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs. | `'inherit'` | false | `tools/AgentTool/built-in/planAgent.ts:73-92`, `tools/AgentTool/builtInAgents.ts:8-8` |
| `statusline-setup` | Use this agent to configure the user's Claude Code status line setting. | `'sonnet'` | true | `tools/AgentTool/built-in/statuslineSetup.ts:134-144`, `tools/AgentTool/builtInAgents.ts:9-9` |
| `verification` | Use this agent to verify that implementation work is correct before reporting completion. Invoke after non-trivial tasks (3+ file edits, backend/API changes, infrastructure changes). Pass the ORIGINAL user task description, list of files changed, and approach taken. The agent runs builds, tests, linters, and checks to produce a PASS/FAIL/PARTIAL verdict with evidence. | `'inherit'` | false | `tools/AgentTool/built-in/verificationAgent.ts:134-152`, `tools/AgentTool/builtInAgents.ts:10-10` |

**Secondary table** (the runtime-available set is governed by three kinds of variables; see `tools/AgentTool/builtInAgents.ts`):

| id | feature_flags | entrypoint_gated | coordinator_required |
|---|---|---|---|
| `claude-code-guide` | — | non-sdk | false |
| `Explore` | BUILTIN_EXPLORE_PLAN_AGENTS, tengu_amber_stoat | — | false |
| `general-purpose` | — | — | false |
| `Plan` | BUILTIN_EXPLORE_PLAN_AGENTS, tengu_amber_stoat | — | false |
| `statusline-setup` | — | — | false |
| `verification` | VERIFICATION_AGENT, tengu_hive_evidence | — | false |
