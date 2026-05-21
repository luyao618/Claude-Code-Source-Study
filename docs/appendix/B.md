# 附录 B · Commands 速查表

> source_commit: `290fdc9481a70612bc5823aa4ed225c52c52aad3`
> generated_at: `2026-05-21T16:18:19.723Z`
> 共 101 项（top-level-dir=4 / runtime-cmd=82 / top-level-file=15）

由 `scripts/gen-commands-table.ts` 扫描 `commands/` 一级目录、`commands/*.ts` 一级文件，并交叉 `commands.ts` 注册图。正文 §C32 引用本表，不裸写命令数。

| name | category | source_files |
|---|---|---|
| `bridge` | top-level-dir | commands/bridge/bridge.tsx:1-509, commands/bridge/index.ts:1-26 |
| `remote-setup` | top-level-dir | commands/remote-setup/api.ts:1-182, commands/remote-setup/index.ts:1-20, commands/remote-setup/remote-setup.tsx:1-187 |
| `review` | top-level-dir | commands/review/UltrareviewOverageDialog.tsx:1-96, commands/review/reviewRemote.ts:1-316, commands/review/ultrareviewCommand.tsx:1-58 …(+1) |
| `voice` | top-level-dir | commands/voice/index.ts:1-20, commands/voice/voice.ts:1-150 |
| `add-dir` | runtime-cmd | commands/add-dir/add-dir.tsx:1-126, commands/add-dir/index.ts:1-11, commands/add-dir/validation.ts:1-110 |
| `agents` | runtime-cmd | commands/agents/agents.tsx:1-12, commands/agents/index.ts:1-10 |
| `ant-trace` | runtime-cmd |  |
| `autofix-pr` | runtime-cmd |  |
| `backfill-sessions` | runtime-cmd |  |
| `branch` | runtime-cmd | commands/branch/branch.ts:1-296, commands/branch/index.ts:1-14 |
| `break-cache` | runtime-cmd |  |
| `btw` | runtime-cmd | commands/btw/btw.tsx:1-243, commands/btw/index.ts:1-13 |
| `bughunter` | runtime-cmd |  |
| `chrome` | runtime-cmd | commands/chrome/chrome.tsx:1-285, commands/chrome/index.ts:1-13 |
| `clear` | runtime-cmd | commands/clear/caches.ts:1-144, commands/clear/clear.ts:1-7, commands/clear/conversation.ts:1-251 …(+1) |
| `color` | runtime-cmd | commands/color/color.ts:1-93, commands/color/index.ts:1-16 |
| `compact` | runtime-cmd | commands/compact/compact.ts:1-287, commands/compact/index.ts:1-15 |
| `config` | runtime-cmd | commands/config/config.tsx:1-7, commands/config/index.ts:1-11 |
| `context` | runtime-cmd | commands/context/context-noninteractive.ts:1-325, commands/context/context.tsx:1-64, commands/context/index.ts:1-24 |
| `copy` | runtime-cmd | commands/copy/copy.tsx:1-371, commands/copy/index.ts:1-15 |
| `cost` | runtime-cmd | commands/cost/cost.ts:1-24, commands/cost/index.ts:1-23 |
| `ctx_viz` | runtime-cmd |  |
| `debug-tool-call` | runtime-cmd |  |
| `desktop` | runtime-cmd | commands/desktop/desktop.tsx:1-9, commands/desktop/index.ts:1-26 |
| `diff` | runtime-cmd | commands/diff/diff.tsx:1-9, commands/diff/index.ts:1-8 |
| `doctor` | runtime-cmd | commands/doctor/doctor.tsx:1-7, commands/doctor/index.ts:1-12 |
| `effort` | runtime-cmd | commands/effort/effort.tsx:1-183, commands/effort/index.ts:1-13 |
| `env` | runtime-cmd |  |
| `exit` | runtime-cmd | commands/exit/exit.tsx:1-33, commands/exit/index.ts:1-12 |
| `export` | runtime-cmd | commands/export/export.tsx:1-91, commands/export/index.ts:1-11 |
| `extra-usage` | runtime-cmd | commands/extra-usage/extra-usage-core.ts:1-118, commands/extra-usage/extra-usage-noninteractive.ts:1-16, commands/extra-usage/extra-usage.tsx:1-17 …(+1) |
| `fast` | runtime-cmd | commands/fast/fast.tsx:1-269, commands/fast/index.ts:1-26 |
| `feedback` | runtime-cmd | commands/feedback/feedback.tsx:1-25, commands/feedback/index.ts:1-26 |
| `files` | runtime-cmd | commands/files/files.ts:1-19, commands/files/index.ts:1-12 |
| `good-claude` | runtime-cmd |  |
| `heapdump` | runtime-cmd | commands/heapdump/heapdump.ts:1-17, commands/heapdump/index.ts:1-12 |
| `help` | runtime-cmd | commands/help/help.tsx:1-11, commands/help/index.ts:1-10 |
| `hooks` | runtime-cmd | commands/hooks/hooks.tsx:1-13, commands/hooks/index.ts:1-11 |
| `ide` | runtime-cmd | commands/ide/ide.tsx:1-646, commands/ide/index.ts:1-11 |
| `install-github-app` | runtime-cmd | commands/install-github-app/ApiKeyStep.tsx:1-231, commands/install-github-app/CheckExistingSecretStep.tsx:1-190, commands/install-github-app/CheckGitHubStep.tsx:1-15 …(+11) |
| `install-slack-app` | runtime-cmd | commands/install-slack-app/index.ts:1-12, commands/install-slack-app/install-slack-app.ts:1-30 |
| `issue` | runtime-cmd |  |
| `keybindings` | runtime-cmd | commands/keybindings/index.ts:1-13, commands/keybindings/keybindings.ts:1-53 |
| `login` | runtime-cmd | commands/login/index.ts:1-14, commands/login/login.tsx:1-104 |
| `logout` | runtime-cmd | commands/logout/index.ts:1-10, commands/logout/logout.tsx:1-82 |
| `mcp` | runtime-cmd | commands/mcp/addCommand.ts:1-280, commands/mcp/index.ts:1-12, commands/mcp/mcp.tsx:1-85 …(+1) |
| `memory` | runtime-cmd | commands/memory/index.ts:1-10, commands/memory/memory.tsx:1-90 |
| `mobile` | runtime-cmd | commands/mobile/index.ts:1-11, commands/mobile/mobile.tsx:1-274 |
| `mock-limits` | runtime-cmd |  |
| `model` | runtime-cmd | commands/model/index.ts:1-16, commands/model/model.tsx:1-297 |
| `oauth-refresh` | runtime-cmd |  |
| `onboarding` | runtime-cmd |  |
| `output-style` | runtime-cmd | commands/output-style/index.ts:1-11, commands/output-style/output-style.tsx:1-7 |
| `passes` | runtime-cmd | commands/passes/index.ts:1-22, commands/passes/passes.tsx:1-24 |
| `perf-issue` | runtime-cmd |  |
| `permissions` | runtime-cmd | commands/permissions/index.ts:1-11, commands/permissions/permissions.tsx:1-10 |
| `plan` | runtime-cmd | commands/plan/index.ts:1-11, commands/plan/plan.tsx:1-122 |
| `plugin` | runtime-cmd | commands/plugin/AddMarketplace.tsx:1-162, commands/plugin/BrowseMarketplace.tsx:1-802, commands/plugin/DiscoverPlugins.tsx:1-781 …(+14) |
| `pr_comments` | runtime-cmd | commands/pr_comments/index.ts:1-50 |
| `privacy-settings` | runtime-cmd | commands/privacy-settings/index.ts:1-14, commands/privacy-settings/privacy-settings.tsx:1-58 |
| `rate-limit-options` | runtime-cmd | commands/rate-limit-options/index.ts:1-19, commands/rate-limit-options/rate-limit-options.tsx:1-210 |
| `release-notes` | runtime-cmd | commands/release-notes/index.ts:1-11, commands/release-notes/release-notes.ts:1-50 |
| `reload-plugins` | runtime-cmd | commands/reload-plugins/index.ts:1-18, commands/reload-plugins/reload-plugins.ts:1-61 |
| `remote-env` | runtime-cmd | commands/remote-env/index.ts:1-15, commands/remote-env/remote-env.tsx:1-7 |
| `rename` | runtime-cmd | commands/rename/generateSessionName.ts:1-67, commands/rename/index.ts:1-12, commands/rename/rename.ts:1-87 |
| `reset-limits` | runtime-cmd |  |
| `resume` | runtime-cmd | commands/resume/index.ts:1-12, commands/resume/resume.tsx:1-275 |
| `rewind` | runtime-cmd | commands/rewind/index.ts:1-13, commands/rewind/rewind.ts:1-13 |
| `sandbox-toggle` | runtime-cmd | commands/sandbox-toggle/index.ts:1-50, commands/sandbox-toggle/sandbox-toggle.tsx:1-83 |
| `session` | runtime-cmd | commands/session/index.ts:1-16, commands/session/session.tsx:1-140 |
| `share` | runtime-cmd |  |
| `skills` | runtime-cmd | commands/skills/index.ts:1-10, commands/skills/skills.tsx:1-8 |
| `stats` | runtime-cmd | commands/stats/index.ts:1-10, commands/stats/stats.tsx:1-7 |
| `status` | runtime-cmd | commands/status/index.ts:1-12, commands/status/status.tsx:1-8 |
| `stickers` | runtime-cmd | commands/stickers/index.ts:1-11, commands/stickers/stickers.ts:1-16 |
| `summary` | runtime-cmd |  |
| `tag` | runtime-cmd | commands/tag/index.ts:1-12, commands/tag/tag.tsx:1-215 |
| `tasks` | runtime-cmd | commands/tasks/index.ts:1-11, commands/tasks/tasks.tsx:1-8 |
| `teleport` | runtime-cmd |  |
| `terminalSetup` | runtime-cmd | commands/terminalSetup/index.ts:1-23, commands/terminalSetup/terminalSetup.tsx:1-531 |
| `theme` | runtime-cmd | commands/theme/index.ts:1-10, commands/theme/theme.tsx:1-57 |
| `thinkback` | runtime-cmd | commands/thinkback/index.ts:1-13, commands/thinkback/thinkback.tsx:1-554 |
| `thinkback-play` | runtime-cmd | commands/thinkback-play/index.ts:1-17, commands/thinkback-play/thinkback-play.ts:1-43 |
| `upgrade` | runtime-cmd | commands/upgrade/index.ts:1-16, commands/upgrade/upgrade.tsx:1-38 |
| `usage` | runtime-cmd | commands/usage/index.ts:1-9, commands/usage/usage.tsx:1-7 |
| `vim` | runtime-cmd | commands/vim/index.ts:1-11, commands/vim/vim.ts:1-38 |
| `advisor` | top-level-file | commands/advisor.ts:1-109 |
| `bridge-kick` | top-level-file | commands/bridge-kick.ts:1-200 |
| `brief` | top-level-file | commands/brief.ts:1-130 |
| `commit` | top-level-file | commands/commit.ts:1-92 |
| `commit-push-pr` | top-level-file | commands/commit-push-pr.ts:1-158 |
| `createMovedToPluginCommand` | top-level-file | commands/createMovedToPluginCommand.ts:1-65 |
| `init` | top-level-file | commands/init.ts:1-256 |
| `init-verifiers` | top-level-file | commands/init-verifiers.ts:1-262 |
| `insights` | top-level-file | commands/insights.ts:1-3200 |
| `install` | top-level-file | commands/install.tsx:1-300 |
| `review` | top-level-file | commands/review.ts:1-57 |
| `security-review` | top-level-file | commands/security-review.ts:1-243 |
| `statusline` | top-level-file | commands/statusline.tsx:1-24 |
| `ultraplan` | top-level-file | commands/ultraplan.tsx:1-471 |
| `version` | top-level-file | commands/version.ts:1-22 |
