# 第 25 章：DirectConnect 与上游代理 — 把同一个 CLI 接到远端服务端和企业代理两条暗线上

> 本章是《深入 Claude Code 源码》系列第 25 章。前一章我们看的是 Bridge IPC：本地 CLI 怎么被手机和浏览器接管。这一章把视角再切一次——这次本地 CLI 不是被接管者，而是接管者。我们看两段乍看八竿子打不着、实际上对称得很的代码：`server/` 和 `upstreamproxy/`。
>
> **风格说明**：本章对齐第 1 章《项目全景》与第 2 章《启动优化》的写法——以「问题先行 → 源码佐证 → 设计推演」三段式推进，结尾以「可迁移的设计模式 + 实战示例」收束。
>
> **法律边界**：本章涉及企业内网拓扑、未公开的上游服务端契约、CCR 控制面 endpoint 与认证协议、MITM 注入策略。对 wire 帧布局、签发流程、密钥派生与审计字段仅作接口层叙述，省略具体协议层细节与企业安全配置项。出现的 URL 路径请按「一类端点」理解，不要当作公开稳定契约。

本章将回答四个核心问题：

1. **DirectConnect 是什么？** — 一条让本地 REPL 变成远端会话客户端的薄通道
2. **Upstream Proxy 是什么？** — 一条把容器内所有出网流量劫持到企业代理的暗线
3. **这两条线为什么放在一章？** — 它们在工程范式上是一对镜像
4. **能从中学到哪些可复用模式？** — 握手与长连分离、单 WS 双向 RPC、fail open、贴近 surface 的状态注入

## 一、两条「直连」线，一个 CLI

打开 `claude-code-cli` 的目录，你会看到两个名字里都带「直」「连」「代理」气息的目录：

```
server/
├── createDirectConnectSession.ts
├── directConnectManager.ts
└── types.ts

upstreamproxy/
├── upstreamproxy.ts
└── relay.ts
```

加上 `hooks/useDirectConnect.ts` 这条 React 端的接线，整篇代码量并不大：`server/` 三文件合计 358 行，`upstreamproxy/` 两文件合计 740 行，`hooks/useDirectConnect.ts` 229 行——一千出头行 TypeScript。但这两块代码做的事，方向完全相反。

`server/` 那一摞解决的问题是：**本地这个 `claude` 进程，怎么去连一台已经跑起来的、远端的 claude server**。它不是 server，是「连 server 的客户端」。换句话说，就是把本地 REPL 变成一个 WebSocket 客户端，把屏幕上敲下的字、按下的回车，通过 WS 推到远端那个真正在干活的进程里去；再把远端的 assistant 回复、工具调用、权限请求一路反向取回来摆在你眼前。

`upstreamproxy/` 那一对解决的问题是：**本地这个 `claude` 进程跑在一个 CCR 容器里时，它要怎么让自己（以及它将拉起的所有 bash / curl / gh / kubectl 子进程）的出网流量，都经过一个由企业控制的 MITM 代理**。它不是「往外连远端 claude」，它是「往外连别的东西」的时候被劫持到代理上去走一遭。

两条线一条向东、一条向西，连接的甚至不是同一类对方：一条连 claude server，一条连企业代理 server。但它们在工程实现上有强烈的对称性，被并到一章里讲的好处也在这里——你会发现 Claude Code 在面对「需要把流量从一个进程托管到另一台机器」这件事时，反复用的是同一套小积木：**WebSocket 当传输、HTTP 当握手、env var 当配置开关、`graceful` 当兜底**。把两条线放在一起看，这套积木的轮廓才看得清楚。

后面五节按这条思路走：先把 DirectConnect 这条线从握手到双向控制讲清楚，再把 Upstream Proxy 这条线从开关到 relay 讲清楚，最后回过头看这两条线在哪几处是对称的、在哪几处是不对称的、为什么 Claude Code 选择把它们写成两套而不是一套。

---

## 二、DirectConnect：把本地 REPL 变成远端会话的客户端

`server/` 这个目录的命名其实有点误导——它不实现 server，它实现的是「连 server」的客户端封装。真正的 server 端在 Anthropic 那边的另一个进程里（C24 Bridge 系列里也间接出现过它），本地这边只负责开一条 WebSocket 上去当个老老实实的双向终端。

为什么会有这个东西？很简单：开 REPL 的人和真正干活的进程，不一定在同一台机器上。最直白的两个场景，一个是 Cloud Workspace——你本地是个轻量 CLI，所有源码、所有工具运行都在云上一个分配给你的 workspace 里跑；另一个是 Headless 远程会话——你脚本化地从 CI 里去 `--connect` 一个长期运行的 sandbox。两个场景共用一套机制：**本地 CLI 负责输入、渲染、权限审批；远端 server 负责真正的 LLM 调用、工具执行、文件系统操作**。

中间的胶水有三层：HTTP 一次性握手、WebSocket 长连双向、React 端的状态绑定。三层分别落在 `createDirectConnectSession.ts`、`directConnectManager.ts`、`hooks/useDirectConnect.ts` 三个文件里。下面顺着这三层走。

### 2.1 一次握手：`createDirectConnectSession`

打开 `server/createDirectConnectSession.ts`，整个文件 88 行，做的就是一件事：POST 一个 `/sessions`，把返回值校验成一个 `DirectConnectConfig`。

```typescript
// server/createDirectConnectSession.ts:49-58
resp = await fetch(`${serverUrl}/sessions`, {
  method: 'POST',
  headers,
  body: jsonStringify({
    cwd,
    ...(dangerouslySkipPermissions && {
      dangerously_skip_permissions: true,
    }),
  }),
})
```

请求体里只有两样东西：调用方告诉服务端「我想把工作目录指到哪里」（`cwd`），以及一个可选的「我想跳过所有权限确认」（`dangerously_skip_permissions`）。两样都让服务端用来初始化它将要拉起的那个 claude 子会话。

返回的 schema 同样朴素，定义在 `server/types.ts:5-11`：

```typescript
export const connectResponseSchema = lazySchema(() =>
  z.object({
    session_id: z.string(),
    ws_url: z.string(),
    work_dir: z.string().optional(),
  }),
)
```

服务端只回三样：一个会话 ID、一条 WebSocket URL、可选的实际工作目录。前两者是后续所有通信的两根钥匙——`session_id` 是逻辑句柄，`ws_url` 是物理通道。`work_dir` 是给客户端 UI 用的「告诉用户你现在被放到哪个目录了」。

值得注意的是这个函数的错误处理。`createDirectConnectSession` 把所有失败都收敛成一个专有错误类 `DirectConnectError`（定义在 `server/createDirectConnectSession.ts:11-16`），分成三档：

- **fetch 抛异常** — 网络层断了；
- **resp.ok 为 false** — HTTP 状态不 OK；
- **Zod 校验失败** — 响应不符 schema。

三段处理写在 `server/createDirectConnectSession.ts:59-76`，全部包成 `throw new DirectConnectError(...)` 重新抛出。统一一个错误类型有个朴素的好处：上层只需要一行 `catch (e instanceof DirectConnectError)`，就能把三种底层错误折叠成同一句「连不上服务端，请检查 URL / Token / 网络」的提示。`main.tsx:3160` 与 `main.tsx:4072` 两个调用点正是这样用的。

到此为止，一次同步的 HTTP 握手就结束了。返回的 `DirectConnectConfig` 长这样（`server/directConnectManager.ts:13-18`）：

```typescript
export type DirectConnectConfig = {
  serverUrl: string
  sessionId: string
  wsUrl: string
  authToken?: string
}
```

四个字段，前两个来自调用方，后两个来自服务端响应。这四个字段是下一节 `DirectConnectSessionManager` 的全部输入。

### 2.2 长连：`DirectConnectSessionManager` 的消息分流

握手完成后，真正长期工作的是 `directConnectManager.ts:40-213` 这个 `DirectConnectSessionManager` 类。它就是一个 WebSocket 客户端的薄薄一层封装，把四类事件——`onMessage` / `onPermissionRequest` / `onConnected` / `onDisconnected`——通过 `DirectConnectCallbacks` 暴露给上层。

```typescript
// server/directConnectManager.ts:20-29
export type DirectConnectCallbacks = {
  onMessage: (message: SDKMessage) => void
  onPermissionRequest: (
    request: SDKControlPermissionRequest,
    requestId: string,
  ) => void
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: Error) => void
}
```

注意这里把 `onMessage` 和 `onPermissionRequest` 拆成了两条独立回调。这一拆是有讲究的：服务端通过同一条 WebSocket 把两类信息混在一起送下来——一类是普通的 SDK 消息（assistant 回复、tool_use、system 事件），另一类是带 `request_id` 的双向控制请求（典型的就是 `can_use_tool`）。前者只需要追加到消息流里，后者必须有响应往回送。

`connect()` 里的 `message` 监听器（`directConnectManager.ts:64-114`）就是这个分流器：

```typescript
// server/directConnectManager.ts:80-100（节选）
if (parsed.type === 'control_request') {
  if (parsed.request.subtype === 'can_use_tool') {
    this.callbacks.onPermissionRequest(
      parsed.request,
      parsed.request_id,
    )
  } else {
    logForDebugging(
      `[DirectConnect] Unsupported control request subtype: ${parsed.request.subtype}`,
    )
    this.sendErrorResponse(
      parsed.request_id,
      `Unsupported control request subtype: ${parsed.request.subtype}`,
    )
  }
  continue
}
```

碰到 `control_request` 走权限分支；其他类型则走消息分支。消息分支挡着一张「不要往上扔」白名单（`directConnectManager.ts:102-112`），里面六条规则分别对应：握手响应、心跳、取消、给服务端 UI 用的精简文本、给服务端 UI 用的工具调用摘要、post-turn 自动总结。这六类消息对上层 React 组件没意义，分流器内部就消化掉，省得每个组件再写一遍过滤。

更细一点的现实考虑藏在 unsupported subtype 那个分支：如果服务端发了一条 `control_request`、但 subtype 不是 `can_use_tool`，本地不会装作没看见——它会**主动回一条 `subtype: 'error'` 的 control_response**。这一段在 `directConnectManager.ts:188-201` 的 `sendErrorResponse` 里：

```typescript
// server/directConnectManager.ts:188-201（节选）
private sendErrorResponse(requestId: string, error: string): void {
  const response = jsonStringify({
    type: 'control_response',
    response: {
      subtype: 'error',
      request_id: requestId,
      error,
    },
  })
  this.ws?.send(response)
}
```

为什么必须主动回？因为服务端在等待——它发出的每一条 `control_request` 都挂着一个 `request_id`，没收到响应就会一直挂着，下一轮会话被堵住。这种「未来新增 control 类型时，旧客户端如何不让对方死锁」的处理，是 wire 兼容性写作里最容易漏的点，这里写在最显眼的位置。

`sendMessage` 是另一边——本地往服务端推用户输入。它把内容包成 SDK 期望的形态（`directConnectManager.ts:131-139`）：

```typescript
const message = jsonStringify({
  type: 'user',
  message: {
    role: 'user',
    content: content,
  },
  parent_tool_use_id: null,
  session_id: '',
})
```

这里那个 `session_id: ''` 不是 bug 也不是占位符——它必须为空。整条 WebSocket 是单会话的，session 是连接级别的概念，由握手时返回的 URL 隐含；消息体里再带一份反而会被服务端拒绝。

权限响应 `respondToPermissionRequest`（`directConnectManager.ts:144-167`）和中断 `sendInterrupt`（`directConnectManager.ts:172-186`）走同一根 WebSocket，但走不同的 envelope：响应是 `type: 'control_response'`，中断是 `type: 'control_request'` 带 `subtype: 'interrupt'`。两者共用一个 `request_id` 概念但语义反转——响应用的是服务端给的 ID，中断用的是客户端自己 `crypto.randomUUID()` 生成的新 ID。这是双向 RPC over 单一 WS 通道的标准做法，看一眼就能套到别的项目。

### 2.3 React 端的接线：`useDirectConnect`

`hooks/useDirectConnect.ts` 是 `DirectConnectSessionManager` 在 React 树里的代言人。它把那个原本可以独立运行的 manager 包成一个 React Hook，让 REPL 屏（`screens/REPL.tsx`）只需要传一份 `DirectConnectConfig` 进去，就能拿到四个稳定引用：`isRemoteMode` / `sendMessage` / `cancelRequest` / `disconnect`。

这一层有几个细节值得停下来看一眼。

第一个是 `toolsRef` 这个 ref（`hooks/useDirectConnect.ts:53-56`）：

```typescript
const toolsRef = useRef(tools)
useEffect(() => {
  toolsRef.current = tools
}, [tools])
```

为什么不直接在 onPermissionRequest 闭包里读 `tools`？因为 `onPermissionRequest` 是绑死在 WebSocket 上的回调，闭包捕获的是**初次绑定时**的 tools 引用。如果用户在远程会话中途加载了新工具，比如 MCP server 接入了新 tool，不更新的话权限弹窗里就找不到这条 tool 的元数据，只能 fallback 到 `createToolStub`。`toolsRef` 这一手是 React 工具箱里非常套路化的「让长生命周期的回调读到最新值」的写法，但放在 DirectConnect 这种「连接一旦建立就活一整轮」的场景里特别关键。

第二个是 `hasReceivedInitRef` 这个去重（`hooks/useDirectConnect.ts:73-78`）：

```typescript
if (sdkMessage.type === 'system' && sdkMessage.subtype === 'init') {
  if (hasReceivedInitRef.current) {
    return
  }
  hasReceivedInitRef.current = true
}
```

服务端每轮 turn 都会重发一条 `system.init`——里面包含模型名、可用工具列表等会话级元数据。对服务端而言这是无害的冗余；对本地 REPL 而言每一条 init 都会触发一遍欢迎横幅渲染。这一手只保留第一次，后续 init 静默丢弃。看起来是 UI 细节，但其实是一种「服务端 wire 兼容 + 客户端体验收敛」的典型分工——服务端按它最稳的方式发，客户端按它最克制的方式收。

第三个是 `onDisconnected` 里的语义分叉（`hooks/useDirectConnect.ts:165-179`）：

```typescript
onDisconnected: () => {
  logForDebugging('[useDirectConnect] Disconnected')
  if (!isConnectedRef.current) {
    process.stderr.write(
      `\nFailed to connect to server at ${config.wsUrl}\n`,
    )
  } else {
    process.stderr.write('\nServer disconnected.\n')
  }
  isConnectedRef.current = false
  void gracefulShutdown(1)
  setIsLoading(false)
},
```

WebSocket 的 `close` 事件不区分「从来没连上」和「连上后掉线」，但用户看到的提示必须区分——前者是配置错误，后者是网络抖动。`isConnectedRef` 这个 ref 在 `onConnected` 里被翻成 true，在 `onDisconnected` 里被读，靠这一个布尔位把两种状态分开。

然后无论哪种情况都触发 `gracefulShutdown(1)`——一旦掉线，整个 CLI 进程退出，不试图重连。这是有意的设计：DirectConnect 是「我把命交给远端」的模式，对端不在就没有继续在本地兜底的必要。Bridge 那条线相反——它会反复 register-poll 直到拿到环境，因为本地才是主体。

第四个是 onPermissionRequest 里那个 `toolUseContext: {} as ToolUseConfirm['toolUseContext']`（`hooks/useDirectConnect.ts:115`）：

```typescript
const toolUseConfirm: ToolUseConfirm = {
  assistantMessage: syntheticMessage,
  tool,
  description:
    request.description ?? `${request.tool_name} requires permission`,
  input: request.input,
  toolUseContext: {} as ToolUseConfirm['toolUseContext'],
  toolUseID: request.tool_use_id,
  ...
}
```

注意那个空对象的强制 cast。本地权限弹窗的类型签名要求一个完整的 `toolUseContext`，里面有 reading lists、追踪指针等一堆本地执行才用得到的字段。但 DirectConnect 场景下工具实际在远端跑，本地的 context 是个空概念。手动构造一个空对象再 cast 过去，比另起一个分支的 union 类型更省事——本地这套逻辑里已经有几十个地方读 `toolUseContext`，重新拆 union 会传染到每一处。这是「类型完美 vs. 代码量」的一处取舍，作者选了后者。

`useMemo` 在最后把四个引用收成稳定结果（`hooks/useDirectConnect.ts:225-228`）：

```typescript
return useMemo(
  () => ({ isRemoteMode, sendMessage, cancelRequest, disconnect }),
  [isRemoteMode, sendMessage, cancelRequest, disconnect],
)
```

这里的注释直接点了名「Same stability concern as useRemoteSession」——前章 C24 看过的那个 `useRemoteSession` 也用了同一招。两个 hook 是姐妹关系：一个连 Bridge 后端、一个连 DirectConnect 后端，它们对外暴露的稳定性契约是一致的，所以「记得 useMemo 收口」这条经验在两边都成立。

### 2.4 DirectConnect 这条线的整体形状

把三层叠起来看，DirectConnect 给本地 REPL 拼出来的是一种**「壳子在这边，灵魂在那边」**的形态。本地这个 `claude` 进程从头到尾不调用 Anthropic API，不执行任何工具，不读任何用户文件——它只做三件事：

1. **输入接收**：把键盘输入打包成 `SDKUserMessage` 推过去；
2. **消息渲染**：把收到的 SDK 消息塞进 React 状态树，让 Ink 画在终端里；
3. **权限审批**：把远端发起的 `can_use_tool` 弹成本地的权限弹窗，把用户的允许/拒绝/反馈作为 `control_response` 推回去。

模型推理、Bash 执行、文件读写——全部在 `wsUrl` 那一端的进程里。这是 Claude Code「把同一份 CLI 同时塑造成 native 和 thin client」这件事的最干脆实现：thin client 的代码量比 native CLI 小一个数量级，但终端里呈现给用户的体验和 native 模式没有可见差别。

---

## 三、Upstream Proxy：CCR 容器里的 MITM 出口

`upstreamproxy/` 这一对文件做的事和 `server/` 那边在精神上是反的。`server/` 是「我去连一个远端服务」，`upstreamproxy/` 是「我让所有从我这进程及子进程发出去的 HTTPS 请求都经过一个企业代理」。

为什么有这个东西？因为 Claude Code 不是只跑在你的笔记本上。它的一种重要部署形态是 CCR（一种受控的远程容器化运行环境，名称在源码里写作 `CLAUDE_CODE_REMOTE`）。CCR 把每一次会话装在一个一次性容器里，容器的出网是受控的——它不能随便连公网，所有出网流量都必须经过一个企业控制的代理，由代理负责注入凭据、做合规审计、决定能去哪些上游。

`upstreamproxy/upstreamproxy.ts` 顶部的注释把这件事写得很清楚（`upstreamproxy/upstreamproxy.ts:1-20`）。我把它翻译一下：在 CCR 容器里启动时，这个模块要：

1. 从 `/run/ccr/session_token` 读一个 token；
2. 调 `prctl(PR_SET_DUMPABLE, 0)` 防止同 UID 的进程 ptrace 自己的堆；
3. 从上游下载一份 CA 证书，和系统证书拼起来，让 curl / gh / python 信任那个 MITM 代理；
4. 起一个本地的 CONNECT→WebSocket relay；
5. 把 token 文件 unlink（token 留在堆里，文件先消失，但要等 relay 起来之后再删，方便 supervisor 重启重试）；
6. 通过 env var 把代理地址注入到所有 agent 子进程。

每一步都「fail open」——任何一步出错都只打一条警告然后放弃，绝不让一个坏掉的代理把整个会话拖死。

这是一条非常具体的部署线，它的所有逻辑都是为了**「让一个不可见的劫持层」无缝插到容器的所有出网路径上**。下面顺着这六步走。

### 3.1 双闸开关

最显眼的设计是入口的双重 env var 闸门（`upstreamproxy/upstreamproxy.ts:85-94`）：

```typescript
if (!isEnvTruthy(process.env.CLAUDE_CODE_REMOTE)) {
  return state
}
if (!isEnvTruthy(process.env.CCR_UPSTREAM_PROXY_ENABLED)) {
  return state
}
```

两条 env var 分别管两件事。`CLAUDE_CODE_REMOTE` 是「我现在跑在 CCR 容器里吗」的总开关；`CCR_UPSTREAM_PROXY_ENABLED` 是「这次会话要不要启用 upstream proxy」的具体开关。两道一起当真才走下去。这种「环境闸 + 功能闸」分开的设计有一个看起来反直觉但其实关键的好处：upstream proxy 是一个 GrowthBook 控制的灰度功能，但 GrowthBook 的客户端 SDK 在 CCR 容器里**永远拿不到值**——每个容器都是冷的，本地缓存是空的，灰度评估只能由控制面在签发容器时完成，并通过 env var 透传进来。源码注释明明白白点了这个坑（`upstreamproxy/upstreamproxy.ts:88-92`），「Every CCR session is a fresh container with no GB cache, so a client-side GB check here always returned the default (false)」——所以这里只能信 env，不能直接调 GrowthBook。

### 3.2 token 的「先用后销」

读到 token 之后，并不会马上把磁盘上的 token 文件删掉。删除被推迟到了 relay 真正起来之后（`upstreamproxy/upstreamproxy.ts:132-144`）：

```typescript
try {
  const wsUrl = baseUrl.replace(/^http/, 'ws') + '/v1/code/upstreamproxy/ws'
  const relay = await startUpstreamProxyRelay({ wsUrl, sessionId, token })
  registerCleanup(async () => relay.stop())
  state = { enabled: true, port: relay.port, caBundlePath }
  logForDebugging(`[upstreamproxy] enabled on 127.0.0.1:${relay.port}`)
  await unlink(tokenPath).catch(() => {
    logForDebugging('[upstreamproxy] token file unlink failed', {
      level: 'warn',
    })
  })
}
```

注释把理由写在了原地（`upstreamproxy/upstreamproxy.ts:138-139`）：「Only unlink after the listener is up: if CA download or listen() fails, a supervisor restart can retry with the token still on disk.」如果在 listener 起来之前就把 token 删了，CA 下载或者监听端口失败、supervisor 拉起新进程，新进程就再也读不到 token——会话彻底瘫掉。先保住能恢复，再消除可见的 secret，这是这种「敏感凭据初始化」类代码的标准动作顺序。

而在内存里把 token 收紧的那一手，是 `setNonDumpable`（`upstreamproxy/upstreamproxy.ts:225-252`）。它通过 Bun FFI 直接调 libc 的 `prctl(PR_SET_DUMPABLE, 0)`：

```typescript
// upstreamproxy/upstreamproxy.ts:225-252（节选）
function setNonDumpable(): void {
  if (process.platform !== 'linux' || typeof Bun === 'undefined') return
  const lib = dlopen('libc.so.6', { prctl: { args: ['i32', 'u64', 'u64', 'u64', 'u64'], returns: 'i32' } })
  lib.symbols.prctl(PR_SET_DUMPABLE, 0n, 0n, 0n, 0n)
}
```

这一手意图很硬核——它告诉内核「我这个进程不可被 dump」，于是同 UID 的进程没法 `gdb -p $PPID` 去扒堆里的 token。注释里直接给了威胁模型：「a prompt-injected `gdb -p $PPID` can't scrape the token from the heap」。在 CCR 这种「同一个容器里跑用户代码 + 我们自己代码」的场景里，让大模型生成一段 `gdb` 命令并不是天方夜谭，所以这条防线是有明确目标的。

但要注意它**实际生效的范围非常窄**。文件顶部那道守卫 `if (process.platform !== 'linux' || typeof Bun === 'undefined') return` 把这段 FFI 限定在「Linux 且 Bun runtime」两条同时为真才执行。CCR 容器里 CLI 是用 Node 跑的（见 §3.4 对 `upstreamproxy/relay.ts:152-154` 的引用），所以 CCR 路径上这段代码其实**不会执行**；本地开发态的 macOS / Windows 上同样不会触发。换句话说，它更像是「写好备用、等 Bun 能跑 CCR 时自动激活」的占位防线，而不是当前 CCR 部署中真正在挡 `gdb` 的那道防线。

### 3.3 NO_PROXY 列表

`NO_PROXY_LIST` 这一段（`upstreamproxy/upstreamproxy.ts:37-63`）看起来像配置，但其实是一份很有意思的「我应该绕过自己」清单：

```typescript
const NO_PROXY_LIST = [
  'localhost',
  '127.0.0.1',
  '::1',
  '169.254.0.0/16',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  'anthropic.com',
  '.anthropic.com',
  '*.anthropic.com',
  'github.com',
  'api.github.com',
  '*.github.com',
  '*.githubusercontent.com',
  'registry.npmjs.org',
  'pypi.org',
  'files.pythonhosted.org',
  'index.crates.io',
  'proxy.golang.org',
].join(',')
```

这份清单分三类。第一类是 loopback 和 RFC1918——容器内部网络、私有网段、IMDS（云元数据接口），代理碰这些只会绕远不会增值。第二类是 `anthropic.com`——代理不能拦 Claude 自己的 API 调用，否则上游会 MITM 掉自己的服务，而且非 Bun 运行时（比如 Python httpx）对自签 CA 的信任链处理千差万别，必然炸。注释直接点名「Python urllib/httpx (suffix match, strips leading dot)」（`upstreamproxy/upstreamproxy.ts:48-49`）这种细节——这是踩过的坑。第三类是 GitHub / npm / pypi / crates / go proxy——这些公共包索引是 CI 环境里 Bash / Curl / git 工具最常碰的，代理对它们没有合规需求，直连最快。

写三种不同形式（`anthropic.com` / `.anthropic.com` / `*.anthropic.com`）也是踩过坑：不同语言、不同 HTTP 客户端解析 `NO_PROXY` 的语义不同，Bun 当 glob，Python 当后缀，Go 当域名前缀——三种都写一遍才能保证一份配置打天下。

### 3.4 relay：CONNECT-over-WebSocket

`upstreamproxy/relay.ts` 这一个文件 455 行，是这一整章里实现最重的一段。它做的事一句话能说清：**起一个本地 TCP 监听，接受标准的 HTTP CONNECT 请求，然后把 CONNECT 之后的字节通过 WebSocket 隧道送到企业代理**。

为什么走 WebSocket 而不是直接的 TCP CONNECT？文件顶部注释把理由摆得很正面（`upstreamproxy/relay.ts:10-12`）：「CCR ingress is GKE L7 with path-prefix routing; there's no connect_matcher in cdk-constructs.」企业入口是 GKE 七层网关，路径前缀路由，没有 TCP CONNECT 匹配器；要在这层网关后面拿到一条全双工通道，唯一可行的就是 WebSocket。Session ingress 通道（C24 见过）已经在用这套模式，这里复用同一个范式。

字节在 WebSocket 上不是裸传的，而是包成一个 protobuf 消息（`upstreamproxy/relay.ts:14-16`）：

```
message UpstreamProxyChunk { bytes data = 1; }
```

包装是手写的——`encodeChunk`（`upstreamproxy/relay.ts:66-81`）只有 10 行，因为只有一个字段：

```typescript
export function encodeChunk(data: Uint8Array): Uint8Array {
  const len = data.length
  const varint: number[] = []
  let n = len
  while (n > 0x7f) {
    varint.push((n & 0x7f) | 0x80)
    n >>>= 7
  }
  varint.push(n)
  const out = new Uint8Array(1 + varint.length + len)
  out[0] = 0x0a
  out.set(varint, 1)
  out.set(data, 1 + varint.length)
  return out
}
```

一个 tag 字节、一段 varint 长度、然后 payload。本来这种事可以让 protobufjs 替你做，但作者选了手写——注释里给了理由：「avoids a runtime dep in the hot path」。这是 hot path，每一条出网请求每一段 TCP segment 都要过一次 encode/decode，一个 runtime 解析器的开销不值得为了 10 行省下来。这一手的判断尺度很重要：**不是所有事都要 runtime lib，看路径热不热**。

整个 relay 的状态机集中在 `ConnState` 类型（`upstreamproxy/relay.ts:110-127`）：

```typescript
type ConnState = {
  ws?: WebSocketLike
  connectBuf: Buffer
  pinger?: ReturnType<typeof setInterval>
  pending: Buffer[]
  wsOpen: boolean
  established: boolean
  closed: boolean
}
```

七个字段对应三件事：WebSocket 本身、CONNECT 阶段的累积缓冲、TCP-上行到 WS 阶段的待发缓冲，以及三个布尔状态位。`pending` / `wsOpen` / `established` 三个字段共同处理了一个很现实的时序问题——客户端发完 CONNECT 头不会等服务端响应再发后续字节，TCP 经常把 CONNECT 头和 TLS ClientHello 合并在一个 packet 里，而本地起 WebSocket 又是异步的。如果不在 wsOpen 翻转前缓冲这些字节，就会有静默丢字节的 bug。注释把这个 corner case 标得很显眼（`upstreamproxy/relay.ts:113-117`）：「TCP can coalesce CONNECT + ClientHello into one packet, and the socket's data callback can fire again while the WS handshake is still in flight. Both cases would silently drop bytes without this buffer.」

数据流入用 `handleData`（`upstreamproxy/relay.ts:295-342`）作为统一入口，分两个相位：

```typescript
if (!st.ws) {
  st.connectBuf = Buffer.concat([st.connectBuf, data])
  const headerEnd = st.connectBuf.indexOf('\r\n\r\n')
  if (headerEnd === -1) {
    if (st.connectBuf.length > 8192) {
      sock.write('HTTP/1.1 400 Bad Request\r\n\r\n')
      sock.end()
    }
    return
  }
  ...
}
if (!st.wsOpen) {
  st.pending.push(Buffer.from(data))
  return
}
forwardToWs(st.ws, data)
```

相位一是「找 CRLF CRLF 攒齐 CONNECT 请求」，相位二是「WS 没开就缓冲、开了就转发」。8192 字节是一个保险阈值——没有客户端能写一个比 8K 大的 CONNECT 头，写到了就当攻击或者 bug 处理，回个 400 把 socket 关掉。

`openTunnel`（`upstreamproxy/relay.ts:344-428`）把 CONNECT 头和 `Proxy-Authorization` 一起塞进第一条 WebSocket 帧：

```typescript
ws.onopen = () => {
  const head =
    `${connectLine}\r\n` + `Proxy-Authorization: ${authHeader}\r\n` + `\r\n`
  ws.send(encodeChunk(Buffer.from(head, 'utf8')))
  st.wsOpen = true
  for (const buf of st.pending) {
    forwardToWs(ws, buf)
  }
  st.pending = []
  st.pinger = setInterval(sendKeepalive, PING_INTERVAL_MS, ws)
}
```

那条 `Proxy-Authorization: Basic <base64(sessionId:token)>` 是真正让代理识别「这次隧道属于哪个 session」的凭据。WebSocket 自己的 `Authorization: Bearer <token>`（在 `headers` 里）是给前面那个 GKE 网关做 upgrade 鉴权用的，两者各管一道门。

`ws.onerror` 和 `ws.onclose` 那两段（`upstreamproxy/relay.ts:410-427`）做了一件特别值得拎出来看的事：

```typescript
ws.onerror = ev => {
  const msg = 'message' in ev ? String(ev.message) : 'websocket error'
  logForDebugging(`[upstreamproxy] ws error: ${msg}`)
  if (st.closed) return
  st.closed = true
  if (!st.established) {
    sock.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
  }
  sock.end()
  cleanupConn(st)
}
```

`established` 是在第一条服务端 chunk 抵达时翻成 true 的（`upstreamproxy/relay.ts:404-407`）。`established === true` 意味着客户端已经在和远端跑 TLS 了，这时候本地再写一段明文 `502 Bad Gateway` 进去，就等于把客户端的 TLS 流损坏了，curl 会报一句不知所云的 `OpenSSL SSL_read: error:0A000126`。所以一旦 established，就只 close，不写——这是一条「在 TLS 隧道里不要乱说话」的硬规则。

`closed` 这个布尔位则是为了对付 `onerror` 后必然紧跟一个 `onclose` 的事件模式——没这个守卫，两次 cleanup 会对一个已经 end 过的 socket 再 end 一次，触发一个不必要的 ECONNRESET 噪音。

最后是 Bun 与 Node 双实现：`startBunRelay`（`upstreamproxy/relay.ts:176-241`）和 `startNodeRelay`（`upstreamproxy/relay.ts:245-289`）是两套并存的实现。注释解释得很直白（`upstreamproxy/relay.ts:152-154`）：「the CCR container runs the CLI under Node, not Bun」。两者最大的区别在 write 的语义：Bun 的 TCP `sock.write` 是同步且部分写的——返回实际写入的字节数，未写完的部分要应用层自己排队、用 `drain` 事件 flush；Node 的 `net.Socket.write` 是无条件 buffer 的，假返回 false 只表示「我现在 backpressure 了」但字节不会丢。Bun 的 `BunState` 多了个 `writeBuf: Uint8Array[]` 就是给这个差异兜底的。两个 runtime 公用同一份 `ConnState`、同一份 `handleData`，但写策略各自适配——这种「公用核心 + 平台适配壳」的拆法是要写跨 runtime 代码时唯一不会爆炸的范式。

### 3.5 注入到所有子进程

整套 upstream proxy 起来之后，怎么让 `BashTool` 跑的 curl、`MCPTool` 跑的 npx、`LSPTool` 跑的 typescript-language-server 都用这个代理？答案在 `getUpstreamProxyEnv`（`upstreamproxy/upstreamproxy.ts:160-199`）：

```typescript
const proxyUrl = `http://127.0.0.1:${state.port}`
return {
  HTTPS_PROXY: proxyUrl,
  https_proxy: proxyUrl,
  NO_PROXY: NO_PROXY_LIST,
  no_proxy: NO_PROXY_LIST,
  SSL_CERT_FILE: state.caBundlePath,
  NODE_EXTRA_CA_CERTS: state.caBundlePath,
  REQUESTS_CA_BUNDLE: state.caBundlePath,
  CURL_CA_BUNDLE: state.caBundlePath,
}
```

八个 env var 一次塞过去。`HTTPS_PROXY` / `https_proxy` 是给 Node / curl / Go 的；`SSL_CERT_FILE` 给 OpenSSL；`NODE_EXTRA_CA_CERTS` 给 Node.js；`REQUESTS_CA_BUNDLE` 给 Python `requests`；`CURL_CA_BUNDLE` 给 curl。大小写都写一份的原因和上面 `NO_PROXY` 一样——不同生态读不同 case。

这一份 env 在 `utils/subprocessEnv.ts:67-84` 那一段被合并到每一次子进程拉起的环境里。这里有一个看起来奇怪的细节，`subprocessEnv.ts` 不直接 import `upstreamproxy`，而是通过一个 `_getUpstreamProxyEnv` 注册点拿到这个函数：

```typescript
// utils/subprocessEnv.ts:67-84（节选）
let _getUpstreamProxyEnv: (() => Record<string, string>) | undefined
...
_getUpstreamProxyEnv = fn
...
const proxyEnv = _getUpstreamProxyEnv?.() ?? {}
```

为什么绕一道？因为 `subprocessEnv` 是冷启动路径上每条命令都要走的工具，`upstreamproxy` 是一个只有在 CCR 模式才会用的模块。直接 import 会让所有非 CCR 启动也付出 upstreamproxy 模块的 load 成本。`entrypoints/init.ts:164-176` 那一段（懒加载 + register-fn）是这套绕道的另一头：

```typescript
const { initUpstreamProxy, getUpstreamProxyEnv } = await import(
  '../upstreamproxy/upstreamproxy.js'
)
registerUpstreamProxyEnvFn(getUpstreamProxyEnv)
await initUpstreamProxy()
```

这里要把 lazy import 的闸门口径说精确。`entrypoints/init.ts:167-176` 只检查 `CLAUDE_CODE_REMOTE` 这一个 env var：进程只要认为自己跑在 CCR 容器里，就会 dynamic import 这个模块并 `registerUpstreamProxyEnvFn`，**不**会顺带读 `CCR_UPSTREAM_PROXY_ENABLED`。第二道功能闸 `CCR_UPSTREAM_PROXY_ENABLED` 是在 `initUpstreamProxy()` 内部、`upstreamproxy/upstreamproxy.ts:85-94` 才 return early 的——CCR 模式下模块一定会被 load / register，但 init 可能立刻 no-op 退出。

所以这套「依赖反转 + 懒加载」省的是「非 CCR 启动」那一类进程的 load 成本，并不能让 CCR 容器里禁用了 upstream proxy 的会话也跳过模块加载。即便如此，第二层好处仍然成立：让 `utils/subprocessEnv.ts` 这个被几十处 import 的低层工具，不去依赖 `upstreamproxy/` 这个上层特性模块，反向防止依赖循环。

`getUpstreamProxyEnv` 还有一个继承分支（`upstreamproxy/upstreamproxy.ts:160-183`）：当本进程没启用 proxy，但环境里已经有 `HTTPS_PROXY` 和 `SSL_CERT_FILE`，就把父进程的代理设定原样传下去。意图很清楚：CCR 容器里第一层 `claude` 进程把 token 文件 unlink 了，第二层 `claude` 子进程没办法再 init 一遍，但父进程的 relay 还在跑、端口还活着——子进程只要继承同一份 env，就能用上父亲那条代理。

---

## 四、两条线在哪儿对称，在哪儿不对称

写到这里你可能已经看出来了，DirectConnect 和 Upstream Proxy 看似做着完全不同的事，但在工程范式上是一对镜像。把对称面摆出来：

| 维度 | DirectConnect | Upstream Proxy |
|---|---|---|
| 入口角色 | 本地 CLI 是客户端，远端是 claude server | 本地 CLI 是被劫持者，远端是企业代理 |
| 初始化协议 | HTTP POST 拿 `wsUrl` + `sessionId` | 读 token 文件 + HTTP GET 拿 CA cert |
| 长连接载体 | 一条 WebSocket | 每条 CONNECT 一条 WebSocket |
| 帧格式 | JSON Lines（SDK message） | 手写 protobuf（UpstreamProxyChunk） |
| 鉴权层 | `Authorization: Bearer authToken` | `Authorization: Bearer wsAuth` + `Proxy-Authorization: Basic sessionId:token` |
| 消息分流 | 按 type 拆 control_request / SDK msg | 按相位拆 CONNECT 头 / 隧道字节 |
| 失败语义 | 一旦 close → gracefulShutdown(1) | 一旦失败 → fail open，禁用代理但不挂会话 |
| 状态注入 | React Hook（`useDirectConnect`） | env var（`HTTPS_PROXY` 等八个） |
| 平台适配 | 单一 WebSocket 实现 | Bun / Node 双 relay 实现 |

四个共同点。第一，**WebSocket 是默认载体**——两边都被 GKE 七层网关或 ingress 限制成 HTTP 协议族，谁也开不出原生 TCP 通道，于是 WebSocket 顺理成章成了「能拿到的最双向的 HTTP-shaped 通道」。第二，**握手 / 长连分离**——一次性的元信息（session id、ca cert）走 HTTP，长连业务走 WS，谁都不试图把两者塞到一条上。第三，**入口处用一道布尔位收敛失败**——`DirectConnectError` 在那一边、`fail open + state.enabled` 在这一边，都不把底层错误外漏，外部代码看到的就是「能用 / 不能用」二态。第四，**多平台/多 runtime 显式分叉**——React vs. 命令行调用、Bun vs. Node、Linux vs. 其他平台，分叉都在最贴近边界的地方，不上浮到核心逻辑。

两个不对称的地方更有意思。一个是失败模式：DirectConnect 失败必然杀进程，因为「灵魂在那边」，本地没法继续；Upstream Proxy 失败必然不杀进程，因为「代理只是个 nice-to-have，劫持失败也允许会话以无代理状态继续」。这一对策略反差正是「会话主语在哪一端」决定的。另一个是注入位置：DirectConnect 通过 React Context 注入到 UI 树，Upstream Proxy 通过 env var 注入到 subprocess 树。前者要让 React 组件感知到「我在远程模式」，后者要让 fork 出去的 bash 感知到「我该用什么代理」，两条注入路径都贴着各自要影响的目标 surface，谁也不强行复用对方的载体。

把这两条线放在一篇里看的最大收获是这个：**Claude Code 在跨进程、跨机器、跨信任域的边界上，用的不是「一套大框架」，而是「一组小契约」**。每一段都很小（DirectConnect 三个文件 358 行，Upstream Proxy 两个文件 740 行），但每一段都能独立讲清楚自己「等谁、信谁、给谁、错怎么办」。这种小契约组装出来的网络层，比一个大而全的 RPC 框架更容易在多年迭代里保持稳定。

---

## 五、可迁移的设计模式

最后把两条线上反复出现的几个动作总结成可以拿走的模式。

**模式一：握手与长连分离**。一次性元信息走 HTTP，长期通信走 WS。这两段不要混在一个端点上——前者要求容易调试、要求服务端可以无状态地校验/拒绝；后者要求双向、要求生命周期不被请求/响应模型束缚。Claude Code 的 `createDirectConnectSession` + `DirectConnectSessionManager` 是个干净样本，CCR 的 `downloadCaBundle` + `startUpstreamProxyRelay` 是另一个样本。

**模式二：双向 RPC over 单一 WS**。当你只能拿到一条 WS、又必须同时支持「服务端推消息」和「服务端发请求等响应」两种语义时，用 `type` 字段做一级分流、用 `request_id` 做二级配对、用 `subtype` 做扩展点。看到不认识的 subtype 时**主动回错而不是装聋**——这是避免远端在你这里挂死的关键，`directConnectManager.ts:88-97` 那段 unsupported subtype 处理是这条规则的最小示范。

**模式三：fail open + 显式状态位**。任何「nice-to-have、但失败不能拖死主流程」的子系统都应该把入口包成「return early on any failure」，把对外开放的查询函数（`getUpstreamProxyEnv`）做成「按 `state.enabled` 切分支」。这一对在 upstreamproxy 里贯穿了整个模块。反之，「灵魂在远端、本地是壳」的子系统应该把失败做成「fail loud + gracefulShutdown」，不要装作还能用，DirectConnect 的 `onDisconnected` 就是反面的对照。

**模式四：状态注入贴近 surface**。要影响 React 树就用 Hook/Context，要影响 subprocess 树就用 env var。不要为了「一致性」强把 env var 塞进 React，也不要为了「优雅」强把 React 状态做成对 subprocess 可见的全局——两套 surface 的传播规则就是不一样，分别贴近各自的传播规则才稳。

**模式五：手写 wire 比 runtime lib 更适合 hot path**。如果你只有一条单字段的 protobuf 消息要在每个 TCP segment 上 encode/decode，10 行手写比一个 50KB 的 runtime 解析器更值得。判据是「这条路径有多热」——一条会话只走一次的握手包，用 lib；每段 TLS 字节都要过的隧道帧，手写。

**模式六：跨 runtime 写共用核心 + 平台适配壳**。`relay.ts` 里 Bun 和 Node 共用一个 `ConnState`、一个 `handleData`，但 `startBunRelay` 和 `startNodeRelay` 各自处理 write 的语义差异。要在多 runtime 上跑同一份代码，最大的陷阱永远是「同名 API 的语义不同」，把这些差异收敛在最贴近边界的两个函数里，核心逻辑就不必反复写 typeof Bun 的分支。

---

## 六、实战示例：把这些模式套到你自己的项目上

光列模式没用，下面给两个能直接对照着写的小场景。它们不是 Claude Code 的代码，是你哪天要做类似事情时可以拿来比对的最小骨架。

### 6.1 场景一：给自己的 CLI 加一个「远端会话」模式

假设你也有一个本地 CLI，现在想让它能 `--connect ws://server/sessions/xxx`，把会话挂到云端。最小可用的实现就是模式一 + 模式二的组合：先用一次 HTTP POST 拿到 `ws_url`、`session_id` 和（可选的）`auth_token`，再用拿到的 `ws_url` 升一条 WebSocket。HTTP 那一段一定要包成一个专有 `SessionError`：把「网络断了」「HTTP 不 OK」「Zod 校验失败」三种底层错误折成一个错误类型，上层只需要一行 `catch` 就能给出统一的「连不上服务端」提示。

WebSocket 升上去之后，按 `type` 字段做一级分流：`control_request` 类的消息有 `request_id`，必须有响应往回送；其余的 SDK 消息直接转给业务层处理。这里有个最容易漏的点：碰到 subtype 不认识的 `control_request` 时，**不要装聋作哑**。服务端在等响应，你不回它就在那挂着，下一轮会话被堵死。正确的做法是主动回一条 `subtype: 'error'` 的 `control_response`，让对面知道「我收到了，但我处理不了」。

照着这个骨架走，你立刻就能避开 Claude Code 走过的两个最常见的坑：一是握手错误五花八门时上层得写五种 catch；二是服务端发新 control 类型时旧客户端把会话挂死。骨架本身用 TypeScript 写不到 40 行（接近 Claude Code 的 `createDirectConnectSession.ts` 88 行 + `directConnectManager.ts` 213 行的精简版），但能撑住一条远端会话的全部必需语义。

### 6.2 场景二：给自己的容器进程加一个「劫持出网」开关

假设你也跑在一个受控容器里，想让所有从容器里发出去的 HTTP / HTTPS 请求都走一个本地 relay。最小骨架是模式三 + 模式四的组合。

第一步是入口处的**双闸开关**。第一道 env var 用来判断「我是不是真在那个受控容器里跑」（比如 `MY_CONTAINER_RUNTIME`），第二道 env var 用来判断「这次会话要不要启用代理」（比如 `MY_PROXY_ENABLED`）。两道都为真才往下走。这种拆法看起来啰嗦，但它解释了为什么 Claude Code 不能在容器里现场调 GrowthBook：冷容器没有 GB 缓存，灰度只能在签发容器时算好、通过 env var 透传进来。你自己写灰度时如果碰到同样的「冷启动 SDK 拿不到值」情况，也就只能走 env var 透传这条路。

第二步是 init 函数体本身的**fail open**。所有可能失败的操作——下载 CA、起 relay、监听端口——全部包在一个 try/catch 里，catch 里只打 warning、不 rethrow，让 `state` 留在 `{ enabled: false }`。这个 `state` 是后续所有查询函数的唯一信源：导出一个 `getProxyEnv()`，按 `state.enabled` 切分支，启用时返回八条 env var（`HTTPS_PROXY` / `https_proxy` 给 Node 和 curl，`SSL_CERT_FILE` / `NODE_EXTRA_CA_CERTS` / `REQUESTS_CA_BUNDLE` / `CURL_CA_BUNDLE` 给各家 TLS 实现），禁用时返回空对象。

第三步是**状态注入**。让 `subprocess` 拉起子进程的那个工具函数从 `getProxyEnv()` 拿到这八条 env，合并进子进程的环境。所有从这个进程 fork 出去的 Bash / curl / npm / pip 命令都会自动用上代理，业务层一行代码都不用改。这就是模式四的核心：env var 是 subprocess 树的自然传播机制，不要为了「优雅」绕开它。

两个骨架加起来不到 60 行代码，但它们覆盖了本章三千多字论述出来的核心结论：**握手与长连分离、单 WS 双向 RPC、fail-open 状态位、状态注入贴近 surface**。剩下的高级问题——hot-path 手写 protobuf、Bun/Node 双 relay、`setNonDumpable` 的硬核防线——都是在这套骨架长大到一定规模之后才需要操心的。

---

DirectConnect 与 Upstream Proxy 这两套不是 Claude Code 里最大的子系统——它们体量都很小，加起来也就一千多行。但它们处在两条最容易被忽略的暗线上：一条让 CLI 能挂到远端 server 当 thin client，一条让 CLI 能在企业环境里把所有出网流量交给受控代理。这两条线的代码里反复出现的「一段 HTTP 握手 + 一条 WebSocket + 一组 env var + 一个 fail-open 状态位」，是 Claude Code 在网络层做工程时的方言。把这门方言搞懂，再去看 Bridge IPC、Coordinator 远程派单、Remote Permission Bridge 这些上层故事时，就会发现底下用的还是同一组小积木。

---

## 下一章预告

[第 26 章：Ink 框架深度定制 — 在终端中运行 React](./26-Ink框架深度定制.md)

我们进入第七篇「终端 UI 与多模态输入」，从 ink/ 96 个文件和 native-ts/ 出发，看团队如何在终端中构建一个完整的 React 渲染引擎。
