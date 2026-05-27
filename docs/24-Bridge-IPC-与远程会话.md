# 第 24 章：Bridge IPC 与远程会话 — 把本地 CLI 接到手机和浏览器上的那条线

> 本篇是《深入 Claude Code 源码》系列的第 24 篇。前面 23 篇我们都把 Claude Code 当成一个跑在终端里的进程：你敲 `claude`、它开 REPL、你按回车、它回答、退出。这一篇换一个场景：**你人在地铁上，会话却得继续跑**。

读者第一次看到 `bridge/` 这个目录、加上一旁同样陌生的 `remote/`、`commands/bridge/`、`commands/remote-setup/`、`commands/remote-env/`，第一反应往往是「这不是把一个 CLI 改成 server 了吗」。其实没那么夸张——这一摞代码做的只是一件事：**让你笔记本上跑着的那个 Claude Code 进程，对外暴露成一条能被手机点亮、被浏览器接管、被 Web UI 续写指令的会话**。

为什么这件事值得单独一篇？因为它把一个看似单进程的 CLI 拆成了**两端**：你按下回车的那一端，和真正动手干活的那一端，被一条由 WebSocket、JWT、子进程、控制帧、消息转译胶水起来的链路串了起来。链路里任何一段出错，对面就只看到一句「断线了」。Claude Code 在这条线上的工程心思和前面看过的对话循环、工具系统、Agent 编排是同一种气质——把异步、失败、续期都写在明面上，把「正常路径」缩到很小一段。

> **风格说明**：本章对齐第 1 篇《项目全景》与第 2 篇《启动优化》的写法——以「问题先行 → 源码佐证 → 设计推演」三段式推进，结尾以「可迁移的设计模式 + 实战示例」收束。
>
> 本章因涉及未公开的服务端契约，对 wire 协议帧布局、企业安全策略、上游服务器 endpoint 命名仅作接口层叙述，省略具体二进制 layout 与签名算法细节。阅读时请把出现的 URL 路径理解成「一类端点」，不要当作公开稳定契约。

本篇将回答四个核心问题：

1. **为什么不能用一条 HTTP 长连接解决全部？** — 三个绕不开的协议需求把架构推成两层
2. **一台本地机器是怎么被服务端「派单」的？** — `register → poll → work secret` 的握手协议
3. **远端的手机端怎么挂回这条会话？** — `SessionsWebSocket` 的失败分类表与 `worker_epoch` 的抢占识别
4. **三条命令入口分别打开了哪种形态？** — `/remote-control`、`/remote-setup`、`/remote-env` 各管一段

---

## 一、为什么需要 Bridge？

在拆代码之前先把场景描清楚。手机上点一下「Claude」图标，看到的是一条对话窗，但模型不在手机上跑——本地的 `claude` 进程还得动磁盘、读你的项目、跑测试。中间需要一条管道，把对面的输入翻译成本地 REPL 的「下一条用户消息」，再把本地的回答、工具调用、权限请求一路反向送出去。

如果完全用 HTTP 短轮询来做，这条管道至少有三处别扭：

第一，权限请求需要**双向**。本地的 BashTool 想跑 `rm -rf` 之前要弹 `can_use_tool`，手机端必须能在几秒钟内把「允许」或「拒绝」送回来，否则工具就卡在那里。HTTP 客户端不天然双向。

第二，会话的「主人」可能在路上**反复换手**。一会儿你在笔记本上盯着 REPL，一会儿换成手机，一会儿同事也想看一眼。每次换手，新接入的一端得能立刻看到这条会话的「现在的状态」，而不是从头回放。这要求服务端记得住会话最近的消息流。

第三，本地 CLI **不能信任地直接收外部消息**。它必须能验证「这条消息确实来自被签发了 token 的远端」，否则随便一个公网请求都能让本地跑命令。

`bridge/` 与 `remote/` 这两块代码加起来就是为了把这三件事一次性解决。bridge 负责**本地侧**：把自己注册成一个能被远端占用的环境、轮询任务、起子进程跑会话。remote 负责**远端侧**：订阅会话的 WebSocket、把控制帧塞回本地、把对面发来的消息转译成 REPL 能消化的格式。

| 协议需求 | Bridge 的回应 | 落地位置 |
|---------|-------------|---------|
| 双向控制帧 | `control_request` / `control_response` 走同一条 WS | `remote/RemoteSessionManager.ts:146-184` |
| 会话状态可换手 | 服务端持有 message stream，客户端订阅即拉 | `remote/SessionsWebSocket.ts:99-205` |
| 本地拒收未授权请求 | `session_ingress_token` + `X-Trusted-Device-Token` 双 token | `bridge/workSecret.ts` + `bridge/trustedDevice.ts` |

---

## 二、两层架构：环境与会话

打开 `bridge/types.ts`，开头几行就把整套抽象的两层结构挑明了：

```typescript
// bridge/types.ts:2
export const DEFAULT_SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000

// bridge/types.ts:69
export type SpawnMode = 'single-session' | 'worktree' | 'same-dir'

// bridge/types.ts:79
export type BridgeWorkerType = 'claude_code' | 'claude_code_assistant'
```

`Environment` 是上层抽象：一台机器、一个 git 仓库、一种派单模式，对应一次 `claude /remote-control` 的运行。`Session` 是下层抽象：一次具体的会话，跑在某个环境里。

环境只有一个，但**可以同时承接多个会话**——你在手机上同时开三个对话框，它们就变成三个 session 挂在同一个 environment 下，由本地这一个 `claude` 进程统一调度子进程。这个 1:N 关系是 Bridge 模式最关键的形状，下面所有故事都围着它转。

环境的形态由 `BridgeConfig`（`bridge/types.ts:81-115`）描述。`spawnMode` 决定每条会话该挂到当前进程上、还是另开 git worktree、还是直接占用当前目录。`workerType` 决定这个环境对外宣称的角色：是个能完整开 REPL 的 `claude_code`，还是个被砍掉所有写权限、只读的 `claude_code_assistant`。`maxSessions` 默认 32，与 GrowthBook 的 `tengu_ccr_bridge_multi_session` 一起决定本地能并发多少条会话。

要理解这一层，可以拿前面讲过的 Agent 系统做类比：Coordinator 那一章里的「主会话 + 派出的 Worker」是**对话层面**的两层架构，Bridge 这里的「Environment + Sessions」是**进程层面**的两层架构。两者在内部都使用「主体不动手，派人去干」的模式，只是 Bridge 派出去的是子进程，跨越的是一台机器以外的物理边界。

---

## 三、握手：register → poll → work secret

环境向服务端报到的逻辑写在 `bridge/bridgeApi.ts` 里。这一段是 Bridge 链路里最容易被忽略但最重要的部分，因为后面所有故事都依赖这次握手交出的几样东西。

### 3.1 注册环境

CLI 把自己的机器名、分支、仓库 URL POST 到一个 `/v1/environments/bridge` 形态的端点，带上 `anthropic-beta: environments-2025-11-01` 这条 beta 头。服务端回一条 `environment_id`，从这一刻起这台机器对服务端来说就是一个「可派单对象」。

`bridge/bridgeApi.ts` 顶部定义了一个 `SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/`。这一行不起眼，但它是 Bridge 全流程的安全底线——所有进出的 environment / session / bridge id 都必须先过这个正则，避免任何路径注入或服务端日志污染。

### 3.2 长轮询拿活儿

环境注册完，CLI 就进入 `runBridgeLoop` 主循环，不停问服务端「有没有给我的新会话」。它的退避表分两组：

```typescript
// bridge/bridgeMain.ts（DEFAULT_BACKOFF 节选）
{
  connInitialMs: 2_000,
  connCapMs: 120_000,        // 连不上的指数退避上限：2 分钟
  connGiveUpMs: 600_000,     // 连不上超过 10 分钟整个 bridge 退出
  generalInitialMs: 500,
  generalCapMs: 30_000,      // 业务出错的退避上限：30 秒
  generalGiveUpMs: 600_000,
}
```

两组分开的好处是：网络抖动不会被当成业务错误烧死重试预算，而业务错误也不会因为退避过长而让用户等到天荒地远。

还有一行 `pollSleepDetectionThresholdMs = 2 × connCapMs` 是为了应对**笔记本合盖**这种特殊场景：一觉醒来发现 `setTimeout` 实际睡了好几个小时，bridge 主动把这视为环境异常，重新走一遍 register 流程，避免拿一份过期 token 去问服务端然后被无声踢掉。这种「时间感知」类的防御，在终端工具里其实不多见。

### 3.3 拿到 work secret

当 long-poll 返回有任务时，response 里会带一段 base64url 编码的 `work_secret`。它在 `bridge/workSecret.ts:6` 的 `decodeWorkSecret()` 里被解码，包含 `session_ingress_token`、`api_base_url`、`sources`、`auth`、`claude_code_args`、`mcp_config`、`use_code_sessions` 这几个字段。

这一份小小的 JSON 是 Bridge 的「分单据」：服务端用它告诉本地「这次会话该连哪个 ingress、用哪个临时 token 自报家门、要不要走 envless 通道」。`use_code_sessions` 这个布尔字段会在下一节再出现，它决定本地是走传统的 session_ingress HTTP 协议还是新一代的 `code/sessions/{id}` 链路。

`session_ingress_token` 是一个有效期半小时量级的 JWT，本地把它存下来、所有后续向服务端发出的对话流量都用它做 Authorization。这个 token 的过期处理由 `bridge/jwtUtils.ts:72` 的 `createTokenRefreshScheduler` 接管——见 §九。

---

## 四、子进程编排：sessionRunner 把 stdout 翻成 activity

`work_secret` 解开之后，bridge 进入「真的开会话」这一步。`bridge/sessionRunner.ts` 是这里的主角。它做的事直白得让人吃惊：**起一个子进程、把它的标准输出按行解析、再把每一行翻译成服务端能读懂的 `activity`**。

```typescript
// bridge/sessionRunner.ts:70-89
const TOOL_VERBS: Record<string, string> = {
  Read: 'Reading',
  Edit: 'Editing',
  Bash: 'Running',
  // ...
}
```

这张映射表很有趣。它把工具的英文名换成进行时——`Read` 变成 `Reading`、`Bash` 变成 `Running`。手机上你看到的「正在读 `package.json`」「正在跑 `npm test`」就是这张表的直接产物。它不在服务端、也不在前端，就在你的本地 `sessionRunner` 里。这种「把状态文案的源头放到最靠近事实的那一端」是 Claude Code 反复出现的工程偏好——上一篇 Cron 调度里我们就看到过同样的写法。

`extractActivities()` 函数负责扫子进程的 stdout JSON 流，把 `tool_use` / `text` / `result` / `error` 这四类事件转成 activity 上报。它和第 5 篇看过的 SSE 解码逻辑同源——同一份 JSON 块，在终端里你看到的是渲染好的彩色界面，从这里看出去就是一条条扁平的事件。

子进程怎么起？`spawnScriptArgs()`（`bridge/sessionRunner.ts:47-54` 附近）会判断当前 `claude` 是编译进 bundled binary 的还是 npm dev 模式，给出不同的命令行。源码注释直接指到上游 issue [anthropics/claude-code#28334](https://github.com/anthropics/claude-code/issues/28334)——记录的是「编译态 vs npm 态在子进程参数解析上的行为差」。读者翻 git log 会看到它前后被改过好几次，每一次都是「编译进二进制带来的细节代价」。

子进程**寿命**由两个东西封顶：`DEFAULT_SESSION_TIMEOUT_MS`（24 小时）和 `onSessionDone()` 回调。前者保证再忘了的会话也不会一直占着进程槽，后者负责跑完之后清理 git worktree、`api.reconnectSession()` 把会话标记成 archived、对 `single-session` 模式还要 `controller.abort` 把整个 bridge 退出。

这里有个相对隐蔽的设计：401/403 失败的会话不会立即 fail，而是被**重新塞回服务端的队列**等下一次有效 token 时再领（源码注释里有 CC-1263 的设计编号），让短暂的鉴权抖动不至于杀死整条工作。

---

## 五、env-less 通道：当 /bridge 端点取代 register

写到这里你也许会想：为什么 envless 会话还要先注册一个环境再申请会话，而不能一步到位？答案是「正在转型，但还没全部转完」。

`bridge/remoteBridgeCore.ts` 是这条转型路径上的产物。它走的是另一组端点：直接 POST `/v1/code/sessions` 拿到会话 id，然后 POST `/v1/code/sessions/{id}/bridge` 拿到一份精简版的「分单据」——里面只有 `worker_jwt`、`expires_in`、`api_base_url`、`worker_epoch` 四样东西。整个流程没有 environment 这一层，所以代码里它被叫做「env-less」核心。

```typescript
// bridge/workSecret.ts:81
// buildCCRv2SdkUrl: 用 worker_jwt + worker_epoch 拼出 v2 ingress URL
```

它有一道单独的 feature flag `tengu_bridge_repl_v2` 把守，**仅** REPL 走这条路；daemon 模式和 print 模式还留在环境制下。这种「老的没废、新的并跑」的策略和第 19 篇编译期优化里讨论过的灰度模式一脉相承——给一条新链路一个独立 flag，让灰度发布期间老路径继续兜底。

`worker_epoch` 是这条链路里的小亮点。每调用一次 `/bridge` 端点，服务端就把会话的 epoch 加 1，并返回给客户端。客户端在所有后续 WebSocket 帧上都带这个 epoch；如果同一条会话被另一台机器**抢占**——你换到办公室那台笔记本接着用——旧的 epoch 立刻失效。这把 `register` 时代靠服务端单独维护 worker 注册表的事情压缩成了一个递增整数：更便宜、更不容易写错。

---

## 六、SessionsWebSocket：浏览器侧如何挂回这条会话

视角换到远端。手机或浏览器开了对话窗，**它**怎么知道你本地正在跑什么？答案在 `remote/SessionsWebSocket.ts`。

它包装的是一条 `wss://…/v1/sessions/ws/{id}/subscribe` 形态的 WebSocket。订阅成功后，所有从你本地 sessionRunner 翻出来的 activity 都会从 server 一路推到这条连接上。

```typescript
// remote/SessionsWebSocket.ts:17-36
const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_ATTEMPTS = 5
const PING_INTERVAL_MS = 30_000
const MAX_SESSION_NOT_FOUND_RETRIES = 3
const PERMANENT_CLOSE_CODES = new Set([4003]) // unauthorized
```

这五行可以倒着读，它们其实就是一张「失败分类表」：

- **4003 永久关闭**——服务端明说「这条会话彻底没了，别再连了」。`handleClose` 直接走 `onClose` 回调（`remote/SessionsWebSocket.ts:247-253`），客户端进入 `disconnected` 状态，不再重连。
- **4001 会话暂时找不到**——通常是服务端在做容器漂移、迁移或会话仓压缩的瞬间窗口。`sessionNotFoundRetries++`，最多重试 3 次，间隔随计数线性放大（`remote/SessionsWebSocket.ts:258-272`）。
- **其他网络错误**——用 5 次 backoff 重连（`remote/SessionsWebSocket.ts:275-287`），每 30 秒心跳一次保活（`startPingInterval`，`remote/SessionsWebSocket.ts:301-313`）。

为什么 4001 要特地做有限重试？因为它和**会话长期处于 compaction** 这种健康状态视觉上不可区分。如果不限制次数，浏览器会无穷重连一条已经在服务端被 GC 的会话，造成肉眼可见的「死循环」式断线提示。

`remote/RemoteSessionManager.ts:146-184` 的 `handleMessage` 在这一层之上又包了一层「会话生命周期」，按消息 type 分发：

```typescript
// remote/RemoteSessionManager.ts:154
if (message.type === 'control_request')       { /* 权限请求 */ }
// remote/RemoteSessionManager.ts:160
if (message.type === 'control_cancel_request') { /* 服务端撤回 */ }
// remote/RemoteSessionManager.ts:175
if (message.type === 'control_response')       { /* 控制帧确认 */ }
// remote/RemoteSessionManager.ts:181
if (isSDKMessage(message))                     { this.callbacks.onMessage(message) }
```

正常的对话消息直接交给上层 UI 渲染；控制请求走单独的 `handleControlRequest`（`remote/RemoteSessionManager.ts:189-214`）；控制取消走单独的清理路径。这种「按消息 type 分发」的写法你在第 5 篇 query 主循环里见过——同一种风格在网络层、对话层、UI 层反复出现，是这套代码的稳态。

`RemoteSessionConfig` 里还有一个值得留意的小字段 `viewerOnly`（`remote/RemoteSessionManager.ts:56-61` 注释）：当对面是 `claude assistant` 这类「只想看一眼」的客户端时，Ctrl+C / Escape 不会真的把 interrupt 信号发给远端；60 秒断线超时也被禁用；会话标题永远不被更新。这是把「观察者」和「驾驶者」在协议层就分开——不需要服务端帮忙，本地包装类自己就知道自己处于哪种身份。

---

## 七、权限回灌：control_request 走完一圈的路径

回到本地。当 BashTool 准备跑 `rm` 之前，它需要一次 `can_use_tool` 确认。在普通终端会话里，REPL 渲染出来一个 confirmation prompt 让你按 y/n。在 Bridge 模式下，这个 prompt 没有 UI 能渲染——你本人可能在地铁上，本地终端没人盯着。

`remote/remotePermissionBridge.ts:12` 的 `createSyntheticAssistantMessage` 解决的就是这件事。它把模型生成的 `can_use_tool` 工具调用**伪装成一条 assistant 消息**塞回会话流里，`id` 取 `` `remote-${requestId}` ``、`role` 设为 `'assistant'`、`content` 是一个 `tool_use` 块带模型原本想跑的 `tool_name` 与 `input`。`remote/remotePermissionBridge.ts:53` 的 `createToolStub` 同步生成一个 `needsPermissions: true` 的 stub 工具，让 UI 渲染时知道这是个需要确认的形态。

为什么用这种「伪装」做法？因为远端 UI 已经知道怎么渲染 `tool_use`——它本来就是模型在普通对话里要工具时的样子。把权限请求改造成同一种形态，远端就不需要再写一套 UI 来处理「这是权限询问而不是真正的工具调用」的特例。同一段渲染、同一个交互、同一份 mental model。

用户在手机上按了「允许」，回应通过 WebSocket 走回本地 `RemoteSessionManager.respondToPermissionRequest`（`remote/RemoteSessionManager.ts:247-282`）。回应的 payload 形如 `{type:'control_response', response:{subtype:'success', request_id, response:{behavior, ...}}}`，`behavior` 是 `allow` 或 `deny`：

- `allow` 分支带 `updatedInput`——远端 UI 可以**修改**模型原本想跑的参数（比如把 `rm -rf /tmp/foo` 改成 `rm -rf /tmp/foo/bar`），这一步是「我同意但我要稍微调一下」的入口。
- `deny` 分支带 `message`——拒绝的时候要给模型一个原因，让它知道接下来怎么换方案，而不是无脑重试。

服务端也可能**撤回**一个还没回答的请求——你已经在另一台设备上批准了。`handleMessage` 在 `control_cancel_request` 分支（`remote/RemoteSessionManager.ts:160-172`）里 `delete` 对应条目并调 `onPermissionCancelled`，把 `tool_use_id` 一并送出去让 UI 收掉对应的确认气泡。这是 Bridge 模式里少数几个「两端都得明白对方可能反悔」的地方，写好它的代价就是 `pendingPermissionRequests` 这张表的存在（`remote/RemoteSessionManager.ts:97-98`）。

---

## 八、消息转译：把 SDK 形态接回 REPL

Bridge 这一侧吐出来的是 Agent SDK 的 `SDKMessage` 系列结构——`init` / `assistant` / `stream_event` / `result` / `status` 各一种。但本地 REPL 内部用的是另一套 `Message` 类型，`type: 'user' | 'assistant' | 'system'`，带 `isVirtual` 这种 REPL 特有字段。中间得有一个翻译层。

`remote/sdkMessageAdapter.ts` 就是那张翻译表。它把 `convertAssistantMessage` / `convertStreamEvent` / `convertResultMessage` / `convertInitMessage` / `convertStatusMessage` 五种 SDK 消息按目标场景分别转换。`ConvertOptions` 里两个布尔字段决定细节差异：

- `convertToolResults`：是否把 `tool_result` 也翻成 REPL message——CCR 走的路径需要，DirectConnect 因为本地工具结果根本不离开本机就不需要。
- `convertUserTextMessages`：是否把对面送过来的纯文本「用户消息」回灌到本地 REPL——远端控制时需要这样让本地 REPL 显示「对面发来了……」。

这两个字段不抽象成一个 enum、就用两个 boolean，是因为业务里实际只有「CCR 模式」和「DirectConnect 模式」两种组合，再加一层枚举反而把意图藏起来了。

`bridge/bridgeMessaging.ts` 里还有一个反向过滤器 `isEligibleBridgeMessage`：

```typescript
// bridge/bridgeMessaging.ts
export function isEligibleBridgeMessage(m: Message): boolean {
  if ((m.type === 'user' || m.type === 'assistant') && m.isVirtual) return false
  return m.type === 'user'
      || m.type === 'assistant'
      || (m.type === 'system' && m.subtype === 'local_command')
}
```

只有真实的 user / assistant 消息、以及本地命令——`/clear` / `/compact` 这类——的系统反馈会被推到 bridge 通道。`isVirtual` 的占位消息一概留在本地。这条过滤线如果写错，远端会看到一堆它根本不懂的中间状态，又或者反过来漏掉了用户必须知道的 `/compact` 结束通知。这种「该送什么不该送什么」的边界判断是 Bridge 模式里最容易写偏的地方之一。

---

## 九、令牌与失败恢复

到这里 Bridge 主线就走通了：本地注册、轮询、起子进程、远端订阅、消息互转、权限互通。剩下的是支撑这条主线**在几小时甚至几十小时尺度上不掉线**的工程肌理。

### 9.1 Token 续期

`bridge/jwtUtils.ts` 给所有 JWT 类 token 提供了一个统一的调度器：

```typescript
// bridge/jwtUtils.ts:52-58
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000        // 提前 5 分钟换
const FALLBACK_REFRESH_INTERVAL_MS = 30 * 60 * 1000  // 解不出过期时间就半小时刷一次
const MAX_REFRESH_FAILURES = 3
```

`decodeJwtPayload`（`bridge/jwtUtils.ts:21`）处理一种特别的格式：服务端发的 token 前缀可能是 `sk-ant-si-…`，调度器要先把这层壳剥掉再 base64url 解 payload 拿 `exp`。如果解不出来——比如 token 是个不规则的 opaque string——就退到「每 30 分钟刷一次」的兜底节奏。连续 3 次刷失败就放弃，让上层调度对应的恢复路径：要么重新走 register，要么把会话标记 dead。

### 9.2 OAuth 失败的「安静处理」

`bridge/initReplBridge.ts` 在 REPL 启动时会检查 OAuth 状态，如果发现「本机没登录」或「最近三次启动都因为 OAuth 失败被踢」，**直接静默跳过**整个 bridge 初始化。源码里这条状态由一个跨进程的 `bridgeOauthDeadExpiresAt` 标志承载：连续 ≥ 3 次失败就在 deadline 之内不再尝试。

为什么要这么保守？因为 REPL 启动是高频路径。每一次冷启动都去问一遍服务端「我能不能加入 Bridge」会让没登录的用户每次启动都额外等一两秒。这种「连续失败 → 进入冷却期 → 冷却期内静默跳过」的模式在 Cron 调度那一章我们也见过，是 Claude Code 处理「可选功能初始化失败」的标准姿势。

### 9.3 关闭码到行为的映射

前面 `SessionsWebSocket` 看到的三档分类是这一摞代码里最容易写错也最难调试的地方——少一档就会把短暂的不可用看成永久死亡，多一档就会把永久死亡误当短暂不可用。表 9.3 把三档摘出来对照：

| 关闭码 | 服务端含义 | 客户端反应 | 源码位置 |
|-------|-----------|----------|---------|
| 4003 | 鉴权失败、会话被永久撤销 | `onClose` 直接告别 | `remote/SessionsWebSocket.ts:247-253` |
| 4001 | 会话暂时找不到（compaction 等） | 限次 3 重试 + 线性退避 | `remote/SessionsWebSocket.ts:258-272` |
| 其他 | 网络抖动 | 5 次指数 backoff | `remote/SessionsWebSocket.ts:275-287` |

### 9.4 Interrupt 信号

`RemoteSessionManager.cancelSession()` 通过一条 `{subtype: 'interrupt'}` 控制请求把远端的 Ctrl+C 翻成「本地正在跑的工具立即停下」：

```typescript
// remote/RemoteSessionManager.ts:294-297
cancelSession(): void {
  logForDebugging('[RemoteSessionManager] Sending interrupt signal')
  this.websocket?.sendControlRequest({ subtype: 'interrupt' })
}
```

`viewerOnly` 模式下这条线被禁用——观察者不该有权限叫停别人正在跑的会话。这条规则在 `RemoteSessionConfig` 的注释里写得明明白白，是一条「权能与角色」的硬绑定。

---

## 十、信任设备与登录

最后一块是**设备身份**。`bridge/trustedDevice.ts` 维护一个 90 天有效期的 trusted device token，保存在 macOS 的 keychain——或对应平台的安全存储——里：

```typescript
// bridge/trustedDevice.ts:33
const TRUSTED_DEVICE_GATE = 'tengu_sessions_elevated_auth_enforcement'
// bridge/trustedDevice.ts:45-52
// readStoredToken 先读 CLAUDE_TRUSTED_DEVICE_TOKEN 环境变量，再降级到 keychain
// bridge/trustedDevice.ts:98
// enrollTrustedDevice() 调 /api/auth/trusted_devices，服务端门 = 账号创建后 10 分钟内
```

`enrollTrustedDevice()` 调用的端点服务端有一道硬门：只有在 `account_session.created_at < 10min` 时才接受。换句话说，这台机器只有**刚刚走完 OAuth login 的那十分钟窗口**才能给自己拿一份 trusted device token。错过这个窗口，下次想登记得重新走一遍 `/login`。

这个设计的味道是「**信任在一段连续的人类动作里建立**」——你刚登录，键盘还在你手里、人脸还在屏幕前，这十分钟内服务端愿意把这台机器记入白名单；之后任何时刻冒出来一个「请把我也加入信任」的请求都会被服务端的另一道门拦下。`tengu_sessions_elevated_auth_enforcement` 这个 GrowthBook gate 决定这条门到底拉不拉起，是企业部署里能由管理员调的开关。

token 一旦在 keychain 里，所有 Bridge 请求都会在头部带一个 `X-Trusted-Device-Token`。服务端拿这个去和签发记录对账：如果设备指纹对上、token 未过期，就允许这次请求执行高敏感动作——比如批准一次远端权限请求；对不上就降级到普通 token 才允许的能力上。

---

## 十一、三个命令入口：用户从哪一句话打开这条线

到这里源码侧的所有齿轮都看完了。但 Bridge 这一摞代码对终端用户来说，其实只有三个能打出来的口令：`/remote-control`、`/remote-setup`、`/remote-env`。三条命令分别承载这三道形态的注册与 UI。它们的体量小到读者很容易当作纯样板代码跳过——`commands/bridge/index.ts` 26 行、`commands/remote-env/index.ts` 15 行——但每一条里都嵌着一道与前面这一摞工程肌理咬合的开关，值得逐条看一遍。

### 11.1 /remote-control：把当前会话让出去

`commands/bridge/index.ts:5-10` 把 `/remote-control`——别名 `rc`——注册成一个 `local-jsx` 命令，`isEnabled` 同时要求 `bundledMode` 的 `BRIDGE_MODE` 编译期 feature 打开 + 运行期 `isBridgeEnabled()` 返回真。这一对「编译期 + 运行期」双闸读起来有点啰嗦，但它是为了让企业版能用同一份二进制裁掉远程控制能力——`BRIDGE_MODE=false` 的编译产物里这条命令连出现在 `/help` 列表里都不会。

`commands/bridge/bridge.tsx:467` 的 `checkBridgePrerequisites()` 是真正的主体之一。预检按这个顺序跑：

1. `waitForPolicyLimitsToLoad()` 等 GrowthBook 拉完远端策略；
2. `isPolicyAllowed('allow_remote_control')` 看组织是否禁用；
3. `getBridgeDisabledReason()` 拉本机门；
4. `isEnvLessBridgeEnabled()` 与 `feature('KAIROS') && isAssistantMode()` 决定走 envless 链路（§五）还是带 environment 注册的旧链路（§三）；
5. `checkEnvLessBridgeMinVersion()` 或 `checkBridgeMinVersion()` 校 CLI 最低版本；
6. `getBridgeAccessToken()` 看本机有没有登录态。

预检任何一关失败就把人类可读的错误打回 REPL；通过了，就把 `replBridgeEnabled` 写进 AppState，由 `REPL.tsx` 的 `useReplBridge` Hook 接管，前文 §三 里 `runBridgeLoop` 的那条主线就是从这一步开始转的。

`bridge.tsx:155` 的 `BridgeDisconnectDialog` 走二次打开的路径：当 `replBridgeConnected || replBridgeEnabled` 已经是真且不是 `replBridgeOutboundOnly` 这种「只镜像不交互」的 CCR 模式时弹出，给用户三个选项——断开 / 显示二维码 / 继续。「显示二维码」走 `qrcode` 模块的 `toString`（`bridge.tsx:3`）把会话 URL 编成 UTF-8 文本块直接打在终端里。这是 Bridge 链路里唯一一处 UI 把 session URL 降级成可以离开屏幕的载体——你手机扫一下就能接上同一条会话——实现却小到只占十几行 React。

### 11.2 /remote-setup：把本地凭证送上去

`commands/remote-setup/` 走的是另一条路。它解决的是「我想直接在 claude.ai/code 网页里跑 Claude，而不是在本地终端跑 Bridge」这种场景。`commands/remote-setup/remote-setup.tsx:87` 的 `Web` 组件按一段状态机推进——`checking` → `confirm` → `uploading`：

1. `commands/remote-setup/remote-setup.tsx:23-61` 的 `checkLoginState` 先 `isSignedIn()` 看本机有没有 Claude OAuth 凭证；
2. 再 `getGhAuthStatus()` 看本机的 `gh` CLI 是不是已经登录了 GitHub；
3. 两个都满足，就 `execa('gh', ['auth', 'token'])` 拉出 GitHub token。

拿到 token 之后立刻用 `RedactedGithubToken`（`commands/remote-setup/api.ts:16`）包一层。这个包装类把 `toString` / `toJSON` / Node 的 inspect 协议全部改写成 `[REDACTED:gh-token]`，只有调 `.reveal()` 一次拿明文塞进 HTTP body，其余路径都拿不出原始 token。这是 Bridge 这一摞代码里少数几个「为了不写错日志而单独引一个类」的地方，背后假定的失败模式很直白：error logger 把这个 token 不小心序列化进 Sentry 一次就够把一个用户的 GitHub 权限漏给攻击者。

`commands/remote-setup/api.ts:51` 的 `importGithubToken` 把它 POST 到 `/v1/code/github/import-token`，带 `anthropic-beta: ccr-byoc-2025-07-29` 这条 beta 头（`commands/remote-setup/api.ts:7`）。服务端在自己的 sync_user_tokens 表里 Fernet 加密存住，之后 claude.ai/code 网页里跑出来的会话就能用这份 token 直接克隆 / 推送你的 repo。`commands/remote-setup/api.ts:119` 的 `createDefaultEnvironment()` 紧跟着是一次 best-effort 的默认环境创建：先 `fetchEnvironments()` 看一下有没有现成环境，没有就 POST `/v1/environment_providers/cloud/create` 建一个跑 `python 3.11` + `node 20` 的 anthropic_cloud 环境。这步失败不致命——前端落地页会自动路由到 env-setup 让用户手动建一个，多一次点击但不至于把用户卡死。失败分类共四种：`not_signed_in` / `invalid_token` / `server` / `network`，对应文案在 `errorMessage` 里一一映射，和 §六 的失败档位表是同一种气质。

### 11.3 /remote-env：让远端环境留在本地编辑

`commands/remote-env/` 是最薄的一条——`remote-env.tsx` 只有六行，整段命令直接把 `RemoteEnvironmentDialog` 这个组件 render 出来。`index.ts` 里的 `isEnabled` 双门也很有意思：`isClaudeAISubscriber()` && `isPolicyAllowed('allow_remote_sessions')`，前者按 OAuth 凭证里的订阅档位判，后者再过一道企业策略闸——两道门用同一条短路逻辑串起来，没订阅的免费用户和被组织禁用了远程会话的企业用户在 UI 上都看不到这条命令。它的目的是让用户能在 REPL 里直接编辑「我的默认远程环境」的脚本和环境变量，不必跳到网页——但这一层 UI 实际上把所有重活都委托给了 `RemoteEnvironmentDialog` 这个共享组件，所以命令文件本身只剩一层 1 行的转发。

三条命令并起来看，能读到 Bridge 模式对外暴露的「三道形态」：`/remote-control` 把当前本地会话让出去给远端控制；`/remote-setup` 把当前账号的本地 GitHub 凭证送上去让网页端能代你跑命令；`/remote-env` 让远端会话的环境定义留在本地编辑。三道形态共用同一条 ingress token + trusted device token 的凭证层，但走的是完全不同的服务端端点。命令层的克制——`/remote-env` 6 行、`/remote-control` 大部分行数花在 React 状态机上——也再次印证一件事：Bridge 这一摞代码的工程取舍偏向「让命令层薄到没有业务逻辑、把所有失败分类压在更下面一层」。

---

## 十二、收束：一条会话从手机点击到本地执行的全程

把上面十一小节连起来回看，你按下手机上「让 Claude 跑一下测试」那一刻，事情是这样发生的：

服务端收到这条 prompt，发现你本地有一个已经注册过的 Bridge 环境。它通过 long-poll 把任务连同一份 `work_secret` 推回本地。`runBridgeLoop` 解出 ingress token、起一个子进程跑 REPL，让子进程拿到你这条 prompt 当作初始消息。模型开始动手——读源码、跑命令、改文件。中途碰到 `npm test` 要授权，本地通过 `RemoteSessionManager` 把一条伪装成 `assistant.tool_use` 的消息推到 WebSocket 上。手机弹出「允许 Bash 跑 npm test ？」你按允许，回应顺着控制帧回到本地，子进程继续跑。`extractActivities` 把每一行 stdout 翻成「Running npm test」「Reading package.json」上报，手机上你看到一条流式更新。

会话跑完，子进程退出，`onSessionDone` 标记 session archived。如果是 worktree 模式，本地清掉那个临时 worktree。如果你出地铁了想接着用，新的 prompt 走同一条 environment 上的下一次 long-poll，重新起一条 session——`environment_id` 没变，但 `session_id` 是新的，「环境」与「会话」的两层 1:N 关系在这里收束。

中间任意一段连接断了：WebSocket 的 5 次 backoff、token 的提前 5 分钟续期、4003 永久关闭与 4001 限次重试、OAuth 失败的冷却期、worker_epoch 的抢占识别——这些机制各自管自己那一段，加起来你看到的是「网络不好的时候，对话会卡一下，但很少会丢」。

---

## 十三、可迁移的设计模式

Bridge 这一摞代码读完，有几条工程取舍可以单独拎出来用在别处。

### 模式 1：双轨并跑 + Feature Flag 灰度

环境制（`bridge/bridgeApi.ts`）与 env-less（`bridge/remoteBridgeCore.ts`）并存、CCR 与 DirectConnect 两套消息转译共用 `sdkMessageAdapter.ts`、driver 与 viewer 通过 `viewerOnly` 字段在客户端就分流——每一条新链路上线时，老链路都被原样保留，由 `tengu_bridge_repl_v2` / `tengu_ccr_bridge_multi_session` 这样的 GrowthBook flag 决定走哪一条。

这不是「兼容怕动老代码」，而是 Bridge 这条线上每一段失败都不只是代码失败：背后可能是一台真实笔记本断网、一个 OAuth provider 宕机、一个企业代理临时切了证书。这些失败要么压根没法在 CI 里复现，要么复现的成本高得离谱。

**适用场景**：任何「新链路要替换老链路、但失败半径覆盖你 CI 测不到的物理环境」的演进——网络协议升级、第三方鉴权切换、跨机房迁移。让两条路并跑半年、灰度看真实失败率，比一次性切换要稳得多。

### 模式 2：失败档位表 + 关闭码到行为的硬映射

`remote/SessionsWebSocket.ts:17-36` 那五行常量加 `handleClose` 里的三道分支，把整套断线策略压成了一张 3×3 的表：什么情况下永久放弃、什么情况下限次重试、什么情况下指数退避。少一档就把短暂的不可用看成永久死亡，多一档就把永久死亡误当短暂不可用。

把失败档位表写成可读的常量集合，而不是散落在 `if (err.code === ...)` 里，让 reviewer 一眼能看出「这种失败属于哪档」——是这种代码最经得起翻车的写法。

**适用场景**：所有需要长连接保活的客户端——SSE、WebSocket、gRPC streaming、MQTT。把关闭码到行为的映射前置到模块顶部常量，比把策略埋在 catch 里安全得多。

### 模式 3：双 token 凭证层 + 设备身份硬绑定

`session_ingress_token`（短期 JWT，半小时刷一次）+ `X-Trusted-Device-Token`（90 天 keychain 长 token）+ `account_session.created_at < 10min` 的服务端硬门，构成了 Bridge 的「凭证三件套」。短 token 管单次会话的鉴权、长 token 管设备身份的延续、硬门管设备首次入网的合法窗口。

这种「短凭证频繁刷、长凭证慢慢续、入网时机硬卡死」的组合在 mobile / IoT 行业很常见，但很少被搬进 CLI 工具。Bridge 把它搬过来，是因为本地 CLI 现在要承担一份和手机 app 一样的「自己代表用户在公网上活动」的责任——单靠一条 OAuth bearer token 不够。

**适用场景**：所有「客户端不是浏览器、要在公网上替用户长期发出请求」的场景——本地代理、桌面同步工具、设备控制端。短刷 + 长续 + 入网窗口硬卡，是绕开「token 一旦泄露就长期裸奔」的标准姿势。

---

## 十四、实战示例：把一条 Bridge 会话从断网恢复

把上面这些零件拼一下，看 Claude Code 是怎么应对一次真实的「地铁过隧道」断网的：

1. 你笔记本上跑着 `claude /remote-control`，环境已经在服务端注册（§三）。手机上开了对话窗，正盯着 sessionRunner 把 `Editing app.tsx` 推上来。
2. 列车进隧道，手机 4G 断 30 秒。`remote/SessionsWebSocket.ts:194-204` 的 `on('close', ...)` 触发，`handleClose` 拿到一个非 4001/4003 的网络错误码，进入「其他网络错误」档：`scheduleReconnect(2000, 'attempt 1/5')`。
3. 期间，本地 sessionRunner 不知道远端断了，继续把子进程 stdout 翻成 activity，POST 给服务端 ingress。这些 activity 在服务端缓存里堆着等订阅端回来。
4. 列车出隧道 8 秒后，第 1 次重连成功——`handleClose` 把 `reconnectAttempts` 清零。手机的 `RemoteSessionManager.handleMessage` 一口气收到堆积的 activity，UI 上看到的是「跳了一下，然后继续往下滚」。
5. 与此同时，`bridge/jwtUtils.ts:72` 的 `createTokenRefreshScheduler` 在后台跑——隧道里的 30 秒可能正好横跨了 `TOKEN_REFRESH_BUFFER_MS = 5min` 的窗口边界，刷 token 的 HTTP 请求会重试到拿到结果或连续 3 次失败为止。
6. 第二天早上你打开笔记本盖子，`pollSleepDetectionThresholdMs` 检测到 `setTimeout` 实际睡了 9 个小时（远超 `2 × connCapMs = 4 分钟`），bridge 主动认为环境异常，重新走一遍 register。`environment_id` 重新发号，旧的 `worker_epoch` 失效——如果同事昨晚也用同一份账号在另一台机器开了一个 environment，他那条会成为「现役」，你这条变成 stale。

整个流程里没有任何一处需要重启 `claude` 进程——所有断线分类、重连退避、token 续期、设备识别都跑在同一个 long-lived bridge 主循环内，靠的是 §六 的失败档位表、§九 的 token 调度器、§五 的 `worker_epoch` 抢占识别这三块拼起来。

---

---

## 下一章预告

[第 25 章：DirectConnect 与上游代理 — 把同一个 CLI 接到远端服务端和企业代理两条暗线上](./25-DirectConnect-与上游代理.md)

我们顺着同一条网络线再往外走一步，看 DirectConnect 和上游代理如何在 Bridge 这条管道更深一层处理企业网络里更别扭的拓扑。

---
*全部内容请关注 https://github.com/luyao618/Claude-Code-Source-Study (求一颗免费的小星星)*
