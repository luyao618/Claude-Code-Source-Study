---
title: V2 修订说明文档（Source Code Study, v2 Revision Spec）
source_commit: 290fdc9481a70612bc5823aa4ed225c52c52aad3
status: approved-by-yao
authoring: CC-Dev (Claude Opus 4.7), reviewed by OC-PM, cross-evaluated by CX-Dev, baseline drafts from OC-Dev / CC-Dev
---

# 《深入 Claude Code 源码》v2 修订说明

## 1. 引言：为什么写 v2

v1 由 **Claude Opus 4.6** 深扫 Claude Code 源码、**ChatGPT 5.4** 担任 reviewer 共同产出，最终交付 **25 篇**源码解析学习交流文章，构成本仓库 `docs/00-…25-` 的初版书稿。在 v1 发布后，Claude Code 源码本身仍在快速演进：新增了 Bridge IPC、Remote Session、Coordinator、Settings Migration、DirectConnect、Buddy、Output Style、Vim/Voice 等多个一级模块；同时 v1 中存在若干与当前源码不再吻合的数字与结构性表述。

v2 由 **Claude Opus 4.7** 重新深扫源码、**ChatGPT 5.5** 担任 reviewer，**对原 25 篇逐篇做事实勘误与必要的迭代重写**，并**新增 8 篇全新文章**：

- **C04** 配置迁移即代码（Migrations）
- **C13** 通信、调度、问询与合成工具
- **C17** Coordinator、Cron 与定时调度
- **C24** Bridge IPC 与远程会话
- **C25** DirectConnect 与上游代理
- **C28** Keybindings、Vim 模式与 Voice 输入
- **C29** Buddy 人格
- **C30** Doctor 屏与 Output Style 体验

> 关于"8 篇 vs 7 章"的口径：v2 提案早期将 Buddy / Doctor / OutputStyle UX 合并为 1 章（C29）；OC-PM 在 review 中建议异质性高，应拆为 C29 Buddy + C30 Doctor+OutputStyle UX，故最终新增章节数为 **8 篇**，整书章节数从 33 增至 **34**。

v2 的另一项核心改动是**全书架构重组**：v1 按"模块树"平铺组织（工具一章、命令一章、Agent 一章……），读者需要自行拼合"一次会话从启动到产出的完整链路"。v2 改以**运行期生命周期**为主线（进入软件之前 → 一次回合的内核 → 工具家族 → Agent/任务/协调 → 协议安全与扩展 → 网络与远程 → 终端 UI 与多模态输入 → 记忆/扩展/总结），并保留模块树视角作为**附录 F 的反查矩阵**，兼顾阅读流畅性与源码导览性。

## 2. 文档目的

本文档是 v2 修订工作的**根 spec**，承担两个目的：

1. **驱动后续 issue 拆分**：v2 写作不在本文档内进行；本文档将作为后续每一个章节 issue 的输入，由 OC-PM 据此产出每章 spec 三件套（章节 spec / 章节正文 issue / fact-check checklist），逐章并行编纂。
2. **沉淀 v1→v2 的修订全貌**：读者据本文档可在不读 v2 全书的前提下，了解 v1 25 篇每篇的去向、判定（保留 / 勘误保留 / 迭代重写 / 拆分合并）、修订工作量级，以及 v2 新增章节的源码依据。

## 3. v2 架构总览

| 维度 | v1 | v2 |
|---|---|---|
| 篇（Part） | 平铺无篇 | **8 篇**（按运行期生命周期） |
| 章（Chapter） | 25 章（含目录） | **34 章** |
| 附录 | 无 | **6 份**（A 工具 / B 命令 / C hooks / D agents / E TaskType / F 模块×章节双向矩阵） |
| 写作公约 | 无 | **§0 四公约**（强制） |
| CI 校验 | 无 | **3 项脚本**（source_commit 一致性 / 程度副词禁词 / manifest diff & 孤儿目录） |

### 8 篇骨架表

| 篇 | 标题 | 含章 | 章数 |
|---|---|---|---|
| 第一篇 | 进入软件之前 | C01–C04 | 4 |
| 第二篇 | 一次回合的内核 | C05–C09 | 5 |
| 第三篇 | 工具家族 | C10–C13 | 4 |
| 第四篇 | Agent、任务与协调 | C14–C17 | 4 |
| 第五篇 | 协议、安全与扩展接口 | C18–C22 | 5 |
| 第六篇 | 网络层与远程协作（v1 完全空白） | C23–C25 | 3 |
| 第七篇 | 终端 UI 与多模态输入 | C26–C30 | 5 |
| 第八篇 | 记忆、扩展与总结 | C31–C34 | 4 |
| **合计** | — | C01–C34 | **34** |

## 4. §0 写作公约（强制，正文每章顶部必须遵守）

§0 是 v2 反幻觉的硬性卡尺，每一篇正文章节的顶部必须包含「源码锚点」结构化前言，并遵循下列四条规则；任一违反会被 CI 阻塞合并。

### §0.1 源码锚点结构化前言（强制）

每篇文章正文起始处必须包含：

```
## 源码锚点
- 主入口：<相对路径>:<起止行>          # 例：query.ts:1-1729
- 关键类型：<TypeName>                  # 例：QueryRequest, TaskType
- 关键函数：<fnName>(file:line-line)    # 例：query(query.ts:412-680)
- 数字来源：<命令或脚本> @ <commit-sha> # 例：scripts/gen-tool-table.ts @ 7f3ac1
- 源码版本：<commit-sha>                # 全章一次性指定
```

### §0.2 数字与引用强制可复算

- 文中任何"X 行 / X 个 / X 种"必须能通过"数字来源"指定的脚本或命令复算；
- 不得直接抄录 v1 的旧数字，必须重新对齐当前 commit；
- 关键类型 / 函数 / 字段引用必须给"文件:行号"；只给目录的引用视为不合格。

### §0.3 source_commit 冻结与 CI 校验（强制）

- 每章 spec 启动时，writer 必须在章节头声明 `source_commit: <sha>`，**冻结**当章引用的源码版本；
- 章节内任何行号引用必须能在该 commit 上 `git blame` 复核；
- 附录脚本生成 manifest 时写入 `source_commit`；正文与 manifest 引用必须**指向同一 commit**；
- CI 强制：`scripts/check-source-commits.ts` 扫描章节头 + 附录 manifest，commit 不一致 → **fail**；
- 章节升级 commit 必须开 PR 集中处理（不允许逐字漂移），PR 描述含变更摘要。

### §0.4 程度副词禁词（事实段落，强制）

- "源码锚点"以下的描述性段落（事实段）**禁词**：
  ```
  约 / 大概 / 左右 / 大量 / 不少 / 主要 / 大部分 / 几乎 / 很多 / 一些
  ```
- 反例：「`query.ts` **大概** 1700 行，包含**主要**对话逻辑」← 违反；
- 正例：「`query.ts` 1729 行（commit 7f3ac1），包含 `query()` 主循环（行 412–680）」← 合规；
- 例外：仅允许出现在"导言/总结/比喻段"，且不得携带数字或事实断言；
- 运行时可用类陈述必须列出依赖变量（feature flag / entrypoint / coordinator），不得给单一具体数字；
- CI 强制：`scripts/lint-no-fuzzy-quantifiers.ts` 在事实段落正则扫禁词 → **fail**。

## 5. 34 章详表

> 列含义：编号 / 标题 / 主入口锚点 / 定位 / v1 来源 / 工作量级（S ≤ 1d · M = 2–4d · L ≥ 1w）/ 是否新增。

### 第一篇 · 进入软件之前

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C01 | 项目全景与四种入口形态 | `entrypoints/{cli.tsx, sdk/, mcp.ts, sandboxTypes.ts, agentSdkTypes.ts, init.ts}` | 重画依赖图，囊括 v1 漏掉的 12 个新模块；解释「同一份源码 = CLI + SDK + MCP server + Sandbox runner」 | v1-01 | L | 否（迭代重写） |
| C02 | 启动链路与冷启动优化 | `cli.tsx`、`main.tsx`、`screens/REPL.tsx`、`bundledMode.ts` | 保留 v1-02 主体；补 `entrypoints/init.ts` SDK 初始化 + bundled vs dev 双模式 | v1-02 | S | 否（勘误保留） |
| C03 | 配置体系与企业 MDM | `services/{remoteManagedSettings, settingsSync, policyLimits}/`、`utils/cliArgs.ts` | 把 v1 "5+1 层" 扩为 7 维度（local / user / project / enterprise-MDM / remote-managed / policyLimits / migration），叙述合并顺序 | v1-17 §1–4 | L | 否（拆分合并） |
| **C04** | **配置迁移即代码** | `migrations/`（11 文件） | 全新章；Settings schema、模型重命名（fennec→opus, opus→opus1m, sonnet1m→45→46）、replBridge→remoteControl 全演化史 | — | M | **是** |

### 第二篇 · 一次回合的内核

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C05 | QueryEngine 与对话主循环 | `QueryEngine.ts:1-1295`、`query.ts:1-1729`、`query/{config,deps,stopHooks,tokenBudget}.ts` | 「门面 QueryEngine + 内核 query + 4 子模块」分层 | v1-05 | L | 否（迭代重写） |
| C06 | System Prompt 与 Output Style 注入 | `constants/{prompts.ts:1-914, systemPromptSections.ts}`、`outputStyles/loadOutputStylesDir.ts` | 保留 v1-04；补 systemPromptSections + output style 注入 | v1-04 | S | 否（勘误保留） |
| C07 | 上下文压缩家族 | `services/compact/`（11 文件，含 autoCompact / microCompact / apiMicrocompact / sessionMemoryCompact / timeBasedMCConfig / postCompactCleanup） | 6 条压缩链路并列展开 | v1-06 | M | 否（迭代重写） |
| C08 | Prompt Cache 横切 | `services/api/promptCacheBreakDetection.ts` 等注入点 | 保留 v1-07；勘误 cache_control 注入点行号 | v1-07 | S | 否（勘误保留） |
| C09 | Thinking、Effort 与 Advisor | `commands/effort/`、`commands/thinkback*/`、`commands/advisor.ts`、`services/PromptSuggestion/` | 保留 v1-08；整合 advisor + PromptSuggestion | v1-08 | S | 否（勘误保留） |

### 第三篇 · 工具家族

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C10 | 工具协议、注册与 ToolSearch | `Tool.ts:1-792`、`tools.ts`、`tools/shared/`、`tools/utils.ts`、`tools/ToolSearchTool/` | 按附录 A "family / runtime leaf / feature-gated" 三列模型组织（不再裸写 42/43） | v1-09 §1–3 | L | 否（拆分合并） |
| C11 | BashTool / PowerShellTool 双 shell | `tools/BashTool/`（18 文件 / 12,411 行）、`tools/PowerShellTool/` | 保留 v1-10 BashTool 主体；PowerShellTool 作 Windows 路径对照 | v1-10 | S | 否（保留） |
| C12 | 文件、代码与 LSP 协作族 | `tools/{FileRead, FileWrite, FileEdit, NotebookEdit, Glob, Grep, LSPTool, REPLTool}/`、`services/lsp/`（7 文件） | LSPTool ↔ LSPClient/LSPDiagnosticRegistry/LSPServerManager | v1-09 §4–5 | M | 否（拆分合并） |
| **C13** | **通信、调度、问询与合成工具** | `tools/{WebFetchTool, WebSearchTool, ScheduleCronTool, RemoteTriggerTool, SendMessageTool, SleepTool, AskUserQuestionTool, SyntheticOutputTool, BriefTool, ConfigTool}/` | 全新章；"对话外的调度与通信"工具集 | — | M | **是** |

### 第四篇 · Agent、任务与协调

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C14 | Agent 系统与 Sub-Agent 调用 | `tools/AgentTool/`、`services/AgentSummary/`、`commands/agents/` | 保留 v1-12；并入 AgentSummary | v1-12 | S | 否（勘误保留） |
| C15 | 内置 Agent 设计模式 | 内置 agent prompt 文件清单（详见附录 D） | 区分"源码定义 6 个" vs "运行时可用集合"（受 feature flag / SDK / coordinator 影响） | v1-13 | M | 否（迭代重写） |
| C16 | 任务模型与 TaskType 谱系 | `Task.ts:1-125`、`tasks.ts:1-39`、`tasks/{DreamTask, InProcessTeammateTask, LocalAgentTask, LocalMainSessionTask, LocalShellTask, RemoteAgentTask}.ts`、6 个 `tools/Task*Tool/` | **7 个 wire TaskType**（local_bash / local_agent / remote_agent / in_process_teammate / local_workflow / monitor_mcp / dream）= 4 默认注册 + 2 feature-gated（local_workflow, monitor_mcp）+ 1 in-process 特例（in_process_teammate） | v1-14 | L | 否（迭代重写） |
| **C17** | **Coordinator、Cron 与定时调度** | `coordinator/coordinatorMode.ts`、`tools/ScheduleCronTool/`（family → CronCreate/CronDelete/CronList 三 leaf）、`hooks/useScheduledTasks.ts` | 全新章；多 Agent 编排层 + 定时触发 | — | M | **是** |

### 第五篇 · 协议、安全与扩展接口

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C18 | MCP 协议实现 | `services/mcp/`（23 文件，含 SdkControlTransport / channelAllowlist / channelPermissions）、`tools/{MCPTool, McpAuthTool, ListMcpResourcesTool, ReadMcpResourceTool}/` | 保留 v1-15；补 SdkControlTransport 与 channel* | v1-15 | S | 否（勘误保留） |
| C19 | 权限系统与远程权限回灌 | `Tool.ts`(needsPermission)、`hooks/toolPermission/{PermissionContext, handlers/}`、`bridge/bridgePermissionCallbacks.ts`、`remote/remotePermissionBridge.ts` | 新增"远程会话权限回灌"小节 | v1-16 | M | 否（迭代重写） |
| C20 | Hooks 系统 | `schemas/hooks.ts`（HOOK_EVENTS 27 个）、`hooks/notifs/`（16 文件）、`hooks/toolPermission/handlers/`、`query/stopHooks.ts:1-473` | 保留 27 事件 / 4 hook command 类型（command/prompt/http/agent），补 stopHooks 与 notifs 路径 | v1-18 | M | 否（迭代重写） |
| C21 | Skill / Plugin / Output Style 三扩展点 | `skills/{bundled, bundledSkills, loadSkillsDir, mcpSkillBuilders}/`、`services/plugins/`、`plugins/{builtinPlugins, bundled/}`、`outputStyles/loadOutputStylesDir.ts` | 整合 v1-24；output style 作为第三条扩展路径 | v1-24 | M | 否（勘误保留） |
| C22 | Feature Flag 与编译期优化 | `utils/betas.ts`、`constants/betas.ts`、`bundledMode.ts` | 保留 v1-19 | v1-19 | S | 否（保留） |

### 第六篇 · 网络层与远程协作（v1 完全空白）

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C23 | 客户端传输与 API 重试 | `services/api/`（20 文件）、`cli/transports/{HybridTransport, SSETransport, WebSocketTransport, SerialBatchEventUploader, WorkerStateUploader, ccrClient}.ts` | 补客户端传输层（v1 完全没提）+ withRetry | v1-20 §1–3 | L | 否（拆分合并） |
| **C24** | **Bridge IPC 与远程会话** | `bridge/`（31 文件）、`remote/{RemoteSessionManager, SessionsWebSocket, sdkMessageAdapter, remotePermissionBridge}.ts`、`commands/{bridge/, remote-setup/, remote-env/}` | 全新章；手机/Web/Desktop 控制本地 CLI session 全链路。涉及法律/合规风险时降级为接口层视角并标注原因 | — | L | **是** |
| **C25** | **DirectConnect 与上游代理** | `server/{directConnectManager, createDirectConnectSession, types}.ts`、`upstreamproxy/{relay, upstreamproxy}.ts`、`hooks/useDirectConnect.ts` | 全新章；企业代理/内网拓扑。同上法律/合规风险标注适用 | v1-20 §4（片段） | M | **是** |

### 第七篇 · 终端 UI 与多模态输入

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C26 | Ink 框架深度定制 | `ink/`（96 文件 / 19,842 行）、`native-ts/{yoga-layout, color-diff, file-index}` | 新增原生 TS 加速一节 | v1-21 | M | 否（迭代重写） |
| C27 | 组件与设计系统 | `components/`（144 文件）、`components/design-system/`（10 文件） | 保留 v1-22 | v1-22 | S | 否（保留） |
| **C28** | **Keybindings、Vim 模式与 Voice 输入** | `keybindings/`（14 文件）、`vim/{motions, operators, textObjects, transitions, types}.ts`、`voice/voiceModeEnabled.ts`、`services/voice*`、`hooks/{useVoice, useVoiceEnabled, useVoiceIntegration, useVimInput}.ts`、`commands/{vim, voice, keybindings}/` | 全新章；"在终端里复刻一台编辑器"的输入层 | — | L | **是** |
| **C29** | **Buddy 人格** | `buddy/`（CompanionSprite / companion / prompt / sprites / useBuddyNotification） | 全新章；人格化伙伴模块 | — | M | **是** |
| **C30** | **Doctor 屏与 Output Style 体验** | `screens/{Doctor, REPL, ResumeConversation}.tsx`、`outputStyles/`、`commands/{output-style, doctor}/` | 全新章；诊断屏 + 输出风格用户体验呈现（与 C21 扩展机制视角互补） | — | M | **是** |

### 第八篇 · 记忆、扩展与总结

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C31 | Memory 子系统全景 | `memdir/`（8 文件）、`services/{SessionMemory, extractMemories, teamMemorySync}/`、`assistant/sessionHistory.ts` | 按"会话级 / 项目级 / 团队级 / 长期"四维度重画 | v1-23 | M | 否（迭代重写） |
| C32 | 命令系统全景 | `commands.ts:1-754`、`commands/`（86 个一级目录 + 15 个一级文件 = 101 个一级条目，总 207 文件） | 不裸写 runtime command 数，按附录 B 脚本输出引用 | v1-11 | M | 否（迭代重写） |
| C33 | 状态管理与跨进程桥 | `state/`（6 文件）、`bridge/bridgePointer.ts` | 保留 v1-03；补 bridgePointer 跨进程暴露 | v1-03 | S | 否（勘误保留） |
| C34 | 架构模式总结 v2 | （横切） | 保留 v1-25；新增 4 个 v2 模式：Bridge IPC / Coordinator-Agent / Migration-as-Code / Output-Style-as-Plugin | v1-25 | S | 否（勘误保留） |

**判定分布**：保留 3 / 勘误保留 11 / 迭代重写 9 / 拆分合并 3 / 全新增 8 = 34 章。
**工作量分布**：L 7 章 / M 14 章 / S 13 章。

## 6. v1 ↔ v2 双向迁移矩阵

### 6.1 正向矩阵（v1 25 篇 → v2 去向）

| v1 # | v1 标题 | 判定 | 工作量 | v2 去向 | 关键差异 |
|---|---|---|---|---|---|
| 00 | 目录与阅读指引 | 迭代重写 | S | 新前言（不进章节） | 加入 §0 公约 |
| 01 | 项目全景 | 迭代重写 | L | C01 | 12 个新模块入图 |
| 02 | 启动优化 | 勘误保留 | S | C02 | + entrypoints/init + bundledMode |
| 03 | 状态管理 | 勘误保留 | S | C33 | + bridgePointer |
| 04 | System Prompt 工程 | 勘误保留 | S | C06 | + systemPromptSections |
| 05 | 对话循环 | 迭代重写 | L | C05 | 门面 + 内核 + 4 子模块 |
| 06 | 上下文管理 | 迭代重写 | M | C07 | 6 条压缩链路 |
| 07 | Prompt Cache | 勘误保留 | S | C08 | 注入点行号 |
| 08 | Thinking 与推理控制 | 勘误保留 | S | C09 | + advisor + PromptSuggestion |
| 09 | 工具系统设计 | 拆分合并 | L | C10 主 + C11/C12/C13 | 工具数三列模型 |
| 10 | BashTool 深度剖析 | 保留 | S | C11 | 数字勘误 |
| 11 | 命令系统 | 迭代重写 | M | C32 | 86+15=101 一级条目 |
| 12 | Agent 系统 | 勘误保留 | S | C14 | + AgentSummary |
| 13 | 内置 Agent 设计模式 | 迭代重写 | M | C15 | 源码定义 vs 运行时 |
| 14 | 任务系统 | 迭代重写 | L | C16 | 7 wire / 4+2+1 |
| 15 | MCP 协议实现 | 勘误保留 | S | C18 | 23 文件 + SdkControlTransport |
| 16 | 权限系统 | 迭代重写 | M | C19 | + 远程权限回灌 |
| 17 | Settings 系统 | 拆分合并 | L | C03 + C04 | 7 维度 + Migrations 独立 |
| 18 | Hooks 系统 | 迭代重写 | M | C20 | 27 事件 + stopHooks + notifs |
| 19 | Feature Flag | 保留 | S | C22 | — |
| 20 | API 调用与错误恢复 | 拆分合并 | L | C23 + C25 | + 客户端传输层 |
| 21 | Ink 框架深度定制 | 迭代重写 | M | C26 | 96 文件 + native-ts |
| 22 | 设计系统 | 保留 | S | C27 | — |
| 23 | Memory 系统 | 迭代重写 | M | C31 | memdir + 三服务 |
| 24 | Skill/Plugin 开发实战 | 勘误保留 | M | C21 | + Output Style |
| 25 | 架构模式总结 | 勘误保留 | S | C34 | + 4 个 v2 新模式 |

### 6.2 反向矩阵（v2 34 章 → v1 来源 + 源码一级目录 + 全新增比例）

| v2 # | 标题 | 来自 v1 | 来自源码（一级目录） | 全新增比例 |
|---|---|---|---|---|
| C01 | 项目全景与四种入口形态 | v1-01 全章 | entrypoints/, bridge/, remote/, coordinator/, buddy/, upstreamproxy/, server/, migrations/, native-ts/, screens/, outputStyles/, memdir/, assistant/, schemas/ | 40% |
| C02 | 启动链路与冷启动优化 | v1-02 全章 | entrypoints/init.ts, bundledMode.ts | 10% |
| C03 | 配置体系与企业 MDM | v1-17 §1–4 | services/{remoteManagedSettings, settingsSync, policyLimits}/ | 30% |
| C04 | 配置迁移即代码 | — | migrations/（11 文件） | 100% |
| C05 | QueryEngine 与对话主循环 | v1-05 全章 | QueryEngine.ts, query.ts, query/{config,deps,stopHooks,tokenBudget}.ts | 30% |
| C06 | System Prompt 与 Output Style 注入 | v1-04 全章 | constants/{prompts,systemPromptSections}.ts, outputStyles/ | 15% |
| C07 | 上下文压缩家族 | v1-06 §3–5 | services/compact/ | 50% |
| C08 | Prompt Cache 横切 | v1-07 全章 | services/api/promptCacheBreakDetection.ts | 10% |
| C09 | Thinking、Effort 与 Advisor | v1-08 全章 | commands/effort/, commands/thinkback*/, services/PromptSuggestion/ | 15% |
| C10 | 工具协议、注册与 ToolSearch | v1-09 §1–3 | Tool.ts, tools.ts, tools/shared/, tools/ToolSearchTool/ | 30% |
| C11 | BashTool / PowerShellTool 双 shell | v1-10 全章 | tools/{BashTool, PowerShellTool}/ | 15% |
| C12 | 文件、代码与 LSP 协作族 | v1-09 §4–5 | tools/{FileRead,FileWrite,FileEdit,NotebookEdit,Glob,Grep,LSPTool,REPLTool}/, services/lsp/ | 50% |
| C13 | 通信、调度、问询与合成工具 | — | tools/{WebFetchTool,WebSearchTool,ScheduleCronTool,RemoteTriggerTool,SendMessageTool,SleepTool,AskUserQuestionTool,SyntheticOutputTool,BriefTool,ConfigTool}/ | 100% |
| C14 | Agent 系统与 Sub-Agent 调用 | v1-12 全章 | tools/AgentTool/, services/AgentSummary/, commands/agents/ | 15% |
| C15 | 内置 Agent 设计模式 | v1-13 全章 | （详见附录 D） | 30% |
| C16 | 任务模型与 TaskType 谱系 | v1-14 全章 | Task.ts, tasks.ts, tasks/, tools/Task*Tool/ | 50% |
| C17 | Coordinator、Cron 与定时调度 | — | coordinator/, tools/ScheduleCronTool/, hooks/useScheduledTasks.ts | 100% |
| C18 | MCP 协议实现 | v1-15 全章 | services/mcp/, tools/{MCPTool,McpAuthTool,ListMcpResourcesTool,ReadMcpResourceTool}/ | 15% |
| C19 | 权限系统与远程权限回灌 | v1-16 全章 | Tool.ts(needsPermission), hooks/toolPermission/, bridge/bridgePermissionCallbacks.ts, remote/remotePermissionBridge.ts | 30% |
| C20 | Hooks 系统 | v1-18 全章 | schemas/hooks.ts, hooks/notifs/, hooks/toolPermission/, query/stopHooks.ts | 30% |
| C21 | Skill / Plugin / Output Style 三扩展点 | v1-24 全章 | skills/, services/plugins/, plugins/, outputStyles/ | 25% |
| C22 | Feature Flag 与编译期优化 | v1-19 全章 | utils/betas.ts, constants/betas.ts, bundledMode.ts | 5% |
| C23 | 客户端传输与 API 重试 | v1-20 §1–3 | services/api/, cli/transports/ | 50% |
| C24 | Bridge IPC 与远程会话 | — | bridge/, remote/, commands/{bridge,remote-*}/ | 100% |
| C25 | DirectConnect 与上游代理 | v1-20 §4（片段） | server/, upstreamproxy/, hooks/useDirectConnect.ts | 90% |
| C26 | Ink 框架深度定制 | v1-21 全章 | ink/, native-ts/{yoga-layout,color-diff,file-index} | 25% |
| C27 | 组件与设计系统 | v1-22 全章 | components/, components/design-system/ | 5% |
| C28 | Keybindings、Vim、Voice 输入 | — | keybindings/, vim/, voice/, services/voice*, hooks/useVim*, hooks/useVoice* | 100% |
| C29 | Buddy 人格 | — | buddy/ | 100% |
| C30 | Doctor 屏与 Output Style UX | — | screens/{Doctor,REPL,ResumeConversation}.tsx, outputStyles/, commands/{output-style,doctor}/ | 100% |
| C31 | Memory 子系统全景 | v1-23 全章 | memdir/, services/{SessionMemory,extractMemories,teamMemorySync}/, assistant/sessionHistory.ts | 40% |
| C32 | 命令系统全景 | v1-11 全章 | commands.ts, commands/ | 30% |
| C33 | 状态管理与跨进程桥 | v1-03 全章 | state/, bridge/bridgePointer.ts | 10% |
| C34 | 架构模式总结 v2 | v1-25 全章 | （横切） | 20% |

## 7. 6 个附录脚本与 CI 校验契约

### 7.1 附录清单

| 附录 | 内容 | 生成脚本 |
|---|---|---|
| 附录 A | 工具速查表（family / runtime leaf / feature-gated 三列） | `scripts/gen-tool-table.ts` |
| 附录 B | Commands 速查表（一级目录 / 一级文件 / runtime 命令） | `scripts/gen-commands-table.ts` |
| 附录 C | Hooks 事件表（HOOK_EVENTS 27 + hook command 4 类） | `scripts/gen-hooks-table.ts` |
| 附录 D | 内置 Agent 速查表（源码定义 vs 运行时可用） | `scripts/gen-agents-table.ts` |
| 附录 E | TaskType 谱系（7 wire / 4 默认 / 2 feature-gated / 1 特例） | `scripts/gen-tasktypes-table.ts` |
| 附录 F | 模块 × 章节双向矩阵 + 孤儿目录 | `scripts/gen-module-matrix.ts` |

### 7.2 脚本归属路径（仓库布局）

尧哥已拍板：v2 修订**直接在 `docs/` 原地修订**，不开 `docs-v2/` 新目录。脚本与附录归属如下：

```
<repo-root>/
├── docs/
│   ├── 00-…25-*.md                 # v1 原稿（v1 备份分支已保留，可在主线持续覆盖修订）
│   ├── V2-REVISION-SPEC.md         # 本文档
│   └── appendix/
│       ├── A.md / A.manifest.json
│       ├── B.md / B.manifest.json
│       ├── C.md / C.manifest.json
│       ├── D.md / D.manifest.json
│       ├── E.md / E.manifest.json
│       └── F.md / F.manifest.json
└── scripts/
    ├── gen-tool-table.ts            # 附录 A
    ├── gen-commands-table.ts        # 附录 B
    ├── gen-hooks-table.ts           # 附录 C
    ├── gen-agents-table.ts          # 附录 D
    ├── gen-tasktypes-table.ts       # 附录 E
    ├── gen-module-matrix.ts         # 附录 F（双向 + 孤儿）
    ├── check-source-commits.ts      # §0.3 CI
    └── lint-no-fuzzy-quantifiers.ts # §0.4 CI
```

每个生成脚本输出双产物：`docs/appendix/{A..F}.md`（正文引用）+ `docs/appendix/{A..F}.manifest.json`（CI 校验依据）。

### 7.3 manifest JSON 字段约定

```ts
{
  "generated_at": "<ISO-8601>",
  "source_commit": "<sha>",
  "items": [
    {
      "name": "<canonical-id>",
      "category": "<family|leaf|feature-gated|...>",
      "source_files": ["path:line-line", ...],
      "feature_flags": ["..."],     // 可选
      "wire_type": "...",            // 仅 TaskType / Hooks
      "default_registered": true,    // 仅 TaskType
      "notes": "..."
    }
  ]
}
```

### 7.4 CI 失败语义

- **fail（阻塞 PR 合并）**：source_commit 不一致 / 程度副词命中 / manifest 与源码 diff 非空 / 孤儿目录列表非空。
- **PR 描述强制**：含 `manifest diff 摘要`（脚本提供 `--diff-summary` flag）。
- **warn 仅限**：章节字数超出预估区间（不阻塞，二次审拆分参考）。

### 7.5 附录 D（内置 Agent）枚举逻辑

附录 D 不试图穷举"运行时可用集合"（feature flag × entrypoint × coordinator 组合爆炸），采用两段式：

1. **正表（CI 校验）**：列出**源码定义**的所有 Agent prompt 文件 + 关键字段（`id`, `displayName`, `modelHint`, `defaultEnabled`）。脚本扫描 `agents/`、`services/AgentSummary/` 等的 prompt 定义文件即可枚举。
2. **副表（notes 列）**：每个 Agent 标注其受**哪些**变量影响：
   - `feature_flags: [...]`（来自 `utils/betas.ts` / `constants/betas.ts`）
   - `entrypoint_gated: [cli|sdk|mcp|sandbox|*]`
   - `coordinator_required: bool`

   读者据 notes 自行推断运行时集合。

### 7.6 附录 F 孤儿目录反向校验

`gen-module-matrix.ts` 增加 `--check-orphans`：扫源码所有一级目录与"v2 章节覆盖目录集合"做差集；非空 → **fail**。例外白名单 `scripts/orphan-allowlist.txt`，每条带注释。

## 8. 仓库布局与释出节奏

### 8.1 仓库布局（尧哥已拍板）

- v1 修订**直接在 `docs/` 原地进行**（不开 `docs-v2/`）；
- 既有 v1 文章按 §6.1 的迁移矩阵逐篇覆盖修订，编号会变（v1 的 `03-状态管理.md` 对应 v2 的 C33 等）；
- v1 25 篇原稿在 `docs-v1-archive` 分支保留为只读备份（已就位）；
- 主线 `main` 始终对应当前最新 v2 状态。

### 8.2 释出节奏：螺旋（骨架先行）

放弃"8 篇线性写"的思路，避免"前面不能改"的死锁。骨架 5 章先写：

- **C01** 项目全景与四种入口形态
- **C05** QueryEngine 与对话主循环
- **C16** 任务模型与 TaskType 谱系
- **C18** MCP 协议实现
- **C32** 命令系统全景

骨架 5 章合并后，其余 29 章可并行展开，由 OC-PM 按工作量级（L/M/S）和领域归并到不同 writer。

### 8.3 CI 强制（尧哥已拍板）

- 每个 PR 必须跑 `pnpm gen:appendix && pnpm check:docs`；
- 通过 `check-source-commits.ts` + `lint-no-fuzzy-quantifiers.ts` + `gen-module-matrix.ts --check-orphans` 三项校验；
- PR 描述含 manifest diff 摘要。

## 9. 拆 issue 指南（如何把本文档转为每章 spec 三件套）

### 9.1 章节 issue 结构（每章一个 issue）

OC-PM 据本文档为每个 v2 章节产出 1 个 parent issue，包含三件套：

1. **章节 spec**（issue body 顶部）
   - 章节编号 / 标题 / 主入口锚点（来自 §5）
   - 来自 v1 的段落区间（来自 §6.1/6.2）
   - 全新增比例 + 工作量级
   - **estimated_words**：`{ min, max }`（L=[6000,10000] / M=[4000,7000] / S=[2000,4000]）
   - **冻结的 source_commit**（章节启动时由 writer 设置）
   - 章节大纲（sub-section 列表）+ 必引源码锚点
   - 验收点（acceptance criteria）：覆盖目录 / 关键类型函数引用 / 必须命中的事实点

2. **章节正文 issue**（child issue）
   - assignee = writer agent
   - 正文 PR 必须通过 §7.4 全部 CI 校验
   - PR body 必含 manifest diff 摘要

3. **fact-check checklist**（child issue 或 PR description 一节）
   - 文中所有数字逐条回链到附录 manifest
   - reviewer（CX-Dev / OC-PM）逐项打勾后方可合并

### 9.2 拆分次序（与释出节奏对齐）

- **第一波**（骨架 5 章 · 串行）：C01 → C05 → C16 → C18 → C32；
- **第二波**（细节 29 章 · 并行）：按"篇"分批，每篇内部按工作量级倒序（L 章先开）；
- **附录脚本基础设施**（独立 issue · 阻塞所有章节）：`scripts/` 下 8 个脚本 + CI workflow 必须先于第二波启动前合并，否则 fact-check 无法执行。

### 9.3 issue 模板字段（建议）

```yaml
title: "v2 · C<NN> <章节标题>"
labels: [v2, chapter, <part-name>, workload-<S|M|L>]
parent: <V2 spec issue id>
body:
  spec:
    chapter_id: C<NN>
    main_anchor: <file:line-line>
    v1_source: <v1-NN §X>
    new_ratio: <0-100>%
    workload: <S|M|L>
    estimated_words: { min, max }
    source_commit: <sha>            # writer 在领取 issue 时填入冻结
  outline: [<sub-section 1>, ...]
  required_anchors: [...]
  acceptance:
    - 覆盖目录：[...]
    - 关键类型/函数：[...]
    - 必须命中的事实点：[...]
  fact_check_links: [<appendix manifest path>]
```

### 9.4 法律 / 合规边界处理（C24 / C25 专用）

- **C24（Bridge IPC）/ C25（DirectConnect）**：默认按"尽量写"，含模块结构、公开 API、源码锚点；
- **降级触发条件**：若涉及（a）未公开的 wire 协议帧 / 二进制布局，（b）企业安全合规细节（IP allowlist、密钥管理、审计日志格式等），（c）任何会泄露上游服务端契约的内容——**章节顶部强制标注**：「本章因 <a/b/c> 降级为接口层视角，省略 <具体省略点>」；
- 法律风险判定不由作者自决；写作时若不确定，必须开 follow-up issue 让人类拍板，写作期不放出。

## 10. 文档归属与下一步

- 本文档由 CC-Dev 在合并 OC-Dev / CC-Dev 双方架构提案、吸收 CX-Dev 横评、通过 OC-PM 必修项 review、获得尧哥三项 Open Q 拍板后产出，作为 v2 修订的根 spec；
- 后续 v2 写作的所有章节 issue 与附录 issue 均以本文档为唯一输入；
- 本文档的任何更新（例如新增章节 / 调整迁移矩阵 / 修订 §0 公约）必须通过 PR 修改本文件，并相应回写所有相关章节 issue。

— end —
