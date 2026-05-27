# 附录 F · 模块 × 章节双向矩阵

> 生成脚本：`scripts/gen-module-matrix.ts`；source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`

## 正表：章节 → 覆盖目录

| 章节 | 标题 | 覆盖一级目录 |
|---|---|---|
| C01 | 项目全景与四种入口形态 | `entrypoints/` |
| C02 | 启动链路与冷启动优化 | `entrypoints/`, `screens/` |
| C03 | 配置体系与企业 MDM | `services/`, `utils/` |
| C04 | 配置迁移即代码 | `migrations/` |
| C05 | QueryEngine 与对话主循环 | `query/` |
| C06 | System Prompt 与 Output Style 注入 | `constants/`, `outputStyles/` |
| C07 | 上下文压缩家族 | `services/` |
| C08 | Prompt Cache 横切 | `services/` |
| C09 | Thinking、Effort 与 Advisor | `commands/`, `services/` |
| C10 | 工具协议、注册与 ToolSearch | `tools/` |
| C11 | BashTool / PowerShellTool 双 shell | `tools/` |
| C12 | 文件、代码与 LSP 协作族 | `tools/`, `services/` |
| C13 | 通信、调度、问询与合成工具 | `tools/` |
| C14 | Agent 系统与 Sub-Agent 调用 | `tools/`, `services/`, `commands/` |
| C15 | 内置 Agent 设计模式 | `tools/` |
| C16 | 任务模型与 TaskType 谱系 | `tasks/`, `tools/` |
| C17 | Coordinator、Cron 与定时调度 | `coordinator/`, `tools/`, `hooks/` |
| C18 | MCP 协议实现 | `services/`, `tools/` |
| C19 | 权限系统与远程权限回灌 | `hooks/`, `bridge/`, `remote/` |
| C20 | Hooks 系统 | `schemas/`, `hooks/`, `query/` |
| C21 | Skill / Plugin / Output Style 三扩展点 | `skills/`, `services/`, `plugins/`, `outputStyles/` |
| C22 | Feature Flag 与编译期优化 | `utils/`, `constants/` |
| C23 | 客户端传输与 API 重试 | `services/`, `cli/` |
| C24 | Bridge IPC 与远程会话 | `bridge/`, `remote/`, `commands/` |
| C25 | DirectConnect 与上游代理 | `server/`, `upstreamproxy/`, `hooks/` |
| C26 | Ink 框架深度定制 | `ink/`, `native-ts/` |
| C27 | 组件与设计系统 | `components/` |
| C28 | Keybindings、Vim、Voice 输入 | `keybindings/`, `vim/`, `voice/`, `services/`, `hooks/`, `commands/` |
| C29 | Buddy 人格 | `buddy/` |
| C30 | Doctor 屏与 Output Style UX | `screens/`, `outputStyles/`, `commands/` |
| C31 | Memory 子系统全景 | `memdir/`, `services/`, `assistant/` |
| C32 | 命令系统全景 | `commands/` |
| C33 | 状态管理与跨进程桥 | `state/`, `bridge/` |
| C34 | 架构模式总结 | （横切） |

## 反查：目录 → 覆盖章节

| 一级目录 | 覆盖章节 |
|---|---|
| `assistant/` | C31 |
| `bootstrap/` | — |
| `bridge/` | C19, C24, C33 |
| `buddy/` | C29 |
| `cli/` | C23 |
| `commands/` | C09, C14, C24, C28, C30, C32 |
| `components/` | C27 |
| `constants/` | C06, C22 |
| `context/` | — |
| `coordinator/` | C17 |
| `entrypoints/` | C01, C02 |
| `hooks/` | C17, C19, C20, C25, C28 |
| `ink/` | C26 |
| `keybindings/` | C28 |
| `memdir/` | C31 |
| `migrations/` | C04 |
| `moreright/` | — |
| `native-ts/` | C26 |
| `outputStyles/` | C06, C21, C30 |
| `plugins/` | C21 |
| `query/` | C05, C20 |
| `remote/` | C19, C24 |
| `schemas/` | C20 |
| `screens/` | C02, C30 |
| `server/` | C25 |
| `services/` | C03, C07, C08, C09, C12, C14, C18, C21, C23, C28, C31 |
| `skills/` | C21 |
| `state/` | C33 |
| `tasks/` | C16 |
| `tools/` | C10, C11, C12, C13, C14, C15, C16, C17, C18 |
| `types/` | — |
| `upstreamproxy/` | C25 |
| `utils/` | C03, C22 |
| `vim/` | C28 |
| `voice/` | C28 |

## 孤儿目录

当前 commit 下 orphans=0（孤儿统计已剔除 `scripts/orphan-allowlist.txt` 中的条目）。

白名单（`scripts/orphan-allowlist.txt`）共 5 项：`bootstrap/`, `context/`, `moreright/`, `types/`, `utils/`。

> 说明：反查表里的 `—` 标记**任何未被成书章节直接覆盖的一级目录**（即 `reverse_index[dir]` 为空），与是否在白名单无关。孤儿统计（`orphans`）= 出现 `—` 的目录集合再剔除 `scripts/orphan-allowlist.txt` 中的条目。白名单中如 `utils/` 等条目实际被章节叙事覆盖，反查表里仍显示具体章号，并不出现 `—`——这属于"白名单兜底但实际不需要兜底"，不算矛盾。
