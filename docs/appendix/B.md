# 附录 B · Commands 速查表

> source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`
> generated_at: `2026-05-21T15:49:31.196Z`
> 共 101 项（top-level-dir=4 / runtime-cmd=82 / top-level-file=15）

由 `scripts/gen-commands-table.ts` 扫描 `commands/` 一级目录、`commands/*.ts` 一级文件，并交叉 `commands.ts` 注册图。正文 §C32 引用本表，不裸写命令数。

| name | category | source_files |
|---|---|---|
| `bridge` | top-level-dir | commands/bridge/bridge.tsx, commands/bridge/index.ts |
| `remote-setup` | top-level-dir | commands/remote-setup/api.ts, commands/remote-setup/index.ts, commands/remote-setup/remote-setup.tsx |
| `review` | top-level-dir | commands/review/UltrareviewOverageDialog.tsx, commands/review/reviewRemote.ts, commands/review/ultrareviewCommand.tsx …(+1) |
| `voice` | top-level-dir | commands/voice/index.ts, commands/voice/voice.ts |
| `add-dir` | runtime-cmd | commands/add-dir/add-dir.tsx, commands/add-dir/index.ts, commands/add-dir/validation.ts |
| `agents` | runtime-cmd | commands/agents/agents.tsx, commands/agents/index.ts |
| `ant-trace` | runtime-cmd |  |
| `autofix-pr` | runtime-cmd |  |
| `backfill-sessions` | runtime-cmd |  |
| `branch` | runtime-cmd | commands/branch/branch.ts, commands/branch/index.ts |
| `break-cache` | runtime-cmd |  |
| `btw` | runtime-cmd | commands/btw/btw.tsx, commands/btw/index.ts |
| `bughunter` | runtime-cmd |  |
| `chrome` | runtime-cmd | commands/chrome/chrome.tsx, commands/chrome/index.ts |
| `clear` | runtime-cmd | commands/clear/caches.ts, commands/clear/clear.ts, commands/clear/conversation.ts …(+1) |
| `color` | runtime-cmd | commands/color/color.ts, commands/color/index.ts |
| `compact` | runtime-cmd | commands/compact/compact.ts, commands/compact/index.ts |
| `config` | runtime-cmd | commands/config/config.tsx, commands/config/index.ts |
| `context` | runtime-cmd | commands/context/context-noninteractive.ts, commands/context/context.tsx, commands/context/index.ts |
| `copy` | runtime-cmd | commands/copy/copy.tsx, commands/copy/index.ts |
| `cost` | runtime-cmd | commands/cost/cost.ts, commands/cost/index.ts |
| `ctx_viz` | runtime-cmd |  |
| `debug-tool-call` | runtime-cmd |  |
| `desktop` | runtime-cmd | commands/desktop/desktop.tsx, commands/desktop/index.ts |
| `diff` | runtime-cmd | commands/diff/diff.tsx, commands/diff/index.ts |
| `doctor` | runtime-cmd | commands/doctor/doctor.tsx, commands/doctor/index.ts |
| `effort` | runtime-cmd | commands/effort/effort.tsx, commands/effort/index.ts |
| `env` | runtime-cmd |  |
| `exit` | runtime-cmd | commands/exit/exit.tsx, commands/exit/index.ts |
| `export` | runtime-cmd | commands/export/export.tsx, commands/export/index.ts |
| `extra-usage` | runtime-cmd | commands/extra-usage/extra-usage-core.ts, commands/extra-usage/extra-usage-noninteractive.ts, commands/extra-usage/extra-usage.tsx …(+1) |
| `fast` | runtime-cmd | commands/fast/fast.tsx, commands/fast/index.ts |
| `feedback` | runtime-cmd | commands/feedback/feedback.tsx, commands/feedback/index.ts |
| `files` | runtime-cmd | commands/files/files.ts, commands/files/index.ts |
| `good-claude` | runtime-cmd |  |
| `heapdump` | runtime-cmd | commands/heapdump/heapdump.ts, commands/heapdump/index.ts |
| `help` | runtime-cmd | commands/help/help.tsx, commands/help/index.ts |
| `hooks` | runtime-cmd | commands/hooks/hooks.tsx, commands/hooks/index.ts |
| `ide` | runtime-cmd | commands/ide/ide.tsx, commands/ide/index.ts |
| `install-github-app` | runtime-cmd | commands/install-github-app/ApiKeyStep.tsx, commands/install-github-app/CheckExistingSecretStep.tsx, commands/install-github-app/CheckGitHubStep.tsx …(+11) |
| `install-slack-app` | runtime-cmd | commands/install-slack-app/index.ts, commands/install-slack-app/install-slack-app.ts |
| `issue` | runtime-cmd |  |
| `keybindings` | runtime-cmd | commands/keybindings/index.ts, commands/keybindings/keybindings.ts |
| `login` | runtime-cmd | commands/login/index.ts, commands/login/login.tsx |
| `logout` | runtime-cmd | commands/logout/index.ts, commands/logout/logout.tsx |
| `mcp` | runtime-cmd | commands/mcp/addCommand.ts, commands/mcp/index.ts, commands/mcp/mcp.tsx …(+1) |
| `memory` | runtime-cmd | commands/memory/index.ts, commands/memory/memory.tsx |
| `mobile` | runtime-cmd | commands/mobile/index.ts, commands/mobile/mobile.tsx |
| `mock-limits` | runtime-cmd |  |
| `model` | runtime-cmd | commands/model/index.ts, commands/model/model.tsx |
| `oauth-refresh` | runtime-cmd |  |
| `onboarding` | runtime-cmd |  |
| `output-style` | runtime-cmd | commands/output-style/index.ts, commands/output-style/output-style.tsx |
| `passes` | runtime-cmd | commands/passes/index.ts, commands/passes/passes.tsx |
| `perf-issue` | runtime-cmd |  |
| `permissions` | runtime-cmd | commands/permissions/index.ts, commands/permissions/permissions.tsx |
| `plan` | runtime-cmd | commands/plan/index.ts, commands/plan/plan.tsx |
| `plugin` | runtime-cmd | commands/plugin/AddMarketplace.tsx, commands/plugin/BrowseMarketplace.tsx, commands/plugin/DiscoverPlugins.tsx …(+14) |
| `pr_comments` | runtime-cmd | commands/pr_comments/index.ts |
| `privacy-settings` | runtime-cmd | commands/privacy-settings/index.ts, commands/privacy-settings/privacy-settings.tsx |
| `rate-limit-options` | runtime-cmd | commands/rate-limit-options/index.ts, commands/rate-limit-options/rate-limit-options.tsx |
| `release-notes` | runtime-cmd | commands/release-notes/index.ts, commands/release-notes/release-notes.ts |
| `reload-plugins` | runtime-cmd | commands/reload-plugins/index.ts, commands/reload-plugins/reload-plugins.ts |
| `remote-env` | runtime-cmd | commands/remote-env/index.ts, commands/remote-env/remote-env.tsx |
| `rename` | runtime-cmd | commands/rename/generateSessionName.ts, commands/rename/index.ts, commands/rename/rename.ts |
| `reset-limits` | runtime-cmd |  |
| `resume` | runtime-cmd | commands/resume/index.ts, commands/resume/resume.tsx |
| `rewind` | runtime-cmd | commands/rewind/index.ts, commands/rewind/rewind.ts |
| `sandbox-toggle` | runtime-cmd | commands/sandbox-toggle/index.ts, commands/sandbox-toggle/sandbox-toggle.tsx |
| `session` | runtime-cmd | commands/session/index.ts, commands/session/session.tsx |
| `share` | runtime-cmd |  |
| `skills` | runtime-cmd | commands/skills/index.ts, commands/skills/skills.tsx |
| `stats` | runtime-cmd | commands/stats/index.ts, commands/stats/stats.tsx |
| `status` | runtime-cmd | commands/status/index.ts, commands/status/status.tsx |
| `stickers` | runtime-cmd | commands/stickers/index.ts, commands/stickers/stickers.ts |
| `summary` | runtime-cmd |  |
| `tag` | runtime-cmd | commands/tag/index.ts, commands/tag/tag.tsx |
| `tasks` | runtime-cmd | commands/tasks/index.ts, commands/tasks/tasks.tsx |
| `teleport` | runtime-cmd |  |
| `terminalSetup` | runtime-cmd | commands/terminalSetup/index.ts, commands/terminalSetup/terminalSetup.tsx |
| `theme` | runtime-cmd | commands/theme/index.ts, commands/theme/theme.tsx |
| `thinkback` | runtime-cmd | commands/thinkback/index.ts, commands/thinkback/thinkback.tsx |
| `thinkback-play` | runtime-cmd | commands/thinkback-play/index.ts, commands/thinkback-play/thinkback-play.ts |
| `upgrade` | runtime-cmd | commands/upgrade/index.ts, commands/upgrade/upgrade.tsx |
| `usage` | runtime-cmd | commands/usage/index.ts, commands/usage/usage.tsx |
| `vim` | runtime-cmd | commands/vim/index.ts, commands/vim/vim.ts |
| `advisor` | top-level-file | commands/advisor.ts |
| `bridge-kick` | top-level-file | commands/bridge-kick.ts |
| `brief` | top-level-file | commands/brief.ts |
| `commit` | top-level-file | commands/commit.ts |
| `commit-push-pr` | top-level-file | commands/commit-push-pr.ts |
| `createMovedToPluginCommand` | top-level-file | commands/createMovedToPluginCommand.ts |
| `init` | top-level-file | commands/init.ts |
| `init-verifiers` | top-level-file | commands/init-verifiers.ts |
| `insights` | top-level-file | commands/insights.ts |
| `install` | top-level-file | commands/install.tsx |
| `review` | top-level-file | commands/review.ts |
| `security-review` | top-level-file | commands/security-review.ts |
| `statusline` | top-level-file | commands/statusline.tsx |
| `ultraplan` | top-level-file | commands/ultraplan.tsx |
| `version` | top-level-file | commands/version.ts |
