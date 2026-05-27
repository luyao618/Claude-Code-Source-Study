# 第 17 章：Coordinator、Cron 与定时调度 — 让会话在没人按回车时继续转

> 本篇是《深入 Claude Code 源码》系列的第 17 篇。前面几篇我们都在讨论「一次对话里模型怎么把事情做完」。这一篇换一个角度：**如果根本没人盯着这个 REPL，事情还能继续往前推吗？**

答案藏在两块看起来不相干、骨子里互相支撑的代码里：

- `coordinator/` -- 让主会话变成「带 Worker 的项目经理」；
- `tools/ScheduleCronTool/` + `utils/cronScheduler.ts` + `hooks/useScheduledTasks.ts` -- 让会话在五分钟后、半小时后、明早 9 点 17 分被一段 prompt 自己叫醒。

我们先解释为什么把这两块放在同一章，然后分别拆开看，最后再回到引言里的问题。

---

## 一、为什么放在同一章？

Coordinator 看起来像「多 Agent 编排」，Cron 看起来像「定时任务调度」。表面上是两个题目。

但只要把两块代码同时翻一遍，就会发现它们解决的是同一个问题：**怎么让 Claude Code 在没人按回车的情况下，自己产生下一回合**。

- Coordinator 解决的是**空间上的下一回合**：主线程不动手了，但派出去的 Worker 在并行干活。
- Cron 解决的是**时间上的下一回合**：会话现在闲着，但十分钟后 scheduler 会从硬盘上读出一段 prompt、塞回主循环、让模型像被用户敲了回车一样继续。

两者对外暴露的工具不在同一份注册表里（`AgentTool` / `TaskStopTool` vs `CronCreate` / `CronDelete` / `CronList`），但对**对话循环的入侵点是同一处**：都走 `enqueuePendingNotification()`，都走 `messageQueueManager` 的 `'later'` 优先级，都把自己当成「来自后台的一条用户消息」插队进 query loop。

意识到这件事之后，第 14 篇（Agent）和第 16 篇（任务模型）里反复出现的 `pendingMessages` / `pendingNotification` 这一组 API，就不再只是 Agent 系统的内部细节，而是这个 CLI 在「无人值守」这一维度上留出来的统一入口。

这一章按这条线索往下走：先看 Coordinator 怎么把一个普通会话改写成项目经理；再看 Cron 工具家族怎么把「一段 prompt + 一个 cron 表达式」落到磁盘上；最后看 scheduler 怎么在每个 tick 上把到点的任务塞回主循环。

---

## 二、Coordinator 模式：主会话不再亲自动手

打开 `coordinator/coordinatorMode.ts`，第一个值得看的不是 system prompt，而是入口判断：

```typescript
// coordinator/coordinatorMode.ts:36-41
export function isCoordinatorMode(): boolean {
  if (feature('COORDINATOR_MODE')) {
    return isEnvTruthy(process.env.CLAUDE_CODE_COORDINATOR_MODE)
  }
  return false
}
```

两道门一起把。第一道是 `feature('COORDINATOR_MODE')` 这一层编译期开关 -- 按第 19 篇讲过的 DCE 机制，外部构建里这整块逻辑会被完整剔掉，不留任何字节；第二道才是运行时的 env truthy 判断。

为什么要叠两道？Coordinator 模式不是给所有用户的默认行为，它会把模型平时拿在手里的 Read / Write / Edit / Bash 这一摞工具全部抽走，换成完全不一样的工具集。如果不小心被外部用户撞开，体验上会像「Claude 突然不会改文件了」。所以外部构建宁可让这段代码不存在，也不要它存在但默认关。

### 2.1 给自己换一张身份证

进入 Coordinator 模式后，主会话第一件事是换 system prompt。原本「你是一个帮用户写代码的 AI」，被换成一段读起来像「项目经理岗位说明书」的大段说明。源码在 `coordinator/coordinatorMode.ts:111-369` 的 `getCoordinatorSystemPrompt()`，里面反复强调的几条：

- 你的角色是分派工作给 Worker，不是亲自完成代码改动；
- 你拿到的工具只有 `AgentTool`（派 Worker）、`SendMessage`（给已经在跑的 Worker 续指令）、`TaskStopTool`（必要时杀掉跑偏的 Worker）；
- 永远不要写 "based on your findings" -- 你必须读懂 Worker 的 research 输出，把它落到一条具体的下一步指令上，而不是让下游模型自己猜你想要什么；
- 一份任务从 Research → Synthesis → Implementation → Verification 走四步，每一步都决定是 Continue（在原 Worker 上续）还是 Spawn Fresh（开一个干净的 Worker 重新切一段上下文）。

为什么要写这么啰嗦？因为 Coordinator 没有现成的「项目经理直觉」可用。模型在普通会话里被训练成「直接动手」的偏好极强：它看到一个 bug，下意识就想 Read 一下源码、Edit 一行试试。Coordinator 模式里这条路被堵死了 -- 它必须把这种冲动改成「派一个 Worker 去 Read 一下」，并写出足够具体的 prompt 让那个 Worker 真的能开干。这份 system prompt 的本质就是在用文字反复纠偏模型的默认动作。

### 2.2 Worker 拿到的是哪一份工具

接下来看 Worker 那一侧。`coordinator/coordinatorMode.ts` 里有一组叫 `INTERNAL_WORKER_TOOLS` 的集合：

```typescript
// coordinator/coordinatorMode.ts:29-34
const INTERNAL_WORKER_TOOLS = new Set([
  'TeamCreate',
  'TeamDelete',
  'SendMessage',
  'SyntheticOutput',
])
```

这些是 Coordinator 编排层自己用的工具，Worker 永远拿不到。Worker 看到的工具集 = 全量工具表 − 这组内部工具，再叠一层环境变量过滤：当 `CLAUDE_CODE_SIMPLE` 被设成 truthy 时，Worker 的工具被进一步压缩到只剩 `Bash / Read / Edit`，连 Glob / Grep 都被拿掉。

这一层简化的动机回到上一章对 REPL 模式（八个高频工具被藏进 REPL VM）的讨论就很顺：Worker 不需要 ToolSearch，不需要 LSPTool 这种 deferred 工具，它只需要能干「读一段、改一段、跑一段」就够了。让 Worker 看到的工具表越窄，prompt 表面消耗的 token 就越少，每次 spawn Worker 的成本就越低。Coordinator 模式恰恰要频繁 spawn Worker（一个工程任务很可能要派出 4–5 个），这点 token 节省会在一次会话里累出可观的差。

### 2.3 Coordinator 的本质

把上面拼起来，Coordinator 不是一个「新的会话类型」，它是一次**对工具集和 system prompt 的双重换皮**：

- 工具集：从「干活的工具」换成「派活的工具」；
- system prompt：从「你是一个 AI」换成「你是一个项目经理」；
- 对话循环本身：**不变** -- 仍然是 C05 那一份 `query()` 主循环，仍然是 C16 那一份 TaskState 注册表，仍然是 C20 那一套 hooks。

这种「内核不变、外层换皮」的设计在源码里很常见。你后面在 Cron 那一节也会看到完全同构的判断：Cron 系统也不发明新的 query loop，它只是往 query loop 里塞消息。同一个内核被两套不同的外层复用，是 Claude Code 源码里非常稳定的一条工程美学。

---

## 三、ScheduleCronTool：把「半小时后跑一段 prompt」做成工具

Coordinator 解决了「不让用户每一步都按回车」的问题，但它仍然要求**有一个人或一个上游进程在跟模型对话**。如果你想让 Claude Code 在凌晨 3 点自己醒来跑一段质量检查、或者在 5 分钟后自动检查 CI 结果，光靠 Coordinator 就不够 -- 你需要一个真正的定时器。

`tools/ScheduleCronTool/` 这个目录里没有一个叫 `ScheduleCronTool.ts` 的入口文件，它是一组 leaf tool 的家族：`CronCreateTool` / `CronDeleteTool` / `CronListTool`。第 10 篇讲过 family tool 与 leaf tool 的关系 -- family 在 `<available-deferred-tools>` 里只露一个名字，三个 leaf 由 family 工具自己暴露 schema 给模型。Cron 走的就是这一条路。

### 3.1 三个 leaf 工具的边界

三个 leaf 各管各的事，但又不是简单地切成 CRUD。`CronCreateTool` 的 `validateInput()` 是其中最重的，它要解析 cron 表达式、要算「下一次触发时间是不是落在一年以内」、要查当前是不是已经塞了 50 个 cron 任务，还要拦住一类特殊的越界：

```typescript
// tools/ScheduleCronTool/CronCreateTool.ts:25
const MAX_JOBS = 50

// tools/ScheduleCronTool/CronCreateTool.ts:105-113
if (input.durable && context?.agentId) {
  return {
    result: false,
    errorCode: 4,
    message:
      'Teammates cannot create durable cron tasks. ' +
      'Set durable: false to keep this task session-only.',
  }
}
```

最后这一条规矩值得多说一句。`CronCreateTool` 的 schema 里 `durable` 默认 false：默认创建的 cron 是 session-only 的，只活在内存里，当前 REPL 退出就没了。如果想跨会话存活，必须显式传 `durable: true`，这条任务才会被写进 `.claude/scheduled_tasks.json`。但 teammate（in-process teammate，C16 讲过的那一类 Agent）创建的 cron 任务被强制禁止 durable，错误码 4。

理由藏在执行端：teammate 是会话级对象，身份只在父 session 里有效。一旦它的 cron 跨会话存活，触发时找不到原来的 teammate，cron 就成了一个无主的孤儿。源码选择「不让它产生」，而不是「让它产生然后清理孤儿」 -- 前者廉价、后者要在 scheduler 那一层维护额外的依存关系。

`CronDeleteTool` 看起来最简单，但带了一道权限检查：teammate 只能删自己创建的 cron，错误码 2。这是 multi-Agent 协作里典型的最小权限 -- 不希望 Agent A 跑着跑着把 Agent B 排好的提醒删掉。

`CronListTool` 给的是不对称视角：teammate 调 List 只能看到自己的 cron；主会话（没有 `agentId`）调 List 能看到这个项目里所有的 cron。它还把两个标志位都置成 true：

```typescript
// tools/ScheduleCronTool/CronListTool.ts:51-55
isReadOnly(): boolean {
  return true
},
isConcurrencySafe(): boolean {
  return true
},
```

这两道开关的意思是：模型可以放心地把 CronList 跟同回合的其它只读工具（Read / Grep / 别的 List）并发跑而不需要排队 -- 在「同时看 cron 和当前文件状态」这种综合排查场景下省一轮 round trip。`CronCreateTool` / `CronDeleteTool` 都没有这两个标记，写操作必须串行。

### 3.2 jitter：永远不要在整点触发

读 cron 系统最容易忽略的一段是 `utils/cronTasks.ts` 里那份默认 jitter 配置：

```typescript
// utils/cronTasks.ts (DEFAULT_CRON_JITTER_CONFIG 摘)
recurringFrac: 0.1,             // 周期任务的随机偏移幅度
recurringCapMs: 15 * 60 * 1000, // 偏移幅度上限 15 分钟
oneShotMaxMs: 90 * 1000,        // 一次性任务最大向前借 90 秒
oneShotMinuteMod: 30,           // 避免命中整点 / 半点
recurringMaxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 天后过期
```

这一组数字背后是一个朴素但容易被忽视的工程顾虑：如果一千个用户都写了 `0 9 * * *`（每天早上 9 点跑），那么 9:00:00 这一刻 Anthropic 的 API 会被同时打一千个请求 -- 典型的 thundering herd。Cron 工具在 prompt 层已经提醒过模型「尽量避开 :00 和 :30」，但模型给用户出的 cron 表达式终究不可控。所以系统在执行层兜底：周期任务的下一次触发往后随机推一段时间，幅度是「下一次本来要等多久」的 10%，封顶 15 分钟。

一次性任务的 jitter 走的是另一条逻辑 -- **向前借时间**，最多提前 90 秒，但有一道 30 分钟最小步长。这条逻辑稍显绕，但跟 prompt 里那一句「尽量避开整点」是同一份意图：源码不相信用户和模型会自觉错峰。

还有一个细节值得记：`jitterFrac` 这个生成 `[0, 1)` 随机数的函数没有用 `Math.random()`，而是把 cron 任务的 ID 前 8 位 hex 切下来除以 `0x100000000`。这意味着同一个任务每次计算 jitter 都得到同一个随机分布 -- 重新加载 `scheduled_tasks.json` 后任务的下次触发时间是稳定的，方便排错；用户跨会话恢复时不会突然感觉「今天提醒的时间跟昨天不一样」。

### 3.3 cron 表达式解析：一个克制版的实现

`utils/cron.ts` 这一份手写的 5 字段 cron 解析器一共 308 行，跟 `cron-parser` 这种成熟库相比，它**主动放弃了好几个特性**：

- 不支持 L（last day of month）/ W（weekday closest to）/ ?（dayOfMonth/dayOfWeek 二选一不指定）；
- 不支持 `MON-FRI` / `JAN-DEC` 这种名字别名；
- 不支持 6 字段（带秒）或 7 字段（带年）格式；
- 只接受星号、N、N-M、N-M/S、`*/N` 这几种语法的组合。

为什么写一份这么克制的解析器？因为 Cron 工具是给模型用的，不是给写过 vixie-cron 的运维用的。模型平时见过的 cron 表达式 95% 都落在这几种语法里，剩下的 L / W / 名字别名属于「会用的人少、用错的人多」的特性。少支持几种语法换来一份能完整 fit 在 308 行里的、能被 reviewer 一次性读完的实现 -- 是个挺合理的权衡。

值得记一笔的是 `computeNextCronRun()` 的实现：它不是按数学方式直接算下一次匹配，而是**从当前时间往前一分钟一分钟走**，最多走 366 天，每一步检查 month / day / hour / minute 是否都匹配。这种「走一遍」的实现牺牲了一点 CPU 换来正确性 -- 尤其是对 DST 这种边界情况，按数学方式算很容易出错（春分跳过 2-3 点、秋分重复 1-2 点），而按分钟走一遍就自然把这些边界处理对了。源码注释直接写明语义：fixed-hour cron 在 spring-forward 那天会被自然跳过（这一小时在本地时间里根本不存在），fall-back 那天只触发一次 -- 这就是 vixie-cron 的标准语义。

### 3.4 OR 还是 AND：day-of-month 与 day-of-week

cron 表达式里有一个被 99% 的用户搞错的细节：当 `dayOfMonth` 和 `dayOfWeek` 同时被指定时（都不是 `*`），任意一个匹配就算匹配。这是 vixie-cron 沿用了几十年的语义，但完全反直觉 -- 大多数人会期望「AND」。源码里直接把这一段写得明明白白：

```typescript
// utils/cron.ts:151-158
const dayMatches =
  domWild && dowWild ? true
  : domWild ? dowSet.has(dow)
  : dowWild ? domSet.has(dom)
  : domSet.has(dom) || dowSet.has(dow)
```

把这个 OR 语义显式写出来 -- `domSet.has(dom) || dowSet.has(dow)`。这种边角语义如果不在源码里贴注释加单测，下一个维护者一定会想「修一下这个 bug」。Claude Code 的处理方式是接受它，并在源码注释里把 vixie-cron 这个名字钉死 -- 以后谁要改这一行，得先读完 vixie-cron 的历史背景。

---

## 四、scheduler：一秒 tick 一次的小心脏

`utils/cronScheduler.ts` 是 cron 系统真正的引擎，565 行里塞进了：tick 循环、文件监听、锁协作、jitter 计算、missed task 检测、aged-out 处理、teammate 路由。先看几条核心常量：

```typescript
// utils/cronScheduler.ts:40-44
const CHECK_INTERVAL_MS = 1000      // 每秒检查一次
const FILE_STABILITY_MS = 300       // 文件被改动后 300ms 才认为稳定
const LOCK_PROBE_INTERVAL_MS = 5000 // 5 秒探一次锁
```

每秒 tick 一次这件事看着粗暴，但在一台空闲的 REPL 上跑 `setInterval(1000)` 不会带来可测量的开销。`FILE_STABILITY_MS = 300` 是 chokidar 监听 `scheduled_tasks.json` 时用的「文件改完了多久算稳定」窗口 -- 避免一次保存触发两次 reload（write + truncate + write）。`LOCK_PROBE_INTERVAL_MS = 5000` 是给「另一个 session 在等着」的场景准备的：本会话拿不到 scheduler lock 时，每 5 秒重新尝试一次，5 秒是个能让用户感觉「换主很快」又不会把 PID liveness 检查打成高频轮询的折衷。

### 4.1 锁：同一个项目只能有一个 scheduler

打开 `utils/cronTasksLock.ts`，你会看到一份跟 `computerUseLock.ts` 同构的实现 -- 这是 Claude Code 里一种被复用了多次的「单租户锁」模式：

```typescript
// utils/cronTasksLock.ts:23-32
const schedulerLockSchema = lazySchema(() =>
  z.object({
    sessionId: z.string(),
    pid: z.number(),
    acquiredAt: z.number(),
  }),
)
```

锁文件落在 `.claude/scheduled_tasks.lock`，内容是 `{sessionId, pid, acquiredAt}`。拿锁走的是 O_EXCL（`writeFile(..., { flag: 'wx' })`）的原子创建 -- 失败一定是因为文件已经存在。然后按三种情况处理：

1. 如果文件里写的 sessionId 就是自己，说明这是同一个 session 重新拿锁（比如 `--resume`），返回 true 并把 pid 刷新成当前进程的新 pid；
2. 如果文件里的 pid 还在跑（`isProcessRunning(pid)`），说明被另一个 live session 占着，返回 false；
3. 如果文件里的 pid 已经死了，那就是 stale lock，unlink 后再试一次原子创建。

「失败 + 探活 + 抢救」这三步既正确（多个 session 同时抢救 stale lock 时只有一个能赢）又简单（不需要分布式协调）。

为什么 cron 系统要做这种锁？因为同一个项目目录可能同时打开两个、三个、甚至更多的 REPL。如果每个 REPL 都自己跑一份 scheduler，同一个 cron 任务会被触发好几次。锁的存在让「调度」这件事在同一个项目里只发生一次 -- 其它会话照样能创建/删除/列出 cron 任务（写文件不需要锁），但只有持锁的那个 session 负责把任务塞回各自的主循环。

`registerCleanup()` 补上了「进程死了锁怎么办」的最后一块：每次拿锁成功之后注册一个 cleanup 回调，进程正常退出时自动 unlink 锁文件。即使是异常退出（kill -9），下一个 session 启动时也会通过 PID liveness 检查把这个 stale lock 抢救掉 -- 双保险。

### 4.2 一个 tick 里发生了什么

scheduler 拿到锁之后，每秒钟做的事大致分三步。

**第一步**是「内存里有哪些任务」。文件型任务由 chokidar 在 `scheduled_tasks.json` 发生变更时调 `load()` 把磁盘内容刷进内存 `tasks` 数组；scheduler 每秒 tick 只读这份内存，并不每秒去 stat 文件。session-only 任务则在每次 tick 都从 `bootstrap/state` 里现取 `getSessionCronTasks()` -- 它们没有文件事件，必须 tick 时再读一次。这是「事件驱动文件 + 周期读内存」的混合：chokidar 在 NFS、Docker volume 这类 inotify 不可靠的环境里漏掉一次也只是把新增 cron 的可见时间推迟到下一次文件事件，已经在内存里的任务一秒一秒继续走。

**第二步**是计算每一个任务的 `nextFireAt` 并跟 `Date.now()` 比较。`nextFireAt` 的锚点是 `lastFiredAt ?? createdAt` -- 也就是说新任务从「创建时刻」开始算，已经跑过的任务从「上一次触发时刻」开始算。这条选择避免了一个细微的偏移问题：如果用 `Date.now()` 当锚点，每秒 tick 都会让下一次触发往后挪一秒，长期运行会累积成可见的飘移。

**第三步**是「该触发就触发」。这一段没有一个独立的 `fireCronTask()` 函数，触发逻辑就写在 `createCronScheduler()` 内部 `check()` 的 `process()` 闭包里：

```typescript
// utils/cronScheduler.ts:293-297 (节选)
if (onFireTask) {
  await onFireTask(t)        // useScheduledTasks 走这条
} else {
  await onFire(t.prompt)     // 后备：只交 prompt
}
```

当 `now >= next` 时优先调 `onFireTask(task)` 把完整 CronTask 交给上层，上层不存在时再 fall back 调 `onFire(t.prompt)`。然后立刻为周期任务计算下一次 `nextFireAt` -- 起点是 `now` 而不是「本来的 next」（`cronScheduler.ts:315-321`），这条选择让长时间不在线的会话醒来之后**只补跑一次**而不是把过去几小时积累的所有触发一并补上；同时把 `lastFiredAt = now` 通过 `markCronTasksFired()` 批量回写到磁盘（`cronScheduler.ts:358-369`），下一次进程启动 first-sight 时能从同一个锚点重建出相同的 `nextFireAt`。

### 4.3 missed task：开机时怎么补

scheduler 还要回答另一个问题：如果一个 cron 任务定的是「下午 3 点跑」，但你下午 2 点关电脑、下午 5 点才重新打开会话，这个任务还跑不跑？

源码的处理是：**只在 scheduler 第一次启动（initial load）的时候，把过期的一次性任务作为「missed」补一次**。`load(initial)` 里只在 `initial === true` 时计算 `findMissedTasks()`，并显式 `filter(t => !t.recurring && ...)` 把周期任务排除（`utils/cronScheduler.ts:184-197`）。

周期任务在初始 load 不走 missed 通道，而是由后续 tick 的 `check()` 按 `lastFiredAt ?? createdAt` 计算 `nextFireAt`：如果这个锚点离 `now` 已经过去了一个甚至多个完整周期，第一次 tick 就会触发一次，然后从 `now` 重新算下一次 -- 也就是说在线缺席多久都只补一次，不会补多次。这条策略跟 vixie-cron 在 `anacron` 上的处理思路一致 -- 既不要丢一次性任务、也不要因为错过几小时就连补好几次周期任务。

周期任务还有另一道生命周期闸：

```typescript
// utils/cronScheduler.ts:53-60
function isRecurringTaskAged(t: CronTask, nowMs: number, maxAgeMs: number): boolean {
  if (!t.recurring) return false
  if (t.permanent) return false
  if (maxAgeMs === 0) return false
  return nowMs - t.createdAt >= maxAgeMs
}
```

`recurringMaxAgeMs = 7 * 24 * 60 * 60 * 1000`，也就是 7 天。判定看的是 `nowMs - t.createdAt`，跟「这 7 天里有没有真的被触发过」无关 -- 一条已经稳稳触发过几十次的周期任务，超过 7 天同样会被判 aged。aged 命中的任务会在下一次到点时**触发最后一次**，然后从磁盘里删掉；`permanent: true` 的内置任务以及 `recurringMaxAgeMs === 0` 时整体豁免。这条决定回答的是「定一个每天检查 CI 的提醒，结果半年过去早不需要了」这种长尾 -- 不要让一份 `.claude/scheduled_tasks.json` 里堆着几十条久远的周期任务永远跑下去。

### 4.4 buildMissedTaskNotification：包装 prompt 的小学问

补跑 missed task 时还有一个值得抄的细节。原本的 prompt 是用户写的，可能包含 markdown 围栏、可能包含特殊字符。直接塞回 query loop 不仅可能把 `<task-notification>` 这个 XML 标签的解析弄乱，还可能被攻击者用「我的 cron prompt 里嵌一段 fake 系统消息」这种方式注入。

`buildMissedTaskNotification()` 的处理是**用一段足够长的反引号围栏把 prompt 整段包住** -- 围栏长度由 prompt 内出现的最长反引号串 + 1 决定，这样不管 prompt 里用了几个反引号都能正确闭合。这是 markdown 安全嵌套的标准做法，但放在 cron 通知的语境里很容易被忽略，源码这一手值得记。

---

## 五、useScheduledTasks：scheduler 与 REPL 的最后一公里

到这里 scheduler 已经把任务推到了「应该触发」这一步，但**触发的消息究竟怎么塞回模型？** 这条最后一公里走的是 `hooks/useScheduledTasks.ts` -- 一个 React hook，把 scheduler 嵌进 REPL 的生命周期。

这个 hook 做的事看起来简单：在 component mount 时调 `createCronScheduler()`、把 schedule fire 事件绑到 REPL 的 enqueue 路径上、unmount 时调 cleanup。但里面有几个细节值得拆开看。

**ref 闭包陷阱**。`isLoadingRef` 用 ref 而不是普通 closure 变量：如果用普通变量，第一次 render 时拿到的 `isLoading` 会被 closure 进 scheduler 回调里 -- 之后 isLoading 变化了，scheduler 看到的还是当时那个值。React 里这是个老毛病，解决方案就是 ref。

**按 agentId 路由**。fire 事件回调里要判断这个 cron 是主会话创建的还是某个 teammate 创建的：

```typescript
// hooks/useScheduledTasks.ts:91-108 (节选)
if (task.agentId) {
  const teammate = getTeammate(task.agentId)
  if (!teammate) {
    // 孤儿：teammate 已经不在
    await removeCronTasks([task.id])
    return
  }
  enqueueForTeammate(teammate, task.prompt)
} else {
  enqueuePendingNotification({ /* ... WORKLOAD_CRON ... */ })
}
```

主会话创建的 cron 直接 `enqueuePendingNotification()` 走主队列；teammate 创建的 cron 走 teammate 自己的 mailbox。如果这个 teammate 已经不在了（被用户主动 kill、或者父 session 关闭），cron 任务就是孤儿，hook 这里直接调 `removeCronTasks([task.id])` 做清理。

注意 teammate cron 在创建端就被禁止 durable（`CronCreateTool.ts:105-113`），`agentId` 也被显式标注为 runtime-only、never written to disk（`utils/cronTasks.ts:64-69`）。所以这一手清理实际操作的是 session store 而不是磁盘上的 `.claude/scheduled_tasks.json`。这跟前面 §三·1 提到的「teammate-no-durable」规则是搭档：在创建端禁止落盘，在执行端清理 session store，两头堵死「孤儿 cron 跨会话残留」这种状态。

**WORKLOAD_CRON 标签**。`workload: WORKLOAD_CRON` 这个字段会出现在通知插队进 query loop 的 metadata 里，最终通过 HTTP header 传到 Anthropic 后端，用作 QoS 分类 -- cron 触发的请求会被打上「这是后台任务，不是 user-facing」的标签，在系统繁忙时可以被优先 deprioritize。这是一种端到端的 attribution：从 hook 注入开始，metadata 一路跟着这条消息走到 API 调用，让后端知道这一刻这个会话的「忙」不是真的有人在等回复。

**isMeta: true**。这条标记让通知在 UI 上以「系统消息」的方式呈现，而不是伪装成用户消息。如果不打这条标记，用户回到 REPL 时会看到对话历史里多了几条「自己没说过的话」 -- 非常困惑的体验。

---

## 六、Cron 启用条件：三道门，一层缓存

回过头看 Cron 工具家族什么时候才会出现在模型的工具列表里：

```typescript
// tools/ScheduleCronTool/prompt.ts:36-45
export function isKairosCronEnabled(): boolean {
  if (!feature('AGENT_TRIGGERS')) return false
  if (isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_CRON)) return false
  return getCachedGate('tengu_kairos_cron')
}
```

三道门叠在一起：

1. `feature('AGENT_TRIGGERS')` -- 编译期 DCE 门，外部构建里整块代码不存在；
2. 没有 `CLAUDE_CODE_DISABLE_CRON` 这个 env 紧急刹车 -- 用户/管理员的本地 kill switch；
3. GrowthBook 的 `tengu_kairos_cron` 这个 feature gate -- Anthropic 后端控制的灰度开关。

`isDurableCronEnabled()` 是独立的子开关（`tengu_kairos_cron_durable`），单独控制「durable 任务能不能用」 -- 这条分层让 Anthropic 在线上能精细控制：先把 session-only 的 cron 开给所有用户用一段时间，确认稳定之后再把 durable 开关打开。

GrowthBook 的判断结果带了 5 分钟的缓存（`KAIROS_CRON_REFRESH_MS = 5 * 60 * 1000`），不会每次工具枚举都去远端查一次。所以一个工具是否对模型可见，并不是一个常量，而是「编译期 feature flag × 本地 env kill switch × GrowthBook 5 分钟缓存的远端 gate」三者的乘积 -- 任何一个翻转都能让 CronCreate/CronDelete/CronList 整族从 `<available-deferred-tools>` 列表里消失。

`DEFAULT_MAX_AGE_DAYS = 7` 这个常量也在 prompt 里被提到 -- 告诉模型「周期任务超过 7 天没人理会自动过期」，让模型在帮用户设置长期提醒时知道边界。这种「把生命周期写进 prompt」的小细节是工具家族里反复出现的：模型看到的工具描述不仅要讲怎么用，还要讲什么时候会失效。

---

## 七、回望：两条线汇到同一个入口

把 Coordinator 和 Cron 两块都拆完了，再回头看引言里那个问题 -- 「为什么放在同一章」。两条线的汇合点其实就一句话：**两者都让 query loop 在没有人按回车的时候继续转下去**。

Coordinator 的方式：把主线程变成项目经理，让被派出的 Worker 自己跑独立的 query loop；Worker 跑完后，结果通过 `enqueuePendingNotification()` 回到主线程的 query loop，主线程模型继续推理「下一步派谁干啥」。

Cron 的方式：在没有任何模型在跑的时刻，由 `setInterval(1000)` 这个小心脏来产生「下一回合」的契机，把 prompt 通过同一个 `enqueuePendingNotification()` 塞回主线程的 query loop。

两条线最终都收口在 `'later'` 优先级队列上 -- 这是 messageQueueManager 留出来的「来自后台」的入口。第 16 篇讲任务通知机制时已经介绍过这套队列的三层优先级（now / next / later），现在你看到的是这套机制的全部使用方：来自后台任务的通知、来自 cron 的触发、来自 teammate 的 idle 信号、来自 Coordinator 派出去的 Worker 完成报告 -- 它们走的都是同一条入口。

这也回答了为什么 Cron 系统的 jitter 配置那么细。如果 cron 触发跟用户输入抢同一个 `'now'` 优先级，整点的雷阵雨会直接打在用户体验上。`'later'` 这一优先级的意义就在于：用户输入永远先处理完，后台的事再说。Cron 的 jitter + `'later'` 优先级 + WORKLOAD_CRON 的 QoS 分类，三者叠在一起，构成了一个相当克制的「后台任务不要打扰前台」的工程承诺。

---

## 八、可迁移的设计模式

把 Coordinator 与 Cron 这两块代码读完之后，有几条设计取舍可以单独拎出来用在别处。

### 模式 1：锁文件 + PID liveness 抢救 stale lock

`utils/cronTasksLock.ts` 这套「O_EXCL 原子创建 + sessionId 复用 + PID liveness 抢救」是单机多进程协调的一份小教科书：

- 原子创建保证「同一时刻只有一个赢家」；
- sessionId 字段允许同一个 session 重入（`--resume` 场景必须）；
- PID liveness 检查把异常退出留下的 stale lock 抢救回来；
- `registerCleanup()` 处理正常退出。

四件事拼起来既正确又简单 -- 不需要 Redis、不需要 etcd、不需要任何分布式协调组件。

**适用场景**：任何「单机内只能跑一份」的后台守护进程 -- 文件索引器、本地缓存清理、定时上传。只要你的协调范围不跨机器，这套模式比任何分布式锁都轻。注意 PID liveness 在 PID 复用快的系统（容器内尤其）上有一个理论上的小窗口，可以再叠一层 `starttime` 检查兜底。

### 模式 2：事件驱动 + 周期兜底的混合 scheduler

`utils/cronScheduler.ts` 没有走纯事件驱动（chokidar 监听 + 立刻 reload）、也没有走纯轮询（每秒 stat 一次文件）。它是：

- chokidar 事件驱动「文件型任务的新增/变更」 -- 几乎实时，但允许漏；
- 每秒 tick 做的不是文件 I/O，而是**读已经在内存里的任务**计算 `nextFireAt` -- 廉价、稳定；
- session-only 任务每秒 tick 现取 -- 无文件事件可依赖时的兜底。

事件驱动负责新鲜度，周期 tick 负责到点触发与漏事件兜底。两者职责分明，谁出问题都不会让整个系统瘫掉。

**适用场景**：任何「需要响应外部状态变化，但又不能依赖事件 100% 送达」的场景 -- 配置文件热加载、外部消息队列消费、文件系统监听。NFS、Docker volume、网络挂载、跨平台兼容 -- 这些环境里 inotify 漏事件是日常。一份「事件驱动 + 兜底周期 reconcile」的混合，几乎总是比纯任何一种都稳。

### 模式 3：工具家族三道门 + 远端 gate 5 分钟缓存

Cron 工具家族的「编译期 feature × 本地 env × 远端 gate」三层门叠加，是 Claude Code 里所有可灰度工具的通用模式。三道门各有各的失效模式与翻转成本：

- 编译期 feature 是不可见的 -- 外部构建里整块代码消失，给「我不希望这段代码出现在用户机器上」用；
- 本地 env 是用户可见的 -- 给「这台机器临时关掉」用；
- 远端 gate 带 5 分钟缓存 -- 给「线上批量灰度 / 紧急下线」用。

加上一个独立的子开关（`tengu_kairos_cron_durable`），就能把「session-only 先开 / durable 后开」这种渐进式发布做得很干净。

**适用场景**：任何「内部已经开始用、但还没准备好默认开给所有用户」的功能。三道门各自的成本：编译期 feature 改了要重新发版、本地 env 改了重启 CLI 就行、远端 gate 改了 5 分钟内全网生效。把开关按响应速度分层，比单一开关灵活很多。

### 模式 4：用 prompt 反复纠偏模型的默认动作

Coordinator 的 system prompt 把「永远不要写 'based on your findings'」「必须把 Worker 的 research 落到具体的下一步指令」这类规矩反复写了好几遍。这不是冗余，这是在和模型的训练偏好对抗 -- 模型默认想直接动手，要让它学会派活，必须用文字把默认行为按住。

**适用场景**：任何把通用模型塞进特定角色的应用 -- 客服机器人、代码 review 助手、SQL 生成器。如果你发现模型在某种场景下总是「忍不住」做某件你不希望它做的事，先别急着调温度或换 prompt 框架 -- 把那条禁令写进 system prompt 里反复强调三次，往往比任何 prompt engineering 技巧都管用。

---

## 九、实战示例：用这一章的工具搭一个「每天早上的 CI 巡检」

把上面这些零件拼一下，看 Claude Code 是怎么落地一个真实需求的：「每天早上 9 点 17 分自动检查一遍 main 分支的 CI 状态，如果失败就用 Coordinator 模式开 Worker 去查」。

1. 用户对 Claude 说「帮我每天早上 9 点 17 分检查 main 分支的 CI」。模型调 `CronCreate({ schedule: '17 9 * * *', prompt: '检查 main 分支最新一次 CI 跑的状态。如果失败，分析失败原因。', durable: true })`。
2. `CronCreateTool` 跑 `validateInput()` -- 解析 `17 9 * * *` 成功、算下次触发时间在 24 小时内、当前 cron 数没到 50、不是 teammate 调用所以允许 durable。任务写入 `.claude/scheduled_tasks.json`。
3. 第二天早上 9:17，jitter 把实际触发时间推到 9:18:42（在 0–15 分钟随机区间内）。scheduler 的 tick 检测到 `now >= nextFireAt`，调 `onFireTask(task)`。
4. `useScheduledTasks` 的 hook 看 `task.agentId` 为空（是主会话创建的），调 `enqueuePendingNotification()`，带 `workload: WORKLOAD_CRON` 与 `isMeta: true`。
5. 主会话当时如果在跑别的事，通知进 `'later'` 优先级队列；当前没事时直接进入下一轮 query loop。模型看到带反引号围栏包好的 prompt，调 `Bash gh run list --branch main --limit 1` 查 CI 状态。
6. 假设 CI 失败。如果这个会话开了 Coordinator 模式（`CLAUDE_CODE_COORDINATOR_MODE=1`），模型会调 `AgentTool` 派一个 Research Worker 去拉失败 job 的日志、再派一个 Synthesis Worker 把日志归纳成 root cause、必要时再派一个 Implementation Worker 直接出 fix PR。Worker 完成后通过同一个 `enqueuePendingNotification()` 把结果送回主会话。
7. 七天后（`recurringMaxAgeMs`），这条 cron 自动 aged-out，触发最后一次然后从磁盘删掉。用户如果还需要它，再问一次「帮我建一个」就好。

整个流程里没有任何一处需要「另起一个守护进程」 -- 所有东西都跑在同一个 Claude Code 会话内，靠的就是 cron scheduler 这颗小心脏、Coordinator 这层换皮、和 `'later'` 这条插队入口。

---

---

## 下一章预告

[第 18 章：MCP 协议实现 — 连接外部工具的标准化桥梁](./18-MCP协议实现.md)

我们进入第五篇「协议、安全与扩展接口」，从 services/mcp/ 23 个文件出发，看 Claude Code 怎么用 5 种传输层（stdio / SSE / HTTP / WebSocket / SDK）连上外部工具服务器。

---
*全部内容请关注 https://github.com/luyao618/Claude-Code-Source-Study (求一颗免费的小星星)*
