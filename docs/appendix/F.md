# 附录 F · 模块 × 章节 双向矩阵

> source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`
> generated_at: `2026-05-21T15:50:05.485Z`
> 章节 35 项；CLI 一级条目 53 个；孤儿 0 个（allowlist=3）

由 `scripts/gen-module-matrix.ts` 生成。Spec §7.6：`--check-orphans` 在 orphans 数 > 0 时 fail。allowlist 见 `scripts/orphan-allowlist.txt`。

## F.1 章节 → 源码一级目录（正向）

| chapter | claimed top-level entries |
|---|---|
| C01 | `entrypoints`, `bridge`, `remote`, `coordinator`, `buddy`, `upstreamproxy`, `server`, `migrations`, `native-ts`, `screens`, `outputStyles`, `memdir`, `assistant`, `schemas` |
| C02 | `bootstrap`, `main.tsx`, `replLauncher.tsx`, `dialogLaunchers.tsx`, `interactiveHelpers.tsx` |
| C03 | `services` |
| C04 | `migrations` |
| C05 | `QueryEngine.ts`, `query.ts`, `query` |
| C06 | `constants`, `outputStyles` |
| C07 | `services` |
| C08 | `services` |
| C09 | `commands`, `services` |
| C10 | `Tool.ts`, `tools.ts`, `tools` |
| C11 | `tools` |
| C12 | `tools`, `services` |
| C13 | `tools` |
| C14 | `tools`, `services`, `commands` |
| C15 | `tools`, `services` |
| C16 | `Task.ts`, `tasks.ts`, `tasks`, `tools` |
| C17 | `coordinator`, `tools`, `hooks` |
| C18 | `services`, `tools` |
| C19 | `Tool.ts`, `hooks`, `bridge`, `remote` |
| C20 | `schemas`, `hooks`, `query` |
| C21 | `skills`, `services`, `plugins`, `outputStyles` |
| C22 | `utils`, `constants` |
| C23 | `services`, `cli` |
| C24 | `bridge`, `remote`, `commands` |
| C25 | `server`, `upstreamproxy`, `hooks` |
| C26 | `ink`, `native-ts` |
| C27 | `components` |
| C28 | `keybindings`, `vim`, `voice`, `services`, `hooks`, `commands` |
| C29 | `buddy` |
| C30 | `screens`, `outputStyles`, `commands` |
| C31 | `memdir`, `services`, `assistant` |
| C32 | `commands.ts`, `commands` |
| C33 | `state`, `bridge` |
| C34 | — (横切) |
| CROSSCUT | `context`, `context.ts`, `cost-tracker.ts`, `costHook.ts`, `history.ts`, `ink.ts`, `projectOnboardingState.ts`, `setup.ts`, `types`, `utils`, `moreright` |

## F.2 反向矩阵 + 孤儿

✅ 所有 CLI 一级条目均已被章节认领。
