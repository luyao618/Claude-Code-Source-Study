# 附录 B · Commands 速查表

> 生成脚本：`scripts/gen-commands-table.ts`；source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`

- 一级目录：86
- 一级文件：15
- 一级条目合计：101
- `commands.ts` 中静态 `import` 引用的一级**目录**：82
- `commands.ts` 中静态 `import` 引用的一级**文件**：10
- `commands.ts` 中条件 `require` 装载的一级**目录**：3（其中 3 个仅以 require 形态装载）
- `commands.ts` 中条件 `require` 装载的一级**文件**：6
- 未被 `commands.ts` 任意 import/require 引用的一级目录：1（`review`；可能通过 plugin 注册或为遗留目录）

## 一级目录

| 名称 | 路径 |
|---|---|
| `add-dir` | `commands/add-dir/` |
| `agents` | `commands/agents/` |
| `ant-trace` | `commands/ant-trace/` |
| `autofix-pr` | `commands/autofix-pr/` |
| `backfill-sessions` | `commands/backfill-sessions/` |
| `branch` | `commands/branch/` |
| `break-cache` | `commands/break-cache/` |
| `bridge` | `commands/bridge/` |
| `btw` | `commands/btw/` |
| `bughunter` | `commands/bughunter/` |
| `chrome` | `commands/chrome/` |
| `clear` | `commands/clear/` |
| `color` | `commands/color/` |
| `compact` | `commands/compact/` |
| `config` | `commands/config/` |
| `context` | `commands/context/` |
| `copy` | `commands/copy/` |
| `cost` | `commands/cost/` |
| `ctx_viz` | `commands/ctx_viz/` |
| `debug-tool-call` | `commands/debug-tool-call/` |
| `desktop` | `commands/desktop/` |
| `diff` | `commands/diff/` |
| `doctor` | `commands/doctor/` |
| `effort` | `commands/effort/` |
| `env` | `commands/env/` |
| `exit` | `commands/exit/` |
| `export` | `commands/export/` |
| `extra-usage` | `commands/extra-usage/` |
| `fast` | `commands/fast/` |
| `feedback` | `commands/feedback/` |
| `files` | `commands/files/` |
| `good-claude` | `commands/good-claude/` |
| `heapdump` | `commands/heapdump/` |
| `help` | `commands/help/` |
| `hooks` | `commands/hooks/` |
| `ide` | `commands/ide/` |
| `install-github-app` | `commands/install-github-app/` |
| `install-slack-app` | `commands/install-slack-app/` |
| `issue` | `commands/issue/` |
| `keybindings` | `commands/keybindings/` |
| `login` | `commands/login/` |
| `logout` | `commands/logout/` |
| `mcp` | `commands/mcp/` |
| `memory` | `commands/memory/` |
| `mobile` | `commands/mobile/` |
| `mock-limits` | `commands/mock-limits/` |
| `model` | `commands/model/` |
| `oauth-refresh` | `commands/oauth-refresh/` |
| `onboarding` | `commands/onboarding/` |
| `output-style` | `commands/output-style/` |
| `passes` | `commands/passes/` |
| `perf-issue` | `commands/perf-issue/` |
| `permissions` | `commands/permissions/` |
| `plan` | `commands/plan/` |
| `plugin` | `commands/plugin/` |
| `pr_comments` | `commands/pr_comments/` |
| `privacy-settings` | `commands/privacy-settings/` |
| `rate-limit-options` | `commands/rate-limit-options/` |
| `release-notes` | `commands/release-notes/` |
| `reload-plugins` | `commands/reload-plugins/` |
| `remote-env` | `commands/remote-env/` |
| `remote-setup` | `commands/remote-setup/` |
| `rename` | `commands/rename/` |
| `reset-limits` | `commands/reset-limits/` |
| `resume` | `commands/resume/` |
| `review` | `commands/review/` |
| `rewind` | `commands/rewind/` |
| `sandbox-toggle` | `commands/sandbox-toggle/` |
| `session` | `commands/session/` |
| `share` | `commands/share/` |
| `skills` | `commands/skills/` |
| `stats` | `commands/stats/` |
| `status` | `commands/status/` |
| `stickers` | `commands/stickers/` |
| `summary` | `commands/summary/` |
| `tag` | `commands/tag/` |
| `tasks` | `commands/tasks/` |
| `teleport` | `commands/teleport/` |
| `terminalSetup` | `commands/terminalSetup/` |
| `theme` | `commands/theme/` |
| `thinkback` | `commands/thinkback/` |
| `thinkback-play` | `commands/thinkback-play/` |
| `upgrade` | `commands/upgrade/` |
| `usage` | `commands/usage/` |
| `vim` | `commands/vim/` |
| `voice` | `commands/voice/` |

## 一级文件

| 名称 | 路径 |
|---|---|
| `advisor` | `commands/advisor.ts` |
| `bridge-kick` | `commands/bridge-kick.ts` |
| `brief` | `commands/brief.ts` |
| `commit-push-pr` | `commands/commit-push-pr.ts` |
| `commit` | `commands/commit.ts` |
| `createMovedToPluginCommand` | `commands/createMovedToPluginCommand.ts` |
| `init-verifiers` | `commands/init-verifiers.ts` |
| `init` | `commands/init.ts` |
| `insights` | `commands/insights.ts` |
| `install` | `commands/install.tsx` |
| `review` | `commands/review.ts` |
| `security-review` | `commands/security-review.ts` |
| `statusline` | `commands/statusline.tsx` |
| `ultraplan` | `commands/ultraplan.tsx` |
| `version` | `commands/version.ts` |

## 条件 require 装载的目录（3）

| 名称 | 路径 |
|---|---|
| `bridge` | `commands/bridge/` |
| `remote-setup` | `commands/remote-setup/` |
| `voice` | `commands/voice/` |
