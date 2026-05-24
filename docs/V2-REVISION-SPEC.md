---
title: V2 修订说明文档（Source Code Study, v2 Revision Spec）
source_commit: 290fdc9481a70612bc5823aa4ed225c52c52aad3
status: approved-by-yao
authoring: CC-Dev (Claude Opus 4.7), reviewed by OC-PM, cross-evaluated by CX-Dev, baseline drafts from OC-Dev / CC-Dev
---

# 《深入 Claude Code 源码》v2 修订说明

## 1. 引言：为什么写 v2

v1 由 **Claude Opus 4.6** 深扫 Claude Code 源码、**ChatGPT 5.4** 担任 reviewer 共同产出，最终交付 **25 篇**源码解析学习交流文章，构成本仓库 `docs/00-…25-` 的初版书稿。v1 与 v2 解析的是**同一套** Claude Code 源码（commit 同步冻结于 `source_commit`），并非源码本身发生了变化；推动 v2 修订的是**模型一侧的迭代**——解析模型从 Claude Opus 4.6 升级到 Claude Opus 4.7，reviewer 模型从 ChatGPT 5.4 升级到 ChatGPT 5.5。借助更强的新一代模型重新通读同一份源码，得以在更高粒度上识别出 v1 中未被充分展开的一级模块（Bridge IPC、Remote Session、Coordinator、Settings Migration、DirectConnect、Buddy、Output Style、Vim/Voice 等），并校正 v1 中若干与源码不一致的数字与结构性表述。

> v2 是用更强模型重新解析同一套源码以校正准确性，**不是用更新颖的写法重写既有文章**。任何"看起来更专业、更工程化"的结构性改写若偏离 v1 文风，均视为越界——本规则由 §0.5 文体一致性硬约束执行。

v2 由 **Claude Opus 4.7** 重新深扫源码、**ChatGPT 5.5** 担任 reviewer，**对原 25 篇逐篇做事实勘误与必要的迭代重写**，并**新增 8 篇全新文章**：

- **C04** 配置迁移即代码（Migrations）
- **C13** 通信、调度、问询与合成工具
- **C17** Coordinator、Cron 与定时调度
- **C24** Bridge IPC 与远程会话
- **C25** DirectConnect 与上游代理
- **C28** Keybindings、Vim 模式与 Voice 输入
- **C29** Buddy 人格
- **C30** Doctor 屏与 Output Style 体验

> 关于"8 篇 vs 7 章"的口径：v2 提案早期将 Buddy / Doctor / OutputStyle UX 合并为 1 章（C29）；OC-PM 在 review 中建议异质性高，应拆为 C29 Buddy + C30 Doctor+OutputStyle UX，故最终新增章节数为 **8 篇**，整书章节数从 33 增至 **34**。

v2 的另一项核心改动是**全书架构重组**：v1 按"模块树"平铺组织（工具一章、命令一章、Agent 一章……），读者需要自行拼合"一次会话从启动到产出的完整链路"。v2 改以**运行期生命周期**为主线（进入软件之前 → 一次回合的内核 → 工具家族 → Agent/任务/协调 → 协议安全与扩展 → 网络与远程 → 终端 UI 与多模态输入 → 记忆/扩展/总结），并保留模块树视角作为**附录 F 的反查矩阵**，兼顾阅读流畅性与源码导览性。

## 2. 文档目的

本文档是 v2 修订工作的**根 spec**，承担两个目的：

1. **驱动后续 issue 拆分**：v2 写作不在本文档内进行；本文档将作为后续每一个章节 issue 的输入，由 OC-PM 据此产出每章 spec 三件套（章节 spec / 章节正文 issue / fact-check checklist），逐章并行编纂。
2. **沉淀 v1→v2 的修订全貌**：读者据本文档可在不读 v2 全书的前提下，了解 v1 25 篇每篇的去向、判定（保留 / 勘误保留 / 迭代重写 / 拆分合并）、修订工作量级，以及 v2 新增章节的源码依据。

## 3. v2 架构总览

| 维度 | v1 | v2 |
|---|---|---|
| 篇（Part） | 平铺无篇 | **8 篇**（按运行期生命周期） |
| 章（Chapter） | 25 章（含目录） | **34 章** |
| 附录 | 无 | **6 份**（A 工具 / B 命令 / C hooks / D agents / E TaskType / F 模块×章节双向矩阵） |
| 写作公约 | 无 | **§0 五公约**（强制） |
| CI 校验 | 无 | **9 项脚本**（source_commit 一致性 / 程度副词禁词 / manifest diff & 孤儿目录 / diff 体积闸 / 标题保留闸 / 代码块占比闸 / 工程化小标题禁词 / 章节正文禁 frontmatter / 章节正文禁 squad 内部术语） |

### 8 篇骨架表

| 篇 | 标题 | 含章 | 章数 |
|---|---|---|---|
| 第一篇 | 进入软件之前 | C01–C04 | 4 |
| 第二篇 | 一次回合的内核 | C05–C09 | 5 |
| 第三篇 | 工具家族 | C10–C13 | 4 |
| 第四篇 | Agent、任务与协调 | C14–C17 | 4 |
| 第五篇 | 协议、安全与扩展接口 | C18–C22 | 5 |
| 第六篇 | 网络层与远程协作（v1 完全空白） | C23–C25 | 3 |
| 第七篇 | 终端 UI 与多模态输入 | C26–C30 | 5 |
| 第八篇 | 记忆、扩展与总结 | C31–C34 | 4 |
| **合计** | — | C01–C34 | **34** |

## 4. §0 写作公约（强制，正文每章顶部必须遵守）

§0 是 v2 反幻觉与文体一致性的硬性卡尺，每一篇正文章节的顶部必须包含「源码锚点」结构化前言，并遵循下列五条规则；任一违反会被 CI 阻塞合并。其中 **§0.5 文体一致性硬约束的优先级高于 §0.1–§0.4**：当准确性诉求与文体一致性冲突时，先保文体，把准确性差分降到"最小可行修正"。

### §0.1 源码锚点结构化前言（强制）

每篇文章正文起始处必须包含：

```
## 源码锚点
- 主入口：<相对路径>:<起止行>          # 例：query.ts:1-1729
- 关键类型：<TypeName>                  # 例：QueryRequest, TaskType
- 关键函数：<fnName>(file:line-line)    # 例：query(query.ts:412-680)
- 数字来源：<命令或脚本> @ <commit-sha> # 例：scripts/gen-tool-table.ts @ 7f3ac1
- 源码版本：<commit-sha>                # 全章一次性指定
```

#### §0.1.1 正文 frontmatter 白名单（强制 · YAO-99 回灌）

> 起因：C01 修订过程中，writer 把 `chapter_id / source_commit / 风格双亲 / 判定 / 骨架重排 / title` 等 squad 内部记账字段全部塞进了 `docs/01-项目全景.md` 的 YAML frontmatter，逼读者从一段 6 行金属牌开始阅读这本书。前后改了三轮才彻底删干净。

硬约束：`docs/` 下所有面向读者的章节 markdown（即 `docs/*.md`）**不允许**出现任何 YAML frontmatter——不允许 `title`、不允许 `chapter_id`、不允许 `source_commit`、不允许 `风格双亲 / 判定 / 骨架重排 / is_new_chapter / 新增章节 / estimated_words / 工作量级 / 全新增比例` 等任何字段。

所有 chapter 元数据只活在四个位置：

1. **PR 描述**：风格双亲声明、保留/改写/新增段落统计、manifest diff 摘要等；
2. **issue body**：章节 spec 三件套（spec / 正文 issue / fact-check checklist）；
3. **`docs/V2-REVISION-SPEC.md` 本身**（即本文件）：迁移矩阵、反向矩阵、新增章节清单等；
4. **`scripts/` 外部 manifest**：`docs/appendix/*.manifest.json` 与脚本输出。

读者翻开 `docs/01-项目全景.md` 这类文件看到的应该是「# 第 1 篇：项目全景 …」开篇，而不是一段 YAML 元数据。

例外白名单（只此一项，且必须在 CI 脚本中显式列出）：

- `docs/V2-REVISION-SPEC.md` —— 这是 spec 元文档，不是面向读者的书章节。

CI 强制：`scripts/check-no-frontmatter-in-chapters.ts` 扫 `docs/*.md`，若首行为 `---` 且 50 行内出现闭合 `---` → **fail**（阻塞 PR 合并）。

§0.5.4 中关于「新章 frontmatter 必须含 `新增章节: yes`」的旧条款由本条覆盖：`新增章节` 这个字段也不进章节文件；CI 识别「这是新增章节」用以触发 C-3 代码块占比闸，统一由 §9.3.1「新章落地文件名表」（与 `scripts/check-code-ratio.ts` 的 `NEW_CHAPTER_FILES` 集合逐字对应）按**文件路径**判定，**不**从章节文件 frontmatter 取值、**不**通过 NN 前缀推断。

### §0.2 数字与引用强制可复算

- 文中任何"X 行 / X 个 / X 种"必须能通过"数字来源"指定的脚本或命令复算；
- 不得直接抄录 v1 的旧数字，必须重新对齐当前 commit；
- 关键类型 / 函数 / 字段引用必须给"文件:行号"；只给目录的引用视为不合格。

### §0.3 source_commit 冻结与 CI 校验（强制）

- 每章 spec 启动时，writer 必须在章节头声明 `source_commit: <sha>`，**冻结**当章引用的源码版本；
- 章节内任何行号引用必须能在该 commit 上 `git blame` 复核；
- 附录脚本生成 manifest 时写入 `source_commit`；正文与 manifest 引用必须**指向同一 commit**；
- CI 强制：`scripts/check-source-commits.ts` 扫描章节头 + 附录 manifest，commit 不一致 → **fail**；
- 章节升级 commit 必须开 PR 集中处理（不允许逐字漂移），PR 描述含变更摘要。

### §0.4 程度副词禁词（事实段落，强制）

- "源码锚点"以下的描述性段落（事实段）**禁词**：
  ```
  约 / 大概 / 左右 / 大量 / 几乎 / 很多
  ```
  （YAO-99 调整：原词表中的「不少 / 主要 / 大部分 / 一些」四个纯定性语气词在叙事
  段几乎必现，已从禁词集合中移除；保留下来的六个词都与「X 行/个/种」这类数值断言
  对冲相关，仍按事实段口径管控。）
- 反例：「`query.ts` **大概** 1700 行」← 违反（数值对冲词）；
- 正例：「`query.ts` 1729 行（commit 7f3ac1），包含 `query()` 主循环（行 412–680）」← 合规；
- 例外：仅允许出现在"导言/总结/比喻段"，且不得携带数字或事实断言；
- 运行时可用类陈述必须列出依赖变量（feature flag / entrypoint / coordinator），不得给单一具体数字；
- CI 强制：`scripts/lint-no-fuzzy-quantifiers.ts` 在事实段落正则扫禁词 → **warning**（YAO-99 由 fail 降为 warning，命中只打印不阻塞 CI，由 reviewer 在 review 中复核命中是否构成事实段落里的数值对冲）。
- **扫描范围口径**（与 §0.5 最小修改原则共同生效）：CI 模式下脚本只扫 PR diff 中**本次新增 / 改动的行**（`base...HEAD` 的 added lines），不扫 v1 baseline 未触碰的行。理由：§0.4 约束的是 v2 新写的事实段落，v1 已发布章节中预先存在的禁词命中属于 §0.5.3 的"最小修改原则"保护范围——writer 不应被强制改写未触碰的 v1 段落，否则与 C-1（中文留存率 ≥50%）/ C-2（标题保留）互锁。本地复核可显式 `--files <path>` 强制全文件扫。仲裁来源：YAO-134。

### §0.5 文体一致性硬约束（强制，优先级高于 §0.1–§0.4）

> 起因：PR #15（C01 项目全景）翻车——把 v1 的"叙事型源码解析博客"重写成了"技术参考手册"。
> 根因：原 §0.1–§0.4 只约束了准确性，没有约束文体；准确性条款被 writer 当成了重写许可。
> §0.5 是对原 §0 公约的硬补丁，作为本规范的第五条公约。

#### §0.5.1 本书的定位（每章 spec 顶部必须复述这两句）

1. **这是一本面向读者的源码解析书的修订版，不是技术 refactor，也不是参考手册。** 叙事风格、文笔节奏、语气、口吻必须与 v1 已发布章节保持一致。
2. **v2 追求的是更准确，不是更新颖的写法。** 任何"看起来更专业、更严谨、更工程化"的结构性改写，只要偏离 v1 文风，都视为越界。

writer 在写作开始前，必须**先抽样阅读至少 2 篇 v1 已发布章节**作为风格基线（例如 `docs/01-项目全景.md` 与对应主题相近的另一篇），并在 PR 描述中显式声明所参考的 v1 章节（"风格双亲"字段）。

#### §0.5.1.1 风格双亲实证段（强制 · YAO-99 回灌）

> 起因：在当前工作流里，「风格双亲」从来只是 PR 描述里的一行字段名，没有任何机制强制 writer 真的读了 v1 那两章再下笔。C01 PR #22 的 1.1–1.5 行号堆砌、句式机械，被尧哥指出「不像给人阅读的」之后才意识到声明 = 没声明。

仅声明 v1 章节名不够。每个 PR 描述必须额外附一段「风格双亲实证段」，结构如下：

```
### 风格双亲实证

风格双亲：v1-XX <章节名> + v1-YY <章节名>

#### v1 原文摘抄（≥ 200 字 × 2 段）

【摘抄 1，来自 docs/XX-…md】
<原文 ≥ 200 字>

【摘抄 2，来自 docs/YY-…md】
<原文 ≥ 200 字>

#### 本章新写正文摘抄（≥ 200 字 × 2 段，覆盖典型叙事段）

【新写 1，来自 docs/NN-…md §X.Y】
<本 PR 中的新写段落 ≥ 200 字>

【新写 2，来自 docs/NN-…md §X.Y】
<本 PR 中的新写段落 ≥ 200 字>
```

四段对照的作用：

1. 把 v1 文风从「writer 心里的印象」具体化为 PR 评审现场的可比对象；
2. reviewer（OC-R / OC-PM）肉眼比对语气、句长、段落密度、第几人称、提问 vs 陈述比例；
3. 若新写两段与 v1 两段语气节奏明显错位（如 v1 是第二人称叙事，新写变成第三人称参考手册口吻），reviewer 直接 Request changes，不进入逐句 review。

R-1 verdict 升级：缺失实证段、或实证段不足 200 字 × 4、或新写段落未涵盖叙事性内容（只摘代码块密度高的过渡段算规避）→ **Request changes**，不进入 R-2 / R-3。

#### §0.5.2 v1 文体基线（writer 必须模仿的特征）

抽样 v1 已发布章节，可观察到以下稳定特征。这些不是建议，是硬基线：

1. **第二人称导入 + 提问式破题**：v1 开篇常用"当你面对……"、"为什么要……？"这类设问句把读者带入。**不是**用"§1 源码锚点"这种规范化小标题切入。
2. **解释性段落 ≫ 表格**：v1 主体是连续叙事段落，配少量代码片段（带文件:行号）与点睛表格。表格用来收束信息、不是替代叙述。**禁止把整章主干压成表格 + 列表**。
3. **"先讲清楚，再给行号"**：v1 引用源码时是"如下面这段（`file:line`）所示，它做的是……"，而不是"`file:line-行号` 定义了 X"。源码锚点服务于叙述，不是叙述本身。
4. **代码块短而精**：v1 单个 `ts` 代码块通常 3–15 行，配前后两段散文解释。**禁止贴 30+ 行原样代码当结构展示**。
5. **小标题口语化**：v1 用"为什么要从全景开始？"、"启动链路：从 `claude` 到 REPL"，**不**用"四种入口形态各自的契约"、"快速路径分发器：13 条旁路 + 1 条主路径"这种技术参考手册口吻。
6. **章节编号轻量**：v1 用 `一、二、三` 或 `## 1.1`，**不**用 `C01 · ...`、`### 2.1 第一层` 这种带前缀的工程化编号。v2 在书脊层面可以保留 C01–C34 的编号（用于 issue 索引），但**正文标题不出现 "C01 ·" 前缀**。

#### §0.5.3 迭代已有 v1 文章的硬规则（"勘误保留"与"迭代重写"档共同适用）

1. **最小修改原则**：以 v1 原文为底，diff 越小越好。理想 PR 的修改集中在：
   - 错误数字 / 错误行号 / 已不存在的 API → 替换为正确值；
   - 与源码不符的事实断言 → 改写为正确断言；
   - 明显幻觉（v1 提到但源码中不存在的概念）→ 删除或更正；
   - 新源码模块的**点名补充**（一两段话嵌入合适位置），不重排原有章节结构。
2. **禁止行为**（违反即 reject PR）：
   - **禁止整篇重写**。如果 diff 中超过 50% 的中文段落被替换，必须先回到 spec 阶段重新审；
   - **禁止改章节骨架**：v1 的一级 / 二级标题不许改名或重排，除非该标题指向的事实本身已不成立（如"三种入口"→"四种入口"这种由源码倒推的强制变化）；
   - **禁止把散文段改成表格**或 **把表格改成散文**，除非原内容明确错了；
   - **禁止把"为什么"型小标题改成"是什么"型**（例 §0.5.2 第 5 条）；
   - **禁止替换文风词**：v1 用"精妙"、"巧妙"、"噩梦"这类口语化形容词时，不要换成"显式"、"按设计"、"非直观"这类工程腔；反之亦然。
3. **"迭代重写"档的边界**：被判定为"迭代重写"的章节（迁移矩阵中的 9 章）仍然要尽可能保留 v1 段落与小标题。"重写"指允许新增 / 替换段落以反映源码的新事实，**不**指允许重组叙事骨架。如果某章的 v1 骨架与新源码事实严重冲突而必须重排，spec 必须显式标注 `骨架重排: yes` 字段并附理由——默认值是 `no`。

#### §0.5.4 新写文章（8 篇新增）的文体规则

C04 / C13 / C17 / C24 / C25 / C28 / C29 / C30 这 8 篇 v1 完全没有的章节，必须**主动模仿 v1 风格**而不是发挥新风格。具体要求：

1. **结构模板**：每篇以"为什么要单独讲 X？" / "当你打开 X 目录会看到……"这类提问 + 场景式开篇；中间穿插源码锚点；末尾用 1–2 段话点题。**不**以"§1 源码锚点"打头。
2. **每篇必须先选定 2 篇 v1 已发布章节作为"风格双亲"**，在 spec 与 PR 描述中显式声明。例如 C24（Bridge IPC）的风格双亲可选 v1-03（状态管理）+ v1-20（API 调用），这两篇的语气、句长、段落密度即 C24 的目标基线。
3. **字数与代码占比对齐 v1**：v1 已发布章节的散文：代码块字符比大致在 4:1 到 6:1 之间。新章必须落在这个区间。代码占比超 25% 触发 CI fail（C-3）。CI 识别「新章」的判据由 §9.3.1「新章落地文件名表」提供——脚本 `scripts/check-code-ratio.ts` 内维护一个与该表逐字对应的 `NEW_CHAPTER_FILES` 集合，按**文件路径**判定新章身份；**不**通过章节文件 frontmatter（§0.1.1 禁止 frontmatter）、**不**通过 NN 前缀。v2 实际文件采用 `NN-标题.md` 命名，文件名中不嵌入书脊编号 `C04 / C13`。
4. **新章不享有"参考手册豁免"**。即使 C13 要讲 10 个工具、C28 要讲三个输入子系统，也必须用叙事方式串起来——可以接受合并讲、分两小节讲、但不接受"每个工具一张表"的纯目录式呈现。

#### §0.5.5 PR #15 的具体翻车点（writer 必读，作为反例）

PR #15 修订了 `docs/01-项目全景.md`，作为本节的反面教材，列出 6 个典型问题。下一版 PR 必须全部回退或修正：

1. **标题被换皮**：`# 第 1 篇：项目全景 — 一个 AI CLI 产品的技术蓝图` 被改成 `# C01 · 项目全景与四种入口形态`。违反 §0.5.2 第 6 条——书脊编号不应进入正文标题。**修正**：保留 v1 标题，C01 只在 spec / issue / 目录索引中使用。
2. **开篇被换皮**：v1 的"当你面对一个约 1900 个源码文件……最大的挑战不是读懂某个函数，而是不知道从哪里开始读"这种叙事破题，被替换为 `## 源码锚点` 列表（主入口、关键类型、关键函数、数字来源）。违反 §0.5.2 第 1 条与 §0.5.3 第 2.4 条。**修正**：保留 v1 开篇 3 段；源码锚点只作为 writer 的私人 cheat sheet 存在于 PR 描述、issue body 或外部 manifest 里，**不进正文任何位置**（包括正文末尾——见下条 §0.5.5 第 7 条 YAO-99 实锤反例 ①）。
3. **散文章节被表格化**：v1 的"一、技术栈选型"一整节（约 800 字散文 + 1 张总结表）被删除替换为 `## 2. 四种入口形态各自的契约` 下的若干 markdown 表格。违反 §0.5.3 第 2.3 条。**修正**：保留 v1 技术栈选型的全部散文，"四种入口形态"作为**新增内容**插入到合适位置（建议作为新的"一、四种入口形态"，原"一、技术栈"顺延为"二"），并以散文为主、表格为辅。
4. **代码块膨胀**：PR #15 出现连续 25+ 行的快速路径分发表（13 行的 markdown 表格 + 散布的源码片段），把 v1 的"快速路径"叙述压缩掉。违反 §0.5.2 第 4 条与第 2 条。**修正**：分发逻辑用散文讲 3–4 段，配 1 张精简到 5–6 行的"代表性快速路径"表（不是 13 条全表），全量列表放附录或脚注。
5. **小标题工程化**：`### 2.1 CLI 入口：cli.tsx 是 Bootstrap，不是主程序`、`### 2.2 Agent SDK 入口：agentSdkTypes.ts 是公共类型门面`——这种"X 是 Y，不是 Z"的小标题不是 v1 风格。**修正**：改为"CLI 入口：cli.tsx 究竟做了什么？" / "Agent SDK 的公共表面"等口语化标题。
6. **新增事实被过度展开**：C01 新增的"12 个 v1 未入图的一级目录"是必须补的事实，但 PR #15 把它扩展为附带行号的整段技术说明，挤压了 v1 原有的"代码是怎么组织的"叙事。违反 §0.5.3 第 1 条最小修改原则。**修正**：在 v1 "代码是怎么组织的"小节里增补**一段散文**（200–400 字），说明"自 v1 写作以来对源码的再次深扫发现还有 12 个一级目录值得入图，它们对应 v2 新增的 8 个章节，分别是……"即可，不要展开。

##### YAO-99 回灌：C01 重做过程中新暴露的三处实锤反例

PR #15 之后的 C01 重做（PR #22）又外漏了三处工程化痕迹，作为 §0.5.5 的新增反例补充进来。下一版 PR 不许重蹈。

7. **附录源码引用清单整节外漏**：PR #22 在正文末尾加了一节「附：本章源码引用清单」，列出全章每个被引用 file:line。这是 reviewer / CI 的脚手架，不是给读者看的。**修正**：删除整节；锚点信息只活在 PR 描述、issue body、外部 manifest 里。CI lint `lint-no-spec-jargon-in-prose.ts` 中 `^#+\s*附[：:]?\s*本章源码引用清单` 命中 → fail。
8. **章节映射 / 反向矩阵清单外漏**：PR #22 §3.2.1 写了「上面目录树漏掉的顶层目录 —— 本书后续章节映射」，把 §6.2 反向矩阵中 C01 那一行的 14 个目录又在正文里清账了一遍。这种「向 CI 兑现覆盖度」的清单不是叙事书的写法。**修正**：删除整节；如果叙事上确实需要某个目录的提示，按 v1 那样**夹叙夹议地一句带过**，而不是列表清账。覆盖度由 spec §6.2 + 附录 F 模块矩阵承担，正文不复述。
9. **正文出现 squad 内部术语**：PR #22 正文出现了 `spec §6.2 / 反向矩阵 / 来自源码目录列 / required_anchors / manifest / CI 闸 / 章节映射 / 风格双亲 / 判定 / 骨架重排` 等词。这些都是 CC-Dev / OC-PM / OC-R / 麻薯 之间沟通用的术语，**不是读者语言**。**修正**：正文里全部用读者熟悉的中文替代或直接删除。CI lint `lint-no-spec-jargon-in-prose.ts` 全词表见脚本，命中即 fail（**不是** §0.4 那种 warning—— squad 术语外漏属于「这本书是给谁看的」级别的越界，没有灰度空间）。

> 一条硬约束（与 §0.1.1 配套）：以后所有章节的判定标准只有一个——「v1 已发布章节那种叙事博客的写法」。任何参考手册式的「附录 / 清单 / 反向矩阵 / 章节映射 / 锚点清算 / 目录覆盖度」 = 越界，reviewer 直接 Request changes。这些「对 CI / spec 交账」的脚手架放 PR 描述 / spec 内部 / 外部 manifest，**不进书**。

#### §0.5.6 验收条款（CI + 人工 review 双轨）

##### CI 强制（writer 不能绕过）

- **C-1 diff 体积闸**（仅对"勘误保留"与"迭代重写"档生效）：PR diff 中**中文段落的替换比例 > 50%** → fail。脚本 `scripts/check-prose-diff-ratio.ts`，统计方法：对每个 v1→v2 文件，比对原文中字符的留存率。
- **C-2 标题保留闸**：v1 章节的一级 / 二级 markdown 标题集合必须是 v2 版本标题集合的子集（允许新增小节，不允许删 / 改名）。例外字段 `骨架重排: yes` 显式声明可放行。脚本 `scripts/check-heading-preservation.ts`。
- **C-3 代码块占比闸**：单章源码 fenced block 字符数 / 全章字符数 > 25% → fail。脚本 `scripts/check-code-ratio.ts`。
- **C-4 工程化小标题禁词**：v2 章节小标题不得匹配以下正则之一：`^C\d{2}\s*·`、`^§\d+\s+`、`(\w+\.tsx?\s+是\s+\w+，?不是\s+\w+)`、`^\d+条旁路`、`^\d+\s+条\s+\S+\s*\+\s*\d+\s+条`。脚本 `scripts/lint-section-titles.ts`。
- **C-5 章节正文禁 frontmatter**（YAO-99 新增 · §0.1.1）：`docs/*.md` 章节文件首行为 `---` 且 50 行内出现闭合 `---` → fail。脚本 `scripts/check-no-frontmatter-in-chapters.ts`。例外白名单只此一项：`docs/V2-REVISION-SPEC.md`。
- **C-6 章节正文禁 squad 内部术语**（YAO-99 新增 · §0.5.5）：扫 PR diff 新增 / 改动行，命中 `spec §x.x / 反向矩阵 / 章节映射 / required_anchors / manifest / CI 闸 / 风格双亲 / 判定 / 骨架重排 / chapter_id / source_commit` 等 squad 内部术语 → fail。脚本 `scripts/lint-no-spec-jargon-in-prose.ts`。全词表与白名单见脚本头部注释。

##### 人工 review（OC-PM 审，CC-Dev 不可自审）

- **R-1 风格双亲实证段（YAO-99 升级）**：PR 描述含 §0.5.1.1 规定的「风格双亲实证段」——双亲声明 + v1 原文 ≥ 200 字 × 2 段 + 本章新写正文 ≥ 200 字 × 2 段。缺一不可：缺失任一段、不足 200 字、或新写段落规避叙事性内容（只摘代码密度高的过渡段）→ **Request changes**，不进入 R-2 / R-3。
- **R-2 反例对照**：对"迭代重写"档，PR 描述含"本次保留 v1 段落 N 段 / 改写 M 段 / 新增 K 段"统计，N 必须显著大于 M+K。
- **R-3 抽样阅读**：reviewer 随机抽 3 个被改动的段落，确认改写**仅源于事实修正**而非文风偏好。文风偏好导致的改写直接 request changes。

#### §0.5.7 对迁移矩阵判定标签的影响

§0.5.3 与 §0.5.4 生效后，迁移矩阵的四档判定语义被进一步收窄：

| 档位 | v2 文体强制 | diff 体积 | 骨架变更 |
|---|---|---|---|
| 保留 | 与 v1 100% 一致风格 | 仅修正错别字 / 死链 | 不允许 |
| 勘误保留 | 与 v1 100% 一致风格 | 仅修正错误数字 / API / 行号 | 不允许 |
| 迭代重写 | 与 v1 风格一致，允许新增段落 | 中文段落留存 ≥ 50% | 默认不允许，需显式 `骨架重排: yes` |
| 拆分合并 | 与 v1 风格一致，允许重组 | 不约束（按章节算） | 允许 |

`v2 是更准确，不是更新颖`这条原则在矩阵中等价于：**没有任何一档允许 writer 出于"写得更专业"的动机改写**。

## 5. 34 章详表

> 列含义：编号 / 标题 / 主入口锚点 / 定位 / v1 来源 / 工作量级（S ≤ 1d · M = 2–4d · L ≥ 1w）/ 是否新增。

### 第一篇 · 进入软件之前

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C01 | 项目全景与四种入口形态 | `entrypoints/{cli.tsx, sdk/, mcp.ts, sandboxTypes.ts, agentSdkTypes.ts, init.ts}` | 重画依赖图，囊括 v1 漏掉的 12 个新模块；解释「同一份源码 = CLI + SDK + MCP server + Sandbox runner」 | v1-01 | L | 否（迭代重写） |
| C02 | 启动链路与冷启动优化 | `cli.tsx`、`main.tsx`、`screens/REPL.tsx`、`bundledMode.ts` | 保留 v1-02 主体；补 `entrypoints/init.ts` SDK 初始化 + bundled vs dev 双模式 | v1-02 | S | 否（勘误保留） |
| C03 | 配置体系与企业 MDM | `services/{remoteManagedSettings, settingsSync, policyLimits}/`、`utils/cliArgs.ts` | 把 v1 "5+1 层" 扩为 7 维度（local / user / project / enterprise-MDM / remote-managed / policyLimits / migration），叙述合并顺序 | v1-17 §1–4 | L | 否（拆分合并） |
| **C04** | **配置迁移即代码** | `migrations/`（11 文件） | 全新章；Settings schema、模型重命名（fennec→opus, opus→opus1m, sonnet1m→45→46）、replBridge→remoteControl 全演化史 | — | M | **是** |

### 第二篇 · 一次回合的内核

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C05 | QueryEngine 与对话主循环 | `QueryEngine.ts:1-1295`、`query.ts:1-1729`、`query/{config,deps,stopHooks,tokenBudget}.ts` | 「门面 QueryEngine + 内核 query + 4 子模块」分层 | v1-05 | L | 否（迭代重写） |
| C06 | System Prompt 与 Output Style 注入 | `constants/{prompts.ts:1-914, systemPromptSections.ts}`、`outputStyles/loadOutputStylesDir.ts` | 保留 v1-04；补 systemPromptSections + output style 注入 | v1-04 | S | 否（勘误保留） |
| C07 | 上下文压缩家族 | `services/compact/`（11 文件，含 autoCompact / microCompact / apiMicrocompact / sessionMemoryCompact / timeBasedMCConfig / postCompactCleanup） | 6 条压缩链路并列展开 | v1-06 | M | 否（迭代重写） |
| C08 | Prompt Cache 横切 | `services/api/promptCacheBreakDetection.ts` 等注入点 | 保留 v1-07；勘误 cache_control 注入点行号 | v1-07 | S | 否（勘误保留） |
| C09 | Thinking、Effort 与 Advisor | `commands/effort/`、`commands/thinkback*/`、`commands/advisor.ts`、`services/PromptSuggestion/` | 保留 v1-08；整合 advisor + PromptSuggestion | v1-08 | S | 否（勘误保留） |

### 第三篇 · 工具家族

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C10 | 工具协议、注册与 ToolSearch | `Tool.ts:1-792`、`tools.ts`、`tools/shared/`、`tools/utils.ts`、`tools/ToolSearchTool/` | 按附录 A "family / runtime leaf / feature-gated" 三列模型组织（不再裸写 42/43） | v1-09 §1–3 | L | 否（拆分合并） |
| C11 | BashTool / PowerShellTool 双 shell | `tools/BashTool/`（18 文件 / 12,411 行）、`tools/PowerShellTool/` | 保留 v1-10 BashTool 主体；PowerShellTool 作 Windows 路径对照 | v1-10 | S | 否（保留） |
| C12 | 文件、代码与 LSP 协作族 | `tools/{FileRead, FileWrite, FileEdit, NotebookEdit, Glob, Grep, LSPTool, REPLTool}/`、`services/lsp/`（7 文件） | LSPTool ↔ LSPClient/LSPDiagnosticRegistry/LSPServerManager | v1-09 §4–5 | M | 否（拆分合并） |
| **C13** | **通信、调度、问询与合成工具** | `tools/{WebFetchTool, WebSearchTool, ScheduleCronTool, RemoteTriggerTool, SendMessageTool, SleepTool, AskUserQuestionTool, SyntheticOutputTool, BriefTool, ConfigTool}/` | 全新章；"对话外的调度与通信"工具集 | — | M | **是** |

### 第四篇 · Agent、任务与协调

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C14 | Agent 系统与 Sub-Agent 调用 | `tools/AgentTool/`、`services/AgentSummary/`、`commands/agents/` | 保留 v1-12；并入 AgentSummary | v1-12 | S | 否（勘误保留） |
| C15 | 内置 Agent 设计模式 | 内置 agent prompt 文件清单（详见附录 D） | 区分"源码定义 6 个" vs "运行时可用集合"（受 feature flag / SDK / coordinator 影响） | v1-13 | M | 否（迭代重写） |
| C16 | 任务模型与 TaskType 谱系 | `Task.ts:1-125`、`tasks.ts:1-39`、`tasks/{DreamTask, InProcessTeammateTask, LocalAgentTask, LocalMainSessionTask, LocalShellTask, RemoteAgentTask}.ts`、6 个 `tools/Task*Tool/` | **7 个 wire TaskType**（local_bash / local_agent / remote_agent / in_process_teammate / local_workflow / monitor_mcp / dream）= 4 默认注册 + 2 feature-gated（local_workflow, monitor_mcp）+ 1 in-process 特例（in_process_teammate） | v1-14 | L | 否（迭代重写） |
| **C17** | **Coordinator、Cron 与定时调度** | `coordinator/coordinatorMode.ts`、`tools/ScheduleCronTool/`（family → CronCreate/CronDelete/CronList 三 leaf）、`hooks/useScheduledTasks.ts` | 全新章；多 Agent 编排层 + 定时触发 | — | M | **是** |

### 第五篇 · 协议、安全与扩展接口

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C18 | MCP 协议实现 | `services/mcp/`（23 文件，含 SdkControlTransport / channelAllowlist / channelPermissions）、`tools/{MCPTool, McpAuthTool, ListMcpResourcesTool, ReadMcpResourceTool}/` | 保留 v1-15；补 SdkControlTransport 与 channel* | v1-15 | S | 否（勘误保留） |
| C19 | 权限系统与远程权限回灌 | `Tool.ts`(needsPermission)、`hooks/toolPermission/{PermissionContext, handlers/}`、`bridge/bridgePermissionCallbacks.ts`、`remote/remotePermissionBridge.ts` | 新增"远程会话权限回灌"小节 | v1-16 | M | 否（迭代重写） |
| C20 | Hooks 系统 | `schemas/hooks.ts`（HOOK_EVENTS 27 个）、`hooks/notifs/`（16 文件）、`hooks/toolPermission/handlers/`、`query/stopHooks.ts:1-473` | 保留 27 事件 / 4 hook command 类型（command/prompt/http/agent），补 stopHooks 与 notifs 路径 | v1-18 | M | 否（迭代重写） |
| C21 | Skill / Plugin / Output Style 三扩展点 | `skills/{bundled, bundledSkills, loadSkillsDir, mcpSkillBuilders}/`、`services/plugins/`、`plugins/{builtinPlugins, bundled/}`、`outputStyles/loadOutputStylesDir.ts` | 整合 v1-24；output style 作为第三条扩展路径 | v1-24 | M | 否（勘误保留） |
| C22 | Feature Flag 与编译期优化 | `utils/betas.ts`、`constants/betas.ts`、`bundledMode.ts` | 保留 v1-19 | v1-19 | S | 否（保留） |

### 第六篇 · 网络层与远程协作（v1 完全空白）

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C23 | 客户端传输与 API 重试 | `services/api/`（20 文件）、`cli/transports/{HybridTransport, SSETransport, WebSocketTransport, SerialBatchEventUploader, WorkerStateUploader, ccrClient}.ts` | 补客户端传输层（v1 完全没提）+ withRetry | v1-20 §1–3 | L | 否（拆分合并） |
| **C24** | **Bridge IPC 与远程会话** | `bridge/`（31 文件）、`remote/{RemoteSessionManager, SessionsWebSocket, sdkMessageAdapter, remotePermissionBridge}.ts`、`commands/{bridge/, remote-setup/, remote-env/}` | 全新章；手机/Web/Desktop 控制本地 CLI session 全链路。涉及法律/合规风险时降级为接口层视角并标注原因 | — | L | **是** |
| **C25** | **DirectConnect 与上游代理** | `server/{directConnectManager, createDirectConnectSession, types}.ts`、`upstreamproxy/{relay, upstreamproxy}.ts`、`hooks/useDirectConnect.ts` | 全新章；企业代理/内网拓扑。同上法律/合规风险标注适用 | v1-20 §4（片段） | M | **是** |

### 第七篇 · 终端 UI 与多模态输入

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C26 | Ink 框架深度定制 | `ink/`（96 文件 / 19,842 行）、`native-ts/{yoga-layout, color-diff, file-index}` | 新增原生 TS 加速一节 | v1-21 | M | 否（迭代重写） |
| C27 | 组件与设计系统 | `components/`（144 文件）、`components/design-system/`（10 文件） | 保留 v1-22 | v1-22 | S | 否（保留） |
| **C28** | **Keybindings、Vim 模式与 Voice 输入** | `keybindings/`（14 文件）、`vim/{motions, operators, textObjects, transitions, types}.ts`、`voice/voiceModeEnabled.ts`、`services/voice*`、`hooks/{useVoice, useVoiceEnabled, useVoiceIntegration, useVimInput}.ts`、`commands/{vim, voice, keybindings}/` | 全新章；"在终端里复刻一台编辑器"的输入层 | — | L | **是** |
| **C29** | **Buddy 人格** | `buddy/`（CompanionSprite / companion / prompt / sprites / useBuddyNotification） | 全新章；人格化伙伴模块 | — | M | **是** |
| **C30** | **Doctor 屏与 Output Style 体验** | `screens/{Doctor, REPL, ResumeConversation}.tsx`、`outputStyles/`、`commands/{output-style, doctor}/` | 全新章；诊断屏 + 输出风格用户体验呈现（与 C21 扩展机制视角互补） | — | M | **是** |

### 第八篇 · 记忆、扩展与总结

| # | 标题 | 主入口锚点 | 定位 | v1 来源 | 工作量 | 新增 |
|---|---|---|---|---|---|---|
| C31 | Memory 子系统全景 | `memdir/`（8 文件）、`services/{SessionMemory, extractMemories, teamMemorySync}/`、`assistant/sessionHistory.ts` | 按"会话级 / 项目级 / 团队级 / 长期"四维度重画 | v1-23 | M | 否（迭代重写） |
| C32 | 命令系统全景 | `commands.ts:1-754`、`commands/`（86 个一级目录 + 15 个一级文件 = 101 个一级条目，总 207 文件） | 不裸写 runtime command 数，按附录 B 脚本输出引用 | v1-11 | M | 否（迭代重写） |
| C33 | 状态管理与跨进程桥 | `state/`（6 文件）、`bridge/bridgePointer.ts` | 保留 v1-03；补 bridgePointer 跨进程暴露 | v1-03 | S | 否（勘误保留） |
| C34 | 架构模式总结 v2 | （横切） | 保留 v1-25；新增 4 个 v2 模式：Bridge IPC / Coordinator-Agent / Migration-as-Code / Output-Style-as-Plugin | v1-25 | S | 否（勘误保留） |

**判定分布**：保留 3 / 勘误保留 11 / 迭代重写 9 / 拆分合并 3 / 全新增 8 = 34 章。
**工作量分布**：L 7 章 / M 14 章 / S 13 章。

## 6. v1 ↔ v2 双向迁移矩阵

### 6.1 正向矩阵（v1 25 篇 → v2 去向）

| v1 # | v1 标题 | 判定 | 工作量 | v2 去向 | 关键差异 |
|---|---|---|---|---|---|
| 00 | 目录与阅读指引 | 迭代重写 | S | 新前言（不进章节） | 加入 §0 公约 |
| 01 | 项目全景 | 迭代重写 | L | C01 | 12 个新模块入图 |
| 02 | 启动优化 | 勘误保留 | S | C02 | + entrypoints/init + bundledMode |
| 03 | 状态管理 | 勘误保留 | S | C33 | + bridgePointer |
| 04 | System Prompt 工程 | 勘误保留 | S | C06 | + systemPromptSections |
| 05 | 对话循环 | 迭代重写 | L | C05 | 门面 + 内核 + 4 子模块 |
| 06 | 上下文管理 | 迭代重写 | M | C07 | 6 条压缩链路 |
| 07 | Prompt Cache | 勘误保留 | S | C08 | 注入点行号 |
| 08 | Thinking 与推理控制 | 勘误保留 | S | C09 | + advisor + PromptSuggestion |
| 09 | 工具系统设计 | 拆分合并 | L | C10 主 + C11/C12/C13 | 工具数三列模型 |
| 10 | BashTool 深度剖析 | 保留 | S | C11 | 数字勘误 |
| 11 | 命令系统 | 迭代重写 | M | C32 | 86+15=101 一级条目 |
| 12 | Agent 系统 | 勘误保留 | S | C14 | + AgentSummary |
| 13 | 内置 Agent 设计模式 | 迭代重写 | M | C15 | 源码定义 vs 运行时 |
| 14 | 任务系统 | 迭代重写 | L | C16 | 7 wire / 4+2+1 |
| 15 | MCP 协议实现 | 勘误保留 | S | C18 | 23 文件 + SdkControlTransport |
| 16 | 权限系统 | 迭代重写 | M | C19 | + 远程权限回灌 |
| 17 | Settings 系统 | 拆分合并 | L | C03 + C04 | 7 维度 + Migrations 独立 |
| 18 | Hooks 系统 | 迭代重写 | M | C20 | 27 事件 + stopHooks + notifs |
| 19 | Feature Flag | 保留 | S | C22 | — |
| 20 | API 调用与错误恢复 | 拆分合并 | L | C23 + C25 | + 客户端传输层 |
| 21 | Ink 框架深度定制 | 迭代重写 | M | C26 | 96 文件 + native-ts |
| 22 | 设计系统 | 保留 | S | C27 | — |
| 23 | Memory 系统 | 迭代重写 | M | C31 | memdir + 三服务 |
| 24 | Skill/Plugin 开发实战 | 勘误保留 | M | C21 | + Output Style |
| 25 | 架构模式总结 | 勘误保留 | S | C34 | + 4 个 v2 新模式 |

### 6.2 反向矩阵（v2 34 章 → v1 来源 + 源码一级目录 + 全新增比例）

| v2 # | 标题 | 来自 v1 | 来自源码（一级目录） | 全新增比例 |
|---|---|---|---|---|
| C01 | 项目全景与四种入口形态 | v1-01 全章 | entrypoints/, bridge/, remote/, coordinator/, buddy/, upstreamproxy/, server/, migrations/, native-ts/, screens/, outputStyles/, memdir/, assistant/, schemas/ | 40% |
| C02 | 启动链路与冷启动优化 | v1-02 全章 | entrypoints/init.ts, bundledMode.ts | 10% |
| C03 | 配置体系与企业 MDM | v1-17 §1–4 | services/{remoteManagedSettings, settingsSync, policyLimits}/ | 30% |
| C04 | 配置迁移即代码 | — | migrations/（11 文件） | 100% |
| C05 | QueryEngine 与对话主循环 | v1-05 全章 | QueryEngine.ts, query.ts, query/{config,deps,stopHooks,tokenBudget}.ts | 30% |
| C06 | System Prompt 与 Output Style 注入 | v1-04 全章 | constants/{prompts,systemPromptSections}.ts, outputStyles/ | 15% |
| C07 | 上下文压缩家族 | v1-06 §3–5 | services/compact/ | 50% |
| C08 | Prompt Cache 横切 | v1-07 全章 | services/api/promptCacheBreakDetection.ts | 10% |
| C09 | Thinking、Effort 与 Advisor | v1-08 全章 | commands/effort/, commands/thinkback*/, services/PromptSuggestion/ | 15% |
| C10 | 工具协议、注册与 ToolSearch | v1-09 §1–3 | Tool.ts, tools.ts, tools/shared/, tools/ToolSearchTool/ | 30% |
| C11 | BashTool / PowerShellTool 双 shell | v1-10 全章 | tools/{BashTool, PowerShellTool}/ | 15% |
| C12 | 文件、代码与 LSP 协作族 | v1-09 §4–5 | tools/{FileRead,FileWrite,FileEdit,NotebookEdit,Glob,Grep,LSPTool,REPLTool}/, services/lsp/ | 50% |
| C13 | 通信、调度、问询与合成工具 | — | tools/{WebFetchTool,WebSearchTool,ScheduleCronTool,RemoteTriggerTool,SendMessageTool,SleepTool,AskUserQuestionTool,SyntheticOutputTool,BriefTool,ConfigTool}/ | 100% |
| C14 | Agent 系统与 Sub-Agent 调用 | v1-12 全章 | tools/AgentTool/, services/AgentSummary/, commands/agents/ | 15% |
| C15 | 内置 Agent 设计模式 | v1-13 全章 | （详见附录 D） | 30% |
| C16 | 任务模型与 TaskType 谱系 | v1-14 全章 | Task.ts, tasks.ts, tasks/, tools/Task*Tool/ | 50% |
| C17 | Coordinator、Cron 与定时调度 | — | coordinator/, tools/ScheduleCronTool/, hooks/useScheduledTasks.ts | 100% |
| C18 | MCP 协议实现 | v1-15 全章 | services/mcp/, tools/{MCPTool,McpAuthTool,ListMcpResourcesTool,ReadMcpResourceTool}/ | 15% |
| C19 | 权限系统与远程权限回灌 | v1-16 全章 | Tool.ts(needsPermission), hooks/toolPermission/, bridge/bridgePermissionCallbacks.ts, remote/remotePermissionBridge.ts | 30% |
| C20 | Hooks 系统 | v1-18 全章 | schemas/hooks.ts, hooks/notifs/, hooks/toolPermission/, query/stopHooks.ts | 30% |
| C21 | Skill / Plugin / Output Style 三扩展点 | v1-24 全章 | skills/, services/plugins/, plugins/, outputStyles/ | 25% |
| C22 | Feature Flag 与编译期优化 | v1-19 全章 | utils/betas.ts, constants/betas.ts, bundledMode.ts | 5% |
| C23 | 客户端传输与 API 重试 | v1-20 §1–3 | services/api/, cli/transports/ | 50% |
| C24 | Bridge IPC 与远程会话 | — | bridge/, remote/, commands/{bridge,remote-*}/ | 100% |
| C25 | DirectConnect 与上游代理 | v1-20 §4（片段） | server/, upstreamproxy/, hooks/useDirectConnect.ts | 90% |
| C26 | Ink 框架深度定制 | v1-21 全章 | ink/, native-ts/{yoga-layout,color-diff,file-index} | 25% |
| C27 | 组件与设计系统 | v1-22 全章 | components/, components/design-system/ | 5% |
| C28 | Keybindings、Vim、Voice 输入 | — | keybindings/, vim/, voice/, services/voice*, hooks/useVim*, hooks/useVoice* | 100% |
| C29 | Buddy 人格 | — | buddy/ | 100% |
| C30 | Doctor 屏与 Output Style UX | — | screens/{Doctor,REPL,ResumeConversation}.tsx, outputStyles/, commands/{output-style,doctor}/ | 100% |
| C31 | Memory 子系统全景 | v1-23 全章 | memdir/, services/{SessionMemory,extractMemories,teamMemorySync}/, assistant/sessionHistory.ts | 40% |
| C32 | 命令系统全景 | v1-11 全章 | commands.ts, commands/ | 30% |
| C33 | 状态管理与跨进程桥 | v1-03 全章 | state/, bridge/bridgePointer.ts | 10% |
| C34 | 架构模式总结 v2 | v1-25 全章 | （横切） | 20% |

## 7. 6 个附录脚本与 CI 校验契约

### 7.1 附录清单

| 附录 | 内容 | 生成脚本 |
|---|---|---|
| 附录 A | 工具速查表（family / runtime leaf / feature-gated 三列） | `scripts/gen-tool-table.ts` |
| 附录 B | Commands 速查表（一级目录 / 一级文件 / runtime 命令） | `scripts/gen-commands-table.ts` |
| 附录 C | Hooks 事件表（HOOK_EVENTS 27 + hook command 4 类） | `scripts/gen-hooks-table.ts` |
| 附录 D | 内置 Agent 速查表（源码定义 vs 运行时可用） | `scripts/gen-agents-table.ts` |
| 附录 E | TaskType 谱系（7 wire / 4 默认 / 2 feature-gated / 1 特例） | `scripts/gen-tasktypes-table.ts` |
| 附录 F | 模块 × 章节双向矩阵 + 孤儿目录 | `scripts/gen-module-matrix.ts` |

### 7.2 脚本归属路径（仓库布局）

尧哥已拍板：v2 修订**直接在 `docs/` 原地修订**，不开 `docs-v2/` 新目录。脚本与附录归属如下：

```
<repo-root>/
├── docs/
│   ├── 00-…25-*.md                 # v1 原稿（v1 备份分支已保留，可在主线持续覆盖修订）
│   ├── V2-REVISION-SPEC.md         # 本文档
│   └── appendix/
│       ├── A.md / A.manifest.json
│       ├── B.md / B.manifest.json
│       ├── C.md / C.manifest.json
│       ├── D.md / D.manifest.json
│       ├── E.md / E.manifest.json
│       └── F.md / F.manifest.json
└── scripts/
    ├── gen-tool-table.ts            # 附录 A
    ├── gen-commands-table.ts        # 附录 B
    ├── gen-hooks-table.ts           # 附录 C
    ├── gen-agents-table.ts          # 附录 D
    ├── gen-tasktypes-table.ts       # 附录 E
    ├── gen-module-matrix.ts         # 附录 F（双向 + 孤儿）
    ├── check-source-commits.ts      # §0.3 CI
    ├── lint-no-fuzzy-quantifiers.ts # §0.4 CI
    ├── check-prose-diff-ratio.ts    # §0.5.6 C-1
    ├── check-heading-preservation.ts # §0.5.6 C-2
    ├── check-code-ratio.ts          # §0.5.6 C-3
    ├── lint-section-titles.ts       # §0.5.6 C-4
    ├── check-no-frontmatter-in-chapters.ts  # §0.5.6 C-5（YAO-99 新增，§0.1.1）
    └── lint-no-spec-jargon-in-prose.ts      # §0.5.6 C-6（YAO-99 新增，§0.5.5）
```

每个生成脚本输出双产物：`docs/appendix/{A..F}.md`（正文引用）+ `docs/appendix/{A..F}.manifest.json`（CI 校验依据）。

### 7.3 manifest JSON 字段约定

```ts
{
  "generated_at": "<ISO-8601>",
  "source_commit": "<sha>",
  "items": [
    {
      "name": "<canonical-id>",
      "category": "<family|leaf|feature-gated|...>",
      "source_files": ["path:line-line", ...],
      "feature_flags": ["..."],     // 可选
      "wire_type": "...",            // 仅 TaskType / Hooks
      "default_registered": true,    // 仅 TaskType
      "notes": "..."
    }
  ]
}
```

### 7.4 CI 失败语义

- **fail（阻塞 PR 合并）**：source_commit 不一致 / 程度副词命中 / manifest 与源码 diff 非空 / 孤儿目录列表非空。
- **PR 描述强制**：含 `manifest diff 摘要`（脚本提供 `--diff-summary` flag）。
- **warn 仅限**：章节字数超出预估区间（不阻塞，二次审拆分参考）。

### 7.5 附录 D（内置 Agent）枚举逻辑

附录 D 不试图穷举"运行时可用集合"（feature flag × entrypoint × coordinator 组合爆炸），采用两段式：

1. **正表（CI 校验）**：列出**源码定义**的所有 Agent prompt 文件 + 关键字段（`id`, `displayName`, `modelHint`, `defaultEnabled`）。脚本扫描 `agents/`、`services/AgentSummary/` 等的 prompt 定义文件即可枚举。
2. **副表（notes 列）**：每个 Agent 标注其受**哪些**变量影响：
   - `feature_flags: [...]`（来自 `utils/betas.ts` / `constants/betas.ts`）
   - `entrypoint_gated: [cli|sdk|mcp|sandbox|*]`
   - `coordinator_required: bool`

   读者据 notes 自行推断运行时集合。

### 7.6 附录 F 孤儿目录反向校验

`gen-module-matrix.ts` 增加 `--check-orphans`：扫源码所有一级目录与"v2 章节覆盖目录集合"做差集；非空 → **fail**。例外白名单 `scripts/orphan-allowlist.txt`，每条带注释。

## 8. 仓库布局与释出节奏

### 8.1 仓库布局（尧哥已拍板）

- v1 修订**直接在 `docs/` 原地进行**（不开 `docs-v2/`）；
- 既有 v1 文章按 §6.1 的迁移矩阵逐篇覆盖修订，编号会变（v1 的 `03-状态管理.md` 对应 v2 的 C33 等）；
- v1 25 篇原稿在 `docs-v1-archive` 分支保留为只读备份（已就位）；
- 主线 `main` 始终对应当前最新 v2 状态。

### 8.2 释出节奏：螺旋（骨架先行）

放弃"8 篇线性写"的思路，避免"前面不能改"的死锁。骨架 5 章先写：

- **C01** 项目全景与四种入口形态
- **C05** QueryEngine 与对话主循环
- **C16** 任务模型与 TaskType 谱系
- **C18** MCP 协议实现
- **C32** 命令系统全景

骨架 5 章合并后，其余 29 章可并行展开，由 OC-PM 按工作量级（L/M/S）和领域归并到不同 writer。

### 8.3 CI 强制（尧哥已拍板）

- 每个 PR 必须跑 `pnpm gen:appendix && pnpm check:docs`；
- 通过 `check-source-commits.ts` + `lint-no-fuzzy-quantifiers.ts` + `gen-module-matrix.ts --check-orphans` 三项校验；
- PR 描述含 manifest diff 摘要。

## 9. 拆 issue 指南（如何把本文档转为每章 spec 三件套）

### 9.1 章节 issue 结构（每章一个 issue）

OC-PM 据本文档为每个 v2 章节产出 1 个 parent issue，包含三件套：

1. **章节 spec**（issue body 顶部）
   - 章节编号 / 标题 / 主入口锚点（来自 §5）
   - 来自 v1 的段落区间（来自 §6.1/6.2）
   - 全新增比例 + 工作量级
   - **estimated_words**：`{ min, max }`（L=[6000,10000] / M=[4000,7000] / S=[2000,4000]）
   - **冻结的 source_commit**（章节启动时由 writer 设置）
   - 章节大纲（sub-section 列表）+ 必引源码锚点
   - 验收点（acceptance criteria）：覆盖目录 / 关键类型函数引用 / 必须命中的事实点

2. **章节正文 issue**（child issue）
   - assignee = writer agent
   - 正文 PR 必须通过 §7.4 全部 CI 校验
   - PR body 必含 manifest diff 摘要

3. **fact-check checklist**（child issue 或 PR description 一节）
   - 文中所有数字逐条回链到附录 manifest
   - reviewer（CX-Dev / OC-PM）逐项打勾后方可合并

### 9.2 拆分次序（与释出节奏对齐）

- **第一波**（骨架 5 章 · 串行）：C01 → C05 → C16 → C18 → C32；
- **第二波**（细节 29 章 · 并行）：按"篇"分批，每篇内部按工作量级倒序（L 章先开）；
- **附录脚本基础设施**（独立 issue · 阻塞所有章节）：`scripts/` 下 8 个脚本 + CI workflow 必须先于第二波启动前合并，否则 fact-check 无法执行。

### 9.3 issue 模板字段（建议）

> **新章识别口径（YAO-99 / YAO-135 修订）**：8 篇新增章节（C04 / C13 / C17 / C24 / C25 / C28 / C29 / C30）的「新章」身份**不再**由章节文件的 frontmatter 字段（旧条款的 `新增章节: yes`）声明——按 §0.1.1，章节文件本身禁止任何 frontmatter。CI C-3（代码块占比闸）识别新章的判据改为：以下文 §9.3.1「新章落地文件名表」为唯一来源，`scripts/check-code-ratio.ts` 内维护一个与该表逐字对应的 `NEW_CHAPTER_FILES` 集合，按**文件路径**判定。v2 实际文件采用 `NN-标题.md` 命名，文件名内也不嵌入书脊编号；新章 NN 从 26 起追加，避开 v1 已占用的 00–25 槽位。

### 9.3.1 新章落地文件名表（强制 · YAO-135 仲裁）

> 起因：8 篇新增章节都没有 v1 base 可复用 NN 槽位（C32 / C16 这类「新书脊编号 + 复用 v1 NN」的便利对新章不成立）。如果允许 writer 自挑 NN，会出现两类失败模式：（a）writer 把新章落在 v1 已占用的 NN 槽位（如 C04 落在 `docs/04-System-Prompt-工程.md`），逼出一个无关的 v1 文件 rename，污染该 PR 的 C-1（中文留存率）/ C-2（标题保留）闸；（b）writer 挑了一个不在 CI 新章集合中的 NN，C-3 25% 占比闸 skip 放行。
>
> 规则：所有 8 篇新章按 C 编号顺序追加到 v1 末尾（v1 占 00–25），自 NN=26 起。具体落地由 OC-Dev 在 spec 中显式登记，writer **不得**自挑文件名。每新增一行，必须同步追加到 `scripts/check-code-ratio.ts` 的 `NEW_CHAPTER_FILES` 集合；spec 表格与脚本集合的一一对应由 OC-Dev 在仲裁仲裁/合 PR 时人工守住。

| Cxx | 章节标题 | 落地文件 | 备注 |
|---|---|---|---|
| C04 | 配置迁移即代码 | `docs/26-配置迁移即代码.md` | YAO-135 仲裁，YAO-106 落地 |
| C13 | 通信、调度、问询与合成工具 | `docs/27-通信调度问询与合成工具.md` | YAO-135 仲裁，YAO-114 落地 |
| C17 | Coordinator、Cron 与定时调度 | _（待 issue 启动时由 OC-Dev 追加）_ | |
| C24 | Bridge IPC 与远程会话 | _（待 issue 启动时由 OC-Dev 追加）_ | |
| C25 | DirectConnect 与上游代理 | _（待 issue 启动时由 OC-Dev 追加）_ | |
| C28 | Keybindings、Vim 与 Voice 输入 | _（待 issue 启动时由 OC-Dev 追加）_ | |
| C29 | Buddy 人格 | _（待 issue 启动时由 OC-Dev 追加）_ | |
| C30 | Doctor 屏与 Output Style 体验 | _（待 issue 启动时由 OC-Dev 追加）_ | |

注：v1 的 `docs/04-System-Prompt-工程.md` **不**因 C04 让位而 rename——它继续以 v1 文件身份留在 NN=04 槽位，待 C06（System Prompt 与 Output Style 注入）正式起笔时再走「迭代重写 / 拆分合并」流程改名为 `docs/06-System-Prompt-与-Output-Style-注入.md`，那是 C06 PR 自己的 scope。新章追加 NN 槽位的方案把「v1 文件 rename」与「新章下笔」这两件事解耦——C04 不需要触碰任何 v1 文件。

```yaml
title: "v2 · C<NN> <章节标题>"
labels: [v2, chapter, <part-name>, workload-<S|M|L>]
parent: <V2 spec issue id>
body:
  spec:
    chapter_id: C<NN>
    main_anchor: <file:line-line>
    v1_source: <v1-NN §X>
    new_ratio: <0-100>%
    workload: <S|M|L>
    estimated_words: { min, max }
    source_commit: <sha>            # writer 在领取 issue 时填入冻结（issue spec / PR 描述用，**不**写入章节文件 frontmatter，见 §0.1.1）
    is_new_chapter: <true|false>    # 8 篇新章=true；仅 issue spec / PR 描述 / 外部 manifest 使用，**不**写入章节文件 frontmatter（§0.1.1）
  outline: [<sub-section 1>, ...]
  required_anchors: [...]
  acceptance:
    - 覆盖目录：[...]
    - 关键类型/函数：[...]
    - 必须命中的事实点：[...]
  fact_check_links: [<appendix manifest path>]
```

### 9.4 法律 / 合规边界处理（C24 / C25 专用）

- **C24（Bridge IPC）/ C25（DirectConnect）**：默认按"尽量写"，含模块结构、公开 API、源码锚点；
- **降级触发条件**：若涉及（a）未公开的 wire 协议帧 / 二进制布局，（b）企业安全合规细节（IP allowlist、密钥管理、审计日志格式等），（c）任何会泄露上游服务端契约的内容——**章节顶部强制标注**：「本章因 <a/b/c> 降级为接口层视角，省略 <具体省略点>」；
- 法律风险判定不由作者自决；写作时若不确定，必须开 follow-up issue 让人类拍板，写作期不放出。

## 10. 文档归属与下一步

- 本文档由 CC-Dev 在合并 OC-Dev / CC-Dev 双方架构提案、吸收 CX-Dev 横评、通过 OC-PM 必修项 review、获得尧哥三项 Open Q 拍板后产出，作为 v2 修订的根 spec；
- 后续 v2 写作的所有章节 issue 与附录 issue 均以本文档为唯一输入；
- 本文档的任何更新（例如新增章节 / 调整迁移矩阵 / 修订 §0 公约）必须通过 PR 修改本文件，并相应回写所有相关章节 issue。

— end —
