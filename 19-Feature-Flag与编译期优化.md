# 第 19 篇：Feature Flag 与编译期优化 — 同一份代码构建两个产品

> 本篇揭示 Claude Code CLI 如何用一套代码库同时维护内部版和外部版两个产品。你将看到 Bun 的 `feature()` 编译期常量折叠、`process.env.USER_TYPE` 构建时 `--define` 常量、`MACRO.*` 构建时值注入、以及 GrowthBook A/B 测试平台如何在不同的时间维度上协同工作。

## 为什么需要多层 Feature Flag？

假设你是一家 AI 公司的工程师，你的产品既有面向公众的开源版本，也有内部员工使用的增强版本。内部版有更多实验性功能（语音模式、多 Agent 协调器、后台任务引擎），但你不想维护两个独立的代码仓库。

Claude Code CLI 面临的正是这个问题。它的解决方案是**三层 Feature Flag 体系**，每层解决不同的问题：

| 层级 | 机制 | 决策时机 | 目的 |
|------|------|---------|------|
| 编译期 | `feature()` from `bun:bundle` | 构建时 | 从产物中物理删除内部代码分支 |
| 编译期 | `process.env.USER_TYPE` (`--define`) | 构建时 | 内部/外部身份门控，同样触发 DCE |
| 运行时 | GrowthBook A/B 测试 | 进程运行中 | 渐进式发布、实验、Kill Switch |

前两者都在构建时决策，但分工不同：`feature()` 是**功能级开关**（一个 flag 控制一个完整特性），`USER_TYPE` 是**身份级开关**（区分内部员工与外部用户）。运行时的 GrowthBook 则支持不重启进程就能开关功能。

---

## 一、编译期：`feature()` 与 Dead Code Elimination

### 1.1 核心机制

`feature()` 是从 `bun:bundle` 导入的编译期函数。它在 Bun 构建时被替换为 `true` 或 `false` 字面量，然后 Bun 的 bundler 会对 `if (false) { ... }` 分支执行 Dead Code Elimination（DCE），将整个分支及其依赖从产物中物理删除。

```typescript
// entrypoints/cli.tsx:1
import { feature } from 'bun:bundle';
```

这意味着在外部构建中，被 `feature()` 关闭的代码**不存在于最终的 JS 文件中** —— 不是被 `if (false)` 跳过，而是被完全删除。这比运行时检查强得多：攻击者无法通过修改环境变量来启用这些功能，因为相关代码根本不在产物里。

### 1.2 feature() 的两种搭配：require() 与动态 import()

`feature()` 实现 DCE 的**核心约束**是：它必须保持 inline（内联在条件判断中），使 bundler 能在编译期对整个分支做常量折叠。源码注释明确写道：

> `feature() must stay inline for build-time dead code elimination` — `cli.tsx:111`

在这个约束下，`feature()` 可以搭配**两种**模块加载方式：

**方式一：条件 `require()`** —— 用于**模块顶层**的条件加载（`tools.ts`、`commands.ts`）：

```typescript
// tools.ts:25-28
const SleepTool =
  feature('PROACTIVE') || feature('KAIROS')
    ? require('./tools/SleepTool/SleepTool.js').SleepTool
    : null
```

**方式二：分支内的动态 `import()`** —— 用于**函数体内**的条件加载（`cli.tsx` 的快速路径）：

```typescript
// entrypoints/cli.tsx:100-106
if (feature('DAEMON') && args[0] === '--daemon-worker') {
  const { runDaemonWorker } = await import('../daemon/workerRegistry.js');
  await runDaemonWorker(args[1]);
  return;
}
```

两者的共同点是：都不是**顶层静态 `import` 声明**。ES Module 的静态 `import` 语句会被模块系统无条件解析和加载，无论它们是否在会执行的代码路径中 —— bundler 无法删除静态 `import` 的依赖树。而 `require()` 和 `await import()` 都是运行时调用表达式，编译器确认 `feature(...)` 为 `false` 后，整个分支（包括其中的模块加载调用）都会被删除。

**选择哪种方式取决于上下文**：`require()` 适用于模块顶层（同步、可赋值给 `const`），`await import()` 适用于 async 函数体内（异步、更自然的代码流）。

这种模式在 `tools.ts` 中最为密集，因为工具注册是 feature flag 使用最集中的地方：

```typescript
// tools.ts:29-53 — 连续的条件注册
const cronTools = feature('AGENT_TRIGGERS')
  ? [
      require('./tools/ScheduleCronTool/CronCreateTool.js').CronCreateTool,
      require('./tools/ScheduleCronTool/CronDeleteTool.js').CronDeleteTool,
      require('./tools/ScheduleCronTool/CronListTool.js').CronListTool,
    ]
  : []
const RemoteTriggerTool = feature('AGENT_TRIGGERS_REMOTE')
  ? require('./tools/RemoteTriggerTool/RemoteTriggerTool.js').RemoteTriggerTool
  : null
const MonitorTool = feature('MONITOR_TOOL')
  ? require('./tools/MonitorTool/MonitorTool.js').MonitorTool
  : null
```

### 1.3 89 个 Feature Flag 的全景

通过搜索整个代码库，共发现 **89 个**不同的 `feature()` 标识符。以使用频次排序，Top 15 为：

| Feature Flag | 使用次数 | 功能领域 |
|-------------|---------|---------|
| `KAIROS` | 154 | 助手/聊天模式 |
| `TRANSCRIPT_CLASSIFIER` | 107 | 权限自动分类 |
| `TEAMMEM` | 51 | 团队记忆 |
| `VOICE_MODE` | 46 | 语音交互 |
| `BASH_CLASSIFIER` | 45 | Bash 命令安全分类 |
| `KAIROS_BRIEF` | 39 | 简报模式 |
| `PROACTIVE` | 37 | 主动模式 |
| `COORDINATOR_MODE` | 32 | 多 Agent 协调器 |
| `BRIDGE_MODE` | 28 | IDE 远程桥接 |
| `EXPERIMENTAL_SKILL_SEARCH` | 21 | 实验性技能搜索 |
| `CONTEXT_COLLAPSE` | 20 | 上下文折叠 |
| `KAIROS_CHANNELS` | 19 | 频道功能 |
| `UDS_INBOX` | 17 | Unix 域套接字消息 |
| `CHICAGO_MCP` | 16 | Computer Use MCP |
| `BUDDY` | 16 | Buddy 模式 |

这些 flag 中，`KAIROS`（希腊语「恰当时机」）出现 154 次，几乎是第二名的 1.5 倍 —— 它对应的是 Claude Code 的「助手」模式，这是一个内部大型实验功能。

### 1.4 feature() 的全栈影响

`feature()` 不仅控制工具和命令的注册，还深入到入口点的**快速路径**、**对话循环**、**System Prompt** 等核心链路。以 `entrypoints/cli.tsx` 为例：

```typescript
// entrypoints/cli.tsx:53
// Ant-only: eliminated from external builds via feature flag.
if (feature('DUMP_SYSTEM_PROMPT') && args[0] === '--dump-system-prompt') {
  // ... 整个 --dump-system-prompt 快速路径
  return;
}

// entrypoints/cli.tsx:100
if (feature('DAEMON') && args[0] === '--daemon-worker') {
  // ... daemon worker 快速路径
  return;
}

// entrypoints/cli.tsx:165
if (feature('DAEMON') && args[0] === 'daemon') {
  // ... daemon 子命令快速路径
  return;
}

// entrypoints/cli.tsx:185
if (feature('BG_SESSIONS') && (args[0] === 'ps' || args[0] === 'logs' || ...)) {
  // ... 后台会话管理快速路径
  return;
}
```

在外部构建中，这些 `if` 块全部被 DCE 删除。用户永远不会看到 `claude daemon`、`claude ps`、`claude attach` 等子命令 —— 因为解析它们的代码根本不存在。

在 `query.ts`（对话循环）中同样大量使用：

```typescript
// query.ts:15-18
const reactiveCompact = feature('REACTIVE_COMPACT')
  ? require('./services/compact/reactiveCompact.js') : null
const contextCollapse = feature('CONTEXT_COLLAPSE')
  ? require('./services/compact/contextCollapse.js') : null
```

### 1.5 编译期 + 运行时双重门控：Ablation Baseline

一个特别精巧的用法是 `cli.tsx` 中的 Ablation Baseline（消融实验基线）。它展示了编译期 `feature()` 和运行时环境变量**组合使用**的模式：

```typescript
// entrypoints/cli.tsx:16-26
// Harness-science L0 ablation baseline. Inlined here (not init.ts) because
// BashTool/AgentTool/PowerShellTool capture DISABLE_BACKGROUND_TASKS into
// module-level consts at import time — init() runs too late. feature() gate
// DCEs this entire block from external builds.
if (feature('ABLATION_BASELINE') && process.env.CLAUDE_CODE_ABLATION_BASELINE) {
  for (const k of [
    'CLAUDE_CODE_SIMPLE',
    'CLAUDE_CODE_DISABLE_THINKING',
    'DISABLE_INTERLEAVED_THINKING',
    'DISABLE_COMPACT',
    'DISABLE_AUTO_COMPACT',
    'CLAUDE_CODE_DISABLE_AUTO_MEMORY',
    'CLAUDE_CODE_DISABLE_BACKGROUND_TASKS',
  ]) {
    process.env[k] ??= '1';
  }
}
```

注释解释了为什么它必须在 `cli.tsx`（而非 `init.ts`）中 —— 因为 BashTool 等工具在 `import` 时就会捕获环境变量到模块级常量中，`init()` 运行时已经太晚了。而 `feature('ABLATION_BASELINE')` 确保这段代码在外部构建中被完全删除。

---

## 二、构建时身份常量：`process.env.USER_TYPE`

### 2.1 USER_TYPE 也是编译期常量

一个容易误解的关键事实：`process.env.USER_TYPE` **不是**普通的运行时环境变量 —— 它是通过 Bun 的 `--define` 在构建时注入的**编译期常量**。源码中的大量注释明确了这一点：

```
// utils/envUtils.ts:137-138
// USER_TYPE is build-time --define'd; in external builds this block is
// DCE'd so the require() and namespace allowlist never appear in the bundle.

// constants/prompts.ts:617-619
// DCE: `process.env.USER_TYPE === 'ant'` is build-time --define. It MUST be
// inlined at each callsite (not hoisted to a const) so the bundler can
// constant-fold it to `false` in external builds and eliminate the branch.

// components/MemoryUsageIndicator.tsx:8
// USER_TYPE is a build-time constant, so the hook call below is either always
// present or always absent — React hook ordering rules are satisfied.
```

在外部构建中，`process.env.USER_TYPE` 被替换为字面量 `"external"`。这意味着 `process.env.USER_TYPE === 'ant'` 会被常量折叠为 `false`，后续的 DCE 与 `feature()` 效果**完全一致** —— 条件分支中的代码（包括 `require()` 的模块）会被从产物中物理删除。

实际的构建产物验证了这一点（`commands/ultraplan.tsx:56`）：

```typescript
// 构建后的外部产物中，USER_TYPE 已被替换为 "external"
const ULTRAPLAN_INSTRUCTIONS: string = "external" === 'ant' && process.env.ULTRAPLAN_PROMPT_FILE
  ? readFileSync(process.env.ULTRAPLAN_PROMPT_FILE, 'utf8').trimEnd()
  : DEFAULT_INSTRUCTIONS;
```

`"external" === 'ant'` 永远为 `false`，bundler 可以安全删除整个 true-branch。

### 2.2 USER_TYPE 的使用约束

源码注释强调了一个重要约束：`USER_TYPE` **必须在每个调用点内联**，不能提升为 `const`：

```typescript
// constants/prompts.ts:617-619 的注释
// It MUST be inlined at each callsite (not hoisted to a const) so the bundler
// can constant-fold it to `false` in external builds and eliminate the branch.
```

如果写成 `const isAnt = process.env.USER_TYPE === 'ant'`，然后在多处使用 `if (isAnt)`，bundler **可能无法**将 `isAnt` 追溯到编译期常量，从而失去 DCE 能力。

这解释了为什么代码中到处重复 `process.env.USER_TYPE === 'ant'` 而不提取为变量 —— 这不是代码风格问题，而是**DCE 正确性要求**。React hooks 的使用甚至需要 biome-ignore 注释来豁免 hook 规则检查，因为编译期常量保证了 hook 调用的稳定性：

```typescript
// hooks/useIssueFlagBanner.ts:100
// biome-ignore lint/correctness/useHookAtTopLevel: process.env.USER_TYPE is a compile-time constant
```

### 2.3 feature() vs USER_TYPE 的分工

既然两者都能实现 DCE，为什么需要两套机制？

- **`feature()`**：**功能级**开关。89 个独立的 flag，每个控制一个特定功能（`KAIROS`、`COORDINATOR_MODE`、`VOICE_MODE`）。内部构建中也可以选择性关闭某些 feature。
- **`USER_TYPE`**：**身份级**开关。只有 `'ant'` / `"external"` 两个值，控制的是「这是不是内部员工」这个全局身份问题。

以 `tools.ts:getAllBaseTools()` 为例，两种模式并存：

```typescript
// tools.ts:193-250 — getAllBaseTools() 中的条件注册
export function getAllBaseTools(): Tools {
  return [
    AgentTool,                  // 无条件注册
    BashTool,                   // 无条件注册
    // ...
    // USER_TYPE 构建时身份门控（外部构建中 DCE 删除）
    ...(process.env.USER_TYPE === 'ant' ? [ConfigTool] : []),
    ...(process.env.USER_TYPE === 'ant' ? [TungstenTool] : []),
    // feature() 构建时功能门控（外部构建中 DCE 删除）
    ...(WebBrowserTool ? [WebBrowserTool] : []),   // feature('WEB_BROWSER_TOOL')
    ...(OverflowTestTool ? [OverflowTestTool] : []),// feature('OVERFLOW_TEST_TOOL')
  ]
}
```

### 2.4 INTERNAL_ONLY_COMMANDS：注册级门控

命令系统有一个显式的内部命令集合，在 `commands.ts:225-254` 中定义：

```typescript
// commands.ts:225-254
export const INTERNAL_ONLY_COMMANDS = [
  backfillSessions,
  breakCache,
  bughunter,
  commit,
  commitPushPr,
  ctx_viz,
  goodClaude,
  issue,
  initVerifiers,
  // ...还有 feature() 门控的命令
  ...(forceSnip ? [forceSnip] : []),       // feature('HISTORY_SNIP')
  ...(ultraplan ? [ultraplan] : []),       // feature('ULTRAPLAN')
  ...(subscribePr ? [subscribePr] : []),   // feature('KAIROS_GITHUB_WEBHOOKS')
  // ...共 20+ 个内部命令
].filter(Boolean)
```

这些命令只在 `COMMANDS()` 函数中按 `USER_TYPE` 条件注入：

```typescript
// commands.ts:343-345
...(process.env.USER_TYPE === 'ant' && !process.env.IS_DEMO
  ? INTERNAL_ONLY_COMMANDS
  : []),
```

**需要注意的边界**：`INTERNAL_ONLY_COMMANDS` 数组中的命令（如 `backfillSessions`、`commit`、`bughunter` 等）是通过**顶层静态 `import`** 引入的。这意味着它们的模块代码**仍然存在于外部构建的 bundle 中** —— 只是不会被注册到命令列表里，用户无法调用它们。真正实现代码级 DCE 的是那些通过 `feature()` + `require()` 条件加载的命令（如 `forceSnip`、`ultraplan`），这些在外部构建中连模块代码都不存在。

`!process.env.IS_DEMO` 是额外的二级门控 —— 即使是内部用户，在 Demo 模式下也不显示这些命令。

---

## 三、`MACRO.*` — 构建时常量注入

### 3.1 七个构建时常量

除了 `feature()` 的布尔门控，项目还通过 `MACRO.*` 注入**构建时确定的字符串/值常量**。搜索整个代码库，共发现 7 个 MACRO 常量：

| 常量 | 用途 | 使用场景 |
|------|------|---------|
| `MACRO.VERSION` | 版本号 | `--version` 输出、API 请求头、更新检查 |
| `MACRO.BUILD_TIME` | 构建时间戳 | 遥测元数据 |
| `MACRO.PACKAGE_URL` | npm 包地址 | 自动更新、安装路径 |
| `MACRO.NATIVE_PACKAGE_URL` | 原生包地址 | 原生安装器 |
| `MACRO.ISSUES_EXPLAINER` | 反馈渠道说明 | System Prompt、错误提示 |
| `MACRO.FEEDBACK_CHANNEL` | 反馈频道链接 | 安全警告 |
| `MACRO.VERSION_CHANGELOG` | 版本变更日志 | 发布说明 |

### 3.2 MACRO.VERSION 的零开销使用

`MACRO.VERSION` 是最频繁使用的构建时常量。它在 `--version` 快速路径中实现了**零 import 返回**：

```typescript
// entrypoints/cli.tsx:37-42
if (args.length === 1 && (args[0] === '--version' || args[0] === '-v' || args[0] === '-V')) {
  // MACRO.VERSION is inlined at build time
  console.log(`${MACRO.VERSION} (Claude Code)`);
  return;
}
```

编译后，`MACRO.VERSION` 被替换为实际的版本字符串（如 `"1.0.34"`），`${MACRO.VERSION}` 变成一个纯字符串字面量。这意味着 `--version` 路径不需要 import 任何模块，不需要读取 `package.json`，甚至不需要字符串拼接 —— 编译时就已经完成了。

### 3.3 MACRO.ISSUES_EXPLAINER 在 System Prompt 中的使用

`MACRO.ISSUES_EXPLAINER` 让内部版和外部版的 System Prompt 指向不同的反馈渠道：

```typescript
// constants/prompts.ts:218
`To give feedback, users should ${MACRO.ISSUES_EXPLAINER}`,
```

内部构建可能指向 Slack 频道，外部构建指向 GitHub Issues —— 同一行代码，不同的构建产物。

### 3.4 MACRO 与 feature() 的区别

`MACRO.*` 和 `feature()` 都是编译期机制，但语义不同：

- **`feature()`**：布尔值，用于代码分支的 DCE（删除整个代码块）
- **`MACRO.*`**：任意值，用于常量替换（将占位符替换为具体值）

两者可以组合使用：

```typescript
// constants/system.ts:82
const cch = feature('NATIVE_CLIENT_ATTESTATION') ? ' cch=00000;' : ''
const header = `cc_version=${MACRO.VERSION}.${fingerprint}; cc_entrypoint=${entrypoint};${cch}`
```

这行代码同时使用了 `feature()` 决定是否包含客户端认证标记，和 `MACRO.VERSION` 注入版本号。

---

## 四、运行时：GrowthBook A/B 测试平台

### 4.1 为什么还需要运行时 Feature Flag？

编译期和模块加载期的 flag 有一个共同的限制：**修改后必须重新构建或重启进程**。但很多场景需要在不重启的情况下控制功能：

- **渐进式发布**：先对 10% 的用户开放新功能
- **Kill Switch**：紧急关闭有问题的功能
- **A/B 测试**：对比不同配置的效果
- **长会话配置刷新**：用户可能在一个 Claude Code 会话中工作数小时

Claude Code 使用 **GrowthBook**（一个开源的 A/B 测试平台）来解决这些需求。

### 4.2 核心 API：`getFeatureValue_CACHED_MAY_BE_STALE()`

这是 GrowthBook 在 Claude Code 中**最核心的读取 API**（`services/analytics/growthbook.ts:734-775`）：

```typescript
// services/analytics/growthbook.ts:734-775
export function getFeatureValue_CACHED_MAY_BE_STALE<T>(
  feature: string,
  defaultValue: T,
): T {
  // 1. 环境变量覆盖（最高优先级，用于测试工具链）
  const overrides = getEnvOverrides()
  if (overrides && feature in overrides) {
    return overrides[feature] as T
  }
  // 2. 本地配置覆盖（/config Gates 面板设置）
  const configOverrides = getConfigOverrides()
  if (configOverrides && feature in configOverrides) {
    return configOverrides[feature] as T
  }

  if (!isGrowthBookEnabled()) {
    return defaultValue
  }

  // 3. 内存中的 remote eval 缓存（最新鲜）
  if (remoteEvalFeatureValues.has(feature)) {
    return remoteEvalFeatureValues.get(feature) as T
  }

  // 4. 磁盘缓存（跨进程持久化）
  try {
    const cached = getGlobalConfig().cachedGrowthBookFeatures?.[feature]
    return cached !== undefined ? (cached as T) : defaultValue
  } catch {
    return defaultValue
  }
}
```

函数名中的 `_CACHED_MAY_BE_STALE` 是一个**命名约定**，明确告诉调用者：返回值可能是过时的（来自上一个进程的磁盘缓存）。这种诚实的命名避免了调用者对数据新鲜度的错误假设。

### 4.3 四级优先级链

GrowthBook 值的解析遵循严格的优先级链：

```mermaid
graph TD
    A["getFeatureValue_CACHED_MAY_BE_STALE('some_flag', default)"] --> B{"环境变量覆盖?<br/>CLAUDE_INTERNAL_FC_OVERRIDES"}
    B -->|有| C["返回 env override 值"]
    B -->|无| D{"/config Gates 覆盖?"}
    D -->|有| E["返回 config override 值"]
    D -->|无| F{"内存缓存?<br/>remoteEvalFeatureValues"}
    F -->|有| G["返回内存缓存值"]
    F -->|无| H{"磁盘缓存?<br/>~/.claude.json"}
    H -->|有| I["返回磁盘缓存值"]
    H -->|无| J["返回 defaultValue"]

    style B fill:#ff9800,color:#fff
    style D fill:#ff9800,color:#fff
    style F fill:#4caf50,color:#fff
    style H fill:#2196f3,color:#fff
```

环境变量覆盖仅对内部用户开放（`process.env.USER_TYPE === 'ant'`），用于测试工具链（eval harnesses）确保实验配置的确定性：

```typescript
// services/analytics/growthbook.ts:170-192
function getEnvOverrides(): Record<string, unknown> | null {
  if (!envOverridesParsed) {
    envOverridesParsed = true
    if (process.env.USER_TYPE === 'ant') {
      const raw = process.env.CLAUDE_INTERNAL_FC_OVERRIDES
      if (raw) {
        try {
          envOverrides = JSON.parse(raw) as Record<string, unknown>
        } catch { /* ... */ }
      }
    }
  }
  return envOverrides
}
```

### 4.4 初始化与刷新机制

GrowthBook 客户端的生命周期经过精心设计（`growthbook.ts:490-617`）：

**初始化**：使用 Remote Eval 模式（`remoteEval: true`），GrowthBook 服务端为当前用户预计算所有 feature 值，客户端只需接收结果。初始化有 5 秒超时，失败时降级到磁盘缓存。

**周期性刷新**：初始化成功后设置定时器 —— 内部用户 20 分钟刷新一次，外部用户 6 小时刷新一次：

```typescript
// services/analytics/growthbook.ts:1012-1016
const GROWTHBOOK_REFRESH_INTERVAL_MS =
  process.env.USER_TYPE !== 'ant'
    ? 6 * 60 * 60 * 1000  // 6 hours
    : 20 * 60 * 1000       // 20 min (for ants)
```

**磁盘同步**：每次成功获取 payload 后，`syncRemoteEvalToDisk()` 将完整的 feature 值集合写入 `~/.claude.json` 的 `cachedGrowthBookFeatures` 字段，供下一次进程启动时作为磁盘缓存使用。

**Auth 变更重建**：当用户登录/登出时，`refreshGrowthBookAfterAuthChange()` 会销毁并重建整个客户端 —— 因为 GrowthBook SDK 的 `apiHostRequestHeaders` 在创建后无法更新。

### 4.5 实验曝光跟踪

GrowthBook 的 A/B 测试需要记录用户被分配到了哪个实验组。Claude Code 的实现有一个精巧的延迟曝光机制：

```typescript
// services/analytics/growthbook.ts:83-88
// Track features accessed before init that need exposure logging
const pendingExposures = new Set<string>()

// Track features that have already had their exposure logged this session (dedup)
const loggedExposures = new Set<string>()
```

当 `_CACHED_MAY_BE_STALE` 在 GrowthBook 初始化完成**之前**被调用时（很常见，因为很多启动路径需要读取 flag），feature 名被加入 `pendingExposures`。初始化完成后，补发这些曝光事件。而 `loggedExposures` 确保每个 feature 每个 session 只记录一次，避免热路径（如渲染循环中的 `isAutoMemoryEnabled`）产生大量重复事件。

### 4.6 GrowthBook 在实际功能中的使用

GrowthBook 被广泛用于控制各种运行时行为。以几个典型场景为例：

```typescript
// utils/toolSchemaCache.ts:7-8 — 问题说明
// GrowthBook gate flips (tengu_tool_pear, tengu_fgts), MCP reconnects, or
// dynamic content in tool.prompt() all cause this churn.
```

这段注释揭示了一个实际问题：GrowthBook 门控的翻转会导致工具 Schema 变化，进而破坏 Prompt Cache。项目通过 `toolSchemaCache` 将工具 Schema 在 session 级别锁定，防止 mid-session 的 GrowthBook 刷新导致缓存失效。

```typescript
// constants/system.ts:56-57 — Kill Switch
function isAttributionHeaderEnabled(): boolean {
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_ATTRIBUTION_HEADER)) return false
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_attribution_header', true)
}
```

这是一个 Kill Switch 模式：默认开启 attribution header，但可以通过 GrowthBook 远程关闭 —— 无需发布新版本。

---

## 五、三层协同：一个功能的完整门控链路

让我们以 Coordinator Mode（多 Agent 协调模式）为例，看各层 Flag 如何协同工作。

### 第一层：编译期 `feature()` — 代码存在性

```typescript
// tools.ts:120-122
const coordinatorModeModule = feature('COORDINATOR_MODE')
  ? (require('./coordinator/coordinatorMode.js') as typeof import('./coordinator/coordinatorMode.js'))
  : null
```

外部构建中，`feature('COORDINATOR_MODE')` 为 `false`，整个 coordinator 模块被 DCE 删除。

### 第二层：运行时环境变量 — 功能激活

```typescript
// main.tsx:1872
if (feature('COORDINATOR_MODE') && isEnvTruthy(process.env.CLAUDE_CODE_COORDINATOR_MODE)) {
  // 启动协调器模式
}
```

即使在内部构建中，用户也需要显式设置环境变量才能启用协调器。`feature()` 在编译期被替换为 `true`，但 `isEnvTruthy()` 仍在运行时检查。

### 第三层：GrowthBook — 子功能细粒度控制

在 coordinator 模块内部，GrowthBook 控制着子功能的开关。例如，scratchpad（草稿区）功能通过 GrowthBook gate 门控：

```typescript
// coordinator/coordinatorMode.ts:25-27
function isScratchpadGateEnabled(): boolean {
  return checkStatsigFeatureGate_CACHED_MAY_BE_STALE('tengu_scratch')
}
```

这展示了三层如何嵌套：`feature()` 决定 coordinator 代码是否存在 → 环境变量决定 coordinator 是否激活 → GrowthBook 决定 coordinator 内部的 scratchpad 子功能是否启用。

```mermaid
graph LR
    A["feature('COORDINATOR_MODE')"] -->|编译期: true/false| B{"代码存在?"}
    B -->|false| C["代码被 DCE 删除<br/>功能不可用"]
    B -->|true| D{"CLAUDE_CODE_COORDINATOR_MODE<br/>环境变量?"}
    D -->|未设置| E["功能未激活"]
    D -->|已设置| F{"GrowthBook gate<br/>tengu_scratch 等"}
    F --> G["子功能由 A/B 测试控制<br/>如 scratchpad 开关"]

    style A fill:#e91e63,color:#fff
    style D fill:#ff9800,color:#fff
    style F fill:#4caf50,color:#fff
```

---

## 六、防止 Flag 翻转破坏系统

Feature Flag 最大的风险是 mid-session 翻转导致不一致状态。Claude Code 采用了多种防御措施。

### 6.1 Latch 模式（单向锁存）

在 Prompt Cache 系统中（第 7 篇详述），多个 flag 使用 **Latch 模式**：一旦开启就不再关闭：

> AFK header / cache editing header / fast mode header 一旦开启不关闭，防止 mid-session 翻转破坏缓存。

### 6.2 toolSchemaCache：Session 级工具 Schema 锁定

```typescript
// utils/toolSchemaCache.ts:6-8
// GrowthBook gate flips (tengu_tool_pear, tengu_fgts), MCP reconnects,
// or dynamic content in tool.prompt() all cause this churn. Memoizing
// per-session locks the schema bytes at first render.
const TOOL_SCHEMA_CACHE = new Map<string, CachedSchema>()
```

工具 Schema 在 session 首次渲染后被缓存到 Map 中。后续的 GrowthBook 刷新不会改变已缓存的 Schema —— 这保护了 Prompt Cache 的字节级一致性。

### 6.3 QueryConfig 刻意排除 feature()

```
// query/config.ts — 第 5 篇提到的设计
// QueryConfig 是不可变环境快照，刻意排除 feature() gate 以保留 DCE
```

`QueryConfig` 在查询开始时拍摄快照，确保整个对话循环中配置不变。它不直接引用 `feature()` 调用，而是在构造时捕获 feature 门控的结果，避免 mid-turn 翻转。

---

## 七、可迁移的设计模式

### 模式 1：编译期 DCE — 同一份代码构建多版本

**核心思想**：使用编译期常量折叠 + 条件 `require()` 或分支内动态 `import()` 实现零成本的代码分叉。

```typescript
// 模式模板（模块顶层用 require）
import { feature } from 'build-system' // Bun/Webpack/Rollup 都有类似机制

const PremiumFeature = feature('PREMIUM')
  ? require('./premium/feature.js').PremiumFeature
  : null

// 模式模板（函数体内用动态 import）
if (feature('PREMIUM') && args[0] === 'premium') {
  const { premiumMain } = await import('./premium/main.js')
  await premiumMain()
  return
}
```

**关键约束**：不能用顶层静态 `import`（bundler 无法删除其依赖树）。`require()` 和 `await import()` 都可以，视上下文选择。

**适用场景**：SaaS 产品的免费版/付费版、开源项目的社区版/企业版。

### 模式 2：诚实命名的缓存 API

**核心思想**：在函数名中明确标注数据新鲜度的语义。

```typescript
// 好的命名
getFeatureValue_CACHED_MAY_BE_STALE()   // 可能过时
getDynamicConfig_BLOCKS_ON_INIT()        // 会阻塞
checkGate_CACHED_OR_BLOCKING()           // 先快后慢
getFeatureValue_DEPRECATED()             // 已废弃

// 坏的命名
getFeatureValue()  // 阻塞还是非阻塞？新鲜还是过时？
```

这种命名法看起来冗长，但它防止了调用者对行为的错误假设 —— 在一个有 30+ 个消费点的 API 中，这种清晰度是值得的。

### 模式 3：多层 Feature Flag 分离关注点

**核心思想**：按**粒度和灵活性**分层 —— 编译期常量最严格（代码物理删除）、运行时 Flag 最灵活（可热更新）。

```
编译期 feature()      ──── 功能边界：按特性裁剪产物
编译期 USER_TYPE      ──── 身份边界：按内部/外部裁剪产物
运行时 GrowthBook     ──── 业务边界：渐进发布、A/B 测试、Kill Switch
```

**反模式**：把所有 flag 都放在运行时（安全风险）或都放在编译期（失去灵活性）。

---

## 下一篇预告

[第 20 篇：API 调用与错误恢复 — 面向不可靠网络的鲁棒设计](./20-API调用与错误恢复.md)

我们将深入 `services/api/withRetry.ts` 和 `services/api/claude.ts`，看 Claude Code 如何处理 529 过载、OAuth 401 重认证、模型降级、指数退避等网络层挑战。在一个依赖远程 API 的 AI 产品中，错误恢复的鲁棒性直接决定了用户体验。

---

*本文基于 Claude Code CLI 开源源码分析撰写。*
