# 任务进度可见性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让一个正在跑的任务在 drafting / building 阶段内就有肉眼可见的变化 —— 服务端在阶段内写进度字段，前端两页共用同一组渲染函数把它显示出来。

**Architecture:** 沿用既有分层，不新增端点、不上 SSE。三个包各加一个**可选**回调把阶段内事件交出来（`generateAssets` 的逐图 `onProgress`、`buildTask` 的原样转发、`draftSpec` 的逐次 `onAttempt`），`runner` 把回调同步写进 `TaskStore`，`app.ts` 的白名单投影 `toView` 放出两个新键，前端一组纯函数 + 一个共享 1s 时钟渲染两页。

**Tech Stack:** TypeScript / pnpm workspace / Vitest / Fastify / Vue 3 + ant-design-vue。

**Spec:** `docs/superpowers/specs/2026-09-23-progress-visibility-design.md`

## Global Constraints

- 三个回调**全部可选**，既有调用点零改动：`buildTask` 6 处（`packages/build/src/__tests__/pipeline.test.ts:45,73,82,96,114,127`）+ `generateAssets` 12 处（`packages/imagegen/src/__tests__/generate.test.ts:45,57,67,71,81,84,94,101,110,124,132,147`）。
- 图片计数的**数值来源只有 `generateAssets` 一处**：`done` 取 `assets.length`（含缓存命中与内容去重）。`runner` 不自己算 `assetsTotal`。
- `assetsDone` 与 `providerCalls` **不同义**：恒有 `assetsDone >= providerCalls`。两个字段都保留，两个界面指标都保留。
- 失败时新字段**一律保留**，不做清理（spec 已定决策 5）。
- 耗时格式：`< 60s` 用一位小数（`43.2s`），`>= 60s` 用 `4m57s`（分钟不补零、秒不补零）。
- 文案表（spec §3.2，逐字）：

  | 条件 | 文案 |
  |---|---|
  | `drafting` | `第 N 次尝试` |
  | `building` / `ready` | `第 N 次尝试通过` |
  | `failed` | `第 N 次尝试`（中性） |
  | `building` 且 `done < total` | `已出 {done}/{total} 张图` |
  | `building` 且 `done === total` | `图片完成，正在 vite 构建` |
  | 图片字段缺失 | `生成图片 + vite build` |

- `toView`（`server/src/app.ts:75`）是**白名单投影**：字段写了不放进白名单，前端逐字节不变，**修了等于没修**。
- `packages/spec`、`packages/codegen`、`packages/templates`、沙箱、CSP、预览路径**完全不动**。
- `useTaskPolling.ts`（1.5s、`ACTIVE_STATUSES`、404 处理）、`queue.ts` 的并发、`runner.ts` 的 ready/failed 分支结构**不动**。
- **绝不 `git add -A`**（本项目缺陷 #17：会扫进无关的根目录文件）。用 `git add <path>` 或 `git add -u`。
- 基线：`pnpm -r test` **41 文件 / 430 例**全绿；`pnpm -r typecheck` Scope 9 of 10、exit 0。
- 提交信息末尾加：`Co-Authored-By: Claude Code <noreply@anthropic.com>`

### 两处对 spec 的偏离（在此说明，实施时按本 plan 走）

1. **不暴露 `startedAt`，计时以 `createdAt` 为唯一起点。** spec §1/§3.3 原定 `elapsedLabel` 用 `startedAt ?? createdAt` 起算。实施推演发现这条会**抖动**：`concurrency` 默认 1，一个排队中的任务先按 `createdAt` 走表，runner 接手时写入 `startedAt`，已耗时从 `32.4s` **跳回** `0.3s`。单一起点后该数字全程单调，且**终态任务显示的数字与改动前逐字节相同**（现有实现就是 `finishedAt - createdAt`）。代价：排队期间那个数字包含排队时长 —— 而状态与步骤本来就已经写着「排队」，且用户问的正是「我提交多久了」。
   连带效果：`TaskView` / `toView` 只加 **2** 个键（`assetsDone`/`assetsTotal`），不是 3 个。`startedAt` 继续留在 `TaskRecord` 上不读。
2. **`useNow` 返回 `{ now, stop }` 而不是裸 `Ref<number>`。** spec §3.3 写的是 `: Ref<number>`。本仓库 web 测试**不挂载组件**（`views/settingsForm.ts`、`components/exportRules.ts` 都是纯函数抽出来单独测），所以 `onUnmounted` 在测试里不会触发 —— 「全部注销后 `vi.getTimerCount() === 0`」这条用例必须有一个**可调用**的注销入口。组件侧照常 `const { now } = useNow(...)`，模板里自动解包。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `packages/imagegen/src/generate.ts` | 逐图事件的**唯一**产生者；`done`/`total` 的算法只此一处 | 改：加 `AssetsProgress` 类型 + `onProgress` 选项 + 两处发射 |
| `packages/build/src/pipeline.ts` | 把上者的事件原样转发给 build 的调用者，不做任何加工 | 改：加 `onProgress` 选项 + 条件展开转发 |
| `server/src/spec-source.ts` | 每次尝试发起前报数 | 改：`DraftSpecOptions.onAttempt` + 循环顶发射 |
| `server/src/store.ts` | 记录的形状（扁平可选字段风格） | 改：加 `assetsDone?` / `assetsTotal?` |
| `server/src/runner.ts` | 唯一的写入者：把两个回调接到 `store.update` | 改：两处装配 |
| `server/src/app.ts` | 对外投影白名单 | 改：`TaskView` + `toView` 各加两个键 |
| `server/src/__tests__/fixture.ts` | 测试替身 | 改：加 `GatedProvider` |
| `web/src/components/taskProgress.ts` | 两页共用的**全部**文案与派生逻辑（纯函数，无 Vue） | 新建 |
| `web/src/api/client.ts` | web 侧的 `TaskView` —— 服务端那份的**手写镜像**，新字段必须两边都加 | 改：加 `assetsDone?` / `assetsTotal?` |
| `web/src/composables/useNow.ts` | 全应用共享的 1s 时钟；注册表 + active 断言，N 行共用 1 个定时器 | 新建 |
| `web/src/components/TaskSteps.vue` | 详情页四步 | 改：改 import，逻辑搬走 |
| `web/src/views/TaskList.vue` | 列表页（用户提交后**停在这一屏**） | 改：加「进度」列 + 时钟 |

新文件都放在其消费方旁边：`taskProgress.ts` 在 `components/`（两个消费方一个是 `components/`、一个是 `views/`，而 `exportRules.ts` 已在 `components/`），`useNow.ts` 在 `composables/`（与 `useTaskPolling.ts` 同类）。

---

## Task 1: `generateAssets` 报逐图进度

**Files:**
- Modify: `packages/imagegen/src/generate.ts`
- Test: `packages/imagegen/src/__tests__/generate.test.ts`

**Interfaces:**
- Consumes: 既有 `generateAssets(spec, options)`、`planAssetJobs`、`StubProvider`、`MemoryImageCache`（`packages/imagegen/src/__tests__/stub-provider.ts`）
- Produces: `AssetsProgress { done: number; total: number }`（从 `@vudt/imagegen` 出包，`index.ts` 是 `export *`）；`GenerateAssetsOptions.onProgress?: (progress: AssetsProgress) => void`

- [ ] **Step 1: 写失败的测试**

打开 `packages/imagegen/src/__tests__/generate.test.ts`。先把 `AssetsProgress` 加进文件顶部的类型 import（该文件已从 `../generate.js` 导入别的东西，把 `AssetsProgress` 附在同一个 import 的 `type` 位置上）。

在已有的 `describe('generateAssets', …)` 块内、文件末尾追加两条用例：

```ts
  it('reports progress before and after every asset', async () => {
    const spec = landingSpec()
    const seen: AssetsProgress[] = []

    const result = await generateAssets(spec, {
      provider: new StubProvider(),
      outDir: await tempOut(),
      onProgress: (progress) => seen.push(progress),
    })

    expect(seen[0]).toEqual({ done: 0, total: spec.assets.length })
    expect(seen.at(-1)).toEqual({ done: spec.assets.length, total: spec.assets.length })
    expect(seen).toHaveLength(spec.assets.length + 1)
    // Strictly one step per entry: the counter never stalls and never skips.
    expect(seen.map((progress) => progress.done)).toEqual(
      Array.from({ length: spec.assets.length + 1 }, (_, index) => index),
    )
    expect(result.assets).toHaveLength(spec.assets.length)
  })

  it('counts a cache hit as progress even though it makes no provider call', async () => {
    const spec = landingSpec()
    const cache = new MemoryImageCache()
    // Warm the cache with a throwaway provider, then measure a run that must hit it.
    await generateAssets(spec, { provider: new StubProvider(), outDir: await tempOut(), cache })

    const seen: AssetsProgress[] = []
    const provider = new StubProvider()
    const result = await generateAssets(spec, {
      provider,
      outDir: await tempOut(),
      cache,
      onProgress: (progress) => seen.push(progress),
    })

    expect(provider.requests).toHaveLength(0)
    expect(result.providerCalls).toBe(0)
    expect(seen.at(-1)).toEqual({ done: spec.assets.length, total: spec.assets.length })
  })
```

`tempOut()`（该文件 `:15`）、`landingSpec`、`StubProvider`、`MemoryImageCache` 都已在该文件内可用。

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm --filter @vudt/imagegen test -- generate.test.ts
```

Expected: FAIL —— `onProgress` 不是 `GenerateAssetsOptions` 的成员（TS 报错 / `seen` 为空导致断言失败）。

- [ ] **Step 3: 最小实现**

在 `packages/imagegen/src/generate.ts` 的 `GenerateAssetsOptions`（`:11`）**上方**加类型：

```ts
/**
 * 已落盘条目数 / 本次任务的条目总数。`done` 数的是 manifest 条目 —— 缓存命中
 * 与内容去重都算，所以它恒有 `done >= providerCalls`，且它才是「已出 N 张图」。
 */
export interface AssetsProgress {
  done: number
  total: number
}
```

给 `GenerateAssetsOptions` 加一个可选项（放在 `tiers` 之后）：

```ts
  /** 循环开始前发一次 `{done: 0, total}`，其后每落盘一条发一次。 */
  onProgress?: (progress: AssetsProgress) => void
```

在函数体里，`const jobs = planAssetJobs(...)` 之后、`const produced = …` 之前，取一次回调：

```ts
  const onProgress = options.onProgress
```

（与既有的 `const cache = options.cache ?? NO_CACHE` 一排，风格一致。）

在 `for (const job of jobs) {` **之前**发首发事件：

```ts
  // 首发在循环之前：计数器在进入图片环节时立刻出现，而不是等第一张图落盘。
  onProgress?.({ done: 0, total: jobs.length })
```

在 `assets.push({ … })` 那条语句**之后**（仍是循环体内）发推进事件：

```ts
    onProgress?.({ done: assets.length, total: jobs.length })
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm --filter @vudt/imagegen test
```

Expected: PASS，该包由 4 文件 / 29 例变为 **4 文件 / 31 例**。

- [ ] **Step 5: 提交**

```bash
git add packages/imagegen/src/generate.ts packages/imagegen/src/__tests__/generate.test.ts
git commit -m "feat(imagegen): report per-asset progress from generateAssets

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 2: `buildTask` 转发图片进度

**Files:**
- Modify: `packages/build/src/pipeline.ts`
- Test: `packages/build/src/__tests__/pipeline.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `AssetsProgress`
- Produces: `BuildTaskOptions.onProgress?: (progress: AssetsProgress) => void`（从 `@vudt/build` 出包）

- [ ] **Step 1: 写失败的测试**

在 `packages/build/src/__tests__/pipeline.test.ts` 顶部把 `AssetsProgress` 加进已有的 `@vudt/imagegen` 类型 import。在该文件的 `describe` 内追加：

```ts
  it('forwards image progress to its own caller', async () => {
    const workspace = await root.allocate('task-progress')
    const spec = landingSpec()
    const seen: AssetsProgress[] = []

    await buildTask(spec, {
      workspace,
      templateDir: TEMPLATE_DIR,
      provider: new PngProvider(),
      onProgress: (progress) => seen.push(progress),
    })

    expect(seen[0]).toEqual({ done: 0, total: spec.assets.length })
    expect(seen.at(-1)).toEqual({ done: spec.assets.length, total: spec.assets.length })
  })
```

`root.allocate('…')`（`WorkspaceRoot` 在 `beforeAll` 里建好）、`PngProvider`（`:19`）、`TEMPLATE_DIR`（`:11`）、`landingSpec` 都已在该文件内可用。

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm --filter @vudt/build test -- pipeline.test.ts
```

Expected: FAIL —— `onProgress` 不是 `BuildTaskOptions` 的成员。这条用例会跑一次真 vite 构建，慢是正常的。

- [ ] **Step 3: 最小实现**

在 `packages/build/src/pipeline.ts` 顶部的 `@vudt/imagegen` import 里加上 `type AssetsProgress`（该行已在导入 `GenerateAssetsResult`、`ImageCache`、`ImageProcessor`、`ImageProvider`）。

给 `BuildTaskOptions` 加（放在 `limits?` 之后、`typecheck?` 之前）：

```ts
  /** 原样转发 `generateAssets` 的图片进度；阶段划分由调用方派生。 */
  onProgress?: (progress: AssetsProgress) => void
```

在 `generateAssets(spec, { … })` 的调用里，按该文件既有的条件展开写法加一行（放在 `provider`/`outDir` 之后、`cache` 之前）：

```ts
    ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm --filter @vudt/build test
```

Expected: PASS，该包由 4 文件 / 25 例变为 **4 文件 / 26 例**。

- [ ] **Step 5: 提交**

```bash
git add packages/build/src/pipeline.ts packages/build/src/__tests__/pipeline.test.ts
git commit -m "feat(build): forward image progress to buildTask callers

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 3: `draftSpec` 每次尝试前报数

**Files:**
- Modify: `server/src/spec-source.ts`
- Test: `server/src/__tests__/spec-source.test.ts`

**Interfaces:**
- Consumes: 既有 `draftSpec(drafter, description, options)`、`ScriptedDrafter`（`server/src/__tests__/fixture.ts:87`）
- Produces: `DraftSpecOptions.onAttempt?: (attempt: number) => void`（1-based，模型调用**之前**触发）

- [ ] **Step 1: 写失败的测试**

在 `server/src/__tests__/spec-source.test.ts` 的 `describe` 内追加：

```ts
  it('reports each attempt number before the model is asked', async () => {
    // Three junk drafts: every attempt is rejected, so all three are reported.
    const drafter = new ScriptedDrafter([{ garbage: true }])
    const seen: number[] = []

    await expect(
      draftSpec(drafter, 'a landing page', {
        maxAttempts: 3,
        onAttempt: (attempt) => seen.push(attempt),
      }),
    ).rejects.toThrow()

    expect(seen).toEqual([1, 2, 3])
    // One report per model call — the callback is not a progress bar of its own.
    expect(seen).toHaveLength(drafter.requests.length)
  })
```

`ScriptedDrafter` 会把同一份垃圾草稿反复交出（该文件已有的失败用例就是这么构造的），所以三次尝试都不通过。

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm --filter @vudt/server test -- spec-source.test.ts
```

Expected: FAIL —— `onAttempt` 不是 `DraftSpecOptions` 的成员。

- [ ] **Step 3: 最小实现**

`server/src/spec-source.ts:21` 的接口改成：

```ts
export interface DraftSpecOptions {
  maxAttempts?: number
  /** 每次尝试的模型调用之前触发，1-based。 */
  onAttempt?: (attempt: number) => void
}
```

在 `for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {` 之下的**第一行**、`const raw = await drafter.draft(` **之前**插入：

```ts
    options.onAttempt?.(attempt)
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm --filter @vudt/server test -- spec-source.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add server/src/spec-source.ts server/src/__tests__/spec-source.test.ts
git commit -m "feat(server): report each draft attempt before the model call

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 4: server 侧落库与投影（本次的核心）

**Files:**
- Modify: `server/src/store.ts:20`（`TaskRecord` 末尾）
- Modify: `server/src/app.ts:61`（`TaskView`）、`:75`（`toView`）
- Modify: `server/src/runner.ts:54`、`:60`
- Modify: `server/src/__tests__/fixture.ts`（加 `GatedProvider`）
- Test: `server/src/__tests__/app.test.ts`

**Interfaces:**
- Consumes: Task 1/2 的 `AssetsProgress`；Task 3 的 `onAttempt`
- Produces: `TaskRecord.assetsDone?` / `TaskRecord.assetsTotal?`；`TaskView.assetsDone?` / `TaskView.assetsTotal?`（`GET /tasks/:id` 与 `GET /tasks` 都能看到）

**这一步做完之前前端看不见任何变化** —— `toView` 白名单与 runner 装配必须**同时**在位。不要在这一步之前去点界面。

**spec 的三条 app.test 用例在这里落成两条 + 一处扩写**：spec 把「building 期间看得见进度」与「失败后保留部分进度」列成两行，但紧接着自己写了「一条替身服务两条用例」—— 两条断言共用同一个夹具、同一份两图草稿、同一个已经停在第 2 张图上的任务，拆成两条只会把同一段装配抄两遍。合并后的用例里，拒绝闸门那一步之后的那组断言**就是**「失败保留」那一条。

- [ ] **Step 1: 写失败的测试**

先在 `server/src/__tests__/fixture.ts` 末尾加测试替身（`ImageProvider`/`ImageRequest` 在 `:1` 已经导入，`ONE_PIXEL_PNG` 在 `:103`）：

```ts
/**
 * 放行前先卡住。`parkAt` 指的是第几次 `generate()` 调用被卡住 —— 之前的调用
 * 正常返回。`reached` 在那次调用进入后立刻 resolve，测试据此拿到一个确定的
 * 「前 k 张已落盘」观察窗口，而不是靠 sleep 猜。
 *
 * 断言之后**拒绝**闸门比放行便宜得多：任务停在图片阶段失败，整段 vite 构建
 * 就不必跑了。GatedDrafter 用的是同一个套路。
 */
export class GatedProvider implements ImageProvider {
  readonly name = 'gated'
  readonly requests: ImageRequest[] = []
  /** `generate()` 被进入 `parkAt` 次之后 resolve。 */
  readonly reached: Promise<void>

  private readonly gate: Promise<void>
  private readonly parkAt: number
  private markReached: () => void = () => {}

  constructor(gate: Promise<void>, parkAt = 1) {
    this.gate = gate
    this.parkAt = parkAt
    this.reached = new Promise((resolve) => {
      this.markReached = resolve
    })
  }

  async generate(request: ImageRequest): Promise<Uint8Array> {
    this.requests.push(request)
    if (this.requests.length >= this.parkAt) {
      this.markReached()
      await this.gate
    }
    return new Uint8Array(ONE_PIXEL_PNG)
  }
}
```

再把 `GatedProvider` 加进 `app.test.ts:12-19` 那个 `./fixture.js` 的 import 列表。

在 `app.test.ts` 顶部（`makeApp` 之后、`describe('POST /tasks')` 之前）加一个只给本测试用的草稿帮手：

```ts
type DraftBlock = { component: string; props: Record<string, unknown>; content?: Record<string, unknown> }
type DraftPage = { route: string; blocks: DraftBlock[] }

/**
 * 共享草稿加一个带图区块，好让测试卡在**第二**张图上、观察到一个非零的计数器。
 * 形状对不上就抛错：一份悄悄只剩一张图的草稿会让 `parkAt: 2` 永远等不到，
 * 测试会挂死而不是失败。
 */
function twoImageDraft(): unknown {
  const draft = landingDraft() as { pages: DraftPage[] }
  const pricing = draft.pages.find((page) => page.route === '/pricing')
  const hero = pricing?.blocks.find((block) => block.component === 'HeroCentered')
  if (hero === undefined) throw new Error('fixture changed: /pricing no longer has a HeroCentered block')
  hero.content = { backdrop: { prompt: 'a pricing dashboard', alt: 'Pricing dashboard' } }
  return draft
}
```

（`landingDraft()` 原本只有 `/` 上的 `HeroSplit.illustration` 一张图 —— `HeroCentered` 的槽位叫 `backdrop`，而夹具里那个 HeroCentered 没有 `content`。）

在 `describe('GET /tasks/:id')` 内追加两条用例：

```ts
  /**
   * 本次修复的核心回归测试。改动之前，drafting 期间的响应体在 130 秒里逐字节
   * 不变 —— 前端是清白的，字段压根没写。队列在 enqueue 时同步泵动，所以
   * `post` 返回时 runTask 已经同步跑到 `await drafter.draft()` 并停在闸门上。
   */
  it('shows the drafting attempt while the model is still working', async () => {
    let fail = (): void => {}
    const gate = new Promise<void>((_resolve, reject) => {
      fail = () => reject(new Error('drafter is down'))
    })
    const harness = await makeApp({ drafter: new GatedDrafter(gate, landingDraft()) })
    track(harness)

    const { id } = (await post(harness, 'a landing page')).json() as { id: string }

    const body = (await harness.app.inject({ method: 'GET', url: `/tasks/${id}` })).json() as {
      status: string
      specAttempts?: number
    }
    expect(body.status).toBe('drafting')
    expect(body.specAttempts).toBe(1)

    // Reject rather than release: this test is about the drafting window, and
    // releasing would pay for a whole real vite build it does not need.
    fail()
    await harness.app.vudt.queue.drain()
  })

  it('shows image progress while building and keeps it after a failure', async () => {
    let fail = (): void => {}
    const gate = new Promise<void>((_resolve, reject) => {
      fail = () => reject(new Error('image provider is down'))
    })
    const provider = new GatedProvider(gate, 2)

    const harness = await makeApp({
      drafter: new ScriptedDrafter([twoImageDraft()]),
      provider,
      concurrency: 1,
    })
    track(harness)

    const { id } = (await post(harness, 'a landing page')).json() as { id: string }

    // Second image is parked; the first one has already landed and reported.
    await provider.reached
    expect(provider.requests).toHaveLength(2)

    const running = (await harness.app.inject({ method: 'GET', url: `/tasks/${id}` })).json() as {
      status: string
      assetsDone?: number
      assetsTotal?: number
    }
    expect(running.status).toBe('building')
    expect(running.assetsDone).toBe(1)
    expect(running.assetsTotal).toBe(2)

    fail()
    await harness.app.vudt.queue.drain()

    // Decision 5: a failure keeps what the record had already learned.
    const failed = (await harness.app.inject({ method: 'GET', url: `/tasks/${id}` })).json() as {
      status: string
      assetsDone?: number
      assetsTotal?: number
    }
    expect(failed.status).toBe('failed')
    expect(failed.assetsDone).toBe(1)
    expect(failed.assetsTotal).toBe(2)
  })
```

再把已有的 drafting 失败用例（`app.test.ts:225` 那条 `'reports a failure with validator feedback when the model will not comply'`）改两处。

第一处，它读响应体时的那句类型注解（`:235-238`）改成：

```ts
    const body = (await harness.app.inject({ method: 'GET', url: '/tasks/' + id })).json() as {
      status: string
      specAttempts?: number
      error?: { detail?: string }
    }
```

第二处，在它已有的两条断言之后补第三条：

```ts
    expect(body.status).toBe('failed')
    expect(body.error?.detail).toBeTruthy()
    // 渐进写意味着一次 drafting 失败会把 specAttempts 留在记录上 —— 这正是
    // draftDescription() 必须有中性 'failed' 分支的全部理由。
    expect(body.specAttempts).toBe(1)
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm --filter @vudt/server test -- app.test.ts
```

Expected: FAIL —— `specAttempts` / `assetsDone` / `assetsTotal` 都不在响应里（`toView` 白名单）。前两条是本次修复要让它变绿的核心；第三条（已有的失败用例扩写）**在改动前也是红的**，因为它断言的 `specAttempts` 今天压根不会被写。

- [ ] **Step 3: 实现**

`server/src/store.ts` —— 给 `TaskRecord`（`:6`）在 `providerCalls?: number` 之后加两个字段：

```ts
  /** 已落盘的 manifest 条目数；building 期间由 runner 逐步写。 */
  assetsDone?: number
  /** 本次任务的条目总数（= spec.assets.length）；同上。 */
  assetsTotal?: number
```

`server/src/app.ts` —— `TaskView`（`:61`）在 `providerCalls?: number` 之后加：

```ts
  assetsDone?: number
  assetsTotal?: number
```

`toView`（`:75`）在 `providerCalls` 那行条件展开之后加两行：

```ts
    ...(task.assetsDone === undefined ? {} : { assetsDone: task.assetsDone }),
    ...(task.assetsTotal === undefined ? {} : { assetsTotal: task.assetsTotal }),
```

`server/src/runner.ts` —— `draftSpec` 调用（`:54`）里加 `onAttempt`：

```ts
    const { spec, attempts } = await draftSpec(deps.drafter(settings.spec), task.description, {
      maxAttempts: deps.specAttempts,
      // 回调是同步的，store.update 也是同步的：写入顺序与循环顺序严格一致，
      // 所以 specAttempts 单调不减，前端可以直接渲染。
      onAttempt: (attempt) => {
        store.update(taskId, { specAttempts: attempt })
      },
    })
```

`buildTask` 调用（`:60`）里在 `maxAssets` 之后加 `onProgress`：

```ts
      onProgress: ({ done, total }) => {
        store.update(taskId, { assetsDone: done, assetsTotal: total })
      },
```

`runner.ts:57` 的 `specAttempts: attempts` **保留不动** —— 它是「drafting 结束后该字段为最终值」这条契约本身，回调只负责让它早一点可见。

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm --filter @vudt/server test
```

Expected: PASS，该包由 10 文件 / 111 例变为 **10 文件 / 113 例**。用 `-t 'shows'` 单独跑两条新用例确认它们真的绿，再跑整包确认没有回归。

- [ ] **Step 5: 提交**

```bash
git add server/src/store.ts server/src/app.ts server/src/runner.ts server/src/__tests__/fixture.ts server/src/__tests__/app.test.ts
git commit -m "feat(server): expose in-stage progress on the task view

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 5: web 侧文案纯函数

**Files:**
- Create: `web/src/components/taskProgress.ts`
- Modify: `web/src/api/client.ts:6`（web 侧的 `TaskView` —— 见下）
- Test: `web/src/components/__tests__/taskProgress.test.ts`

**Interfaces:**
- Consumes: `TaskView`（`web/src/api/client.ts:6`）
- Produces: `currentStep(task): number`、`stepStatus(task): error | process`、`draftDescription(task): string`、`buildDescription(task): string`、`progressLabel(task): string`、`elapsedLabel(task, now): string`

> **web 的 `TaskView` 是独立声明，必须同步。** `server/src/app.ts` 的 `TaskView` 与 `web/src/api/client.ts` 的 `TaskView` 是两份手写的镜像（web 不 import 服务端代码）。Task 4 只改了服务端那份；本任务的 `taskProgress.ts` 读的是 web 这份，不补 `assetsDone`/`assetsTotal` 就编译不过 —— 这是预检扫描抓到的 plan 缺陷。

- [ ] **Step 1: 写失败的测试**

新建 `web/src/components/__tests__/taskProgress.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import type { TaskView } from '../../api/client.js'
import {
  buildDescription,
  currentStep,
  draftDescription,
  elapsedLabel,
  progressLabel,
  stepStatus,
} from '../taskProgress.js'

function task(overrides: Partial<TaskView> = {}): TaskView {
  return { id: 'abc', status: 'queued', description: 'x', createdAt: 1_000, ...overrides }
}

describe('currentStep / stepStatus', () => {
  it.each([
    { status: 'queued' as const, step: 0 },
    { status: 'drafting' as const, step: 1 },
    { status: 'building' as const, step: 2 },
    { status: 'ready' as const, step: 3 },
    { status: 'failed' as const, step: 3 },
  ])('maps $status to step $step', ({ status, step }) => {
    expect(currentStep(task({ status }))).toBe(step)
  })

  it('marks only failed as an error', () => {
    expect(stepStatus(task({ status: 'failed' }))).toBe('error')
    expect(stepStatus(task({ status: 'ready' }))).toBe('process')
    expect(stepStatus(task({ status: 'drafting' }))).toBe('process')
  })
})

describe('draftDescription', () => {
  it('says which attempt is running while drafting', () => {
    expect(draftDescription(task({ status: 'drafting', specAttempts: 2 }))).toBe('第 2 次尝试')
  })

  it('says the attempt passed once the spec is in', () => {
    expect(draftDescription(task({ status: 'building', specAttempts: 1 }))).toBe('第 1 次尝试通过')
    expect(draftDescription(task({ status: 'ready', specAttempts: 3 }))).toBe('第 3 次尝试通过')
  })

  it('stays neutral after a failure instead of claiming the attempt passed', () => {
    // The regression this guards: progressive writing leaves specAttempts set on a
    // task whose every attempt failed, and the old wording claimed '通过'.
    expect(draftDescription(task({ status: 'failed', specAttempts: 3 }))).toBe('第 3 次尝试')
  })

  it('falls back when no attempt has been reported', () => {
    expect(draftDescription(task({ status: 'queued' }))).toBe('LLM 产出 spec')
  })
})

describe('buildDescription', () => {
  it('counts up while images are still coming', () => {
    expect(buildDescription(task({ status: 'building', assetsDone: 2, assetsTotal: 5 }))).toBe(
      '已出 2/5 张图',
    )
  })

  it('names the vite build once every image has landed', () => {
    expect(buildDescription(task({ status: 'building', assetsDone: 5, assetsTotal: 5 }))).toBe(
      '图片完成，正在 vite 构建',
    )
  })

  it('treats an image-free spec as immediately ready to build', () => {
    expect(buildDescription(task({ status: 'building', assetsDone: 0, assetsTotal: 0 }))).toBe(
      '图片完成，正在 vite 构建',
    )
  })

  it('falls back before the first progress event arrives', () => {
    expect(buildDescription(task({ status: 'building' }))).toBe('生成图片 + vite build')
  })

  it('keeps the partial count on a failed task', () => {
    expect(buildDescription(task({ status: 'failed', assetsDone: 1, assetsTotal: 5 }))).toBe(
      '已出 1/5 张图',
    )
  })

  it('reports the manifest size once the images are done', () => {
    expect(buildDescription(task({ status: 'ready', assetsDone: 5, assetsTotal: 5 }))).toBe(
      '已生成 5 张图',
    )
  })
})

describe('progressLabel', () => {
  it('names the queue before the runner picks the task up', () => {
    expect(progressLabel(task({ status: 'queued' }))).toBe('排队中')
  })

  it('follows the stage', () => {
    expect(progressLabel(task({ status: 'drafting', specAttempts: 1 }))).toBe('第 1 次尝试')
    expect(progressLabel(task({ status: 'building', assetsDone: 1, assetsTotal: 5 }))).toBe(
      '已出 1/5 张图',
    )
    expect(progressLabel(task({ status: 'ready', specAttempts: 1 }))).toBe('完成')
  })

  it('picks the stage a failure happened in without claiming the draft passed', () => {
    expect(progressLabel(task({ status: 'failed', specAttempts: 2 }))).toBe('第 2 次尝试')
    expect(progressLabel(task({ status: 'failed', assetsDone: 1, assetsTotal: 5 }))).toBe(
      '已出 1/5 张图',
    )
  })
})

describe('elapsedLabel', () => {
  it('uses one decimal below a minute', () => {
    expect(elapsedLabel(task({ createdAt: 0, finishedAt: 43_200 }), 99_999)).toBe('43.2s')
    expect(elapsedLabel(task({ createdAt: 0, finishedAt: 59_940 }), 99_999)).toBe('59.9s')
  })

  it('switches to minutes at the boundary', () => {
    expect(elapsedLabel(task({ createdAt: 0, finishedAt: 60_000 }), 99_999)).toBe('1m0s')
    expect(elapsedLabel(task({ createdAt: 0, finishedAt: 297_300 }), 99_999)).toBe('4m57s')
  })

  it('ticks off the clock while the task is still running', () => {
    expect(elapsedLabel(task({ createdAt: 1_000 }), 101_000)).toBe('1m40s')
  })

  it('freezes on the recorded finish', () => {
    // `now` is far past finishedAt; the label must not move.
    expect(elapsedLabel(task({ createdAt: 0, finishedAt: 5_000 }), 900_000)).toBe('5.0s')
  })

  it('never goes negative when the clocks disagree', () => {
    expect(elapsedLabel(task({ createdAt: 10_000 }), 4_000)).toBe('0.0s')
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm --filter @vudt/web test -- taskProgress.test.ts
```

Expected: FAIL —— `../taskProgress.js` 不存在。

- [ ] **Step 3: 实现**

先补 web 侧的投影类型 —— `web/src/api/client.ts` 的 `TaskView`（`:6`）在 `providerCalls?: number` 之后加两行，与 Task 4 加在服务端那份上的**逐字一致**：

```ts
  assetsDone?: number
  assetsTotal?: number
```

然后新建 `web/src/components/taskProgress.ts`：

```ts
import type { TaskView } from '../api/client.js'

/**
 * 视图逻辑放在这里而不是 SFC 里，是为了可测：web 的测试不挂载组件，纯函数才
 * 是能被断言的形状（同 `settingsForm.ts`、`exportRules.ts`）。列表页与详情页
 * 消费同一组函数，所以两屏不可能显示不一致。
 */

/** 0-3，对应模板里渲染的四个步骤：排队 / draft spec / 构建 / 完成。 */
export function currentStep(task: TaskView): number {
  switch (task.status) {
    case 'queued':
      return 0
    case 'drafting':
      return 1
    case 'building':
      return 2
    default:
      return 3
  }
}

export function stepStatus(task: TaskView): 'error' | 'process' {
  return task.status === 'failed' ? 'error' : 'process'
}

/**
 * `specAttempts` 现在是**渐进写**的：drafting 期间它表示「正在第几次」，成功后
 * 表示「第几次成功的」，同一个量。但失败之后它两样都不是 —— 每一次都可能没
 * 通过，所以措辞必须中性，不能声称通过。
 *
 * 不用「`assetsTotal` 在不在」来区分失败发生在哪个阶段：`buildTask` 在
 * maxAssets 超限时抛错，那时 spec 明明已经通过、`assetsTotal` 却仍不存在，
 * 那条推断会说谎。
 */
export function draftDescription(task: TaskView): string {
  if (task.specAttempts === undefined) return 'LLM 产出 spec'
  if (task.status === 'drafting' || task.status === 'failed') return `第 ${task.specAttempts} 次尝试`
  return `第 ${task.specAttempts} 次尝试通过`
}

/**
 * 图片进度。`done === total` 是「图片已跑完」的信号 —— 之后到 vite 启动只隔
 * 一次 assertExpectedAssetsExist（毫秒级），所以这里可以直接改口说 vite。
 *
 * 注意这条是**隐式约定**：哪天在图片与 vite 之间插进一个**长**步骤，这个派生
 * 就会说谎，届时必须补一个真正的阶段字段。
 */
export function buildDescription(task: TaskView): string {
  const { status, assetsDone, assetsTotal } = task
  if (assetsDone === undefined || assetsTotal === undefined) return '生成图片 + vite build'
  if (assetsDone < assetsTotal) return `已出 ${assetsDone}/${assetsTotal} 张图`
  return status === 'building' ? '图片完成，正在 vite 构建' : `已生成 ${assetsTotal} 张图`
}

/** 列表页那一列用的单行摘要：当前阶段 + 走到哪儿了。 */
export function progressLabel(task: TaskView): string {
  switch (task.status) {
    case 'queued':
      return '排队中'
    case 'drafting':
      return draftDescription(task)
    case 'building':
      return buildDescription(task)
    case 'ready':
      return '完成'
    default:
      // 失败：`assetsTotal` 在不在只用来挑**说哪句真话**（图片阶段的进度 vs 中性的
      // 尝试次数），两种措辞都不声称结果 —— 所以这条推断在这里是安全的。
      return task.assetsTotal === undefined ? draftDescription(task) : buildDescription(task)
  }
}

/**
 * 已耗时。起点是 `createdAt` 而不是记录上那个 `startedAt`：排队中的任务因此从
 * **提交时刻**起算，runner 接手时数字不会跳回 0；终态任务显示的数字也与改动前
 * 逐字节相同（现有实现就是 finishedAt - createdAt）。代价是排队时长也算在内 ——
 * 状态那一列已经写着「排队」了。
 */
export function elapsedLabel(task: TaskView, now: number): string {
  const end = task.finishedAt ?? now
  // 浏览器与服务的时钟可能不同步，先夹到 0，免得出现 '-3.2s'。
  const seconds = Math.max(0, end - task.createdAt) / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}m${whole % 60}s`
}
```

- [ ] **Step 4: 跑测试与类型检查确认它绿**

```bash
pnpm --filter @vudt/web test -- taskProgress.test.ts
pnpm --filter @vudt/web typecheck
```

Expected: 两条都 exit 0。**typecheck 是这一步的必跑项** —— `taskProgress.ts` 读 `assetsDone`/`assetsTotal`，而 web 的 `TaskView` 是手写镜像，漏补字段在 vitest 里不会报（vitest 不做类型检查），只有在 typecheck 里才现形。

- [ ] **Step 5: 提交**

```bash
git add web/src/api/client.ts web/src/components/taskProgress.ts web/src/components/__tests__/taskProgress.test.ts
git commit -m "feat(web): extract task progress phrasing into tested functions

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 6: 共享 1s 时钟

**Files:**
- Create: `web/src/composables/useNow.ts`
- Test: `web/src/composables/__tests__/useNow.test.ts`

**Interfaces:**
- Produces: `useNow(active: () => boolean, intervalMs?: number): { now: Ref<number>; stop: () => void }`

- [ ] **Step 1: 写失败的测试**

新建 `web/src/composables/__tests__/useNow.test.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from '../useNow.js'

// 模块级状态在同一个文件里跨用例存活，所以每条用例都必须把自己注册的消费者
// stop 掉，否则下一条的 getTimerCount 会读到上一条留下的定时器。
describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shares one clock between consumers', async () => {
    vi.setSystemTime(1_000)
    const first = useNow(() => true)
    const second = useNow(() => true)

    expect(first.now).toBe(second.now)
    expect(vi.getTimerCount()).toBe(1)

    vi.setSystemTime(1_400)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(first.now.value).toBe(1_400)

    first.stop()
    second.stop()
  })

  it('does not advance while no consumer is active', async () => {
    const idle = useNow(() => false)
    const before = idle.now.value

    vi.setSystemTime(Date.now() + 3_000)
    await vi.advanceTimersByTimeAsync(3_000)

    expect(idle.now.value).toBe(before)
    idle.stop()
  })

  it('clears the interval once every consumer is gone', () => {
    const first = useNow(() => true)
    const second = useNow(() => true)
    expect(vi.getTimerCount()).toBe(1)

    first.stop()
    expect(vi.getTimerCount()).toBe(1)

    second.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})
```

第二条用例断言的是「值没变」而不是某个具体时刻 —— `now` 是模块级的，跨用例带着上一条留下的值，写死数字会互相耦合。

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm --filter @vudt/web test -- useNow.test.ts
```

Expected: FAIL —— `../useNow.js` 不存在。

- [ ] **Step 3: 实现**

新建 `web/src/composables/useNow.ts`：

```ts
import { onUnmounted, ref, type Ref } from 'vue'

const DEFAULT_INTERVAL_MS = 1000

/**
 * 全应用一个时钟。列表页有 N 行，每行一个 setInterval 就是 N 个定时器；这里
 * 只留一个，靠一张注册表把各消费者的 active 断言收在一起。
 */
const now = ref(Date.now())
const consumers = new Set<() => boolean>()
let timer: ReturnType<typeof setInterval> | undefined

/** 只要还有**任一**消费者 active 就推进；全不 active 时空转不写，不触发重渲染。 */
function tick(): void {
  for (const active of consumers) {
    if (active()) {
      now.value = Date.now()
      return
    }
  }
}

export interface UseNow {
  /** 共享的当前时刻（毫秒）。 */
  now: Ref<number>
  /** 注销本消费者；最后一个注销时定时器被清掉。 */
  stop: () => void
}

/**
 * 消费这个时钟。`active` 每次都重新求值 —— 传一个闭包即可，不必是响应式的。
 *
 * 间隔由**第一个**消费者决定，后来的沿用同一个定时器。
 */
export function useNow(active: () => boolean, intervalMs = DEFAULT_INTERVAL_MS): UseNow {
  consumers.add(active)
  timer ??= setInterval(tick, intervalMs)

  let stopped = false
  function stop(): void {
    if (stopped) return
    stopped = true
    consumers.delete(active)
    if (consumers.size === 0 && timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  onUnmounted(stop)
  return { now, stop }
}
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm --filter @vudt/web test -- useNow.test.ts
```

Expected: PASS。`onUnmounted` 在组件之外会打一条 `[Vue warn]`（该文件里 `useTaskPolling.test.ts` 早就在打同一条），不影响结果。

- [ ] **Step 5: 提交**

```bash
git add web/src/composables/useNow.ts web/src/composables/__tests__/useNow.test.ts
git commit -m "feat(web): add a shared second clock for running tasks

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 7: 两页接线

**Files:**
- Modify: `web/src/components/TaskSteps.vue`（全文替换 `<script setup>`）
- Modify: `web/src/views/TaskList.vue`

**Interfaces:**
- Consumes: Task 5 的六个纯函数、Task 6 的 `useNow`
- Produces: 无（叶子）

**用户提交后停在列表页**（`TaskList.vue:38-45` 的 `onSubmit` 只清空输入框、不跳转），所以列表页那一列才是这个 bug 的主战场。

- [ ] **Step 1: 改 `TaskSteps.vue`**

把 `web/src/components/TaskSteps.vue` 的整个 `<script setup>` 块（第 1-42 行）替换为：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { ACTIVE_STATUSES } from '../api/client.js'
import type { TaskView } from '../api/client.js'
import { useNow } from '../composables/useNow.js'
import {
  buildDescription,
  currentStep,
  draftDescription,
  elapsedLabel,
  stepStatus,
} from './taskProgress.js'

const props = defineProps<{ task: TaskView }>()

// 终态任务不再走表：这是「无残留定时器」那条纪律在页面上的落点。
const { now } = useNow(() => ACTIVE_STATUSES.includes(props.task.status))

const step = computed(() => currentStep(props.task))
const status = computed(() => stepStatus(props.task))
const draftText = computed(() => draftDescription(props.task))
const buildText = computed(() => buildDescription(props.task))
const elapsed = computed(() => elapsedLabel(props.task, now.value))
</script>
```

模板里把绑定换名（其余一个字不动）：`:current="currentStep"` → `:current="step"`、`:status="status"` 保持不变、`:description="draftDescription"` → `:description="draftText"`、`:description="buildDescription"` → `:description="buildText"`、`:description="elapsed"` 保持不变。

`<template>` 段最终应为：

```vue
<template>
  <a-space direction="vertical" size="middle" style="width: 100%">
    <a-steps :current="step" :status="status" size="small">
      <a-step title="排队" />
      <a-step title="draft spec" :description="draftText" />
      <a-step title="构建" :description="buildText" />
      <a-step title="完成" :description="elapsed" />
    </a-steps>

    <a-alert
      v-if="task.error !== undefined"
      type="error"
      show-icon
      :message="task.error.message"
      :description="task.error.detail"
    />
  </a-space>
</template>
```

- [ ] **Step 2: 改 `TaskList.vue`**

顶部 import 改成：

```ts
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskList } from '../composables/useTaskList.js'
import { ACTIVE_STATUSES } from '../api/client.js'
import type { TaskStatus, TaskView } from '../api/client.js'
import { useNow } from '../composables/useNow.js'
import { elapsedLabel, progressLabel } from '../components/taskProgress.js'
```

在 `const { tasks, loading, error, start, submit } = useTaskList()` 之后加：

```ts
// 全表 N 行共用这一个时钟；全是终态任务时它不推进，也就不会重渲染。
const { now } = useNow(() => tasks.value.some((task) => ACTIVE_STATUSES.includes(task.status)))

function progressText(task: TaskView): string {
  return progressLabel(task)
}

function elapsedText(task: TaskView): string {
  return elapsedLabel(task, now.value)
}
```

`columns` 里在「状态」之后插入一列（「图片调用」列**保留不动** —— 它是最终成本指标，与进度不同义）：

```ts
const columns = [
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '进度', key: 'progress', width: 220 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '图片调用', dataIndex: 'providerCalls', key: 'providerCalls', width: 100 },
  { title: '', key: 'actions', width: 100 },
]
```

`#bodyCell` 里在 `status` 分支之后插入：

```vue
          <template v-else-if="column.key === 'progress'">
            {{ progressText(record) }}
            <span class="task-list__elapsed">{{ elapsedText(record) }}</span>
          </template>
```

并在文件末尾（`</template>` 之后）加一个 scoped 样式块：

```vue
<style scoped>
.task-list__elapsed {
  margin-left: 8px;
  color: rgba(0, 0, 0, 0.45);
}
</style>
```

- [ ] **Step 3: 跑 web 全包测试与类型检查**

```bash
pnpm --filter @vudt/web test
pnpm --filter @vudt/web typecheck
```

Expected: 两条都 exit 0。测试数不变（本步不加测试，纯接线；逻辑已经在 Task 5/6 测过）—— 由 Task 8 的全仓回归兜底。

- [ ] **Step 4: 提交**

```bash
git add web/src/components/TaskSteps.vue web/src/views/TaskList.vue
git commit -m "feat(web): show live progress on the list and detail pages

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 8: 全仓回归 + 真任务手验

**Files:** 无（本任务不改代码；发现缺陷就回到对应任务修，再回来重跑）

- [ ] **Step 1: 全仓测试**

```bash
pnpm -r test 2>&1 | tail -n 40
```

Expected: exit 0。**硬性要求只有一条：每个包的用例数不减、全绿。** 已知会变的三个包：

| 包 | 基线 | 期望 |
|---|---|---|
| imagegen | 4 / 29 | 4 / 31（Task 1 加 2 条） |
| build | 4 / 25 | 4 / 26（Task 2 加 1 条） |
| server | 10 / 111 | 10 / 113（Task 4 加 2 条；那条扩写的失败用例不算新例） |
| web | 6 / 48 | 6→8 文件、48→75 例（Task 5 的 `taskProgress.test.ts` 24 条 + Task 6 的 `useNow.test.ts` 3 条） |

其余四包（spec 2/13、blocks 6/93、codegen 6/60、providers 3/51）**一个数字都不该动**。web 那 24 条是把 `taskProgress.test.ts` 里每个 `it` 逐个数出来的 —— 若实际输出与它不符，**先查是不是少写了一条**，不要顺手改上表。把实际数字记进 ledger。

- [ ] **Step 2: 全仓类型检查**

```bash
pnpm -r typecheck 2>&1 | tail -n 20
```

Expected: exit 0，`Scope: 9 of 10 workspace projects`。

- [ ] **Step 3: 反证 —— 先确认这条 bug 曾经真实存在**

在改动**之后**，用一个能复现旧行为的方式确认新行为确实是新的：起服务（见 Step 4），提交一条描述，在 drafting 期间每 5 秒 `curl` 一次 `GET /tasks/:id`，把两次响应存盘再 `diff`：

```bash
curl -s localhost:4300/tasks/<id> -o "$CLAUDE_JOB_DIR/tmp/t1.json"
# 5 秒后再来一次
curl -s localhost:4300/tasks/<id> -o "$CLAUDE_JOB_DIR/tmp/t2.json"
diff "$CLAUDE_JOB_DIR/tmp/t1.json" "$CLAUDE_JOB_DIR/tmp/t2.json"
```

Expected: **必须有差异**。改动之前这条 diff 是空的（原始证据：130 秒里响应体逐字节相同）—— 空 diff 就说明修了等于没修。

- [ ] **Step 4: 真任务手验（本次的核心验收）**

`server/.env` 已有真 key。**必须从仓库根起服务**（cwd 有五处依赖，起错会静默跌回默认模型 → 中转站 503）；设置文件随之落在 `<根>/.vudt/settings.json`。

```bash
cd /d/zw/vue-ui-design-template
pnpm --filter @vudt/server dev
```

浏览器开 `http://localhost:4300`（4300 上可能还挂着你自己的旧进程，先确认端口是谁的），依次确认：

1. **停在列表页**（不要点进详情）提交一条描述，看「进度」列在动：`排队中` → `第 1 次尝试` → `已出 0/N 张图` → … → `图片完成，正在 vite 构建` → `完成`，且**已耗时每秒钟在走**。
2. 点进详情页，四个步骤的描述与列表页**一致地**变化；任务结束后已耗时**冻结**不再动。
3. 失败路径：故意把 `.vudt/settings.json` 的 model 改错（或让图片模型指向一个不存在的名字）触发失败，确认部分进度（`已出 k/N 张图`）仍显示，且 error alert 正常。

- [ ] **Step 5: 记录**

把 Step 1 的实际每包数字、Step 3 的 diff 结果、Step 4 的三条观察写进 `.superpowers/sdd/2026-09-23-progress-visibility/progress.md`。**本任务不提交**（它的交付物是确认，不是改动）。

---

## 验收标准（整支）

1. `pnpm -r test` 全绿且每个包的用例数**不减**；`pnpm -r typecheck` exit 0。
2. 真任务上，drafting 与 building 期间**相邻两次** `GET /tasks/:id` 的响应体**不同**（Step 3 的 diff 非空）。
3. 停在**列表页**就能看到进度在动、已耗时在走；详情页与列表页的措辞一致。
4. 失败任务的部分进度仍可见，且 `draftDescription` 不会对失败任务说「通过」。
5. `packages/spec`、`packages/codegen`、`packages/templates` 零改动（`git diff --stat` 核对）。

**为什么验收必须包含真任务**：这条 bug 的教训正是「单元测试全绿而产品是坏的」—— 前端被测试证明正确的同时，整条链在真任务上纹丝不动。只跑全仓测试不足以声称修好了。
