# 第 24 篇：Skill/Plugin 开发实战 — 基于源码理解扩展点

> 本篇是《深入 Claude Code 源码》系列的第 24 篇。前面 23 篇我们深入分析了 Claude Code 的内部架构，现在是时候"反过来用"了 —— 站在扩展开发者的视角，理解如何编写自定义 Agent、Skill、Plugin 和 Hook 脚本。本篇的独特价值在于：每一个配置字段、每一个行为约定，我们都能追溯到源码中的具体实现。

## 为什么需要理解扩展点？

Claude Code 的核心是一个 AI Agent 运行时。但不同团队、不同项目的需求千差万别 —— 有人需要自动化代码审查流程，有人需要集成内部工具链，有人需要约束 Agent 只做特定任务。

Claude Code 提供了四个层级的扩展机制，从轻量到重量依次为：

```
Hook 脚本 → Skill 文件 → Agent 定义 → Plugin 包
```

- **Hook**：在特定事件（工具调用前后、会话开始结束）触发 Shell 命令
- **Skill**：一个 Markdown 文件，定义一段 prompt + 行为约束，模型可以自主调用
- **Agent**：一个 Markdown 文件，定义一个独立的 AI 角色（有自己的 prompt、工具集、模型）
- **Plugin**：一个完整的目录包，可以同时提供 Skill、Agent、Hook、MCP 服务器

本篇将逐一解析这四个扩展点的编写方式，并指出它们在源码中是如何被发现、解析和执行的。

---

## 一、自定义 Skill 编写

### 1.1 目录结构与发现机制

Skill 的标准格式是一个目录，内含 `SKILL.md` 文件：

```
.claude/skills/
└── my-review/
    └── SKILL.md
```

源码中，Skill 的发现从 `loadSkillsFromSkillsDir()` 开始（`skills/loadSkillsDir.ts:407-480`）。它扫描指定目录下的所有子目录，读取每个子目录中的 `SKILL.md` 文件：

```typescript
// skills/loadSkillsDir.ts:424-445
const results = await Promise.all(
  entries.map(async (entry): Promise<SkillWithPath | null> => {
    // Only support directory format: skill-name/SKILL.md
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      return null
    }
    const skillDirPath = join(basePath, entry.name)
    const skillFilePath = join(skillDirPath, 'SKILL.md')
    let content: string
    try {
      content = await fs.readFile(skillFilePath, { encoding: 'utf-8' })
    } catch (e: unknown) {
      if (!isENOENT(e)) {
        logForDebugging(`[skills] failed to read ${skillFilePath}: ${e}`)
      }
      return null
    }
    // ...parse frontmatter and create command
  }),
)
```

关键发现规则：
- **只支持目录格式**，单独的 `.md` 文件在 `/skills/` 目录下不会被加载
- 目录名即为 Skill 名（`entry.name`）
- 支持符号链接（`entry.isSymbolicLink()`）

Skill 文件的搜索范围通过 `getSkillDirCommands()` 定义（`loadSkillsDir.ts:638-804`），按优先级从高到低并行加载 5 个来源：

| 来源 | 路径 | SettingSource |
|------|------|--------------|
| 企业管理策略 | `<managedPath>/.claude/skills/` | `policySettings` |
| 用户级 | `~/.claude/skills/` | `userSettings` |
| 项目级（向上遍历） | `.claude/skills/`（CWD 到 HOME） | `projectSettings` |
| 附加目录 | `--add-dir` 指定的目录 | `projectSettings` |
| 遗留命令目录 | `.claude/commands/`（同时支持单文件格式） | 各来源 |

### 1.2 Frontmatter 主要配置字段

`SKILL.md` 的核心是 YAML frontmatter。所有字段的解析逻辑集中在 `parseSkillFrontmatterFields()` 中（`loadSkillsDir.ts:185-265`）：

```markdown
---
name: "Security Review"
description: "Review code changes for security issues"
allowed-tools: Bash(git diff:*), Bash(git log:*), FileRead
argument-hint: "<branch-name>"
arguments: branch
when_to_use: "When the user asks for a security review of code changes"
version: "1.0"
model: sonnet
effort: high
context: fork
agent: general-purpose
user-invocable: true
paths: "src/**/*.ts, lib/**/*.js"
shell: bash
hooks:
  PostToolUse:
    - matcher: Bash
      hooks:
        - type: command
          command: "echo 'Tool used'"
---

# Security Review Skill

Review the code changes on the given branch...
```

每个字段的源码映射：

| 字段 | 类型 | 默认值 | 源码位置 |
|------|------|--------|---------|
| `name` | string | undefined（显示名，不影响 Skill 标识） | `loadSkillsDir.ts:238-240` — `displayName` |
| `description` | string | 从 Markdown 正文首行提取 | `loadSkillsDir.ts:208-214` |
| `allowed-tools` | string/string[] | `[]` | `loadSkillsDir.ts:242-245` |
| `argument-hint` | string | undefined | `loadSkillsDir.ts:246-249` |
| `arguments` | string/string[] | `[]` | `loadSkillsDir.ts:249-251` |
| `when_to_use` | string | undefined | `loadSkillsDir.ts:252` |
| `version` | string | undefined | `loadSkillsDir.ts:253` |
| `model` | string | 继承父级 | `loadSkillsDir.ts:221-226`，`'inherit'` 映射为 undefined |
| `effort` | string/int | undefined | `loadSkillsDir.ts:228-235` |
| `context` | `'fork'` | `undefined`（即 inline） | `loadSkillsDir.ts:260` |
| `agent` | string | undefined | `loadSkillsDir.ts:261` |
| `user-invocable` | boolean | `true` | `loadSkillsDir.ts:216-219` |
| `paths` | string/string[] | undefined | `loadSkillsDir.ts:159-178` |
| `shell` | `'bash'`/`'powershell'` | bash | `loadSkillsDir.ts:263` |
| `hooks` | HooksSettings | undefined | `loadSkillsDir.ts:136-153` |
| `disable-model-invocation` | boolean | `false` | `loadSkillsDir.ts:255-257` |

### 1.3 两种执行模式：Inline vs Fork

Skill 的 `context` 字段决定了执行模式，这是一个重要的架构选择：

**Inline 模式**（默认）：Skill 的 Markdown 内容被展开为一条 user message，注入到当前对话上下文中。模型在同一个 token 预算内处理 Skill 指令。这在 `SkillTool.call()` 中实现（`tools/SkillTool/SkillTool.ts:634-643`）：

```typescript
// tools/SkillTool/SkillTool.ts:634-643
const processedCommand = await processPromptSlashCommand(
  commandName, args || '', commands, context,
)
// ...返回 newMessages 注入当前对话
```

**Fork 模式**（`context: fork`）：Skill 在一个独立的 Sub-Agent 中执行，拥有独立的 token 预算和对话上下文。通过 `executeForkedSkill()` 实现（`SkillTool.ts:122-289`），内部调用 `runAgent()` 启动子 Agent：

```typescript
// tools/SkillTool/SkillTool.ts:222-237
for await (const message of runAgent({
  agentDefinition,
  promptMessages,
  toolUseContext: { ...context, getAppState: modifiedGetAppState },
  canUseTool,
  isAsync: false,
  querySource: 'agent:custom',
  model: command.model as ModelAlias | undefined,
  availableTools: context.options.tools,
  override: { agentId },
})) {
  agentMessages.push(message)
}
```

**选择建议**：
- 简单的 prompt 增强 → Inline（轻量、共享上下文）
- 需要大量工具调用的复杂任务 → Fork（独立 token 预算、不污染主对话）

### 1.4 变量替换与 Shell 命令嵌入

Skill 内容在执行时会经过变量替换。这在 `createSkillCommand().getPromptForCommand()` 中实现（`loadSkillsDir.ts:344-398`）：

```typescript
// loadSkillsDir.ts:349-369
finalContent = substituteArguments(finalContent, args, true, argumentNames)

// Replace ${CLAUDE_SKILL_DIR} with the skill's own directory
if (baseDir) {
  finalContent = finalContent.replace(/\$\{CLAUDE_SKILL_DIR\}/g, skillDir)
}

// Replace ${CLAUDE_SESSION_ID} with the current session ID
finalContent = finalContent.replace(
  /\$\{CLAUDE_SESSION_ID\}/g, getSessionId(),
)
```

可用的变量：

| 变量 | 含义 | 用途 |
|------|------|------|
| `$1`, `$2`, ... | 位置参数 | 用户调用时传入的参数 |
| `${CLAUDE_SKILL_DIR}` | Skill 所在目录的绝对路径 | 引用 Skill 附带的脚本或数据文件 |
| `${CLAUDE_SESSION_ID}` | 当前 Session ID | 日志关联、临时文件命名 |
| `${named_arg}` | 命名参数 | 通过 `arguments:` 声明的命名参数 |

此外，Skill 支持 Shell 命令嵌入 —— 通过 `` !`command` `` 或 ` ```! ` 代码块，在 Skill 加载时执行 Shell 命令并将输出嵌入 prompt。但有一个重要的安全限制：**MCP 来源的 Skill 不执行 Shell 命令**（`loadSkillsDir.ts:374-396`）：

```typescript
// loadSkillsDir.ts:374
if (loadedFrom !== 'mcp') {
  finalContent = await executeShellCommandsInPrompt(
    finalContent, { ...toolUseContext }, `/${skillName}`, shell,
  )
}
```

### 1.5 条件 Skill（paths 过滤）

通过 `paths` frontmatter 可以创建"只在操作特定文件时才激活"的 Skill。这在 `activateConditionalSkillsForPaths()` 中实现（`loadSkillsDir.ts:997-1058`），使用 `ignore` 库（gitignore 风格匹配）：

```typescript
// loadSkillsDir.ts:1012-1038
const skillIgnore = ignore().add(skill.paths)
for (const filePath of filePaths) {
  const relativePath = isAbsolute(filePath)
    ? relative(cwd, filePath)
    : filePath
  if (skillIgnore.ignores(relativePath)) {
    // Activate this skill
    dynamicSkills.set(name, skill)
    conditionalSkills.delete(name)
    activatedConditionalSkillNames.add(name)
  }
}
```

例如，一个只在操作 `.proto` 文件时激活的 Skill：

```markdown
---
description: "Validate protobuf changes"
paths: "**/*.proto"
---
Check that the protobuf changes follow our style guide...
```

### 1.6 动态 Skill 发现

除了启动时加载，Claude Code 还会在文件操作过程中动态发现嵌套目录中的 Skill。`discoverSkillDirsForPaths()` 从文件路径向上遍历，查找 `.claude/skills/` 目录（`loadSkillsDir.ts:861-915`）：

```typescript
// loadSkillsDir.ts:876-908
while (currentDir.startsWith(resolvedCwd + pathSep)) {
  const skillDir = join(currentDir, '.claude', 'skills')
  if (!dynamicSkillDirs.has(skillDir)) {
    dynamicSkillDirs.add(skillDir)
    try {
      await fs.stat(skillDir)
      // Check if gitignored...
      newDirs.push(skillDir)
    } catch { /* Directory doesn't exist */ }
  }
  const parent = dirname(currentDir)
  if (parent === currentDir) break
  currentDir = parent
}
```

这意味着 monorepo 中的子包可以拥有自己的 Skill，当模型操作该子包中的文件时，相关 Skill 会自动被发现并注册。

---

## 二、自定义 Agent 编写

### 2.1 目录结构与发现

Agent 定义放在 `.claude/agents/` 目录中，每个 `.md` 文件定义一个 Agent：

```
.claude/agents/
├── test-runner.md
└── db-migration.md
```

Agent 的发现流程在 `getAgentDefinitionsWithOverrides()` 中（`tools/AgentTool/loadAgentsDir.ts:296-393`）。它调用 `loadMarkdownFilesForSubdir('agents', cwd)` 扫描多个层级的 `agents/` 目录，然后调用 `parseAgentFromMarkdown()` 解析每个文件。

### 2.2 Frontmatter 配置字段全解

Agent 的 frontmatter 比 Skill 更丰富，解析逻辑在 `parseAgentFromMarkdown()` 中（`loadAgentsDir.ts:541-755`）：

```markdown
---
name: test-runner
description: "Run tests and fix failures. Iterates until all tests pass."
tools: Bash, FileRead, FileEdit, FileWrite
disallowedTools: AgentTool
model: sonnet
effort: high
permissionMode: default
maxTurns: 30
color: green
background: false
memory: project
isolation: worktree
mcpServers:
  - slack
  - custom-server:
      type: stdio
      command: node
      args: ["./server.js"]
skills: commit, review
initialPrompt: "Read the test configuration first"
hooks:
  Stop:
    - matcher: ""
      hooks:
        - type: command
          command: "echo 'Agent stopped'"
---

You are a test runner agent. Your job is to...
```

每个字段的源码映射：

| 字段 | 类型 | 必填 | 源码位置 |
|------|------|------|---------|
| `name` | string | ✅ | `loadAgentsDir.ts:549` — `agentType` |
| `description` | string | ✅ | `loadAgentsDir.ts:550` — `whenToUse`，支持 `\n` 转义 |
| `tools` | string/string[] | ❌ | `loadAgentsDir.ts:660` — 白名单 |
| `disallowedTools` | string/string[] | ❌ | `loadAgentsDir.ts:677-680` — 黑名单 |
| `model` | string | ❌ | `loadAgentsDir.ts:569-573`，`'inherit'` 使用父级模型 |
| `effort` | string/int | ❌ | `loadAgentsDir.ts:624-632` |
| `permissionMode` | string | ❌ | `loadAgentsDir.ts:635-644` |
| `maxTurns` | int | ❌ | `loadAgentsDir.ts:648-654` |
| `color` | string | ❌ | `loadAgentsDir.ts:567` — 终端显示颜色 |
| `background` | boolean | ❌ | `loadAgentsDir.ts:576-591` |
| `memory` | `'user'`/`'project'`/`'local'` | ❌ | `loadAgentsDir.ts:594-605` |
| `isolation` | `'worktree'` | ❌ | `loadAgentsDir.ts:608-621` — 在独立 git worktree 中运行 |
| `mcpServers` | array | ❌ | `loadAgentsDir.ts:693-708` — 按名称引用或内联定义 |
| `skills` | string | ❌ | `loadAgentsDir.ts:684` — 逗号分隔的 Skill 名称列表 |
| `initialPrompt` | string | ❌ | `loadAgentsDir.ts:686-689` — 首轮 user turn 前缀 |
| `hooks` | HooksSettings | ❌ | `loadAgentsDir.ts:711` |

### 2.3 工具约束三策略

Agent 的工具控制有三种策略，在 `runAgent()` 中实现了三层过滤（详见第 12 篇）：

**白名单**（`tools`）：只允许使用列出的工具。
```yaml
tools: Bash, FileRead, FileEdit
```

**黑名单**（`disallowedTools`）：禁止使用列出的工具，其余全部可用。
```yaml
disallowedTools: AgentTool, TaskTool
```

**通配符**（`tools: ['*']`）：允许所有工具（内置 general-purpose Agent 使用此模式）。

在源码中，`tools` 字段的解析使用 `parseAgentToolsFromFrontmatter()`，它处理逗号分隔的字符串或数组格式。

### 2.4 Agent 记忆系统

当设置了 `memory` 字段，Agent 会拥有持久化记忆。记忆目录由 `getAgentMemoryDir()` 决定（`tools/AgentTool/agentMemory.ts:52-65`）：

| Scope | 目录 | 共享范围 |
|-------|------|---------|
| `user` | `~/.claude/agent-memory/<name>/` | 跨所有项目 |
| `project` | `.claude/agent-memory/<name>/` | 团队共享（VCS） |
| `local` | `.claude/agent-memory-local/<name>/` | 本机专用 |

记忆内容通过 `loadAgentMemoryPrompt()` 注入到 Agent 的 System Prompt 尾部（`agentMemory.ts:138-177`）：

```typescript
// agentMemory.ts:726-732
getSystemPrompt: () => {
  if (isAutoMemoryEnabled() && memory) {
    const memoryPrompt = loadAgentMemoryPrompt(agentType, memory)
    return systemPrompt + '\n\n' + memoryPrompt
  }
  return systemPrompt
},
```

当 `memory` 启用时，`FileWrite`、`FileEdit`、`FileRead` 三个工具会被自动注入（即使 `tools` 白名单中没有列出），以便 Agent 读写记忆文件（`loadAgentsDir.ts:663-674`）：

```typescript
if (isAutoMemoryEnabled() && memory && tools !== undefined) {
  const toolSet = new Set(tools)
  for (const tool of [FILE_WRITE_TOOL_NAME, FILE_EDIT_TOOL_NAME, FILE_READ_TOOL_NAME]) {
    if (!toolSet.has(tool)) {
      tools = [...tools, tool]
    }
  }
}
```

### 2.5 六级覆盖优先级

当多个来源定义了同名 Agent 时，`getActiveAgentsFromList()` 按以下顺序去重（后者覆盖前者）（`loadAgentsDir.ts:193-221`）：

```typescript
// loadAgentsDir.ts:203-210
const agentGroups = [
  builtInAgents,    // 1. 内置 Agent（最低优先级）
  pluginAgents,     // 2. Plugin Agent
  userAgents,       // 3. 用户级 (~/.claude/agents/)
  projectAgents,    // 4. 项目级 (.claude/agents/)
  flagAgents,       // 5. Feature Flag
  managedAgents,    // 6. 企业管理策略（最高优先级）
]
```

这意味着项目级 Agent 会覆盖同名的内置 Agent，而企业策略可以强制覆盖一切。

### 2.6 MCP 服务器集成

Agent 可以通过 `mcpServers` 字段声明依赖的 MCP 服务器。支持两种格式：

**按名称引用**（引用已在配置中定义的 MCP 服务器）：
```yaml
mcpServers:
  - slack
  - github
```

**内联定义**：
```yaml
mcpServers:
  - my-server:
      type: stdio
      command: node
      args: ["./my-mcp-server.js"]
```

解析使用 Zod 的 union schema（`loadAgentsDir.ts:63-68`）：

```typescript
const AgentMcpServerSpecSchema = lazySchema(() =>
  z.union([
    z.string(), // Reference by name
    z.record(z.string(), McpServerConfigSchema()), // Inline as { name: config }
  ]),
)
```

---

## 三、Plugin 系统架构

### 3.1 Plugin 目录结构

Plugin 是最完整的扩展形式。源码中，`pluginLoader.ts:14-25` 的注释记录了基本结构（`commands/`、`agents/`、`hooks/`），而 `skills/` 和 `output-styles/` 的支持定义在 manifest schema 中（`utils/plugins/schemas.ts:484-523`）以及 `LoadedPlugin` 类型的 `skillsPath`/`outputStylesPath` 字段中（`types/plugin.ts:57-69`）。完整结构如下：

```
my-plugin/
├── plugin.json          # 可选的 manifest 文件
├── commands/            # 斜杠命令
│   ├── build.md
│   └── deploy.md
├── skills/              # Skill 目录
│   └── review/
│       └── SKILL.md
├── agents/              # Agent 定义
│   └── test-runner.md
├── hooks/               # Hook 配置
│   └── hooks.json
└── output-styles/       # 自定义输出样式
    └── concise.md
```

### 3.2 Plugin Manifest（plugin.json）

Plugin manifest 使用 `PluginManifestSchema` 验证（`utils/plugins/schemas.ts`）。`userConfig` 的每个字段必须包含 `type`、`title`、`description` 三个必填属性，由 `PluginUserConfigOptionSchema` 严格校验（`schemas.ts:587-621`）。以下是一个完整示例：

```json
{
  "name": "my-plugin",
  "description": "A useful plugin for my team",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  },
  "commands": "./commands",
  "skills": "./skills",
  "agents": "./agents",
  "hooks": "./hooks/hooks.json",
  "mcpServers": {
    "my-server": {
      "type": "stdio",
      "command": "node",
      "args": ["./mcp-server/index.js"]
    }
  },
  "userConfig": {
    "apiKey": {
      "type": "string",
      "title": "API Key",
      "description": "API key for the external service",
      "required": true,
      "sensitive": true
    },
    "maxRetries": {
      "type": "number",
      "title": "Max Retries",
      "description": "Maximum number of retry attempts",
      "default": 3,
      "min": 0,
      "max": 10
    }
  }
}
```

### 3.3 Plugin 命令命名规范

Plugin 中的命令自动带有 Plugin 名称前缀。命名逻辑在 `getCommandNameFromFile()` 中（`utils/plugins/loadPluginCommands.ts:60-97`）：

```typescript
// 普通文件：pluginName:commandBaseName
// 例：my-plugin:build

// Skill 格式：pluginName:skillDirName
// 例：my-plugin:review

// 嵌套目录：pluginName:namespace:commandBaseName
// 例：my-plugin:sub:deploy
```

### 3.4 Plugin 变量替换

Plugin 命令支持特有的变量替换（`utils/plugins/loadPluginCommands.ts:340-377`）：

| 变量 | 含义 |
|------|------|
| `${CLAUDE_PLUGIN_ROOT}` | Plugin 根目录路径 |
| `${CLAUDE_PLUGIN_DATA}` | Plugin 数据存储目录 |
| `${CLAUDE_SKILL_DIR}` | 当前 Skill 的目录（区别于 Plugin 根目录） |
| `${CLAUDE_SESSION_ID}` | 当前 Session ID |
| `${user_config.X}` | 用户配置值（敏感字段自动脱敏） |

其中 `${user_config.X}` 有安全保护 —— 标记为 `sensitive: true` 的配置项会被替换为描述性占位符而非实际值，因为 Skill 内容会进入模型 prompt（`loadPluginCommands.ts:348-353`）。

### 3.5 Plugin 发现与加载

Plugin 的加载由 `pluginLoader.ts` 中的 `loadAllPlugins()` 驱动。来源有两个：

1. **Marketplace 安装的 Plugin**：通过 `plugin@marketplace` 格式在 settings 中配置
2. **Session 级 Plugin**：通过 `--plugin-dir` CLI 参数或 SDK 的 `plugins` 选项指定

加载结果是一个 `PluginLoadResult`，包含三个数组（`types/plugin.ts:285-289`）：

```typescript
type PluginLoadResult = {
  enabled: LoadedPlugin[]   // 已启用的 Plugin
  disabled: LoadedPlugin[]  // 已禁用的 Plugin
  errors: PluginError[]     // 加载失败的 Plugin 错误
}
```

### 3.6 LoadedPlugin 数据结构

每个成功加载的 Plugin 被表示为 `LoadedPlugin`（`types/plugin.ts:48-70`），它携带了所有路径和配置信息：

```typescript
type LoadedPlugin = {
  name: string
  manifest: PluginManifest
  path: string               // Plugin 根目录
  source: string             // 来源标识（如 "my-plugin@my-marketplace"）
  enabled?: boolean
  commandsPath?: string      // 默认 commands 目录
  commandsPaths?: string[]   // 额外命令路径
  commandsMetadata?: Record<string, CommandMetadata>
  agentsPath?: string        // 默认 agents 目录
  skillsPath?: string        // 默认 skills 目录
  hooksConfig?: HooksSettings
  mcpServers?: Record<string, McpServerConfig>
  settings?: Record<string, unknown>
}
```

---

## 四、Hook 脚本编写

### 4.1 Hook 配置格式

Hook 可以在三个地方配置：settings.json、Agent frontmatter、Skill frontmatter。格式统一为三层嵌套结构（详见第 18 篇）：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/pre-bash-check.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "FileWrite|FileEdit",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/lint-check.sh"
          }
        ]
      }
    ]
  }
}
```

### 4.2 四种 Hook 类型

源码中定义了四种可持久化的 Hook 类型（`types/hooks.ts` 的 `HookCommand` discriminated union）：

**Shell 命令 Hook**（最常用）：
```json
{
  "type": "command",
  "command": "./scripts/check.sh",
  "timeout": 30000,
  "async": false
}
```

**Prompt Hook**（LLM 评估）：
```json
{
  "type": "prompt",
  "prompt": "Review this code change for security issues",
  "model": "haiku"
}
```

**Agent Hook**（多轮验证）：
```json
{
  "type": "agent",
  "prompt": "Verify all tests pass",
  "tools": ["Bash", "FileRead"]
}
```

**HTTP Hook**（Web 回调）：
```json
{
  "type": "http",
  "url": "https://my-api.com/webhook",
  "method": "POST",
  "headers": { "Authorization": "Bearer ${API_TOKEN}" }
}
```

### 4.3 Hook 的输入机制：stdin JSON + 环境变量

Shell Hook 的输入数据通过 **stdin 以 JSON 格式传入**，而非环境变量。这一点在源码的 `hooksConfigManager.ts` 中有明确说明 —— 例如 `PreToolUse` 的描述是 `"Input to command is JSON of tool call arguments"`（`hooksConfigManager.ts:32`），`PostToolUse` 是 `"Input to command is JSON with fields 'inputs' (tool call arguments) and 'response' (tool call response)"`（`hooksConfigManager.ts:41`）。

在 `execCommandHook()` 中，JSON 数据通过 `child.stdin.write(jsonInput + '\n', 'utf8')` 写入子进程的 stdin（`utils/hooks.ts:1006`）。

**不同事件的 stdin JSON 内容**（以 `BaseHookInput` 为基础，各事件追加特定字段，定义在 `entrypoints/sdk/coreSchemas.ts:414-420` 等）：

| 事件 | stdin JSON 包含的字段 |
|------|---------------------|
| `PreToolUse` | `tool_name`, `tool_input`, `tool_use_id` |
| `PostToolUse` | `inputs`（工具输入）, `response`（工具输出） |
| `PostToolUseFailure` | `tool_name`, `tool_input`, `tool_use_id`, `error`, `error_type` |
| `Stop` / `SubagentStop` | `agent_id`, `agent_type`, `agent_transcript_path`（SubagentStop） |
| `SessionStart` | `source`（startup/resume/clear/compact） |
| `UserPromptSubmit` | 原始 user prompt 文本 |

所有事件的 `BaseHookInput` 都包含 `session_id`、`transcript_path`、`cwd`、`hook_event_name` 等公共字段。

**在 Hook 脚本中读取 stdin JSON 的示例**：

```bash
#!/bin/bash
# 从 stdin 读取 JSON 输入
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
echo "Tool being called: $TOOL_NAME" >&2
```

**环境变量方面**，Hook 只会收到少量上下文变量（`utils/hooks.ts:881-926`）：

| 环境变量 | 含义 | 条件 |
|---------|------|------|
| `CLAUDE_PROJECT_DIR` | 项目根目录 | 始终设置 |
| `CLAUDE_PLUGIN_ROOT` | Plugin/Skill 根目录 | 仅 Plugin/Skill Hook |
| `CLAUDE_PLUGIN_DATA` | Plugin 数据存储目录 | 仅 Plugin Hook |
| `CLAUDE_PLUGIN_OPTION_<KEY>` | 用户配置值（含敏感值） | 仅 Plugin Hook |
| `CLAUDE_ENV_FILE` | 环境注入文件路径 | 仅 SessionStart/Setup/CwdChanged/FileChanged |

注意 `CLAUDE_ENV_FILE` 只在特定事件中设置（而非所有事件），且 Hook 可以向该文件写入 `KEY=VALUE` 对，这些值会被注入到后续的 BashTool 命令环境中。

### 4.4 退出码语义（按事件类型区分）

Shell Hook 的退出码决定了 Claude Code 的后续行为，但**退出码 `2` 的含义因事件类型而异**（`utils/hooks/hooksConfigManager.ts:29-263`）：

| 退出码 | 含义 |
|--------|------|
| `0` | 成功，继续正常流程（部分事件会将 stdout 传给模型或显示在 transcript） |
| `2` | **因事件而异**（见下表） |
| 其他非零 | 非阻塞错误 —— 将 stderr 显示给用户，但继续执行 |

**退出码 `2` 的分事件语义**：

| 事件 | 退出码 2 的行为 |
|------|---------------|
| `PreToolUse` | 将 stderr 展示给模型，**阻止工具调用** |
| `PostToolUse` | 将 stderr **立即展示给模型**（而非仅在 transcript 模式显示） |
| `Stop` | 将 stderr 展示给模型，**继续对话**（模型不会停止） |
| `SubagentStop` | 将 stderr 展示给 Sub-Agent，**继续运行 Sub-Agent** |
| `UserPromptSubmit` | **阻止 prompt 处理**，擦除原始 prompt，将 stderr 展示给用户 |
| `PreCompact` | **阻止 compaction** |
| `TeammateIdle` | 将 stderr 展示给 teammate，**阻止 idle**（teammate 继续工作） |
| `TaskCreated` | 将 stderr 展示给模型，**阻止任务创建** |
| `TaskCompleted` | 将 stderr 展示给模型，**阻止任务标记完成** |

这个差异非常重要 —— 同样是退出码 `2`，在 `PreToolUse` 中意味着"阻止工具执行"，在 `Stop` 中意味着"让模型继续对话"，两者的语义完全不同。

### 4.5 Frontmatter Hook 的特殊处理

当 Hook 定义在 Agent 或 Skill 的 frontmatter 中时，`registerFrontmatterHooks()` 会进行特殊转换（`utils/hooks/registerFrontmatterHooks.ts:18-67`）：

```typescript
// registerFrontmatterHooks.ts:39-45
// For agents, convert Stop hooks to SubagentStop
let targetEvent: HookEvent = event
if (isAgent && event === 'Stop') {
  targetEvent = 'SubagentStop'
  logForDebugging(
    `Converting Stop hook to SubagentStop for ${sourceName}`)
}
```

这个转换至关重要 —— Agent 结束时触发的是 `SubagentStop` 而非 `Stop` 事件。如果你在 Agent frontmatter 中写 `Stop` Hook，源码会自动帮你转换为 `SubagentStop`，避免 Hook 永远不触发的问题。

这些 frontmatter Hook 被注册为 Session Hook（通过 `addSessionHook()`），仅在该 Agent/Skill 的生命周期内有效。

### 4.6 异步 Hook

Hook 可以通过两种方式声明异步执行：

**配置级**：在 Hook 定义中设置 `"async": true` 或 `"asyncRewake": true`
```json
{
  "type": "command",
  "command": "./scripts/long-running-check.sh",
  "async": true
}
```

**协议级**：Hook 脚本的 stdout 首行输出 `{"async":true}` 或 `{"asyncRewake":true}`

`asyncRewake` 模式更有趣 —— 异步 Hook 完成后，如果退出码为 `2`，会唤醒模型并将 Hook 的输出注入对话。这适用于需要长时间运行的验证任务（如 CI/CD 流水线）。

---

## 五、MCP Skill 桥接

MCP 服务器可以通过 `skill://` 资源协议发布 Skill。这些 Skill 被 Claude Code 通过 `mcpSkillBuilders.ts` 桥接到内部的 Skill 系统中。

桥接模块采用了一个精巧的依赖注入模式来打破循环依赖（`skills/mcpSkillBuilders.ts`）：

```typescript
// skills/mcpSkillBuilders.ts:31-44
let builders: MCPSkillBuilders | null = null

export function registerMCPSkillBuilders(b: MCPSkillBuilders): void {
  builders = b
}

export function getMCPSkillBuilders(): MCPSkillBuilders {
  if (!builders) {
    throw new Error(
      'MCP skill builders not registered — loadSkillsDir.ts has not been evaluated yet',
    )
  }
  return builders
}
```

`loadSkillsDir.ts` 在模块初始化时注册构建器（`loadSkillsDir.ts:1083-1086`），这样 MCP 模块就可以使用相同的 `createSkillCommand()` 和 `parseSkillFrontmatterFields()` 函数来创建标准的 Skill 对象，实现统一的加载和执行路径。

MCP Skill 有一个关键安全限制：**不执行 Shell 命令嵌入**（`loadSkillsDir.ts:374`），因为 MCP 来源的内容是远程不可信的。

---

## 六、实战示例

### 示例 1：代码审查 Skill

```
.claude/skills/review-pr/SKILL.md
```

```markdown
---
description: "Review current branch changes against main"
allowed-tools: Bash(git diff:*), Bash(git log:*), FileRead, Grep
when_to_use: "When the user wants a code review"
context: fork
effort: high
---

You are a code reviewer. Review all changes on the current branch
compared to main.

Steps:
1. Run `git diff main...HEAD --stat` to see changed files
2. For each changed file, read the diff and analyze:
   - Logic errors
   - Security issues
   - Performance concerns
   - Missing error handling
3. Provide a structured review with severity levels
```

### 示例 2：带记忆的 Test Agent

```
.claude/agents/test-fixer.md
```

```markdown
---
name: test-fixer
description: "Run tests, diagnose failures, and fix them. Remembers past patterns."
tools: Bash, FileRead, FileEdit, FileWrite
maxTurns: 50
memory: project
color: red
hooks:
  Stop:
    - matcher: ""
      hooks:
        - type: command
          command: "echo 'Test fixer completed' >> .claude/agent-logs/test-fixer.log"
---

You are a test fixing agent. Your workflow:
1. Run the test suite to identify failures
2. For each failure, diagnose the root cause
3. Apply the minimal fix
4. Re-run to verify the fix
5. Repeat until all tests pass

Important:
- Save patterns you learn to your memory for future reference
- Never modify test assertions to make tests pass
- If a fix requires API changes, document them clearly
```

### 示例 3：带 CI 验证的 Hook

`.claude/settings.json`：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "FileEdit|FileWrite",
        "hooks": [
          {
            "type": "command",
            "command": "cat | jq -r '.inputs.file_path // empty' | xargs -I{} npx eslint --fix {} 2>/dev/null || true"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "npm test -- --bail 2>&1 | tail -20",
            "asyncRewake": true
          }
        ]
      }
    ]
  }
}
```

这个配置做了两件事：
1. 每次文件被编辑/写入后，从 stdin JSON 中提取 `file_path` 字段，自动运行 ESLint 修复
2. 当 Agent 即将停止时，异步运行测试套件；如果测试失败（退出码 2），唤醒模型继续修复（注意 `Stop` 事件的退出码 2 含义是"继续对话"）

---

## 七、可迁移的设计模式

### 模式 1：Markdown-as-Config + Frontmatter 约定

Claude Code 用 Markdown frontmatter 作为 Agent 和 Skill 的配置格式，正文作为 prompt 内容。这个模式的优势在于：
- **人类可读**：Markdown 文件可以直接在编辑器中预览
- **版本控制友好**：纯文本，diff 清晰
- **渐进式复杂度**：最简单的 Skill 只需要正文，复杂配置通过 frontmatter 逐步添加

**适用场景**：任何需要"配置 + 内容"混合体的系统（CMS 模板、文档生成规则、AI prompt 管理）。

### 模式 2：Write-Once Registry 打破循环依赖

`mcpSkillBuilders.ts` 的模式 —— 一个无依赖的叶子模块作为注册中心，生产者在模块初始化时写入，消费者在运行时读取。这避免了 A→B→C→A 的循环依赖，同时保持了类型安全。

**适用场景**：任何模块图中存在循环依赖的场景，特别是当 "bundler 无法解析动态 import 路径" 时（如 Bun 的 bunfs 环境）。

### 模式 3：多来源聚合 + 优先级去重

Claude Code 的扩展系统（Agent、Skill、Plugin）都遵循同一模式：
1. 并行从多个来源加载
2. 按优先级排序（内置 < Plugin < 用户 < 项目 < 企业策略）
3. 按名称去重，高优先级覆盖低优先级
4. 通过 realpath 去重处理符号链接和重复路径

**适用场景**：任何需要多层配置合并的系统（VS Code 的 settings 层级、npm 的 config 链、Kubernetes 的 overlay 模式）。

---

## 下一篇预告

[第 25 篇：架构模式总结 — 可迁移到你自己项目的设计模式](./25-架构模式总结.md)

作为系列的收官篇，我们将跨越全部 24 篇的分析，提炼出 7 个核心设计模式：编译期 DCE、极简 Store、工具注册表、Prompt 分段缓存、多层配置合并、Agent 隔离、安全防线。每个模式都附带可直接复用的代码骨架。

---

*全部内容请关注 https://github.com/luyao618/Claude-Code-Source-Study (求一颗免费的小星星)*
