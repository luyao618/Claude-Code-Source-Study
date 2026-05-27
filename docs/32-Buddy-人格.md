# 第 32 篇：Buddy 人格 — 在 PromptInput 边上养一只随机生成的小动物

> 本篇是《深入 Claude Code 源码》系列第 32 篇。我们将剖析 `buddy/` 目录下的 6 个文件以及它们在 REPL、PromptInput、配置、附件、消息流里的 7 处接入点，看 Claude Code 如何在一个本来全是代码与文字的终端里，挤出一只随机生成的、会眨眼、会被摸、会冒话框、还会被悄悄藏掉的小动物。

## 为什么 Buddy 值得单独一篇？

终端工具向来是"功能至上"的世界——多一行像素都要解释为什么不让位给输出。可这一次 Claude Code 偏偏在 PromptInput 框右边塞进了一只小生物，它会随机出一个名字、会在你打字时眨眼、你把光标停在它上面按一下回车它就会出爱心，它甚至会冒出一个圆角小气泡评论你刚才的对话。

这件事不是简单地"画一只 ASCII 小动物"。它要回答的问题相当多：

1. **同一个人每次启动看到的是不是同一只？** 如果每次都重新随机，那就是个噱头；如果存满了配置文件，那一旦清掉 `~/.claude.json` 就再也找不回原来那只
2. **它在终端窄到 80 列时怎么办？** 把一只 12 列宽的小动物硬塞到一个本来就在挤滚动条的窗口里，是体验灾难
3. **大模型会不会以为自己就是这只小动物？** 系统提示里突然出现"你叫 Sproink，是只 frog"——模型很可能下一句就开始扮演青蛙
4. **没开 Buddy 的人，构建出来的二进制里能不能完全没有它的代码？** 一个"宠物"功能进了 critical path 是说不过去的
5. **怎么让人发现这个隐藏功能而不打扰那些不想要它的人？** 弹一个明黄色公告会被骂；藏到 `--help` 里又没人看

Claude Code 的答案是：**把"骨"和"魂"切开存，把渲染、出现、声明、命令四个面分别接进现成的子系统，再用两道编译期 + 一道运行期门把它整体藏在大多数构建之外**。`buddy/` 目录里六个文件加起来千余行，刚好对应这五个问题一一作答：`companion.ts` 管"骨"和"魂"的拆分与生成、`types.ts` 管物种与稀有度词典、`sprites.ts` 管 18 个物种的 ASCII 像素画、`CompanionSprite.tsx` 管帧动画与气泡、`prompt.ts` 管对大模型的"第三人称声明"、`useBuddyNotification.tsx` 管短窗口里的彩虹色入口提示。

本篇按这个顺序拆：先看"骨与魂"如何被切开（§一）、再看 18 物种的字典是怎么躲开打包扫描的（§二）、像素画与帧动画如何在 500 ms 一拍的节奏下完成眨眼与摸头（§三）、窄屏退化与全屏浮动气泡的两种排版（§四）、怎么用第三人称介绍把小动物钉在"旁观者"而不是"扮演者"位置（§五）、最后看 `/buddy` 入口、彩虹高亮、footer 集成与两道编译门如何把它整体藏在大多数构建之外（§六）。

---

## 一、骨与魂：一半算出来，一半存下来

`Companion` 这个类型在 `buddy/types.ts:100-124` 里被切成了两半。`CompanionBones` 包六个字段——`rarity`、`species`、`eye`、`hat: Hat`、`shiny: boolean`、`stats: Record<StatName, number>`；`CompanionSoul` 只包两个——`name: string` 和 `personality: string`。对外用的 `Companion = CompanionBones & CompanionSoul & { hatchedAt: number }`——`hatchedAt` 是外层字段，不在 Soul 里；而落盘的 `StoredCompanion = CompanionSoul & { hatchedAt: number }`——骨头一个字节都不存。

`Bones` 是"骨"——稀有度、物种、眼神、帽子、是否闪光、五维属性，全部是可以从一个种子算回来的派生数据。`Soul` 是"魂"——只有两样：模型给它起的名字，和模型生成的人格描述。

为什么这样切？看 `companion.ts` 里 `getCompanion()` 的最后一步就明白了（`buddy/companion.ts:127-133`）：

```typescript
export function getCompanion(): Companion | undefined {
  const stored = getGlobalConfig().companion;
  if (!stored) return undefined;
  const { bones } = roll(companionUserId());
  return { ...stored, ...bones };
}
```

`stored` 先铺，`bones` 后铺——意味着每次读出来的"骨"都是临时算出来的，不是反序列化出来的。这件事有两个直接好处：第一，配置文件无论怎么变都不会污染骨架，源码里那句注释说得很直白——"editing config.companion can't fake a rarity"，用户改不出一只 legendary 来；第二，假如哪天往 `Bones` 里加一个字段（比如新增一个 `aura: Color`），老用户不需要"迁移"，下次启动直接补上。

骨架怎么算？关键在那一行 `roll(companionUserId())`。`companionUserId()` 在 `buddy/companion.ts:119-122` 里取 OAuth 账号 UUID，回退到本机 `userID`，再回退到字符串 `'anon'`——一个稳定且对同一台机器/账号同一只手指头可重现的标识。

再看种子化的伪随机数。`buddy/companion.ts:16-25` 用了一段教科书级的 Mulberry32：状态只有 32 bit，函数体只有四行算术（加常数、`Math.imul` 两次、右移异或一次），最后把 32 位整数除以 `4294967296` 归一到 `[0,1)`。这是公认的小巧确定性 PRNG，纯算术、不依赖运行环境、调用一万次和调用一次的开销线性可数。配套的 `hashString`（`buddy/companion.ts:27-37`）优先用 Bun 自带的非加密哈希，退回 FNV-1a 五行手写实现（异或当前字符 + `Math.imul` 乘 0x01000193），两者都满足"相同输入永远相同输出"。

然后种子里加了一道"咸"（`buddy/companion.ts:84`）：

```typescript
const SALT = 'friend-2026-401';
```

`roll(userId)` 实际用的种子是 `hashString(userId + SALT)`。这道咸的作用很直接：**用户的 UUID 是个稳定标识，谁都没必要把它和具体哪种小动物绑死**——咸一改，全员重新孵化，相当于一次"全服换代"的开关，藏在源码里、不需要走配置。

最后是一个轻量缓存（`buddy/companion.ts:107-117`）：单槽位记住最近一次的 `userId → Bones`，因为运行期内 `userId` 不会变（除非中途登录/登出），但 `getCompanion()` 会被 500 ms 一拍的渲染器频繁调用，避免每帧都重算 5 次随机数。同文件还导出一个不走缓存的 `rollWithSeed(seed)`，专供调试和文档场景做"我给你一个固定种子，你给我看看出什么"。

---

## 二、十八种小动物：藏在 `String.fromCharCode` 后面

`types.ts` 里 `SPECIES` 是一个长 18 的 `as const` 数组，每个槽位都写成 `String.fromCharCode(0x66, 0x72, 0x6f, 0x67)` 这种形式（这一个就是 `'frog'`），下面紧跟一行 `// 'frog'` 注释告诉人类它是什么。同文件还有两张表：`RARITY_WEIGHTS` 给五档稀有度分别赋 60/25/10/4/1，加起来正好 100；`RARITY_STARS` 给同样五档配上 1 到 5 个 `★` 字符，渲染时直接拼在名字旁边。

这种"把一行字符串名拆成 `String.fromCharCode(…)` 数列"的写法看起来很怪——直接写 `'frog'` 不香吗？看一眼仓库根目录的字符串扫描脚本就明白了。打包流水线里有一条 canary：扫描 bundle 产物，凡是出现一组预定义的"内部代号"明文（`frog`/`legendary`/`Sproink` 之类）就 fail。Buddy 是个面向特定渠道发布的彩蛋特性，绝大多数构建里它需要 dead code elimination 干净到不剩字符串残骸。把名字写成字符码常量数组，编译期 TypeScript 不动它，运行期 V8 会把它拼起来，扫描器看到的只是一串数字字面量，认不出来。

稀有度的权重表 60/25/10/4/1 加起来是 100，刚好不是巧合——`rollRarity` 就是按累积权重在 `[0,100)` 区间里掷一次随机数（`buddy/companion.ts:43-51`）：累积扫一遍 `RARITY_WEIGHTS`，命中第一个区间为止；兜底返回 `'common'` 防止浮点累积误差。

紧挨着还有一层"地板"保护——`buddy/companion.ts:53-59` 的 `RARITY_FLOOR` 给五档稀有度分别定下 5 / 15 / 25 / 35 / 50 的基线下限。它的用途在 `rollStats`（`buddy/companion.ts:62-82`）里：五维属性是 `DEBUGGING / PATIENCE / CHAOS / WISDOM / SNARK`——一个很 self-aware 的清单。算法走的是三分支：先掷一个 `peak`、再掷一个 `dump`，用 `while (dump === peak)` 重掷直到两者不撞；然后遍历五项，落到 `peak` 的算 `Math.min(100, floor + 50 + Math.floor(rng()*30))`、落到 `dump` 的算 `Math.max(1, floor - 10 + Math.floor(rng()*15))`、其余项算 `floor + Math.floor(rng()*40)`。地板随稀有度递增，传说级最低 50，所以 legendary 那只看一眼属性条就跟普通一只一望可辨；high/low 用 `while` 重掷撞 peak 的方式避撞，没有用偏移取模的小技巧。

帽子是稀有度的一个伴生物。`rollFrom(rng)`（`buddy/companion.ts:91-102`）的工作流程是：先 `mulberry32(hashString(seed + SALT))` 拿到一个确定性的 `rand()` 函数，再依次掷出 `rarity`、`species`（在 `SPECIES` 里取下标）、`eye`（在 `EYES` 里取下标），然后帽子按一条 hard rule 走——`rarity === 'common' ? 'none' : pick(rng, HATS)`，common 永远 `'none'`，非 common 直接在 `HATS` 里掷一个下标（注意 `HATS` 数组本身把 `'none'` 也算成一个枚举值，所以非 common 也有八分之一概率掷到 `'none'`）；接着 `rng() < 0.01` 决定 `shiny` 是否为真；最后掷一遍 `stats` 收尾。没有 18% 概率给帽子这种事——帽子的有无完全由稀有度档位决定，"common 不戴 / 非 common 大概率戴一顶"是 hard branch 而非概率门。帽子表里包括 `tinyduck` 这种站在主体头顶上的小附庸，渲染时需要避开主体本身就有的纹理，所以它和物种像素画是要做空间互让的，这件事会在 §三 看到。

---

## 三、像素画、500 ms 一拍、眨眼与摸头

`sprites.ts` 是一个把 18 个物种 × 3 帧 × 5 行 × 12 列全部硬编码的字典表。每个物种是一个 `string[][]`，外层 3 帧、内层 5 行字符串，每行宽 12 列，眼睛位置统一用 `{E}` 这个占位符标出来——因为眼睛是骨架字段，不能硬编进像素表，要在渲染时按 `Bones.eyes` 替换成对应字符（圆点、星号、闭眼弧线之类）。

`renderSprite(bones, frame)` 在 `buddy/sprites.ts:454-468` 做这一步替换 + 帽子布置：先 `map(line => line.replaceAll('{E}', bones.eye))`；如果 `bones.hat !== 'none'`，**只在第 0 行本来全空（`trim()` 为空）时**才把 `HAT_LINES[bones.hat]` 写进 `lines[0]` 替换掉那一行——第 0 行被 smoke / antenna 之类的纹理占用时，源码直接放弃戴帽子，不会 unshift 一行把动物拔高；反过来如果最终 `lines[0]` 仍是空白、且**该物种的每一帧 `frames.every(f => !f[0]!.trim())` 都是空白**，就把那行 `shift()` 掉，省一行空间——`every` 这个判断写在源码注释里说得很清楚（"Only safe when ALL frames have blank line 0; otherwise heights oscillate"），是为了避免不同帧之间高度抖动。这些细节决定了每帧渲出来的 ASCII 在垂直方向能不能精确占用预期格子数，而正确的格子数对接下来 PromptInput 那段宽度结算（§六）至关重要。

帧动画的节奏由 `CompanionSprite.tsx` 顶部一组常量定义（`buddy/CompanionSprite.tsx` 节选）：

```typescript
const TICK_MS = 500;
const BUBBLE_SHOW = 20;          // 20 拍 ≈ 10 s
const FADE_WINDOW = 6;           // 最后 6 拍变暗，提示要消失
const PET_BURST_MS = 2500;
const IDLE_SEQUENCE = [0, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 2, 0, 0, 0];
```

`IDLE_SEQUENCE` 是这整篇里最让人愿意盯着看的一段——它是个长度 15 的循环序列，写明了"小动物在没事干时给你看什么"：大部分时候是帧 0（基础站姿），偶尔切到帧 1（小抖动）和帧 2（另一种小动作），中间穿插一个 `-1` 代表"眨眼"——渲染时遇到 `-1` 不取帧、改画一行 `^_^` 这种闭眼脸覆盖在原本眼睛行上。15 拍正好 7.5 秒一个循环，恰好长到不会让人觉得机械、短到不会让人怀疑它死了。

`useEffect` 里挂一个 `setInterval(tick, TICK_MS)`，每拍 `setFrameIdx(prev => prev + 1)`，根据 `companionReaction` 是否非空切换到"激动序列"（一段连续切帧的快节奏循环），10 秒之后清掉 reaction 回到 `IDLE_SEQUENCE`。`companionReaction` 这个字段从哪里来？在 `AppStateStore.ts:168-171` 它和 `companionPetAt` 一同被列为顶层 app state 字段：

```typescript
companionReaction?: string;
companionPetAt?: number;
```

`companionReaction` 由 REPL 在每一轮对话结束后投喂（`screens/REPL.tsx:2805-2809` 一带）：拿最后一条 assistant 消息的内容片段，丢给一个内部"伙伴观察者"函数，让它从一组短句模板里选一句作为反应，再 `setAppState({ companionReaction: '…' })`。`companionPetAt` 则由 PromptInput 那段 footer 集成里"按 Enter 摸头"的分支写入。摸头的视觉表达靠一组 `PET_HEARTS` 帧（`buddy/CompanionSprite.tsx` 内）：

```typescript
const PET_HEARTS = [
  '   ♡       ',
  '  ♡ ♡      ',
  ' ♡   ♡     ',
  '♡     ♡    ',
  '            ',
];
```

在 `PET_BURST_MS` 也就是 2.5 秒之内，每拍换一帧爱心、压在小动物正上方，整体看起来像几颗心从头顶慢慢飘起、散开、消失。

气泡用的是一个手写的 React 组件 `SpeechBubble`（`buddy/CompanionSprite.tsx:43-151`）。文本进来先过一道 30 列的贪心折行——按空白分词、逐词累加、超过 30 就把当前行 `push` 进 `lines`、当前词作为下一行的第一个词。折好之后用 Ink 的 `Box border` 包一圈，再按 `tail` 参数把一个尾巴字符（`'right' → '◀'`、`'down' → '▼'`）定位在边框的对应位置上，整体看起来像漫画里那种"指向小动物头顶"的对话框。`fading` 跟着 `BUBBLE_SHOW - tick < FADE_WINDOW` 走，最后 3 秒整段套 `dimColor`，告诉读者"再不看就消失了"。

30 列是这只圆角气泡的内部最大宽度——加上两侧各 1 列边框 + 内边距，整体占 36 列（你会在 §四 看到这个数字以常量形式出现在宽度结算里）。

---

## 四、窄屏退化与全屏的浮动气泡

终端宽度是这套渲染最大的不可控变量。一台 80 列宽的窗口，左边光是 PromptInput 自己就要 60 多列；如果再硬塞一只 12 列宽的小动物加一个 36 列的气泡，等于直接把输入框挤崩。`CompanionSprite.tsx` 用一个对外暴露的函数告诉 PromptInput "我要占多少列"（`buddy/CompanionSprite.tsx:167-175`）：

```typescript
export function companionReservedColumns(cols: number, speaking: boolean): number {
  const cfg = getGlobalConfig();
  if (cfg.companionMuted) return 0;
  if (cols < 100) return 0;
  const sprite = 12 + 2;            // 12 列像素画 + 2 列内边距
  const bubble = speaking ? 36 : 0; // 36 列气泡，只在说话时算
  return sprite + bubble;
}
```

100 列是分水岭。低于 100，小动物自己缩成一行 ASCII 写在 footer 那条状态栏边上，不再占任何列宽；超过 100，按"基础 14 列、说话时 +36 列"算给 PromptInput 让出去。值得注意的是它读取了 `cfg.companionMuted`——这个字段在 `utils/config.ts:269-271` 里和 `companion` 并列：

```typescript
companion?: import('../buddy/types.js').StoredCompanion;
companionMuted?: boolean;
```

`companionMuted: true` 是用户的"我知道有这个东西，但请你不要再占我屏幕"开关；它不删除 companion 本身（孵化记录、名字都还在），只是渲染期把 reserved columns 整条算零。任何相关 UI——包括 PromptInput 那边的 footer 项可见性判断、气泡显隐、彩虹高亮——都要先过这个静默开关。

第二个分歧在全屏视图。Claude Code 在某些屏（比如长输出回放、Doctor 屏）会切到一个把整个 viewport 接管的 `FullscreenLayout`，外层 box 设了 `overflowY: 'hidden'`。这种情况下小动物本体还是要画在原位，但气泡如果跟着画就会被裁掉一半。解决办法是把气泡单独拆成 `CompanionFloatingBubble` 组件，挂进 `FullscreenLayout.bottomFloat` 这个专门预留的"逃出 overflow 裁切"的插槽：

```typescript
export function CompanionFloatingBubble() {
  const reaction = useAppState(s => s.companionReaction);
  if (!reaction) return null;
  // 通过一个 portal-like 插槽渲染在 fullscreen 外层之上
  return <SpeechBubble text={reaction} tail="down" fading={…} />;
}
```

REPL 里两个组件是分别挂载的（`screens/REPL.tsx:276` 与同文件下方一带）：本体 `<CompanionSprite/>` 跟着 PromptInput 走，气泡 `<CompanionFloatingBubble/>` 跟着 FullscreenLayout 的浮动槽走。它们读同一份 `companionReaction` state，所以视觉上完全一致，只是渲染树位置不同。

REPL 还做了一件细节：滚动列表往上滚时立刻把 `companionReaction` 清空——气泡会马上消失。理由很直白：用户在看历史的时候，弹一个对当前最后一句话的反应是干扰。

---

## 五、第三人称介绍：不让模型代入这只小动物

把 Buddy 接进 prompt 这件事最容易翻车的环节是：你给系统提示加一段"You are a frog named Sproink"，模型立刻开始 `*ribbit*` 全文，把整段对话毁掉。`buddy/prompt.ts:7-13` 里这段刻意写成第三人称：

```typescript
export function companionIntroText(name: string, species: string): string {
  return `# Companion

A small ${species} named ${name} sits beside the user's input box and occasionally comments in a speech bubble. You're not ${name} — it's a separate watcher.

When the user addresses ${name} directly (by name), its bubble will answer. Your job in that moment is to stay out of the way: respond in ONE line or less, or just answer any part of the message meant for you. Don't explain that you're not ${name} — they know. Don't narrate what ${name} might say — the bubble handles that.`;
}
```

第一段反复按住"你不是它"这个键——`${name}` 坐在用户的输入框旁边、偶尔出气泡、你是观察者、它是另外一个观察者。第二段是这段 prompt 真正难写的部分：用户直接 by-name 点名 companion 时，模型不能装没看见、也不能抢答——要让出一行以内的响应空间，让气泡接话；不要解释"我不是 X"（用户知道），也不要替 X 编台词（气泡会处理）。这两段加起来同时圈住了两种最常见的漂移：扮演 companion、和无视 companion 抢话。

这段文本通过 `getCompanionIntroAttachment(messages)`（`buddy/prompt.ts:15-36`）包成一个 attachment 注入消息流。注意函数签名：**返回的是 `Attachment[]`，不是 `Attachment | null`**——四道前置闸（`!feature('BUDDY')`、`!getCompanion()`、`getGlobalConfig().companionMuted`、消息流里已有同名 `companion_intro`）任意一道命中时返回空数组 `[]`，全过则返回一个 `[{ type: 'companion_intro', name, species }]`。去重那一步不是按 attachment 类型粗筛，而是逐条扫消息流：遇到 `type === 'attachment'` 且 `attachment.type === 'companion_intro'` 且 `attachment.name === companion.name` 时才认作"已经介绍过"——这意味着如果用户换了一只 companion（name 不同），旧的 intro 不算数，新的 intro 还是会注入一次。

调度由 `utils/attachments.ts` 一并处理：`maybe('companion_intro', getCompanionIntroAttachment(messages))` 和其他多个"按情况附加"的 attachment 走同一条 schedule（`utils/attachments.ts:866-867` 一带）。最终渲成模型可见的字符串靠 `utils/messages.ts:4232-4235`：

```typescript
case 'companion_intro':
  return companionIntroText(attachment.name, attachment.species);
```

整条链路里没有任何特例化的 system prompt 拼接——它走的就是 Claude Code 自己的 attachment 体系，复用 `maybe()`、复用 messages 渲染、复用去重判定。Buddy 在这件事上没有自己的"框架"，它只是一个新增的 attachment 类型。

---

## 六、入口、彩虹、footer 与两道编译门

发现入口的设计在 `useBuddyNotification.tsx`（`buddy/useBuddyNotification.tsx:12-21` 节选）：

```typescript
export function isBuddyTeaserWindow(): boolean {
  if ('external' === 'ant') return true;
  const d = new Date();
  return d.getFullYear() === 2026 && d.getMonth() === 3 && d.getDate() <= 7;
}

export function isBuddyLive(): boolean {
  if ('external' === 'ant') return true;
  const d = new Date();
  return d.getFullYear() > 2026
    || (d.getFullYear() === 2026 && d.getMonth() >= 3);
}
```

两个判断都走**本地日期**——`getFullYear() / getMonth() / getDate()`，不是 `getUTC*`。这件事注释里也写明白了："Local date, not UTC — 24h rolling wave across timezones. Sustained Twitter buzz instead of a single UTC-midnight spike, gentler on soul-gen load." 用本地时区铺开 24 小时滚动波，能让东亚和美西错峰孵化，避开一个 UTC 午夜的集中尖峰。`isBuddyTeaserWindow` 决定"要不要弹那个发现公告"——2026 年 4 月 1 日到 7 日（`getDate() <= 7`）这一周对所有人开，或者对特定渠道（`'external' === 'ant'`）持续开。`isBuddyLive` 决定"`/buddy` 命令本身能不能用"——2026 年 4 月以后一直能用。两条线分开，使得"先 teaser 一周让大家发现、之后一直保留命令"这种节奏可以纯靠时间函数表达，不依赖任何外部 flag 服务。

teaser 通知用 Claude Code 的通用 notification 系统（`buddy/useBuddyNotification.tsx:43-66`）。组件里挂一个 `useEffect`，函数体顺序过三道 early-return 闸：`!feature('BUDDY')`、`config.companion` 已存在或 `!isBuddyTeaserWindow()`。注意源码这里**只查 `config.companion` 是否已经孵化、不查 `companionMuted`**——发现入口的弹出条件是"还没养过"，而不是"用户没把它静音"，毕竟没养过就没什么可静音的。三道闸全过则 `addNotification({ key: 'buddy-teaser', jsx: <RainbowText text="/buddy" />, priority: 'immediate', timeoutMs: 15000 })`——通知主体就是彩虹色四字 `/buddy`，是按字符逐个 `getRainbowColor(i)` 染色再拼成一段 `<Text>`，没有更长的文案。整段 effect 返回一个 cleanup 函数 `removeNotification('buddy-teaser')`，依赖项是 `[addNotification, removeNotification]`。

三道闸顺序很关键——`feature('BUDDY')` 在最前，构建时它返回常量 `false` 时整段 `useEffect` 在产物里被整体擦掉；窗口与已孵化状态过滤运行期人群。彩虹色用 `getRainbowColor` 把字符串逐字符按色环上色，是 Claude Code 内已经用在新版本公告里的同一组工具。

footer 集成在 `PromptInput.tsx` 的可见性表达式里（`components/PromptInput/PromptInput.tsx:310-316` 一带）：

```typescript
const _companion = getCompanion();
const footerItems: FooterItem[] = [
  /* 其他 footer 项 */
  ...(!!_companion && !cfg.companionMuted ? ['companion' as const] : []),
];
```

`'companion'` 这个 footer 变体在 `AppStateStore.ts:87` 一带被加进 `FooterItem` 联合类型。它的"焦点态 + Enter"行为映射到 `onSubmit('/buddy')`——把焦点停在 companion footer 项上按回车，等价于打 `/buddy` 命令；这件事不仅是发现入口，也是"鼠标用户/触控板用户在不打字的状态下也能摸到这只小动物"的入口。

`/buddy` 在输入框里被键入时，PromptInput 用一段 `findBuddyTriggerPositions` 把所有 `/buddy\b` 的位置找出来，叠一层彩虹色高亮（`buddy/useBuddyNotification.tsx:79-97`）：

```typescript
export function findBuddyTriggerPositions(text: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const re = /\/buddy\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push([m.index, m.index + m[0].length]);
  }
  return out;
}
```

这一层视觉提示纯靠 PromptInput 自己的彩色字符渲染管线接进去，是个一行函数式的"返回区间数组"，没有内部状态，便于单测。

最外层的总开关有两道，是编译期门（`commands.ts:118-120` 与同文件下方一带）：

```typescript
const buddy = feature('BUDDY') && require('./commands/buddy/index.js').default;
// …
const allCommands = [
  /* …其他命令… */
  ...(buddy ? [buddy] : []),
];
```

`feature('BUDDY')` 是 §第 19 篇里讲过的"compile-time feature flag"——构建时根据当前渠道把它折叠成 `true` 或 `false`，配合 `require(…)` 的 lazy resolve 和 tree-shaker，整张 buddy 命令子树在 `feature('BUDDY') === false` 的产物里彻底消失。再加上 `useBuddyNotification.tsx` 里 `'external' === 'ant'` 这种字面量比较，构建时整段表达式可以直接被替换成常量布尔，余下的代码被压成无效分支删掉。

两道门一道由 `feature('BUDDY')` 控制特性总开关，另一道由 `'external' === 'ant'` 字面量给特定渠道再开一道边门。这种"compile-time 双重 gating"在 §第 19 篇里见过 `migrateFennecToOpus()` 同样的写法——一句普通的 `if`，对编译器是常量条件，对源码读者是渠道意图的明示。

---

## 七、收束：为什么六个文件就能写出一只活的小动物

回过头看，`buddy/` 这六个文件做对的事就一句话：**把"宠物"这个本应横跨配置、渲染、prompt、命令、通知五个子系统的功能，拆成五块各自接进对应子系统现有的扩展点，自己不造任何"框架"**。

- 配置那侧只多了两个字段：`companion`（魂）和 `companionMuted`（开关），骨头一字不存
- 渲染那侧用 Ink 已有的 Box + 一个手写的 30 列 wrap，没有引入任何动画库；500 ms 一拍是手摇的 `setInterval`
- prompt 那侧借用 attachment 体系新增了一个 `companion_intro` 类型，复用 `maybe()` 调度、复用 messages 渲染
- 命令那侧借 `feature('BUDDY')` 和 `require(…)` 的懒解析能力把整子树编译期切除
- 通知那侧借用现成的 `addNotification` 走和版本公告同一个发现通道

这种"什么都不自创"的克制，是 Buddy 能在一年里被加进、被默认关、被全员擦干净三件事同时成立的根本——因为它没有任何只属于自己的、需要被维护的脚手架。下一次有人想往 PromptInput 边上再塞一个"装饰性、彩蛋性、渠道限定"的东西时，照着 `buddy/` 这六个文件的接法描一遍就够。
