# Coordinator、Cron 与定时调度 — 不靠人按回车的那一路

> 本篇是《深入 Claude Code 源码》系列的第 17 篇。前面几篇讲的是「模型怎么在一次对话里把事情做完」——任务系统、Agent 协作、文件协作族。这一篇换个角度问：**如果根本没人盯着这个 REPL，事情还能继续往前推吗？** 答案藏在两块看起来不太一样、但骨子里互相支撑的代码里：`coordinator/`（让一个会话变成「带 Worker 的项目经理」）和 `tools/ScheduleCronTool/` + `hooks/useScheduledTasks.ts`（让会话在 5 分钟后、半小时后、明早 9 点 17 分被一段 prompt 自己叫醒）。

## 为什么要把 Coordinator 与 Cron 放在同一章？

直接读源码很容易把这两块拆成两个独立的题目：Coordinator 看着像「多 Agent 编排」，Cron 看着像「定时任务调度」，一个属于 squad / swarm 那一族，另一个像是给 SDK daemon 准备的辅助设施。把它们放在同一章听起来有些勉强。

但凡是把这两块代码同时翻完一遍，就会发现它们其实在解决同一类问题：**怎么让 Claude Code 这个进程在没人按回车的情况下，自己产生下一回合**。

Coordinator 解决的是空间上的「下一回合」——主线程不动手了，但它派出去的 Worker 在并行干活，每个 Worker 自己跑一个完整的 query loop；Coordinator 自己再以「项目经理」的身份围着这些 Worker 收发消息。Cron 解决的是时间上的「下一回合」——这个会话现在闲着没事，但十分钟以后，scheduler 会从硬盘上读出一段 prompt、塞回主循环、让模型像被用户敲了回车一样开始新一轮推理。

两者对外暴露的工具不在同一份注册表里（`AgentTool` / `TaskStopTool` vs `CronCreate` / `CronDelete` / `CronList`），但对**对话循环的入侵点是同一处**：都走 `enqueuePendingNotification()`，都走 `messageQueueManager` 的 `'later'` 优先级，都把自己当成「来自后台的一条用户消息」插队进 query loop。当你意识到这件事之后，前面 C14（Agent）/ C16（任务模型）里反复出现的 `pendingMessages` / `pendingNotification` 这一组 API，就突然变得不再是 Agent 系统的内部细节，而是这个 CLI 在「无人值守」这一维度上留出来的统一入口。

这一章按这条线索往下走：先看 Coordinator 怎么把一个普通会话改写成项目经理；再看 Cron 工具家族怎么把「一段 prompt + 一个 cron 表达式」落到磁盘上；最后看 scheduler 怎么在每一个 tick 上把到点的任务塞回主循环——以及多个会话同时盯着同一份 `scheduled_tasks.json` 时，谁有资格当那个开锁的 scheduler。

---

## 一、Coordinator 模式：当主会话不再亲自动手

打开 `coordinator/coordinatorMode.ts`，第一个值得看的不是 system prompt，而是 `isCoordinatorMode()` 这几行：

```typescript
// coordinator/coordinatorMode.ts:36-41
export function isCoordinatorMode(): boolean {
  if (feature('COORDINATOR_MODE')) {
    return isEnvTruthy(process.env.CLAUDE_CODE_COORDINATOR_MODE)
  }
  return false
}
```

两个门一起把：先是 `feature('COORDINATOR_MODE')` 这一层编译期开关——按第 19 篇讲过的 DCE 机制，外部构建里这整块逻辑会被完整剔掉，不留任何字节；其次才是运行时的 env truthy 判断。两道门是有讲究的：Coordinator 模式不是给所有用户的默认行为，它会把模型平时拿在手里的 Read / Write / Edit / Bash 这一摞工具全部抽走，换成一份完全不一样的工具集。如果不小心被外部用户撞开，体验上会像「Claude 突然不会改文件了」。所以外部构建宁可让这段代码不存在，也不要它存在但默认关。

真正进入 Coordinator 模式之后，**主会话第一件事是给自己换一张身份证**。它的 system prompt 不再是「你是一个帮用户写代码的 AI」，而是一份接近 370 行、读起来像「项目经理岗位说明书」的大段说明。这份 prompt 的来源是 `getCoordinatorSystemPrompt()`，里面被反复强调的几条要点抄一下：

- 你的角色是分派工作给 Worker，不是亲自完成代码改动；
- 你拿到的工具只有 `AgentTool`（派 Worker）、`SendMessage`（给已经在跑的 Worker 续指令）、`TaskStopTool`（必要时杀掉跑偏的 Worker）；
- 永远不要写 "based on your findings"——你必须读懂 Worker 的 research 输出，把它落到一条具体的下一步指令上，而不是让下游模型自己猜你想要什么；
- 一份任务从 Research → Synthesis → Implementation → Verification 走四步，每一步都决定是 Continue（在原 Worker 上续）还是 Spawn Fresh（开一个干净的 Worker 重新切一段上下文）。

为什么要把这一份说明书写得这么啰嗦？因为 Coordinator 没有现成的「项目经理直觉」可用。模型在普通会话里被训练成「直接动手」的偏好极强：它看到一个 bug，下意识就想 Read 一下源码、Edit 一行试试。Coordinator 模式里这条路被堵死了——它必须把这种冲动改成「派一个 Worker 去 Read 一下」，并写出足够具体的 prompt 让那个 Worker 真的能开干。这份 prompt 的本质就是在用文字反复纠偏模型的默认动作。

### 1.1 Worker 拿到的是哪一份工具

接下来看 Worker 那一侧。`coordinator/coordinatorMode.ts` 里有一组叫 `INTERNAL_WORKER_TOOLS` 的集合，列着 `TeamCreate` / `TeamDelete` / `SendMessage` / `SyntheticOutput`——这些是 Coordinator 编排层自己用的工具，Worker 永远拿不到。Worker 看到的工具集是「全量工具表减去这组内部工具」，再叠一层环境变量过滤：当 `CLAUDE_CODE_SIMPLE` 被设成 truthy 时，Worker 的工具被进一步压缩到只剩 `Bash / Read / Edit`，连 Glob / Grep 都被拿掉。

这一层简化的动机在源码注释里写得不算明显，但回到上一章对 REPL 模式（八个高频工具被藏进 REPL VM）的讨论就很顺：Worker 不需要拥有 ToolSearch、不需要拥有 LSPTool 这种 deferred 工具，它只需要能干「读一段、改一段、跑一段」就够了。让 Worker 看到的工具表越窄，它在 prompt 表面消耗的 token 越少，每次 spawn 一个 Worker 的成本就越低。Coordinator 模式恰恰要频繁 spawn Worker（一个工程任务很可能要派出 4–5 个），这点 token 节省会在一次会话里累出可观的差。

### 1.2 Coordinator 的本质是什么

把上面这几件事拼起来，Coordinator 不是一个「新的会话类型」，它是一次**对工具集和 system prompt 的双重换皮**：

- 工具集：从「干活的工具」换成「派活的工具」；
- system prompt：从「你是一个 AI」换成「你是一个项目经理」；
- 对话循环本身：不变——仍然是 C05 那一份 `query()` 主循环，仍然是 C16 那一份 TaskState 注册表，仍然是 C20 那一套 hooks。

这种「内核不变、外层换皮」的设计在源码里很常见——你后面在 Cron 那一节也会看到完全同构的判断：Cron 系统也不发明新的 query loop，它只是往 query loop 里塞消息。同一个内核被两套不同的外层复用，是 Claude Code 源码里非常稳定的一条工程美学。

---

## 二、ScheduleCronTool：把「半小时后跑一段 prompt」做成工具

Coordinator 解决了「不让用户每一步都按回车」的问题，但它仍然要求**有一个人或一个上游进程在跟模型对话**。如果你想让 Claude Code 在凌晨 3 点自己醒来跑一段质量检查、或者在 5 分钟后自动检查 CI 结果，光靠 Coordinator 就不够了——你需要一个真正的定时器。

`tools/ScheduleCronTool/` 这个目录里没有一个叫 `ScheduleCronTool.ts` 的入口文件，它是一组 leaf tool 的家族：`CronCreateTool` / `CronDeleteTool` / `CronListTool`。第 10 篇讲过 family tool 与 leaf tool 的关系——family 在 `<available-deferred-tools>` 里只露一个名字，三个 leaf 由 family 工具自己暴露 schema 给模型。Cron 走的就是这一条路。

### 2.1 三个 leaf 工具各自的边界

三个 leaf 各管各的事，但又不是简单地切成 CRUD。`CronCreateTool` 的 `validateInput()` 是其中最重的：它要解析 cron 表达式、要算「下一次触发时间是不是落在一年以内」、要查当前是不是已经塞了 50 个 cron 任务（`MAX_JOBS = 50`），还要拦住一类特殊的越界——「teammate 不允许创建 durable 任务」。

最后这一条规矩值得多说一句。`CronCreateTool` 的 schema 里 `durable` 默认是 false：默认创建的 cron 是 session-only 的，只活在内存里，当前 REPL 退出就没了。如果想让 cron 跨会话存活，必须显式传 `durable: true`，这条任务才会被写进 `.claude/scheduled_tasks.json`。但 teammate（in-process teammate，也就是 C16 讲过的那一类 Agent）创建的 cron 任务被强制禁止 durable——错误码是 4，原因藏在 hooks/useScheduledTasks 那一层：teammate 是会话级的对象，它的身份只在父 session 里有效。一旦它的 cron 跨会话存活，触发时找不到原来的 teammate，cron 就成了一个无主的孤儿。源码选择的处理方式是「不让它产生」，而不是「让它产生然后清理孤儿」——前者廉价、后者要在 scheduler 那一层维护额外的依存关系。

`CronDeleteTool` 看起来最简单，但它带了一道权限检查：teammate 只能删自己创建的 cron，错误码 2。这是 multi-Agent 协作里典型的最小权限——不希望 Agent A 跑着跑着把 Agent B 排好的提醒删掉。`CronListTool` 则反过来给了不对称的视角：teammate 调 List 只能看到自己的 cron；主会话（没有 `agentId`）调 List 能看到这个项目里所有的 cron。

这三个工具共享一个隐藏属性：`isReadOnly` 和 `isConcurrencySafe` 在 `CronListTool` 上都给了 true，意思是模型可以在同一回合里把三个 cron 列表查询打成 batch 并发跑——这在「项目里一次性看清所有定时任务」这种场景下省一轮 round trip。

### 2.2 jitter：永远不要在整点触发

读 cron 系统最容易忽略的一段是 `utils/cronTasks.ts` 里那份 `DEFAULT_CRON_JITTER_CONFIG`：

```typescript
// utils/cronTasks.ts (摘)
recurringFrac: 0.1,             // 周期任务的随机偏移幅度
recurringCapMs: 15 * 60 * 1000, // 偏移幅度上限 15 分钟
oneShotMaxMs: 90 * 1000,        // 一次性任务最大向前借 90 秒
oneShotFloorMs: 0,
oneShotMinuteMod: 30,           // 避免命中整点 / 半点
recurringMaxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 天后过期
```

这一组数字背后是一个相当朴素但容易被忽视的工程顾虑：如果一千个用户都写了 `0 9 * * *`（每天早上 9 点跑一次），那么 9:00:00 这一刻 Anthropic 的 API 会被同时打一千个请求——这是典型的 thundering herd。Cron 工具在 prompt 层就已经在提醒模型「尽量避开 :00 和 :30」（见 `tools/ScheduleCronTool/prompt.ts`），但模型给用户出的 cron 表达式终究不可控。所以系统在执行层兜底——`jitteredNextCronRunMs()` 把周期任务的下一次触发往后随机推一段时间，幅度是「下一次本来要等多久」的 10% 但封顶 15 分钟。

一次性任务的 jitter 走的是另一条逻辑：`oneShotJitteredNextCronRunMs()` 是**向前借时间**，最多提前 90 秒，但有一道 `oneShotMinuteMod = 30` 的最小步长——也就是说如果你写「每 30 分钟跑一次」，系统会确保实际触发落在 :00 和 :30 之外的某个小数位上。这条逻辑设计得稍显绕，但跟 prompt 里那一句「尽量避开整点」是同一份意图：源码不相信用户和模型会自觉错峰。

`jitterFrac` 这个生成 [0, 1) 随机数的函数也值得一提：它没有用 `Math.random()`，而是把 cron 任务的 ID 前 8 位 hex 切下来除以 0x100000000。这意味着同一个任务每次计算 jitter 都得到同一个随机分布——这条决定让重新加载 `scheduled_tasks.json` 后任务的下次触发时间是稳定的，方便排错；也让用户在跨会话恢复时不会突然感觉「今天提醒的时间跟昨天不一样」。

### 2.3 cron 表达式解析：一个克制版的实现

`utils/cron.ts` 这一份手写的 5 字段 cron 解析器一共 308 行，跟 `cron-parser` 这种成熟库相比，它**主动放弃了好几个特性**：

- 不支持 L（last day of month）/ W（weekday closest to）/ ?（dayOfMonth/dayOfWeek 二选一不指定）；
- 不支持 `MON-FRI` / `JAN-DEC` 这种名字别名；
- 不支持 6 字段（带秒）或 7 字段（带年）格式；
- 只接受星号、N、N-M、N-M/S、`*/N` 这几种语法的组合。

为什么写一份这么克制的解析器？读完整份代码之后能猜出来理由：Cron 工具是给模型用的，不是给写过 vixie-cron 的运维用的。模型平时在文档训练数据里见过的 cron 表达式 95% 都落在这几种语法里，剩下的 L / W / 名字别名属于「会用的人少、用错的人多」的特性。少支持几种语法换来一份能完整 fit 在 308 行里的、能被 reviewer 一次性读完的实现——这是个挺合理的权衡。

值得记一笔的是 `computeNextCronRun()` 的实现：它不是按数学方式直接算下一次匹配，而是**从当前时间往前一分钟一分钟走**，最多走 366 天（`maxIter = 366 * 24 * 60`），每一步检查 month / day / hour / minute 是否都匹配。这种「走一遍」的实现牺牲了一点点 CPU 换来了正确性——尤其是对 DST（夏令时切换）这种边界情况，按数学方式算很容易出错（春分跳过 2-3 点那一天、秋分重复 1-2 点那一天），而按分钟走一遍就自然把这些边界处理对了。源码注释里直接写明了语义：fixed-hour cron 在 spring-forward 那天会被自然跳过（这一小时在本地时间里根本不存在，hour-set 检查失败），fall-back 那天则只触发一次（步进逻辑会跳过第二次出现的同一小时）——这就是 vixie-cron 的标准语义。

### 2.4 OR 还是 AND：day-of-month 与 day-of-week

cron 表达式里有一个被 99% 的用户搞错的细节：当 `dayOfMonth` 和 `dayOfWeek` 同时被指定时（即都不是 `*`），任意一个匹配就算匹配。这是 vixie-cron 沿用了几十年的语义，但完全反直觉——大多数人会期望「AND」。`computeNextCronRun()` 里这一段：

```typescript
// utils/cron.ts (摘)
const dayMatches =
  domWild && dowWild ? true
  : domWild ? dowSet.has(dow)
  : dowWild ? domSet.has(dom)
  : domSet.has(dom) || dowSet.has(dow)
```

把这个 OR 语义显式写出来——`domSet.has(dom) || dowSet.has(dow)`。这种边角语义如果不在源码里贴一段注释加一份单测，下一个维护者一定会想「修一下这个 bug」。Claude Code 的处理方式是接受它、并在源码注释里把 vixie-cron 这个名字钉死——以后谁要改这一行，得先读完 vixie-cron 的历史背景。

---

## 三、scheduler：一秒 tick 一次的小心脏

`utils/cronScheduler.ts` 是 cron 系统真正的引擎，565 行里塞进了：tick 循环、文件监听、锁协作、jitter 计算、missed task 检测、aged-out 处理、teammate 路由。先看它的几条核心常量：

```typescript
// utils/cronScheduler.ts (摘)
const CHECK_INTERVAL_MS = 1000      // 每秒检查一次
const FILE_STABILITY_MS = 300       // 文件被改动后 300ms 才认为稳定
const LOCK_PROBE_INTERVAL_MS = 5000 // 5 秒探一次锁
```

每秒 tick 一次这件事看着粗暴，但在一台空闲的 REPL 上跑 setInterval(1000) 不会带来可测量的开销。`FILE_STABILITY_MS = 300` 这个数字是 chokidar 监听 `scheduled_tasks.json` 时用的「文件改完了多久算稳定」窗口——避免一次保存触发两次 reload（写 + truncate + 写）。`LOCK_PROBE_INTERVAL_MS = 5000` 则是给「另一个 session 在等着」的场景准备的：当本会话拿不到 scheduler lock 时，每 5 秒重新尝试一次，5 秒是个能让用户感觉「换主很快」但又不会把 PID liveness 检查打成高频轮询的折衷。

### 3.1 锁：同一个项目里只能有一个 scheduler

打开 `utils/cronTasksLock.ts` 这个文件，你会看到一份跟 `computerUseLock.ts` 同构的实现——这是 Claude Code 里一种被复用了多次的「单租户锁」模式：

```typescript
// utils/cronTasksLock.ts (摘)
const schedulerLockSchema = lazySchema(() =>
  z.object({
    sessionId: z.string(),
    pid: z.number(),
    acquiredAt: z.number(),
  }),
)
```

锁文件落在 `.claude/scheduled_tasks.lock`，内容是一份 JSON：`{sessionId, pid, acquiredAt}`。拿锁走的是 O_EXCL（`writeFile(..., { flag: 'wx' })`）的原子创建——失败一定是因为文件已经存在。然后做三件事的依次判断：如果文件里写的 sessionId 就是自己，说明这是同一个 session 重新拿锁（比如 `--resume`），返回 true 并把 pid 字段顺手刷新成当前进程的新 pid；如果文件里的 pid 还在跑（`isProcessRunning(pid)`），说明被另一个 live session 占着，返回 false；如果文件里的 pid 已经死了，那就是 stale lock，unlink 后再试一次原子创建——这种「失败 + 探活 + 抢救」的三步实现既正确（多个 session 同时抢救 stale lock 时只有一个能赢）又简单（不需要分布式协调）。

为什么 cron 系统要做这种锁？因为同一个项目目录可能同时打开两个、三个、甚至更多的 REPL。如果每个 REPL 都自己跑一份 scheduler，同一个 cron 任务会被触发好几次。锁的存在让「调度」这件事在同一个项目里只发生一次——其它会话照样能创建/删除/列出 cron 任务（写文件不需要锁），但只有持锁的那个 session 负责把任务塞回各自的主循环。

`registerCleanup()` 这一手则补上了「进程死了锁怎么办」的最后一块：每次拿锁成功之后注册一个 cleanup 回调，进程正常退出时自动 unlink 锁文件。即使是异常退出（kill -9），下一个 session 启动时也会通过 PID liveness 检查把这个 stale lock 抢救掉——双保险。

### 3.2 一个 tick 里发生了什么

scheduler 拿到锁之后，每秒钟做的事大致分三步：

第一步是「重读 `scheduled_tasks.json` 看看有没有新任务」——但这一步不是每秒真的去 stat 文件，而是由 chokidar 在文件变更时触发 reload，scheduler 自己 tick 时只读内存里的任务列表。这是一种典型的「事件驱动 + 周期兜底」的混合：chokidar 漏掉一次（NFS、Docker volume 的 inotify 经常不可靠），下一秒 tick 也会从内存里继续往前走。

第二步是计算每一个任务的 `nextFireAt` 并跟 `Date.now()` 比较。`nextFireAt` 的锚点是 `lastFiredAt ?? createdAt`——也就是说一个新创建的任务从「创建时刻」开始算下一次触发，一个已经跑过的任务从「上一次触发时刻」开始算。这条选择避免了一个细微的偏移问题：如果用 `Date.now()` 当锚点，每次 tick 都会让下一次触发往后挪一秒，长期运行会累积成可见的飘移。

第三步是「该触发就触发」。`fireCronTask()` 把任务的 prompt 包装成一条 `task-notification`，调 `enqueuePendingNotification()` 塞回 messageQueueManager 的 `'later'` 队列，然后把 `lastFiredAt` 更新为 `now`、`nextFireAt` 重新计算并加 jitter。注意周期任务这里有个细节：reschedule 的起点是 `now` 而不是「本来的 next」——这条选择让长时间不在线的会话醒来之后**只补跑一次**而不是补跑过去几小时积累的所有触发。

### 3.3 missed task：开机时怎么补

scheduler 还要回答另一个问题：如果一个 cron 任务定的是「下午 3 点跑」，但你下午 2 点关电脑、下午 5 点才重新打开会话，这个任务还跑不跑？

源码的处理是：**只对一次性、非周期的 cron 任务补跑**，并且只在 scheduler 第一次启动（initial load）的时候补一次。周期任务过期就过期了（前面说过，周期任务从 `now` 开始算下一次，自然就是下一个周期）；一次性任务如果错过了，错过的窗口太大就直接当过期处理。这条策略跟 vixie-cron 在 `anacron` 上的处理思路是一致的——既不要丢一次性任务、也不要因为错过几小时就连补好几次周期任务。

而周期任务还有另一道生命周期闸：`recurringMaxAgeMs = 7 * 24 * 60 * 60 * 1000`，也就是 7 天。任何周期任务在 7 天里如果一次都没真正被触发（比如这个项目 7 天都没人打开），下一次再触发时会**触发最后一次**，然后从磁盘里删掉。这条决定回答的是「定一个每天检查 CI 的提醒，结果项目荒废了 3 个月」这种长尾——不要让一份 `.claude/scheduled_tasks.json` 里堆着几百条过期任务陪你一辈子。

### 3.4 buildMissedTaskNotification：包装 prompt 的小学问

补跑 missed task 时还有一个值得抄的细节。原本的 prompt 是用户写的，可能包含 markdown 围栏、可能包含特殊字符。直接塞回 query loop 不仅可能把 `<task-notification>` 这个 XML 标签的解析弄乱，还可能被攻击者用「我的 cron prompt 里嵌一段 fake 系统消息」这种方式注入。`buildMissedTaskNotification()` 的处理是**用一段足够长的反引号围栏把 prompt 整段包住**——围栏长度由 prompt 内出现的最长反引号串 + 1 决定，这样不管 prompt 里用了几个反引号都能正确闭合。这是 markdown 安全嵌套的标准做法，但放在 cron 通知的语境里很容易被忽略，源码这一手值得记。

---

## 四、useScheduledTasks：scheduler 与 REPL 的最后一公里

到这里 scheduler 已经把任务推到了「应该触发」这一步，但**触发的消息究竟怎么塞回模型？** 这条最后一公里走的是 `hooks/useScheduledTasks.ts`——一个 React hook，把 scheduler 嵌进 REPL 的生命周期。

这个 hook 做的事看起来简单：在 component mount 时调 `createCronScheduler()`、把 schedule fire 事件绑到 REPL 的 enqueue 路径上、unmount 时调 cleanup。但里面有几个细节值得拆开看：

第一是 `isLoadingRef` 这一个 ref。如果不用 ref 而用普通的 closure 变量，第一次 render 时拿到的 `isLoading` 会被 closure 进 scheduler 回调里——之后 isLoading 变化了，scheduler 看到的还是当时那个值。React 里这是个老毛病，解决方案就是 ref。

第二是「按 agentId 路由」。fire 事件回调里要判断这个 cron 是主会话创建的还是某个 teammate 创建的——前者直接 `enqueuePendingNotification()` 走主队列，后者要走 teammate 自己的 mailbox。如果这个 teammate 已经不在了（被用户主动 kill、或者父 session 关闭），cron 任务变成了孤儿，hook 这里会把它从 `.claude/scheduled_tasks.json` 里删掉——这条「自动清理」是前面 §2.1 提到的「teammate-no-durable」规则的搭档：在创建端禁止，在执行端清理，两头堵死「孤儿 cron」这种状态。

第三是 `workload: WORKLOAD_CRON` 这个字段。它会出现在通知插队进 query loop 的 metadata 里，最终通过 HTTP header 传到 Anthropic 后端，用作 QoS 分类——cron 触发的请求会被打上「这是后台任务，不是 user-facing」的标签，在系统繁忙时可以被优先 deprioritize。这是一种端到端的 attribution：从 hook 注入开始，metadata 一路跟着这条消息走到 API 调用，让后端知道这一刻这个会话的「忙」不是真的有人在等回复。

第四是 `isMeta: true`。这条标记让通知在 UI 上以「系统消息」的方式呈现，而不是伪装成用户消息。如果不打这条标记，用户回到 REPL 时会看到对话历史里多了几条「自己没说过的话」——非常困惑的体验。

---

## 五、Cron 启用条件：三道门，一层缓存

回过头再看一眼 Cron 工具家族什么时候才会出现在模型的工具列表里。`tools/ScheduleCronTool/prompt.ts` 里 `isKairosCronEnabled()` 这个函数把三道门叠在了一起：

1. `feature('AGENT_TRIGGERS')` ——编译期 DCE 门，外部构建里整块代码不存在；
2. 没有 `CLAUDE_CODE_DISABLE_CRON` 这个 env 紧急刹车——用户/管理员的本地 kill switch；
3. GrowthBook 的 `tengu_kairos_cron` 这个 feature gate——Anthropic 后端控制的灰度开关。

三道门同时为真，工具才注册。`isDurableCronEnabled()` 是一个独立的子开关（`tengu_kairos_cron_durable`），单独控制「durable 任务能不能用」——这条分层让 Anthropic 在线上能精细控制：先把 session-only 的 cron 开给所有用户用一段时间，确认稳定之后再把 durable 开关打开。

GrowthBook 的判断结果带了 5 分钟的缓存（`KAIROS_CRON_REFRESH_MS = 5 * 60 * 1000`），不会每次工具枚举都去远端查一次。这跟 §0.4 那条「运行时可用类陈述必须列出依赖变量」的规矩对得很齐：工具是否可用不是一个常量，而是「feature flag 状态 × env 状态 × GrowthBook 5 分钟缓存」三者的乘积。

`DEFAULT_MAX_AGE_DAYS = 7` 这个常量也在 prompt 里被提到——告诉模型「周期任务超过 7 天没人理会自动过期」，让模型在帮用户设置长期提醒时知道边界。这种「把生命周期写进 prompt」的小细节是工具家族里反复出现的：模型看到的工具描述不仅要讲怎么用，还要讲什么时候会失效。

---

## 六、回望：两条线汇到同一个入口

把 Coordinator 和 Cron 两块都拆完了，再回头看引言里那个问题——「为什么放在同一章」。两条线的汇合点其实就一句话：**两者都让 query loop 在没有人按回车的时候继续转下去**。

Coordinator 的方式是：把主线程变成项目经理，让被派出的 Worker 自己跑独立的 query loop；当 Worker 跑完，结果通过 `enqueuePendingNotification()` 回到主线程的 query loop，主线程模型继续推理「下一步派谁干啥」。

Cron 的方式是：在没有任何模型在跑的时刻，由 setInterval(1000) 这个小心脏来产生「下一回合」的契机，把 prompt 通过同一个 `enqueuePendingNotification()` 塞回主线程的 query loop。

两条线最终都收口在 `'later'` 优先级队列上——这是 messageQueueManager 留出来的「来自后台」的入口。第 16 篇讲任务通知机制时已经介绍过这套队列的三层优先级（now / next / later），现在你看到的是这套机制的全部使用方：来自后台任务的通知、来自 cron 的触发、来自 teammate 的 idle 信号、来自 Coordinator 派出去的 Worker 完成报告——它们走的都是同一条入口。

这也回答了为什么 Cron 系统的 jitter 配置那么细。如果 cron 触发跟用户输入抢同一个 'now' 优先级，整点的雷阵雨会直接打在用户体验上。'later' 这一优先级的意义就在于：用户输入永远先处理完，后台的事再说。Cron 的 jitter + 'later' 优先级 + WORKLOAD_CRON 的 QoS 分类，三者叠在一起，构成了一个相当克制的「后台任务不要打扰前台」的工程承诺。

---

## 下一篇预告

下一篇进入第五篇「协议、安全与扩展接口」，从 `services/mcp/` 23 个文件出发，看 Claude Code 怎么用 5 种传输层（stdio / SSE / HTTP / WebSocket / SDK）连上外部工具服务器，以及 OAuth + XAA 认证方案在 cli 里是怎么落地的。

---

*全部内容请关注 https://github.com/luyao618/Claude-Code-Source-Study (求一颗免费的小星星)*
