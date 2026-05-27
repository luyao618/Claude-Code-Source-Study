# 深入 Claude Code 源码

> **从 Anthropic 的 AI 编程助手源码中，学会构建 AI Agent 应用的全栈技术**

Claude Code 是 Anthropic 推出的 AI 命令行编程助手，也是目前最好的 AI Coding 产品之一。它的源码涵盖了 System Prompt 工程、多 Agent 编排、工具系统、权限安全、Bridge IPC、远程会话、企业代理、终端 UI 等完整技术栈。

**这是一份 34 章、覆盖全部核心模块的深度源码分析。**

不是泛泛而谈的架构概览，而是逐文件、逐函数的拆解——每章都精确到源码行号，附关键代码片段，并总结可迁移到你自己项目的设计模式。整书以**运行期生命周期**为主线组织：进入软件之前 → 一次回合的内核 → 工具家族 → Agent/任务/协调 → 协议安全与扩展 → 网络与远程 → 终端 UI 与多模态输入 → 记忆/扩展/总结。

## 为什么值得读？

- 🔍 **真实产品，不是 demo** — 从真实的生产级 AI 产品中学习，而非玩具项目
- 🏗️ **全栈覆盖** — 从编译期优化、运行时状态管理，到 Prompt Cache、Bridge IPC、终端渲染
- 🎯 **面向实战** — 章节顺序就是一次会话从启动到产出的链路本身，每章结尾提炼可直接复用的设计模式
- 📖 **中文友好** — 正文中文，技术术语保留英文原文

## 目录

> 📂 所有文章在 [`docs/`](./docs/) 目录下，完整目录与阅读指引见 [00-目录与阅读指引](./docs/00-目录与阅读指引.md)
>
> 📝 想了解本书为什么有 v2、v2 相比 v1 多了什么？见 [V2-CHANGELOG](./V2-CHANGELOG.md)

### 第一篇 · 进入软件之前

| # | 文章 | 你会学到 |
|---|------|---------|
| 01 | [项目全景与四种入口形态](./docs/01-项目全景与四种入口形态.md) | 同一份源码 = CLI + SDK + MCP server + Sandbox runner |
| 02 | [启动链路与冷启动优化](./docs/02-启动链路与冷启动优化.md) | 毫秒级 CLI 启动：侧效果前置、DCE、bundled vs dev |
| 03 | [配置体系与企业 MDM](./docs/03-配置体系与企业MDM.md) | 7 维度配置合并、remoteManaged、settingsSync、policyLimits |
| 04 | [配置迁移即代码](./docs/04-配置迁移即代码.md) | migrations/ 11 文件、模型重命名、replBridge→remoteControl 全演化史 |

### 第二篇 · 一次回合的内核

| # | 文章 | 你会学到 |
|---|------|---------|
| 05 | [QueryEngine 与对话主循环](./docs/05-QueryEngine与对话主循环.md) | 门面 QueryEngine + 内核 query + 4 子模块 |
| 06 | [System Prompt 与 Output Style 注入](./docs/06-SystemPrompt与OutputStyle注入.md) | 分段构建、缓存边界、Output Style 注入 |
| 07 | [上下文压缩家族](./docs/07-上下文压缩家族.md) | autoCompact / microCompact / sessionMemoryCompact 六条压缩链路 |
| 08 | [Prompt Cache 横切](./docs/08-PromptCache横切.md) | CacheSafeParams、Dynamic Boundary、跨模块横切 |
| 09 | [Thinking、Effort 与 Advisor](./docs/09-Thinking-Effort-与-Advisor.md) | ThinkingConfig、Effort 级别、ultrathink、Advisor |

### 第三篇 · 工具家族

| # | 文章 | 你会学到 |
|---|------|---------|
| 10 | [工具协议、注册与 ToolSearch](./docs/10-工具协议-注册与-ToolSearch.md) | Tool 接口、buildTool() builder、family / runtime leaf / feature-gated 三列模型 |
| 11 | [BashTool / PowerShellTool 双 shell](./docs/11-BashTool-PowerShellTool-双shell.md) | 四层安全防线、沙箱执行、Windows 路径对照 |
| 12 | [文件、代码与 LSP 协作族](./docs/12-文件-代码-与-LSP-协作族.md) | FileRead/Write/Edit、NotebookEdit、Glob、Grep、LSPTool、REPLTool |
| 13 | [通信、调度、问询与合成工具](./docs/13-通信调度问询与合成工具.md) | WebFetch / ScheduleCron / SendMessage / AskUserQuestion 等十件工具 |

### 第四篇 · Agent、任务与协调

| # | 文章 | 你会学到 |
|---|------|---------|
| 14 | [Agent 系统与 Sub-Agent 调用](./docs/14-Agent系统与SubAgent调用.md) | AgentDefinition、runAgent、AgentSummary、context 隔离 |
| 15 | [内置 Agent 设计模式](./docs/15-内置Agent设计模式.md) | 6 个内置 Agent 的 Prompt 设计、源码定义 vs 运行时 |
| 16 | [任务模型与 TaskType 谱系](./docs/16-任务模型与TaskType谱系.md) | 7 wire TaskType = 4 默认 + 2 feature-gated + 1 特例 |
| 17 | [Coordinator、Cron 与定时调度](./docs/17-Coordinator-Cron-与定时调度.md) | 多 Agent 编排层 + 定时触发 |

### 第五篇 · 协议、安全与扩展接口

| # | 文章 | 你会学到 |
|---|------|---------|
| 18 | [MCP 协议实现](./docs/18-MCP协议实现.md) | services/mcp/ 23 文件、SdkControlTransport、channelAllowlist |
| 19 | [权限系统与远程权限回灌](./docs/19-权限系统与远程权限回灌.md) | 规则链、AI Classifier、bridgePermissionCallbacks |
| 20 | [Hooks 系统](./docs/20-Hooks系统.md) | 27 个 HOOK_EVENTS、4 种 hook command 类型、stopHooks、notifs |
| 21 | [Skill / Plugin / Output Style 三扩展点](./docs/21-Skill-Plugin-OutputStyle三扩展点.md) | 自定义 Agent/Skill、Plugin 架构、Output Style 作为扩展路径 |
| 22 | [Feature Flag 与编译期优化](./docs/22-FeatureFlag与编译期优化.md) | feature() DCE、GrowthBook、同一份代码构建两个产品 |

### 第六篇 · 网络层与远程协作

| # | 文章 | 你会学到 |
|---|------|---------|
| 23 | [客户端传输与 API 重试](./docs/23-客户端传输与API重试.md) | withRetry、过载处理、HybridTransport / SSE / WebSocket |
| 24 | [Bridge IPC 与远程会话](./docs/24-Bridge-IPC-与远程会话.md) | 手机/Web/Desktop 控制本地 CLI 全链路 |
| 25 | [DirectConnect 与上游代理](./docs/25-DirectConnect-与上游代理.md) | server/、upstreamproxy/、企业代理拓扑 |

### 第七篇 · 终端 UI 与多模态输入

| # | 文章 | 你会学到 |
|---|------|---------|
| 26 | [Ink 框架深度定制](./docs/26-Ink框架深度定制.md) | 自定义 React Reconciler、Yoga 布局、native-ts 加速 |
| 27 | [组件与设计系统](./docs/27-组件与设计系统.md) | ThemedText、主题系统、工具 UI 协议 |
| 28 | [Keybindings、Vim 模式与 Voice 输入](./docs/28-Keybindings-Vim与Voice输入.md) | 「这一下按键意味着什么」的三种解释 |
| 29 | [Buddy 宠物](./docs/29-Buddy宠物.md) | 在 PromptInput 边上养一只随机生成的小动物 |
| 30 | [Doctor 屏与 Output Style 体验](./docs/30-Doctor屏与OutputStyle体验.md) | 自检仪表 + 换装系统 |

### 第八篇 · 记忆、扩展与总结

| # | 文章 | 你会学到 |
|---|------|---------|
| 31 | [Memory 子系统全景](./docs/31-Memory子系统全景.md) | 会话级 / 项目级 / 团队级 / 长期四维度 |
| 32 | [命令系统全景](./docs/32-命令系统全景.md) | 101 个一级条目、内建/Skill/Plugin/Workflow |
| 33 | [状态管理与跨进程桥](./docs/33-状态管理与跨进程桥.md) | 35 行极简 Store、AppState、bridgePointer 跨进程 |
| 34 | [架构模式总结](./docs/34-架构模式总结.md) | 可迁移到你自己项目的设计模式合集 |

### 附录

| 编号 | 内容 |
|---|---|
| [附录 A](./docs/appendix/A.md) | 工具速查表（family / runtime leaf / feature-gated 三列） |
| [附录 B](./docs/appendix/B.md) | Commands 速查表（一级目录 / 一级文件 / runtime 命令） |
| [附录 C](./docs/appendix/C.md) | Hooks 事件表（HOOK_EVENTS 27 + hook command 4 类） |
| [附录 D](./docs/appendix/D.md) | 内置 Agent 速查表（源码定义 vs 运行时可用） |
| [附录 E](./docs/appendix/E.md) | TaskType 谱系（7 wire / 4 默认 / 2 feature-gated / 1 特例） |
| [附录 F](./docs/appendix/F.md) | 模块 × 章节双向矩阵 + 孤儿目录 |

## 推荐阅读路线

| 路线 | 章数 | 适合人群 |
|------|------|---------|
| ⚡ **入门路线** | 7 章 | 想快速建立全局认知：1 → 2 → 33 → 5 → 10 → 14 → 34 |
| 🤖 **AI 工程路线** | 9 章 | 想深入 AI 核心设计：1 → 33 → 6 → 5 → 7 → 9 → 10 → 14 → 15 |
| 🏢 **远程与企业路线** | 5 章 | 想看 CLI 怎么在企业拓扑里活下来：3 → 4 → 23 → 24 → 25 |
| 📚 **完整路线** | 34 章 | 按顺序通读，获得最完整的理解 |

## Star History

如果这个项目对你有帮助，请给一颗 ⭐ 支持一下！

## License

MIT
