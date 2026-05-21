# `scripts/` — V2 修订基础设施

本目录是 V2-REVISION-SPEC.md §7 规定的基础设施代码。所有脚本由 [`tsx`](https://www.npmjs.com/package/tsx) 直接执行，无需先编译。

## 8 个脚本

| 脚本 | 角色 | 输出 |
|---|---|---|
| `gen-tool-table.ts` | 附录 A | `docs/appendix/A.{md,manifest.json}` |
| `gen-commands-table.ts` | 附录 B | `docs/appendix/B.{md,manifest.json}` |
| `gen-hooks-table.ts` | 附录 C | `docs/appendix/C.{md,manifest.json}` |
| `gen-agents-table.ts` | 附录 D | `docs/appendix/D.{md,manifest.json}` |
| `gen-tasktypes-table.ts` | 附录 E | `docs/appendix/E.{md,manifest.json}` |
| `gen-module-matrix.ts` | 附录 F + 孤儿反向校验 | `docs/appendix/F.{md,manifest.json}` |
| `check-source-commits.ts` | CI lint §0.3：跨章节 / 跨 manifest commit 一致性 | exit 0/1 |
| `lint-no-fuzzy-quantifiers.ts` | CI lint §0.4：事实段落禁词 | exit 0/1 |

## 配置

每个生成器需要指向 CLI 源码根目录。三种方式（按优先级）：

1. `--source <path>` 命令行参数
2. `CLI_SOURCE` 环境变量
3. 默认值：`~/work/code/awesome-project/claude-code-cli`（spec §0.1）

可选 `--source-commit <sha>` 强制指定 manifest 写入的 commit；不指定时由 `git -C <source> rev-parse HEAD` 取得。

## 本地用法

```sh
# 一次性生成全部附录
CLI_SOURCE=~/work/code/awesome-project/claude-code-cli pnpm gen:appendix

# 跑齐 3 项 CI 校验（本地与 CI 行为一致）
CLI_SOURCE=~/work/code/awesome-project/claude-code-cli pnpm check:docs
```

## CI 契约（§7.4）

- `check:source-commits` / `check:fuzzy-quantifiers` 仅读取仓内文件，PR 必跑。
- `gen:appendix` + `check:orphans` 需要 CLI 源码；通过 GitHub Secret `CLI_SOURCE_PATH` 注入。fork PR 自动跳过并打 warning，由维护者推 main 时跑齐全套。
- `git diff --exit-code docs/appendix` 检测 manifest 漂移：作者必须在 PR 内提交最新 manifest，否则 fail。

## 设计取舍

- **不解析 TS AST**：附录 A/B/E 用正则在 `tools.ts` / `commands.ts` / `Task.ts` 上抽取注册图。spec 锁定的 commit 不变，正则即足够；当源码结构变更时 manifest 数字也会改变，CI diff 立即可见。
- **附录 F 章节→模块映射手写**：因为这是「写作合同」（spec §6.2 已敲定），不应试图从源码反推；脚本只做反向 orphan diff。
- **lint §0.4 跳过附录与 spec**：附录由本目录生成、spec 是元文档，二者本身不参与"事实段落"语义。
