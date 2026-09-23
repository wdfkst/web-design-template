# 任务进度可见性 — 设计文档

日期：2026-09-23
状态：定稿（用户已逐段确认：粒度、计时器、两页范围三段均过）

## 目标

修掉**用户最初报的那个问题**：提交生成任务后，从头到尾看不到它在动。

三个已确认的范围决策：

1. **粒度**：阶段内加三个可见量（draft 第 N 次尝试、已出 N/M 张图、vite 构建阶段名）+ 已耗时计时器。不加假进度，不加新端点。
2. **计时器纳入**：`startedAt` 暴露进 `TaskView`，前端每秒自走。
3. **两页都修**：提交后用户**停在列表页**（`TaskList.vue:38-45` 的 `onSubmit` 只清空输入框、不跳转），所以列表页才是盯着看的那一屏；详情页与列表页共用同一组渲染函数。

**明确不做**：SSE / 长轮询推送（方案 B）、记录上挂阶段日志（方案 C）、给 vite build 内部加子进度、每张图的缩略图落盘可见、草稿重试原因可见。

## 背景：字段写得**太晚**，不是缺少推送手段

前端**是清白的**，且已被实测证明：用 Playwright 的 `page.route()` 拦截 `/tasks` 与 `/tasks/:id` 喂递增状态，列表页与详情页都逐帧更新、终态自停、无残留定时器。`useTaskPolling.ts` 的 1.5s 轮询、`ACTIVE_STATUSES` 判非终态才续、404 单独成 `notFound` 并停表，三条都对。

真正的根因在服务端：**`TaskRecord` 里没有任何阶段内字段**。

| 位置 | 现状 |
|---|---|
| `server/src/runner.ts:57` | `specAttempts` 与 `status:'building'` 一起写 —— drafting **结束后**才出现 |
| `server/src/runner.ts:76` | `providerCalls` 到 `status:'ready'` 才写 |
| `server/src/runner.ts:50` | `startedAt` 写了，但**全仓零个读取点** —— 纯死字段 |
| `packages/imagegen/src/generate.ts:88-126` | 逐 asset 的循环，只在 `:126` 用返回值交出 `providerCalls`，无回调 |
| `server/src/spec-source.ts:48` | 逐 attempt 的循环，无回调 |

实测：一个任务 drafting 130s 期间每 5s 采一次 `GET /tasks/:id`，**响应体逐字节相同**。

**半个成因在投影层**：`toView`（`server/src/app.ts:75`）是**白名单**。字段写了不加进白名单，前端照样看不见 —— 这条不记住，本次改动会「修了等于没修」。

## 已定决策

1. **不新增 draft 阶段的字段**，改用已有的 `specAttempts` **渐进写**。它的语义天然就是「到目前为止尝试过几次」：drafting 期间 = 正在第几次，成功后 = 第几次成功，同一个量。
2. **不新增 `buildPhase` 字段**。「vite 构建中」由 `assetsDone === assetsTotal` **派生**。
3. **图片计数只有一个数值来源**（`generateAssets`），runner **不自己**算 `assetsTotal`（它手里虽有 `spec`）—— 避免两处算法各自漂移。
4. **三个回调全部可选**，既有调用点零改动。
5. **失败时新字段一律保留**，不做清理 —— 「挂在第 5 张图」在失败后仍要看得见。
6. 耗时格式改为 `4m57s` / `43.2s` 分段（现有 `toFixed(1)+'s'` 会在 building 阶段显示 `297.3s`）。

## 第 1 节：数据形状

`TaskRecord`（`server/src/store.ts:6`）加两个字段，沿用该文件既有的扁平可选风格：

| 字段 | 含义 | 数值来源 | 记录写入者 |
|---|---|---|---|
| `assetsDone?: number` | 已落盘的 manifest 条目数 | `generateAssets` 的 `onProgress` | `runner` 在 `buildTask` 的回调里 |
| `assetsTotal?: number` | 本次任务的条目总数（= `spec.assets.length`） | 同上 | 同上 |

`TaskView`（`server/src/app.ts:61`）加**三个**键并同步进 `toView`：

- `assetsDone`、`assetsTotal` —— 同上
- `startedAt` —— 已在 `TaskRecord`（`store.ts:13`）里，只是从未被读

### `assetsDone` 与 `providerCalls` 不同义

**两个数别混**：

- `providerCalls` = **真实模型调用次数**，受缓存命中与内容去重影响（`generate.ts:91` 的 `produced` map 按 contentHash 去重、`:95` 的缓存命中不计调用）
- `assetsDone` = **manifest 条目数**，即「已出 N 张图」的那个 N

所以恒有 `assetsDone >= providerCalls`，且 `assetsDone` 才是用户看到的进度。

### 为什么「vite 构建中」可以不新增字段

图片全部落盘到 vite 启动之间只隔一次 `assertExpectedAssetsExist`（`pipeline.ts:81`，毫秒级）。因此 `assetsDone === assetsTotal` 是「图片已跑完」的准确信号。`assetsTotal === 0` 的任务（无图的 spec）也正确：`building` 一进入就显示「正在 vite 构建」。

**代价**：多一个隐式约定。若哪天在图片与 vite 之间插入一个**长**步骤，这条派生就会说谎 —— 届时必须补 `buildPhase` 字段。这一点写进 plan 的注释里。

### 时序（一次真实任务）

| 时刻 | `status` | 字段变化 |
|---|---|---|
| 创建 | `queued` | — |
| runner 起步（`runner.ts:50`） | `drafting` | `startedAt` |
| 每次尝试发起 | `drafting` | `specAttempts` = 1 → 2 → 3 |
| spec 通过（`runner.ts:57`） | `building` | `specAttempts` 最终值（此时**还没有**图片字段） |
| `writeProject` 完成、图片环节开始 | `building` | `assetsTotal` = N，`assetsDone` = 0（第一个回调） |
| 每张图落盘 | `building` | `assetsDone` = 1 … N |
| 图片跑完 | `building` | `assetsDone` = N（前端据此转「正在 vite 构建」） |
| 完成（`runner.ts:71`） | `ready` | `providerCalls`、`specAttempts` 最终值（既有） |

写频率：每任务 ≤ 3（尝试）+ N+1（图，N ≤ `maxAssets` 默认 24）次 `store.update`。`store.update`（`store.ts:46`）是浅合并 + 新对象，每次约 O(字段数)，可忽略。

## 第 2 节：三处回调

### 2.1 `draftSpec` —— 加 `onAttempt`

```ts
// server/src/spec-source.ts
export interface DraftSpecOptions {
  maxAttempts?: number
  /** Fired before each attempt's model call, 1-based. */
  onAttempt?: (attempt: number) => void
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  options.onAttempt?.(attempt)   // 循环顶部，模型调用之前
  const raw = await drafter.draft(…)
```

`runner.ts:57` 那句 `specAttempts: attempts` **保留**：它是「drafting 结束后该字段为最终值」这条契约本身，回调只负责让它**早点**可见。

### 2.2 `generateAssets` —— 加 `onProgress`，它是 `done`/`total` **数值**的唯一来源

数值链条只有一条，中间不重复计算：**`generateAssets` 算出 `done`/`total` → `buildTask` 原样转发 → `runner` 写进记录**。已定决策 3 说的「只有一个写者」指的是**记录写入**只由 `runner` 经 `buildTask` 的回调发生一次；图片计数不会被 runner 自己再算一遍（runner 手里虽有 `spec`，但它**不**去写 `assetsTotal`）。

```ts
// packages/imagegen/src/generate.ts
export interface AssetsProgress { done: number; total: number }

options.onProgress?.({ done: 0, total: jobs.length })   // 循环之前
for (const job of jobs) {
  …
  assets.push({ … })
  options.onProgress?.({ done: assets.length, total: jobs.length })
}
```

`done` 取 `assets.length` —— 含缓存命中与内容去重的条目，这才是「已出 N 张图」的诚实含义。

### 2.3 `buildTask` —— 加 `onProgress`，只做转发

```ts
// packages/build/src/pipeline.ts
export interface BuildTaskOptions { …; onProgress?: (progress: AssetsProgress) => void }

const images = await generateAssets(spec, {
  provider, outDir: projectDir,
  ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
  …
})
```

条件展开沿用该文件既有的 `cache`/`processor`/`limits` 写法。

### 2.4 `runner.ts` 两处装配

```ts
// drafting 期间（runner.ts:54 的 draftSpec 调用里）
onAttempt: (attempt) => { store.update(taskId, { specAttempts: attempt }) }

// building 期间（runner.ts:60 的 buildTask 调用里）
onProgress: ({ done, total }) => { store.update(taskId, { assetsDone: done, assetsTotal: total }) }
```

回调是**同步**的，`store.update` 也是同步的，所以写入顺序与循环顺序严格一致，计数器**单调不减** —— 这是前端可以直接渲染而不必做防御的前提。

### 2.5 一处有意的取舍

`generateAssets` 在循环**前**发一次 `(0, total)`，让计数器在进入图片环节时立刻出现；代价是它之前那 1-2 秒的 `writeProject` 期间没有计数器（前端显示上一阶段的文案）。反过来（让 `buildTask` 在函数开头就发）能提前 1-2 秒，但 `done`/`total` 就有了**两个数值来源**，与已定决策 3 冲突。**选前者。**

### 2.6 明确不做的

- **不给 vite build 段加回调**：`runNodeSandboxed`（`pipeline.ts:120`）是子进程，拿不到中间态，硬报就是假进度。
- **不给 `writeProject` 加**：1-2 秒且无子进度。

## 第 3 节：前端两页 + 共享时钟

### 3.1 逻辑抽成纯函数

仓库已为「视图逻辑要可测」定过调子 —— `views/settingsForm.ts`、`components/exportRules.ts` 都是**纯函数抽出来单独测**（web 的测试不挂载组件）。沿用，新建 `web/src/components/taskProgress.ts`：

```ts
export function currentStep(task: TaskView): number          // 0-3，现于 TaskSteps.vue:12
export function stepStatus(task: TaskView): 'error' | 'process'
export function draftDescription(task: TaskView): string
export function buildDescription(task: TaskView): string
export function elapsedLabel(task: TaskView, now: number): string | undefined
```

两页消费同一组函数，所以列表与详情**不可能显示不一致**。

### 3.2 文案

| 阶段 | 文案 |
|---|---|
| `drafting` | `第 N 次尝试` |
| `building` / `ready` | `第 N 次尝试通过`（现有文案，保留） |
| `failed` | `第 N 次尝试`（**中性**：不声称通过，也不声称未通过） |
| `building`，`done < total` | `已出 {done}/{total} 张图` |
| `building`，`done === total` | `图片完成，正在 vite 构建` |
| `building`，`total` 缺失 | `生成图片 + vite build`（现有兜底，`TaskSteps.vue:29`） |
| 终态 | 冻结的已耗时 |

**`draftDescription` 现在会说谎，而且本次改动会让它开始暴露**：它是 `第 N 次尝试通过`（`TaskSteps.vue:34`），今天只在 `status === 'building'` 时才渲染，所以「通过」两个字没机会出错。改成渐进写 `specAttempts` 之后，**一个 drafting 失败的任务会留下 `specAttempts = 3`**，旧逻辑就会渲染「第 3 次尝试通过」——三次全没通过。所以这一条不是顺手改，是**本次改动的前置条件**。

**`failed` 为什么不区分「挂在 drafting」还是「挂在 building」**：唯一可用的推断是「`assetsTotal` 在不在」（它只在 `buildTask` 内部才会被写），但这条推断**不成立** —— `buildTask` 在 `pipeline.ts:59` 就因 `maxAssets` 超限抛错时，spec 明明已经通过，`assetsTotal` 却仍是 undefined，于是文案会错报成「未通过」。用 `status` 三分支、失败时保持中性，是唯一不需要新增字段又不会说谎的写法。

### 3.3 共享 1s 时钟

新建 `web/src/composables/useNow.ts`：

```ts
export function useNow(active: () => boolean, intervalMs = 1000): Ref<number>
```

- 模块级**一个** `ref(Date.now())` + **一个** `setInterval`，注册表 hold 住各消费者的 `active` 断言
- 只有**任一**消费者 active 时才推进 `now.value`；全不 active 时空转不写（列表页全是终态任务时不触发重渲染）
- 消费者 `onUnmounted` 时注销，注册表空了 `clearInterval` —— 「无残留定时器」这条纪律只在一个地方落实
- 列表页 N 行共用**这一个**计时器，不是每行一个

`elapsedLabel` 用 `startedAt ?? createdAt` 起算、`finishedAt ?? now` 收尾，所以终态行**冻结在真实耗时**上，不依赖时钟。

### 3.4 两页的落点

- **`TaskSteps.vue`**：`currentStep`/`status`/两个 description 改为 import 纯函数；完成态显示冻结耗时。
- **`TaskList.vue`**：**新增一列「进度」**（宽 ~160），渲染同一组短语 + 已耗时。**「图片调用」列（`:32`）保留** —— 它是最终成本指标，与进度不同义（见第 1 节）。

### 3.5 耗时格式

```ts
// < 60s：43.2s     >= 60s：4m57s
```

现有实现是 `((finishedAt - createdAt) / 1000).toFixed(1) + 's'`（`TaskSteps.vue:37-41`），在 building（4-5 分钟）会显示 `297.3s`。

## 数据流（变化点）

```
draftSpec ──[新] onAttempt(1..3)──→ runner ──→ store.update{specAttempts} ──→ toView ──→ GET /tasks/:id
                                                                                        ↑ [新] 加 3 个键
buildTask ──[新] onProgress{done,total}──→ runner ──→ store.update{assetsDone,assetsTotal}
    └─→ generateAssets ──[新] onProgress{done,total}──┘
            └─→ provider / cache / postProcess（不动）

runner.ts:71 的 ready 分支（providerCalls）与 :79 的 failed 分支（保留新字段）—— 不动
前端：useTaskPolling（1.5s，不动）──→ useNow（新，1s 时钟）+ taskProgress.ts（新，纯函数）
        ├─→ TaskSteps.vue（改：改 import）
        └─→ TaskList.vue（改：加一列）
```

## 测试改动面

### 新增

| 文件 | 用例 | 要点 |
|---|---|---|
| `packages/imagegen/src/__tests__/generate.test.ts` | 「reports progress before and after every asset」 | 注入 `onProgress` 收集序列，断言首项 `{done:0,total:N}`、末项 `{done:N,total:N}`、长度为 N+1、且 `done` 严格递增 |
| 同上 | 「counts a cache hit as progress even though it makes no provider call」 | 先跑一次暖缓存，第二次用 `onProgress` 断言 `done` 仍到 N 而 `providerCalls === 0` —— **这条同时钉住「与 providerCalls 不同义」** |
| `packages/build/src/__tests__/pipeline.test.ts` | 「forwards image progress to its own caller」 | 注入 `onProgress`，断言收到 `{done:0,total:N}` 与终值；用已有的 `landingSpec()` |
| `server/src/__tests__/spec-source.test.ts` | 「reports each attempt number before the model is asked」 | `ScriptedDrafter` 连续两份垃圾 → 断言 `onAttempt` 收到 `[1,2,3]` |
| `server/src/__tests__/app.test.ts` | 「shows the drafting attempt while the model is still working」 | 用 `GatedDrafter`（`fixture.ts:136`）卡住 drafting，在闸门未放行时 `GET /tasks/:id`，断言 `specAttempts === 1` 且 `startedAt` 有值 —— **这是本次的核心回归测试**：修之前此断言必红。照 `app.test.ts` 里既有的快照守卫用例（`GatedDrafter` + MemorySettingsStore + concurrency 1）的形状写 |
| `server/src/__tests__/app.test.ts` | 「shows image progress while the building stage is still running」 | 卡住第 k 张图，断言 `assetsDone === k`、`assetsTotal === N`，且 `status === 'building'` |
| `server/src/__tests__/app.test.ts` | 「keeps the partial image progress on a failure」 | 断言 failed 记录上 `assetsDone`/`assetsTotal` 仍在（已定决策 5） |
| `server/src/__tests__/app.test.ts` | 扩写已有的「reports a failure with validator feedback when the model will not comply」（`:221`）：补断言 failed 记录上 `specAttempts === 1`（该用例传的配置就是 `specAttempts: 1`） | 钉住「drafting 失败会留下 `specAttempts`」这个事实 —— 它正是第 3.2 节那个中性文案分支的**唯一理由**，不钉住的话下一个人会以为那个分支多余而删掉它 |
| `web/src/components/__tests__/taskProgress.test.ts` | 第 3.2 节表格**每一行**一条，含 `total === 0` 与 `total` 缺失两个边界；耗时格式 `< 60s` / `>= 60s` 两侧 | 纯函数，不挂载组件 |
| `web/src/composables/__tests__/useNow.test.ts` | 三个：多消费者共用同一 ref、全不 active 时 `now` 不推进、全部注销后 `vi.getTimerCount() === 0` | 沿用 `vi.useFakeTimers()` + `advanceTimersByTimeAsync`（`useTaskPolling.test.ts:10` 的既有写法） |

### 需要新建的测试替身

**`server/src/__tests__/fixture.ts` 现在没有可放行的图片 provider** —— 只有 `ScriptedDrafter:87`、`StubProvider:108`、`FailingProvider:123`、`GatedDrafter:136`。上面两条 building 期间的用例需要**新增一个 `GatedProvider`**，形状照 `GatedDrafter:136-148`：构造时收一个 promise，`generate()` 先 `await` 它再返回图。

**关于耗时**：`app.test.ts` 已因真 vite 构建达到 ~24.5s（settings 那轮已有记录）。让 `GatedProvider` 在断言之后**拒绝**而不是放行，可以省下整段构建时间，顺带覆盖「失败保留部分进度」那条 —— 一条替身服务两条用例。若选择放行，则必须 `await harness.app.vudt.queue.drain()` 并接受该文件再长一截。

### 预期不受影响（已扫过，记录以便复核）

- **三个回调全部可选**，既有调用点零改动：`buildTask` 6 处（`pipeline.test.ts:45,73,82,96,114,127`）+ `generateAssets` 12 处（`generate.test.ts:45,57,67,71,81,84,94,101,110,124,132,147`）。
- 两个包的 `index.ts` 都是 `export *`（`imagegen/index.ts:6`、`build/index.ts:6`），新类型自动出包，无需改导出。
- **没有任何测试钉 `specAttempts` 在 drafting 期间缺席**（全仓唯一一处 `specAttempts` 的测试用法是 `app.test.ts:228`，把它当**配置项**传 `1`）。这是「渐进写`specAttempts`」可行的前提，已逐处核过。
- `startedAt` 全仓无读取点，加进 `TaskView` 不改变任何现有行为。
- `toView` 已有的键一个不动，只加三个；`TaskList.vue` 现有四列保留。
- `packages/spec`、`packages/codegen`、`packages/templates`、沙箱、CSP、预览路径 **完全不动**。

### 不动

`useTaskPolling.ts`（1.5s、`ACTIVE_STATUSES`、404 处理三条都已正确）、`useTaskList.ts` 的轮询、`queue.ts` 的并发（默认 1）、`runner.ts` 的 ready/failed 分支结构、`toView` 的既有键、任何 CSP 与端点。

## 我擅自定的点（可否决）

1. **命名 `assetsDone`/`assetsTotal`**（而不是 `imagesDone`/`imagesTotal`）—— 跟代码词汇（`spec.assets`、`generateAssets`、`maxAssets`）走，而不是跟界面词汇（「张图」）走。若你觉得 API 面该说图片，改名是一行的事。
2. **列表页「图片调用」与「进度」两列并存**，而不是把「图片调用」列改造成进度列。理由是两者不同义（第 1 节），且「图片调用」是最终成本指标、有独立价值。
3. **共享时钟用「注册表 + active 断言」**，而不是每行一个 `setInterval`。前者省定时器但多了模块级状态；若你偏好「无全局状态」，改成每个组件自持一个 `active` 门控的定时器也成立，代价是 N 行 N 个定时器。
4. **`< 60s` 保留一位小数、`>= 60s` 用 `4m57s`（不带秒的小数）** —— 秒级以下的小数只在短任务里有信息量。

## 交付顺序

1. **三个包的进度回调**（`imagegen` → `build` → `spec-source`），纯加可选参数，各自单包测试
2. **server**：`store.ts` 两个字段 + `runner.ts` 两处装配 + `app.ts` 的 `TaskView`/`toView` 三个键 + 三条 app.test 用例（含核心回归测试）
3. **web**：`taskProgress.ts` 纯函数 + `useNow.ts` + 两页改造 + 两组测试
4. **全仓回归 + 真任务手验**

第 1、2 步之后前端还看不见任何变化（`toView` 白名单与 runner 装配要同时在位），所以**第 2 步未完成前不要急着看界面**。

## 验证

- 全仓 `pnpm -r test` 全绿，`pnpm -r typecheck` 全绿（当前基线：41 文件 / 430 例）。
- **真任务手验（本次的核心验收）**：`server/.env` 已有真 key，从**仓库根**起服务，提交一条描述，确认：
  1. **停在列表页**就能看到「进度」列在动：`第 1 次尝试` → `已出 0/5 张图` → … → `图片完成，正在 vite 构建`，且**已耗时在走**；
  2. 点进详情页，四个步骤的描述与列表页一致地变化，终态后耗时**冻结**；
  3. 起服务前先做**反证**：修之前，drafting 期间每 5s 采一次 `GET /tasks/:id` 响应体**逐字节相同**（这是这条 bug 的原始证据）。修后同一采样在 active 阶段**相邻两次必须不同**。这一条手工做即可，也可以直接读 `curl` 两次比 diff。
- 任务失败时（可故意把 `.vudt/settings.json` 的 model 改错触发），确认部分进度仍可见、且 error alert 仍正常显示。

**这条 plan 的验收为什么必须包含真任务**：本 bug 的教训正是「单元测试全绿而产品是坏的」—— 前端被测试证明正确的同时，整条链在真任务上纹丝不动。只跑全仓测试不足以声称修好了。
