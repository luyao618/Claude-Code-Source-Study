# 第 12 章：文件、代码与 LSP 协作族 — 从 Read 到 LSP 的工程一致性

> 本章是《深入 Claude Code 源码》系列对工具家族的第二次深入。上一篇剖完了 `Tool` 接口、`buildTool()` 与 ToolSearch 的抽象骨架，这一篇把镜头收近到八个具体工具上：`FileRead` / `FileWrite` / `FileEdit` / `NotebookEdit` / `Glob` / `Grep` / `LSPTool` / `REPLTool`，外加 `services/lsp/` 这一摞被 LSPTool 直接架在上面的服务。它们合起来回答了一个问题：当一个 Agent 想"读懂并改动一份代码仓库"时，Claude Code 的源码里到底铺了多少条不显眼的规矩。

## 为什么要把文件、代码与 LSP 放在一起讲？

如果你只看工具名，很容易以为这八个工具是平行的：四个负责文件读写、两个负责搜索、一个负责调用语言服务、一个负责 REPL。但在源码里它们其实共享同一条暗线 —— **任何想动文件的工具，都被强制经过同一份"读过没有 / 读完之后改没改"的核账逻辑**；任何想看代码的工具，最终都从 `ripGrep` 或 LSP 这两条路里走出去；任何想压缩 deferred 工具集面的入口，都收口到同一个 REPL 沙箱里。

也正因为它们在工程上是一组人共用的同一份契约，把它们拆成八章去讲会显得啰嗦：每个工具的 README 内核重复度很高，但**它们彼此之间靠对方留出的不变量在工作**。所以本章按"读 → 写 → 搜 → 看代码 → 收口到 REPL"的顺序串一遍，重点不在每个工具的 API 表面，而在它们之间互相留下的接缝。

读完之后，你应该能回答这几个问题：FileEdit 为什么必须先看到 FileRead 的回执？Grep 的 `--max-columns 500` 到底在防什么？LSPTool 为什么是一个 deferred 工具而不是常驻？写文件之后，LSP 诊断为什么会"自己刷一遍"？REPL 模式打开后，那八个最常用的工具去哪了？

---

## 一、读：FileReadTool 与"先读后写"这条暗规

`tools/FileReadTool/FileReadTool.ts:1-1183` 是这一族里最长的一个文件 —— 不是因为它要做什么复杂的事，而是因为读文件这件事在 Claude Code 里有太多形态：纯文本、二进制图片、PDF、Jupyter notebook、超长日志，每一种都要在同一个工具里走完"路径解析 → 编码探测 → 截断 → 回执"的全套流程。

它的工具定义本身很克制：`searchHint: 'read files, images, PDFs, notebooks'`，`isReadOnly` 与 `isConcurrencySafe` 都给 true，而 `maxResultSizeChars` 在 `FileReadTool.ts:342` 写的是 `Infinity`。

`maxResultSizeChars: Infinity` 在整个工具家族里是个例外 —— BashTool、Grep、Glob 都给了具体的字符上限。这里之所以放任不管，是因为 FileRead 在内部按行截：默认每次最多返回 2000 行，超出部分提示"使用 offset/limit 继续"。换句话说，它选了"由调用方分页"而不是"由外层截尾"的策略，这样模型就知道**还有内容没读完**，而不是悄悄拿到一段被砍过的字符串。

真正有意思的是它跟写工具之间的契约 —— `readFileState`。每次成功读完一个文件，FileReadTool 都会在 `FileReadTool.ts:830-846` 把这条记录写进 `ToolUseContext` 共享的 `readFileState` Map：`{ content, timestamp: getFileModificationTime(...), offset, limit }`。这一手是为后面写工具留的伏笔。如果你跳过 FileRead 直接 FileWrite，validateInput 阶段会拒；如果你读完之后，文件被 linter / 用户在外部改了一次，再写也会拒。这条规矩没写在某一份单独的文档里，它在每一个写工具的 `validateInput` 里都重复实现了一遍 —— 错误码也各自一套：FileWrite 用 `errorCode: 2 / 3`（`FileWriteTool.ts:198-218`），FileEdit 用 `errorCode: 6 / 7`（`FileEditTool.ts:275-307`），NotebookEdit 用 `errorCode: 9 / 10`（`NotebookEditTool.ts:218-237`），前者表示"还没读过"，后者表示"读完之后又被外部改了"。

FileRead 还藏着一个不显眼的细节：UNC 路径短路。`FileReadTool.ts:458-465` 在所有 stat/readFile 操作之前对 `\\host\share\file` 或 `//...` 形式的路径直接 `return { result: true }` 不做任何 I/O —— Windows 上对 UNC 路径调 `fs.existsSync()` 之类会自动触发 SMB / NTLM 握手，如果 host 是攻击者控制的，等于把当前用户的 hash 送出去（源码注释原文："Skip filesystem operations for UNC paths to prevent NTLM credential leaks"）。所以这条短路不是"按 UNC 处理"，而是 **validate 阶段一律放行、不在权限通过前对 UNC 做任何 filesystem I/O**，把真正的 stat/read 延后到用户授权后的 `call` 阶段做。同样的两行你在 NotebookEdit、FileEdit、FileWrite 的 `validateInput` 里都会再看到一遍 —— 工具家族层面没有抽出一个 helper，因为每个工具都有自己的"放行返回值"形状，凑成 helper 反而要外挂参数。这是源码里"重复优于错误抽象"的典型一刀。

再读完之后，结果块通过 `mapToolResultToToolResultBlockParam` 决定回给模型的是什么。如果是 `file_unchanged` 这个内部 stub（同一文件在同一时刻被读两次，第二次直接返回"没变"），返回的会是一段固定文本 `FILE_UNCHANGED_STUB`，而不是把整份文件再塞一次回上下文 —— 这是上下文窗口意义上的去重。

---

## 二、写：三件套与同一份 readFileState

FileWrite、FileEdit、NotebookEdit 是写工具的三件套。三者解决的子问题不同：FileWrite 整篇盖写，FileEdit 做"老字符串 → 新字符串"的局部替换，NotebookEdit 专门改 `.ipynb` 里的 cell。但它们的 `validateInput` 共用一份模板：

```typescript
// tools/NotebookEditTool/NotebookEditTool.ts:218-237
// Require Read-before-Edit — silent data loss is unacceptable.
const readTimestamp = toolUseContext.readFileState.get(fullPath)
if (!readTimestamp) {
  return { result: false, message: 'File has not been read yet...', errorCode: 9 }
}
if (getFileModificationTime(fullPath) > readTimestamp.timestamp) {
  return { result: false, message: 'File has been modified since read...', errorCode: 10 }
}
```

这一段就是"先读后写"的全部基线：三者都靠 `readFileState` 防 stale。但在 mtime 失配之后，三件套的处理并不一致：FileWrite (`FileWriteTool.ts:279-293`) 和 FileEdit (`FileEditTool.ts:289-309`) 在 full read 路径下都带了一层"内容相等兜底"——即使 `getFileModificationTime` 比 read 时新，只要把磁盘当前内容拿出来和 `readFileState` 里缓存的 content 逐字节比对完全一致，就继续放行，不抛 `errorCode: 10`。这样可以容忍 prettier、IDE 自动保存这种"重写但内容没变"的场景。NotebookEdit (`NotebookEditTool.ts:230-237`) 则没有这层兜底，是纯 mtime 判断——只要 mtime 变大就保守拒绝，理由源码注释里写得很直白："silent data loss" 是不能接受的，而 "读一次再来" 是廉价的；对 `.ipynb` 这种 JSON 容器来说，按字节比 content 也不太可靠，所以宁可严一点。

写完之后，三件套都做了一件事：把 `readFileState` 的时间戳就地刷新成"写后 mtime"。NotebookEditTool 里的注释把背后那个隐藏的 bug 讲得很清楚：

```typescript
// tools/NotebookEditTool/NotebookEditTool.ts:433-442
// offset:undefined breaks FileReadTool's dedup match —
// without this, Read→NotebookEdit→Read in the same millisecond would
// return the file_unchanged stub against stale in-context content.
readFileState.set(fullPath, {
  content: updatedContent,
  timestamp: getFileModificationTime(fullPath),
  offset: undefined, limit: undefined,
})
```

`offset: undefined` 不是写错了，是有意把 FileReadTool 的去重键打断 —— 因为下一次 Read 必须看到新内容，而不是被 stub 挡回去。这种"两个工具靠一个键的精确形状互相协作"的设计在源码里很常见：契约不在 README 里，在字段值的形状里。

NotebookEdit 还要多解决一个问题：notebook 是 JSON，但 cell.source 是要原地改的字段，于是它必须避开 `safeParseJSON` 的缓存版本：

源码注释（`NotebookEditTool.ts:326-333`）讲得很直白：必须用非 memoized 的 jsonParse —— `safeParseJSON` 按 content string 缓存并返回共享对象引用，而下面要原地 mutate notebook（`cells.splice`、`targetCell.source = ...`），用 memoized 版本会污染 `validateInput()` 和后续 `call()` 的缓存视图。

`safeParseJSON` 是项目里到处用的带缓存版本，按 content string 做 key。Notebook 改的是同一份对象引用，一旦缓存命中、原地 mutate，就会把缓存里别的调用方的视图也污染掉。源码用的解决方案不是"clone 一份"，而是"切到非 memoized 版本" —— 比 clone 便宜，也更直白：哪一条路径会 mutate，就走非缓存版。

写工具收尾时还做了一件容易忽略的事：清掉这一份文件在 LSP 诊断 LRU 里的去重戳：

```text
LSPDiagnosticRegistry.clearDeliveredDiagnosticsForFile(fullPath)
```

为什么需要这一刀，留到第四节讲。

---

## 三、搜：Glob 与 Grep 的取舍

`GlobTool` 与 `GrepTool` 表面上是两个搜索工具，实际职责一刀切得很清晰：Glob 找文件名，Grep 找文件内容。

GlobTool 短小：`tools/GlobTool/GlobTool.ts:1-198`，整个文件不到 200 行。它的 `maxResultSizeChars` 给到 100,000：

```typescript
// tools/GlobTool/GlobTool.ts:57-80
export const GlobTool = buildTool({
  name: GLOB_TOOL_NAME,
  searchHint: 'find files by name pattern or wildcard',
  maxResultSizeChars: 100_000,
  isConcurrencySafe() { return true },
  isReadOnly() { return true },
})
```

10 万字符在文件路径这种场景下已经能放下几千条匹配。Glob 的输出按 mtime 倒序排（测试模式下按名字稳定排序），这样模型在浏览一个仓库时拿到的第一屏更像"最近改过的文件"，而不是"碰巧字典序靠前的文件"。

GrepTool 复杂得多 —— 它要包一个真正的 `ripGrep` 出去：

```typescript
// tools/GrepTool/GrepTool.ts:108-119
const DEFAULT_HEAD_LIMIT = 250
// ...
const effectiveLimit = limit ?? DEFAULT_HEAD_LIMIT
```

```typescript
// tools/GrepTool/GrepTool.ts:160-170
maxResultSizeChars: 20_000,
```

```typescript
// tools/GrepTool/GrepTool.ts:328-340
const args = ['--hidden']
// ...
args.push('--max-columns', '500')
```

20K 字符的 `maxResultSizeChars` 配合 250 行的默认 head limit、单行 500 列的 `--max-columns`，这三个数字背后是一致的判断：**搜索结果是给模型当工作记忆用的，不是给读者当 grep 用的**。让模型一次性吞下一个 minified 文件里那种几千列长的单行，对推理没有任何帮助，反而会把上下文窗口冲掉一半。所以 GrepTool 默认开 `--hidden`（dotfiles 也搜），同时主动给单行字符数封顶 —— 不是因为 ripgrep 不能输出长行，而是因为长行对模型有害。

Grep 还排除了一组明确的版本控制目录：`.git / .svn / .hg / .bzr / .jj / .sl`。这份名单里 `.jj` 和 `.sl` 不那么常见，反映了 Claude Code 用户群的实际使用 —— Jujutsu 和 Sapling 这两套实验型 VCS 也加进去了，避免在它们的内部对象库上做无意义的全文搜索。

`isConcurrencySafe` 与 `isReadOnly` 在 Glob 和 Grep 两侧都是 true。这意味着模型一次返回三个连续的 Grep 调用时，`partitionToolCalls` 可以把它们打成一个并发 batch 同时跑出去 —— 这是上一章讲到的并发安全分区在实战里最高频的命中点。

---

## 四、看代码：LSPTool 与 services/lsp/ 的协奏

如果说前面六个工具是"在文件系统层面看一份代码"，LSPTool 与它背后的 `services/lsp/` 就是"按编程语言去理解一份代码"。它的工具定义在 `tools/LSPTool/LSPTool.ts:1-860`，加上服务侧七个文件总共近 3000 行 —— 比八个工具里任何一个都重。

### 它支持九种操作

`tools/LSPTool/prompt.ts:1-21` 把工具能干什么写得很直白：

> goToDefinition / findReferences / hover / documentSymbol / workspaceSymbol / goToImplementation / prepareCallHierarchy / incomingCalls / outgoingCalls

九个操作覆盖了"找定义、找引用、看文档、列符号、跳实现、爬调用链"这几件 IDE 里最基本的事。LSPTool 不试图重新发明语义分析，它只是把 LSP 协议的请求帧翻译成工具调用，再把响应翻回模型能读的文本。

这里有个对齐细节值得点一下 —— LSP 的位置编码用的是 0-based，但工具暴露给模型的接口刻意用了 1-based：

```typescript
// tools/LSPTool/LSPTool.ts:79-84
.describe('The line number (1-based, as shown in editors)'),
// ...
.describe('The character offset (1-based, as shown in editors)'),
```

```typescript
// tools/LSPTool/LSPTool.ts:432
// Convert from 1-based (user-friendly) to 0-based (LSP protocol)
```

模型平时看见的所有行号都是 1-based（编辑器界面、`file:line` 引用、错误堆栈），让它在这一个工具里突然切到 0-based 是没必要的认知负担。所以转换在工具内部完成，对模型不暴露这个差异 —— 这是工具家族里另一条不显眼的规矩：**工具的输入语义要顺着模型的预设走，不要把协议细节漏出去**。

### 三个守门员

LSPTool 不是默认上场的。它的工具元信息里有三条共同生效的守门员：

```typescript
// tools/LSPTool/LSPTool.ts:131-138
isLsp: true,
// ...
shouldDefer: true,
isEnabled() {
  return isLspConnected()
},
```

`shouldDefer: true` 让它走 deferred 工具通道 —— 模型平时只在 `<available-deferred-tools>` 列表里看到它的名字，看不到参数 schema，只有真的去 ToolSearch 调出来才能用。`isEnabled` 又再加一刀：必须有 LSP 连接才注册。两条放一起的效果是：**没配 LSP 服务器的项目里，模型完全不知道这个工具存在**；配了的项目里，它也只是按需出现，不平白占 prompt 配额。

LSPTool 还有一道文件大小护栏：

```typescript
// tools/LSPTool/LSPTool.ts:53
const MAX_LSP_FILE_SIZE_BYTES = 10_000_000
```

```typescript
// tools/LSPTool/LSPTool.ts:263-267
if (stats.size > MAX_LSP_FILE_SIZE_BYTES) {
  // 拒绝
}
```

10MB 这条线是经验值 —— 让 TypeScript 服务对一个 50MB 的 bundle 跑符号解析，CPU 和内存都会被打穿，而且对模型来说也意义不大：那种文件多半是构建产物，不是源文档。

### 找到了之后还要再过一遍 .gitignore

LSP 工作区符号搜索会把构建产物里的符号一起喷出来，于是 LSPTool 收尾时再补一刀：

收尾时，LSPTool 还要在 `LSPTool.ts:577-588` 补一刀过滤：把工作区符号搜索得到的路径按 50 条一批送进 `git check-ignore`，把 ignore 命中的剔掉再返回。这不是 LSP 服务的职责，但放在 LSPTool 这一层做最合理 —— "哪些是源文件" 是 git 工作区视角的判断，LSP 服务器自己看不到 `.gitignore`。

### 单例 + 代数式状态机

`services/lsp/manager.ts:1-289` 是整个 LSP 子系统的入口，它做的事可以一句话讲清：保证全进程只有一个 `LSPServerManager` 实例，避免重复初始化和重复 spawn 子进程。但实现上它没用"一个 Promise 当全局锁"这种朴素做法，而是引入了一个明确的初始化状态机：

```text
initializationState: 'not-started' | 'pending' | 'success' | 'failed'
```

`isBareMode()` 模式（极简启动场景，没 plugin）下直接短路；正常路径下，第一次调用 `getLspServerManager()` 把状态翻到 `pending` 并起一个 init Promise；后续并发调用全部 await 同一个 Promise；plugin 热刷新触发 `reinitializeLspServerManager()` 时，状态翻回 `not-started`，generation 计数器加一，把任何还在路上的旧 init Promise 作废 —— 这是为了对付 issue #15521 报的那个 race：旧 init 拿到的句柄已经不再对应当前 plugin 集合。

`isLspConnected()` 这个函数就是 LSPTool 那一行 `isEnabled` 背后的 truth source，绕了一大圈，最终是问 manager："你当前有没有至少一台活的语言服务器？"

### 服务器实例的生命周期

`services/lsp/LSPServerInstance.ts:1-511` 管的是单个语言服务器子进程的生命周期。状态机收得很紧：

```text
stopped → starting → running → stopping → stopped
任意 → error
```

声明能力的时候它做了三件值得注意的事：

```typescript
// services/lsp/LSPServerInstance.ts:193-234 (节选)
configuration: false,
workspaceFolders: false,
// ...
didSave: true,
// ...
positionEncodings: ['utf-16'],
```

把 `configuration` 和 `workspaceFolders` 直接关掉，是因为 Claude Code 不打算扮演一个"完整 IDE 客户端"：不少语言服务器会回头问项目级配置，但本工具家族里 LSP 只是被当作"按需查询"的接口，不需要把整套配置面暴露出去。`didSave: true` 反过来是必要的 —— 因为 LSP 服务器要靠 didSave 才知道该重跑诊断。`positionEncodings: ['utf-16']` 选 UTF-16，纯粹是为了对齐 LSP 规范默认值，少几款服务器在编码不一致时的边角崩溃。

它还把 `-32801`（LSP 协议里的 `ContentModified`）当作一类专门的瞬时错误处理：

```typescript
// services/lsp/LSPServerInstance.ts:17
const LSP_ERROR_CONTENT_MODIFIED = -32801
```

```typescript
// services/lsp/LSPServerInstance.ts:378-390 (节选)
errorCode === LSP_ERROR_CONTENT_MODIFIED
// ...指数退避重试，base 500ms × 2^attempt, 最多三次
```

"内容被改了，请重发"是 LSP 协议里非常常规的一类错误 —— 你刚问完 hover，服务器还没回，编辑器里又改了一个字符，先前那次查询就废了。重试本身不复杂，但把它放在服务器实例这一层而不是工具这一层做，意味着 LSPTool 拿到的是已经退完一遍的结果，工具层不用管协议细节。

崩溃恢复也是同一种思路：`maxRestarts` 默认 3，超出就报"已超过重启上限"，不再无限循环。

### LSPClient：vscode-jsonrpc 的薄包装

`services/lsp/LSPClient.ts:1-447` 是 LSPServerInstance 下面那一层 —— 它把 `vscode-jsonrpc` 的 `StreamMessageReader / StreamMessageWriter` 套到 child_process 的 stdio 上，再把 notification / request 收发包成异步 API。

这一层有两个细节值得说：

第一，**先等 `spawn` 事件再用 stdio**。Node.js 里 `child_process.spawn()` 返回的对象一开始拿不到稳定的 stdio handle，必须等 `spawn` 事件触发后再读写，否则在 binary 实际找不到的情况下会拿到 ENOENT 而不是 spawn error。所以 LSPClient 在最外层 await 了一次 spawn，才把 stream 接到 jsonrpc reader/writer 上。

第二，**connection 还没好，handler 先排队**。`pendingHandlers` 这个队列存的是"等连接建立之后再注册的 notification / request handler" —— 这样上层可以在 spawn 之前就声明"我想监听 diagnostics"，不用关心实际连接什么时候才好。connection ready 之后队列一次性 flush。这个设计让 LSPServerInstance 那一层写起来更顺：状态机不必塞"已连未连"的判断。

`onCrash` 回调在子进程非零退出且不是主动 stop 时触发 —— 这是 LSPServerInstance 的崩溃恢复入口。

### LSPDiagnosticRegistry：把诊断攒成"刚刚好"

诊断是 LSP 子系统里最容易把上下文打爆的那一头：一个中型仓库随便就能喷几千条 hint。`services/lsp/LSPDiagnosticRegistry.ts:1-386` 用三个数字把它压扁：

```typescript
// services/lsp/LSPDiagnosticRegistry.ts:42-46
const MAX_DIAGNOSTICS_PER_FILE = 10
const MAX_TOTAL_DIAGNOSTICS = 30
const MAX_DELIVERED_FILES = 500
```

单文件最多 10 条，单次投递总量 30 条 —— 超出就按 Error < Warning < Info < Hint 的严重度排序砍掉低优先级，并在投递摘要里写明"因为容量限制丢了 N 条"。`MAX_DELIVERED_FILES = 500` 是个 LRU，记录"哪些文件最近已经把诊断送给模型看过了"，下次同样的诊断再来就跳过 —— 解决的是 LSP 服务器会在每次小改动后重发同一份诊断的问题。

这个 LRU 跟前面写工具收尾时那一刀 `clearDeliveredDiagnosticsForFile()` 是配套的：write 之后这份文件的诊断通常会变（你刚改完代码），所以把它从 LRU 里清掉，让新的诊断结果能马上重新送给模型。如果没有这一刀，模型改完代码、LSP 重发了新诊断，但因为"刚刚才送过"被去重掉，新报错就被吃了。这是写族和 LSP 族之间的另一条暗契约，跟 readFileState 那条对称。

### passiveFeedback：诊断怎么真正被送出去

`services/lsp/passiveFeedback.ts:1-328` 是 diagnostic 的回传通道。`registerLSPNotificationHandlers()` 在每台 LSP 服务器上注册 `textDocument/publishDiagnostics` 处理器，把 LSP 那一边主动推过来的诊断走到注册表里。

它做了两件容易被忽略的事：一是把 LSP 协议里 `severity` 那四个整数（1/2/3/4）映射成 Error/Warning/Info/Hint 字符串，让上层不用记这套编码；二是统计每台服务器的"连续诊断处理失败次数"，超过 3 就开始告警 —— 因为 LSP 服务器进入坏状态后会持续抛畸形数据，本地如果不数着，就会变成"明明诊断送达但模型每次都看不到任何错"的隐形失败。

`HandlerRegistrationResult` 返回的字段有 `totalServers / successCount / registrationErrors / diagnosticFailures`，让 manager 这一层能区分"7 台服务器全好"和"7 台里 1 台压根没注上"。

### 配置只走 plugin

`services/lsp/config.ts:1-79` 只有 79 行，做的事一句话讲完：LSP 服务器列表只从 plugin 里读，不从用户 settings / project settings / env 里读。

```typescript
// services/lsp/config.ts
getAllLspServers() // 仅来自 loadAllPluginsCacheOnly()
```

这条选择的含义不在代码里，在产品策略里：language server 启动行为对用户机器有较强影响（spawn 子进程、占内存、可能写缓存），所以把"哪些 LSP 跑起来"这个决策收口到 plugin —— plugin 是显式安装的，不像 settings 那样会被 IDE 默默改写。这跟 §3 配置体系里讨论的 7 层合并顺序是不冲突的：LSP 不是普通配置项，它是"功能注册"，走的是 plugin 通道而不是 settings 通道。

---

## 五、收口：REPLTool 与那八个被藏起来的工具

`tools/REPLTool/constants.ts:1-46` 这个不到 50 行的文件，描述了一条很少有人意识到、但每天在跑的暗规：

```typescript
// tools/REPLTool/constants.ts:13-30
export function isReplModeEnabled(): boolean {
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_REPL)) return false
  if (isEnvTruthy(process.env.CLAUDE_REPL_MODE)) return true
  return process.env.USER_TYPE === 'ant' &&
         process.env.CLAUDE_CODE_ENTRYPOINT === 'cli'
}
```

REPL 模式在 Anthropic 内部用户跑交互式 CLI 时默认开启 —— 注释说得很清楚为什么不让 SDK 入口默认开：SDK 的调用方是写脚本的人，他们的代码里直接 `client.tools.read(...)` 这样调，REPL 模式会把 Read/Write/Edit 等工具从可见列表里藏起来，对脚本来说是不可见的破坏。所以判断条件刻意要求"用户类型是 ant 且入口是 cli"两条同时成立。

REPL 模式打开后会发生什么？

```typescript
// tools/REPLTool/constants.ts:37-46
export const REPL_ONLY_TOOLS = new Set([
  FILE_READ_TOOL_NAME, FILE_WRITE_TOOL_NAME, FILE_EDIT_TOOL_NAME,
  GLOB_TOOL_NAME, GREP_TOOL_NAME, BASH_TOOL_NAME,
  NOTEBOOK_EDIT_TOOL_NAME, AGENT_TOOL_NAME,
])
```

这八个名字在工具列表里被抽掉了。模型直接调用 `Read` 会拿不到这个工具 —— 取而代之，它要通过 `REPL` 工具发一段 JS/TS 代码，在 REPL 的 VM 上下文里调 `Read(...)`、`Bash(...)`，由 REPL 一次性返回所有结果。

为什么要这么绕？因为模型在交互式 CLI 里经常一回合连发七八个 Read/Grep —— 把它们改成一段 JS 让 REPL 一次执行，节省的是 round trip 数和 tool_use 块的 token 开销。但这个收口不能损失工具的实际可用性，所以同样八个工具又通过另一个入口在 REPL VM 里照样存在：

```typescript
// tools/REPLTool/primitiveTools.ts:11-39 (节选) — lazy getter 避开循环依赖
let _primitiveTools: readonly Tool[] | undefined
export function getReplPrimitiveTools(): readonly Tool[] {
  return (_primitiveTools ??= [
    FileReadTool, FileWriteTool, FileEditTool, GlobTool,
    GrepTool, BashTool, NotebookEditTool, AgentTool,
  ])
}
```

注释里那段对 TDZ 的解释值得抄一遍：`collapseReadSearch.ts → primitiveTools.ts → FileReadTool.tsx → ...` 这条 import 链最终会绕回工具注册表，所以不能在模块顶层 `const` 求值，必须用 lazy getter 把求值推到第一次调用 —— 否则会触发"Cannot access before initialization"。这是工具家族扩到这个规模后必然撞上的循环依赖问题，源码选了 lazy 这一刀，没有去重新设计模块图。

为什么不是 `getAllBaseTools()` 而要硬列这八个？同样有注释：`getAllBaseTools()` 在 `hasEmbeddedSearchTools()` 为 true 时会把 Glob/Grep 摘掉，但 REPL VM 里这两个是必要的，所以这里跳过那一层，直接拼一份独立清单。

REPL 这一节看似跟"文件、代码、LSP"是分头的话题，但它其实是这一族工具的最后一道收口 —— 模型在交互式 CLI 里看到的"工具表面"被它压成了一个 `REPL` + 几个非 primitive 工具 + 一个 ToolSearch，前面我们花一整章讨论的八个工具反而退到了 REPL VM 的内层。

---

## 六、回望：这一族留给我们什么

把这八个工具加 `services/lsp/` 整体读完一遍，能看出源码在工具家族这一层反复出现的几个判断：

1. **契约靠字段值的形状传递，不靠文档**。`readFileState` 里 `offset: undefined` 这种值，等于在 FileRead 和 NotebookEdit 之间签了一份只有源码注释能解释的协议。同样，LSPDiagnosticRegistry 的 LRU 与写工具的 `clearDeliveredDiagnosticsForFile()` 也是隔空配合。
2. **保守优先于聪明**：mtime 不等说明读过的视图过期了，哪怕内容可能没变也宁可让模型再读一次；UNC 路径与其去处理不如直接放行；LSP 文件超 10MB 直接拒。
3. **协议细节包在工具内部**：LSP 0-based 位置在工具边界翻成 1-based；ContentModified 的退避重试发生在 LSPServerInstance 而不是工具层；configuration / workspaceFolders 这种 IDE 客户端要面对的能力直接关掉。
4. **重复 > 错误抽象**：UNC 短路在四个 validateInput 里各自重复一遍；Read/Write 的 readFileState 刷新动作也是各写各的；source code 没有去抽 helper，因为每个工具的"放行返回值"形状不一样。
5. **deferred 不是节流，是收口**：LSPTool 走 deferred 是因为它的工具描述本身就重，平时压根用不上；REPL 模式把八个高频工具藏到 VM 里也是同一种思路 —— 减少模型 prompt 表面，把执行重定向到一个 batch 通道。

下一章会从工具家族跳到第三方协议层 —— C13 讲那些"对话外的调度与通信"工具（WebFetch / WebSearch / ScheduleCron / RemoteTrigger / SendMessage / SleepTool / AskUserQuestion / SyntheticOutput / Brief / Config），它们跟本章八件套不太一样：本章的工具是"代码本身的副本与视图"，下一章的工具是"对话回路之外的世界"。

---

## 下一章预告

[第 13 章：通信、调度、问询与合成工具 — Agent 与外部世界之间的十条窄通道](./13-通信调度问询与合成工具.md)

我们把镜头掉转 180°，不再看 Agent 怎么动本地代码，而是看它怎么开口——WebFetch / WebSearch / ScheduleCron / RemoteTrigger / SendMessage / SleepTool / AskUserQuestion / SyntheticOutput / Brief / Config 十件工具，对话回路之外的世界。
