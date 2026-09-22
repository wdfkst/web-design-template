# draft 阶段改为派生 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让生产链路走派生路径——模型只输出 draft（选块 + 写主体文字），几何与 asset id 全部由 `derivePageAssets` 从侧车派生，并把 draft 的 JSON 形状与全部枚举写进 prompt。

**Architecture:** 新增 `packages/templates/blocks/src/draft.ts`（`ProjectDraftSchema` + `deriveSpecInput`），它是唯一把 draft 变成 spec 的地方，与 `derivePageAssets` 同包（spec 不能反向依赖 blocks）。`server/src/spec-source.ts` 的重试循环保持原样，中间换成两道闸：`deriveSpecInput`（形状 + 派生）→ `parseProjectSpecInput`（route 唯一性等 spec 级校验）。drafter 的 prompt 从「写完整 spec」改为「写 draft」，并逐个列全枚举、props 与 slot。

**Tech Stack:** TypeScript（ESM、NodeNext、`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax`）、Zod 4、Vitest 3、pnpm workspace。

**Spec:** `docs/superpowers/specs/2026-09-21-spec-derivation-design.md`

## Global Constraints

- **仓库不是 git 仓库**（`git rev-parse --is-inside-work-tree` 报 fatal）。因此**所有任务的 "Commit" 步骤都跳过**，改为「跑全仓测试确认绿」。不要 `git init`。
- 全仓测试命令：仓库根目录 `npx vitest run`（当前 36 文件 / 333 例：331 绿 + 2 红，两红是 Task 4 要改写的那两个）。单文件：`npx vitest run <path>`，单例加 `-t "<测试名>"`。
- 单包 typecheck：`pnpm --filter @vudt/<pkg> typecheck`；全仓 `pnpm -r typecheck`。
- **几何只来自侧车**（`derive.ts` 的核心不变量）：LLM 只能写 `prompt`/`alt`，不得放宽这条。不要在任何测试或 fixture 里手写 `renderSize`/`aspectRatio`/`transparent`/`composition`。
- 严格 TS 三条实测影响写法：可选属性用**条件展开**（照 `runner.ts:71` 的 `...(x === undefined ? {} : { x })`）、数组下标访问要 `!`、纯类型导入必须 `import type`。
- 注释与 commit message 用英文，与仓库现有风格一致；注释解释**为什么**，不复述代码。
- 读文件超过 200 行必须分段（`sed -n 'a,bp'`），命令输出加 `| head -n 100`。
- 不改 `SpecDrafter` 接口签名（providers 与 server 各有一份刻意重复的声明，两份都不动）。
- 不引新的运行时依赖。

---

## File Structure

**新建**

| 文件 | 职责 |
|---|---|
| `packages/templates/blocks/src/draft.ts` | `ProjectDraftSchema`（模型的输出形状）、`deriveSpecInput()`（唯一把 draft 变成 `ProjectSpecInput` 的函数）。与 `derivePageAssets` 同住，因为 spec 不能反向依赖 blocks。 |
| `packages/templates/blocks/src/__tests__/draft.test.ts` | 形状拒绝 + 派生成功的单元测试。 |
| `packages/templates/blocks/src/__tests__/sfc-props.test.ts` | 侧车 `props` 键集合与 SFC `defineProps` 名集合的对齐守卫（照 `sfc-geometry.test.ts` 的做法）。 |

**修改**

| 文件 | 改什么 |
|---|---|
| `packages/templates/blocks/src/slot.ts:26-33` | `BlockDefinition` 加 `props: Readonly<Record<string, string>>` |
| `packages/templates/blocks/src/blocks/*.slots.ts`（7 个） | 各加一行 `props`，值抄自对应 SFC 的 `defineProps` |
| `packages/templates/blocks/src/derive.ts:2,60-65` | 未知组件错误文本补上合法组件清单 |
| `packages/templates/blocks/src/index.ts` | 导出 `draft.js` |
| `packages/templates/blocks/src/__tests__/derive.test.ts:79-99` | 补一条「错误里点名合法组件」 |
| `packages/providers/src/openai-spec-drafter.ts:28-60` | catalogue 加 props 段；`systemPrompt()` 写全 draft 形状与全部枚举 |
| `packages/providers/src/__tests__/openai-spec-drafter.test.ts:1-10,63-82,157-225` | 两个 RED 测试按 draft 形状改写；补一条 props 渲染断言 |
| `server/src/spec-source.ts:1,39-52` | 循环体换成两道闸 |
| `server/src/__tests__/fixture.ts:1,8-60` | `landingSpecInput()` → `landingDraft()`，返回 draft |
| `server/src/__tests__/spec-source.test.ts` | fixture 改名；作废几何测试，换成未知 slot / 重复 route 两条 |
| `server/src/__tests__/spec-view.test.ts:1-9` | 走 `deriveSpecInput` 拿 spec |
| `server/src/__tests__/app.test.ts:16-17,53,158,188,450,478,502` | fixture 改名（纯机械替换） |

## Task 顺序理由

先做 blocks 包的叶子（错误文本、props 侧车），再做 `draft.ts`（新链路的核心），再做 prompt（它要渲染 Task 2 加的 props），最后才动物 server 的接线与 fixture。

Task 3 结束时 `providers` 的两个测试会**变绿**（它们是按 draft 形状改写的）；Task 4 之前 server 仍按旧 spec 形状消费——这中间存在一个「prompt 说 draft、server 期望 spec」的短暂不一致窗口，**这是刻意的**：两个任务各自独立可测，真实端到端只在 Task 6 跑一次。不要为了让中间态「也能跑」而把两个任务合并。

---

### Task 1: 未知组件的错误文本补上合法组件清单

**Files:**
- Modify: `packages/templates/blocks/src/derive.ts:2`（import）、`:60-65`（错误文本）
- Test: `packages/templates/blocks/src/__tests__/derive.test.ts:79-83` 之后

**Interfaces:**
- Consumes: `listBlockComponents()`（`packages/templates/blocks/src/registry.ts:29`，返回按名字排序的组件名数组）
- Produces: 无新符号。错误文本变为 `unknown block component "X" on route "/" (available: CtaBanner, …)`，Task 3 的 `deriveSpecInput` 直接把这条 message 当 feedback 回喂模型。

- [ ] **Step 1: 写失败测试**

在 `derive.test.ts` 的 `it('rejects an unknown component', …)` 之后插入：

```ts
  // The feedback goes back to the model verbatim, so it has to name the legal
  // set — same reason the slot error lists the declared slots.
  it('names the available components in the error to help the retry prompt', () => {
    expect(() => derivePageAssets('/', [{ component: 'MadeUpBlock' }])).toThrow(
      /MadeUpBlock.*available: CtaBanner, EmptyStatePanel, FeatureTriad, FooterSimple, HeroCentered, HeroSplit, NavBarSimple/,
    )
  })
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run packages/templates/blocks/src/__tests__/derive.test.ts -t "names the available components"`
Expected: FAIL — 实际 message 是 `unknown block component "MadeUpBlock" on route "/"`，不含 `available:`。

- [ ] **Step 3: 实现**

`derive.ts:2` 的 import 改为：

```ts
import { getBlockDefinition, listBlockComponents } from './registry.js'
```

`derive.ts:60-65` 的错误改为：

```ts
    const definition = getBlockDefinition(selection.component)
    if (!definition) {
      throw new BlockDerivationError(
        `unknown block component "${selection.component}" on route "${route}"` +
          ` (available: ${listBlockComponents().join(', ')})`,
      )
    }
```

- [ ] **Step 4: 跑测试确认它通过**

Run: `npx vitest run packages/templates/blocks/src/__tests__/derive.test.ts`
Expected: PASS，该文件全绿（含既有的 `rejects an unknown component`，它只断言抛 `BlockDerivationError`）。

- [ ] **Step 5: 全仓确认绿（仓库非 git，不提交）**

Run: `npx vitest run 2>&1 | tail -n 5`
Expected: `36 passed` 之外仍只有那 2 个已知红灯（providers 的那两个），无新增失败。

---

### Task 2: 侧车声明 props，并加 SFC 对齐守卫

**Files:**
- Modify: `packages/templates/blocks/src/slot.ts:26-33`
- Modify: `packages/templates/blocks/src/blocks/nav-bar-simple.slots.ts`、`hero-split.slots.ts`、`hero-centered.slots.ts`、`feature-triad.slots.ts`、`cta-banner.slots.ts`、`empty-state-panel.slots.ts`、`footer-simple.slots.ts`
- Test: `packages/templates/blocks/src/__tests__/sfc-props.test.ts`（新建）

**Interfaces:**
- Consumes: 无（叶子任务）
- Produces:
  ```ts
  interface BlockDefinition {
    component: string
    pageTypes: readonly string[]
    props: Readonly<Record<string, string>>   // 新增：prop 名 -> 形状注记，永不含 'assets'
    slots: readonly SlotSpec[]
  }
  ```
  Task 3 的 prompt 渲染依赖 `definition.props` 的键与值。

- [ ] **Step 1: 写失败测试**

新建 `packages/templates/blocks/src/__tests__/sfc-props.test.ts`：

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BLOCK_REGISTRY } from '../registry.js'

const templateBlocksDir = fileURLToPath(new URL('../../../vue3-base/src/blocks/', import.meta.url))

function readSfc(component: string): string {
  return readFileSync(`${templateBlocksDir}${component}.vue`, 'utf8')
}

/**
 * Prop names out of the one `defineProps<{ … }>()` literal every block declares.
 * `assets` is filtered out: the code generator injects it from the block's
 * `assetBindings`, so the model must never be asked for it.
 */
function extractPropNames(sfc: string): string[] {
  const block = /defineProps<\{([\s\S]*?)\}>\(\)/.exec(sfc)
  expect(block, 'SFC has no defineProps<{ … }>() literal').not.toBeNull()
  return (block![1]!.match(/^\s{4}(\w+)\??:/gm) ?? [])
    .map((line) => line.trim().replace(/\??:$/, ''))
    .filter((name) => name !== 'assets')
}

/**
 * Without this, renaming a prop in an SFC would leave the prompt advertising a
 * key the component no longer accepts — the model's copy then lands nowhere and
 * the page renders empty text, which nothing else in the pipeline would catch.
 */
describe('sidecar props match the props their components accept', () => {
  for (const definition of BLOCK_REGISTRY.values()) {
    it(`${definition.component} declares exactly the props its SFC accepts`, () => {
      const fromSfc = extractPropNames(readSfc(definition.component))
      expect(Object.keys(definition.props).sort()).toEqual([...fromSfc].sort())
    })
  }

  it('never asks the model for the injected assets prop', () => {
    for (const definition of BLOCK_REGISTRY.values()) {
      expect(definition.props).not.toHaveProperty('assets')
    }
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run packages/templates/blocks/src/__tests__/sfc-props.test.ts`
Expected: FAIL — `definition.props` 还不存在，`Object.keys(undefined)` 抛 `TypeError`。

- [ ] **Step 3: 实现**

`slot.ts` 的 `BlockDefinition` 加字段（放在 `pageTypes` 与 `slots` 之间）：

```ts
  /**
   * Props the LLM may set, as `name -> shape note`. A list or object prop carries
   * its shape in the note: `BlockSchema.props` is validated as `unknown`, so a
   * wrong shape only shows up as empty markup in the preview. `assets` is absent
   * on purpose — the code generator injects it from `assetBindings`.
   */
  props: Readonly<Record<string, string>>
```

七个侧车各加一行 `props`（插在 `pageTypes` 之后、`slots` 之前），值逐字抄自 `packages/templates/vue3-base/src/blocks/<Component>.vue` 的 `defineProps`：

```ts
// nav-bar-simple.slots.ts
  props: { brand: 'string', links: '{ label, to }[]', ctaLabel: 'string' },
// hero-split.slots.ts
  props: { headline: 'string', subhead: 'string', primaryCta: 'string', secondaryCta: 'string' },
// hero-centered.slots.ts
  props: { headline: 'string', subhead: 'string', primaryCta: 'string' },
// feature-triad.slots.ts
  props: { heading: 'string', features: '{ title, body }[]' },
// cta-banner.slots.ts
  props: { headline: 'string', body: 'string', ctaLabel: 'string' },
// empty-state-panel.slots.ts
  props: { headline: 'string', body: 'string', ctaLabel: 'string' },
// footer-simple.slots.ts
  props: { brand: 'string', note: 'string' },
```

若测试报某个组件名字对不上，**改侧车去对齐 SFC**，不要改测试的提取正则——SFC 是 props 的真值来源。

- [ ] **Step 4: 跑测试确认它通过**

Run: `npx vitest run packages/templates/blocks/src/__tests__/sfc-props.test.ts`
Expected: PASS，8 例（7 个组件 + 1 条 assets 断言）。

- [ ] **Step 5: 跑 blocks 包全量确认没弄坏别的**

Run: `npx vitest run packages/templates/blocks 2>&1 | tail -n 5`
Expected: 全绿（`registry.test.ts` 全走遍历，不受新字段影响）。

- [ ] **Step 6: 全仓确认绿（不提交）**

Run: `npx vitest run 2>&1 | tail -n 5`
Expected: 仍只有那 2 个已知红灯。

---

### Task 3: `draft.ts`——draft 形状与 `deriveSpecInput`

**Files:**
- Create: `packages/templates/blocks/src/draft.ts`
- Create: `packages/templates/blocks/src/__tests__/draft.test.ts`
- Modify: `packages/templates/blocks/src/index.ts`

**Interfaces:**
- Consumes: `derivePageAssets(route, selections)` / `mergeDerivedAssets(parts)` / `BlockDerivationError`（`derive.js`）、`SlotContentSchema` / `SlotContent`（`slot.js`）、`BlockSchema` / `PageSchema` / `PageTypeSchema` / `MetaSchema` / `ThemeSchema` / `StyleBibleSchema` / `formatIssues` / `ProjectSpecInput`（`@vudt/spec`）
- Produces（Task 4、5 依赖）:
  ```ts
  const ProjectDraftSchema: z.ZodObject<…>
  type ProjectDraft = z.infer<typeof ProjectDraftSchema>
  type DeriveSpecResult =
    | { ok: true; value: ProjectSpecInput }
    | { ok: false; feedback: string }
  function deriveSpecInput(draft: unknown): DeriveSpecResult
  ```

- [ ] **Step 1: 写失败测试**

新建 `packages/templates/blocks/src/__tests__/draft.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { parseProjectSpecInput } from '@vudt/spec'
import { deriveSpecInput } from '../draft.js'
import { HeroSplit } from '../registry.js'

const theme = {
  colorTokens: {
    primary: '#4f46e5',
    secondary: '#0ea5e9',
    accent: '#f59e0b',
    background: '#ffffff',
    surface: '#f8fafc',
    foreground: '#0f172a',
    muted: '#64748b',
  },
  radius: 'lg',
  spacing: 'normal',
  fontPair: { heading: 'Inter', body: 'Inter' },
  mode: 'light',
} as const

const styleBible = {
  artStyle: 'flat-vector',
  lineWeight: 'none',
  shading: 'flat',
  perspective: 'front',
  palette: ['#4f46e5', '#0ea5e9'],
  backgroundTreatment: 'solid',
  negativePrompt: 'no text',
  seed: 7,
} as const

/** What the model is expected to send: blocks carry subject text, not geometry. */
function landingDraft(pages?: unknown): Record<string, unknown> {
  return {
    meta: { name: 'Acme', description: 'A landing page for Acme', targetStack: 'vue3' },
    theme,
    styleBible,
    pages: pages ?? [
      {
        route: '/',
        title: 'Home',
        pageType: 'landing',
        blocks: [
          { component: 'NavBarSimple', props: { brand: 'Acme' } },
          {
            component: 'HeroSplit',
            content: { illustration: { prompt: 'a developer at a desk', alt: 'Developer at a desk' } },
          },
          { component: 'FooterSimple', props: { brand: 'Acme', note: '(c) 2026' } },
        ],
      },
    ],
  }
}

function okValue(result: ReturnType<typeof deriveSpecInput>) {
  if (!result.ok) throw new Error(`expected a derived spec, got: ${result.feedback}`)
  return result.value
}

function failureOf(result: ReturnType<typeof deriveSpecInput>): string {
  if (result.ok) throw new Error('expected a failure')
  return result.feedback
}

describe('deriveSpecInput', () => {
  it('turns a draft into a spec the spec schema accepts', () => {
    const value = okValue(deriveSpecInput(landingDraft()))

    expect(parseProjectSpecInput(value).ok).toBe(true)
  })

  it('binds every slot and takes its geometry from the sidecar', () => {
    const value = okValue(deriveSpecInput(landingDraft()))
    const illustration = HeroSplit.slots[0]!

    // Only HeroSplit has slots, so the draft's three blocks yield one asset.
    expect(value.assets).toHaveLength(1)
    expect(value.assets[0]!.id).toBe(value.pages[0]!.blocks[1]!.assetBindings.illustration)
    expect(value.assets[0]!.renderSize).toEqual(illustration.renderSize)
    expect(value.assets[0]!.aspectRatio).toBe(illustration.aspectRatio)
  })

  it('carries the subject text the model wrote', () => {
    const value = okValue(deriveSpecInput(landingDraft()))

    expect(value.assets[0]!.prompt).toBe('a developer at a desk')
    expect(value.assets[0]!.alt).toBe('Developer at a desk')
  })

  it('falls back to the sidecar default when a slot is left out', () => {
    const value = okValue(
      deriveSpecInput(
        landingDraft([
          {
            route: '/',
            title: 'Home',
            pageType: 'landing',
            blocks: [{ component: 'HeroSplit' }],
          },
        ]),
      ),
    )

    expect(value.assets[0]!.prompt).toBe(HeroSplit.slots[0]!.defaultPrompt)
    expect(value.assets[0]!.alt).toBe(HeroSplit.slots[0]!.defaultAlt)
  })

  it('reports path-prefixed feedback when the draft shape is wrong', () => {
    const { theme: _omitted, ...withoutTheme } = landingDraft()

    const feedback = failureOf(deriveSpecInput(withoutTheme))

    // Gate 1's message is fed straight back to the model, so it has to name the path.
    expect(feedback).toMatch(/^theme: /m)
  })

  it('names the declared slots when the draft invents one', () => {
    const feedback = failureOf(
      deriveSpecInput(
        landingDraft([
          {
            route: '/',
            title: 'Home',
            pageType: 'landing',
            blocks: [{ component: 'HeroSplit', content: { banner: { prompt: 'anything' } } }],
          },
        ]),
      ),
    )

    expect(feedback).toMatch(/has no slot "banner"/)
    expect(feedback).toMatch(/illustration/)
  })

  it('names the available components when the draft picks an unknown one', () => {
    const feedback = failureOf(
      deriveSpecInput(
        landingDraft([
          { route: '/', title: 'Home', pageType: 'landing', blocks: [{ component: 'MadeUpBlock' }] },
        ]),
      ),
    )

    expect(feedback).toMatch(/available: .*HeroSplit/)
  })

  it('rejects two pages that derive the same asset id', () => {
    const page = {
      route: '/',
      title: 'Home',
      pageType: 'landing',
      blocks: [{ component: 'HeroSplit' }],
    }

    const feedback = failureOf(deriveSpecInput(landingDraft([page, page])))

    expect(feedback).toMatch(/duplicate derived asset id/)
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run packages/templates/blocks/src/__tests__/draft.test.ts`
Expected: FAIL — `Failed to resolve import "../draft.js"`。

- [ ] **Step 3: 实现**

新建 `packages/templates/blocks/src/draft.ts`：

```ts
import {
  BlockSchema,
  MetaSchema,
  PageSchema,
  PageTypeSchema,
  StyleBibleSchema,
  ThemeSchema,
  formatIssues,
  type ProjectSpecInput,
} from '@vudt/spec'
import { z } from 'zod'
import {
  BlockDerivationError,
  derivePageAssets,
  mergeDerivedAssets,
  type BlockSelection,
} from './derive.js'
import { SlotContentSchema } from './slot.js'

const DraftBlockSchema = z.object({
  component: BlockSchema.shape.component,
  props: BlockSchema.shape.props,
  /** Subject text per slot name. Geometry cannot be written here by design. */
  content: z.record(z.string(), SlotContentSchema).optional(),
})

const DraftPageSchema = z.object({
  route: PageSchema.shape.route,
  title: PageSchema.shape.title,
  pageType: PageTypeSchema,
  blocks: z.array(DraftBlockSchema).min(1),
})

/**
 * What the drafter returns. Identical to a spec except that a block carries
 * subject text (`content`) instead of `assetBindings`, and there is no `assets`
 * array: both are derived from the block sidecars, never written by the model.
 * The spec's own schema pieces are reused so the two shapes cannot drift apart.
 */
export const ProjectDraftSchema = z.object({
  meta: MetaSchema,
  theme: ThemeSchema,
  styleBible: StyleBibleSchema,
  pages: z.array(DraftPageSchema).min(1),
})

export type ProjectDraft = z.infer<typeof ProjectDraftSchema>

export type DeriveSpecResult =
  | { ok: true; value: ProjectSpecInput }
  | { ok: false; feedback: string }

function toSelection(block: ProjectDraft['pages'][number]['blocks'][number]): BlockSelection {
  return {
    component: block.component,
    props: block.props,
    ...(block.content === undefined ? {} : { content: block.content }),
  }
}

/**
 * The one place a draft becomes a spec.
 *
 * Geometry and asset ids come from `derivePageAssets`, so a draft can only be
 * wrong about the blocks it picked and the words it wrote — never about the
 * shape of an image. Every failure is returned as text the retry prompt can
 * carry verbatim.
 */
export function deriveSpecInput(draft: unknown): DeriveSpecResult {
  const parsed = ProjectDraftSchema.safeParse(draft)
  if (!parsed.success) return { ok: false, feedback: formatIssues(parsed.error.issues) }

  const { meta, theme, styleBible, pages } = parsed.data

  try {
    const derivations = pages.map((page) => ({
      page,
      derived: derivePageAssets(page.route, page.blocks.map(toSelection)),
    }))
    const assets = mergeDerivedAssets(derivations.map((entry) => entry.derived))

    return {
      ok: true,
      value: {
        meta,
        theme,
        styleBible,
        pages: derivations.map(({ page, derived }) => ({
          route: page.route,
          title: page.title,
          pageType: page.pageType,
          blocks: derived.blocks,
        })),
        assets,
      },
    }
  } catch (error) {
    // The derivation errors already name the offending block, slot or route.
    if (error instanceof BlockDerivationError) return { ok: false, feedback: error.message }
    throw error
  }
}
```

`index.ts` 加一行（放在 `derive.js` 之后）：

```ts
export * from './draft.js'
```

- [ ] **Step 4: 跑测试确认它通过**

Run: `npx vitest run packages/templates/blocks/src/__tests__/draft.test.ts`
Expected: PASS，8 例。

- [ ] **Step 5: typecheck 该包**

Run: `pnpm --filter @vudt/blocks typecheck`
Expected: 无输出（成功）。若报 `ProjectSpecInput` 赋值错误，检查 `pages[].blocks` 用的是 `derived.blocks` 而不是 draft 的块。

- [ ] **Step 6: 全仓确认绿（不提交）**

Run: `npx vitest run 2>&1 | tail -n 5`
Expected: 仍只有那 2 个已知红灯。

---

### Task 4: prompt 写全 draft 形状、枚举与 props

**Files:**
- Modify: `packages/providers/src/openai-spec-drafter.ts:28-60`
- Test: `packages/providers/src/__tests__/openai-spec-drafter.test.ts:1-10`（import）、`:63-82`（`schemaEnumValues`）、`:157-225`（两个 RED 测试）

**Interfaces:**
- Consumes: `definition.props`（Task 2）、`BLOCK_REGISTRY`（`@vudt/blocks`）
- Produces: 无新符号。改完后本文件那两个红灯转绿，全仓回到全绿。

**背景**：这两个测试是按已被否掉的「只补 prompt 文档」方案写的，断言的是**完整 spec** 的枚举与键名。走派生路线后模型不再写 `assets`，所以两条断言的清单都要收缩。

- [ ] **Step 1: 改测试（先让它按新形状变红）**

`openai-spec-drafter.test.ts:3-10` 的 import 改为（去掉三个不再需要的符号）：

```ts
import { listBlockComponents } from '@vudt/blocks'
import { PageTypeSchema, StyleBibleSchema, ThemeSchema } from '@vudt/spec'
```

`schemaEnumValues()`（`:67-82`）改为只列**模型仍要写的**枚举：

```ts
function schemaEnumValues(): string[] {
  const enums: (readonly string[])[] = [
    ThemeSchema.shape.mode.options,
    ThemeSchema.shape.radius.options,
    ThemeSchema.shape.spacing.options,
    StyleBibleSchema.shape.artStyle.options,
    StyleBibleSchema.shape.lineWeight.options,
    StyleBibleSchema.shape.shading.options,
    StyleBibleSchema.shape.perspective.options,
    StyleBibleSchema.shape.backgroundTreatment.options,
    PageTypeSchema.options,
  ]
  return enums.flat()
}
```

`names every key the model has to emit`（`:192-225`）的 `keys` 数组改为 draft 的键（**加 `content`，去掉 `assets`/`id`/`purpose`/`aspectRatio`/`renderSize`/`w`/`h`/`transparent`/`composition`**）：

```ts
    const keys = [
      'meta',
      'name',
      'description',
      'targetStack',
      'theme',
      'colorTokens',
      'primary',
      'secondary',
      'accent',
      'background',
      'surface',
      'foreground',
      'muted',
      'radius',
      'spacing',
      'fontPair',
      'heading',
      'body',
      'mode',
      'styleBible',
      'artStyle',
      'lineWeight',
      'shading',
      'perspective',
      'palette',
      'backgroundTreatment',
      'negativePrompt',
      'seed',
      'pages',
      'route',
      'title',
      'pageType',
      'blocks',
      'component',
      'props',
      'content',
      'prompt',
      'alt',
    ]
```

在同一 describe 里补一条 props 渲染的断言（放在 `lists the legal slot names for each block …` 之后）：

```ts
  test('documents each block\'s props from the sidecar so copy lands in the right keys', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    // Props are validated as `unknown`, so a wrong key is not an error — it just
    // renders nothing. The prompt is the only place the model can learn them.
    expect(system).toMatch(/HeroSplit[^\n]*headline \(string\)[^\n]*secondaryCta/)
    expect(system).toMatch(/FeatureTriad[^\n]*features \(\{ title, body \}\[\]\)/)
  })
```

保留不动的两条：`tells the model geometry comes from the sidecar, not from it`（断言 prompt 里出现 `renderSize` 与 `aspectRatio`）与 `lists the legal slot names for each block`（断言 `/HeroSplit[^\n]*illustration/`）。**新 prompt 必须继续满足它们。**

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run packages/providers/src/__tests__/openai-spec-drafter.test.ts`
Expected: FAIL —— 三条新断言都红：枚举缺 6 个值（`pageType` 的 6 个值本来就缺）、键名缺 `content` 等、props 行不存在。

- [ ] **Step 3: 实现**

`renderBlockCatalogue()`（`:33-40`）改为同时渲染 props：

```ts
function renderBlockCatalogue(): string {
  const lines: string[] = []
  for (const component of [...BLOCK_REGISTRY.keys()].sort()) {
    const definition = BLOCK_REGISTRY.get(component)!
    const pageTypes = definition.pageTypes.join(', ')
    const props = Object.entries(definition.props)
      .map(([name, shape]) => `${name} (${shape})`)
      .join(', ')
    const slots = definition.slots
      .map((slot) => `${slot.name} (${slot.purpose}, ${slot.aspectRatio})`)
      .join('; ')
    lines.push(
      `- ${component} [pages: ${pageTypes}] props: ${props === '' ? 'none' : props}` +
        ` | slots: ${slots === '' ? 'none' : slots}`,
    )
  }
  return lines.join('\n')
}
```

`systemPrompt()`（`:41-60`）整体替换为：

```ts
function systemPrompt(): string {
  return [
    'You design Vue 3 marketing and app pages as a single JSON "draft" object.',
    'Reply with one JSON object only, no prose and no code fences.',
    '',
    'Draft shape (send every key; only "props" and "content" may be omitted):',
    '{',
    '  "meta": { "name": string, "description": string, "targetStack": "vue3" },',
    '  "theme": {',
    '    "colorTokens": { "primary": hex, "secondary": hex, "accent": hex,',
    '      "background": hex, "surface": hex, "foreground": hex, "muted": hex },',
    '    "radius": "none" | "sm" | "md" | "lg" | "full",',
    '    "spacing": "compact" | "normal" | "relaxed",',
    '    "fontPair": { "heading": string, "body": string },',
    '    "mode": "light" | "dark" | "both"',
    '  },',
    '  "styleBible": {',
    '    "artStyle": "flat-vector" | "isometric" | "hand-drawn" | "gradient-mesh" | "3d-clay" | "line-art" | "paper-cut",',
    '    "lineWeight": "none" | "thin" | "medium" | "bold",',
    '    "shading": "none" | "flat" | "soft-gradient" | "dramatic",',
    '    "perspective": "front" | "isometric" | "top-down" | "three-quarter",',
    '    "palette": array of 2-8 hex colors,',
    '    "backgroundTreatment": "solid" | "subtle-gradient" | "scene" | "abstract-shapes",',
    '    "negativePrompt": string (may be empty),',
    '    "seed": non-negative integer',
    '  },',
    '  "pages": [',
    '    {',
    '      "route": "/" or "/pricing" (lowercase, unique, starts with "/"),',
    '      "title": string,',
    '      "pageType": "landing" | "dashboard" | "form" | "list-detail" | "auth" | "settings",',
    '      "blocks": [',
    '        { "component": <a component listed below>,',
    '          "props": { <the copy for that block, see its props below> },',
    '          "content": { "illustration": { "prompt": string, "alt": string } } }',
    '      ]',
    '    }',
    '  ]',
    '}',
    '',
    'Available block components, with the props and the only legal slot names for each:',
    renderBlockCatalogue(),
    '',
    'Rules:',
    '- Use only the components listed above, and only the props and slot names listed for that one.',
    '- You do not write asset ids, sizes or bindings. Every slot listed above is filled with an image',
    '  automatically: put your own subject text in "content", keyed by slot name. The geometry',
    '  (aspectRatio, renderSize, transparent, composition) comes from the component sidecar, not from',
    '  you.',
    '- "content" may be omitted, or list only the slots worth describing; the rest fall back to the',
    '  slot\'s own default. Never invent a slot name, and never send an "assets" key.',
    '- Keep the page count and the block count small: 1-3 pages, 2-5 blocks per page. Every slot you',
    '  use costs one image, so prefer a few well-chosen sections over a long page.',
    '- Routes must be unique and start with "/". targetStack is always "vue3".',
  ].join('\n')
}
```

（`:41-60` 的函数文档注释保留原意，只把「the model is allowed to influence」的对象从 asset 改成 block 的 props/内容。）

- [ ] **Step 4: 跑测试确认它通过**

Run: `npx vitest run packages/providers/src/__tests__/openai-spec-drafter.test.ts`
Expected: PASS，该文件全绿。

- [ ] **Step 5: typecheck 该包**

Run: `pnpm --filter @vudt/providers typecheck`
Expected: 无输出。

- [ ] **Step 6: 全仓确认全绿（不提交）**

Run: `npx vitest run 2>&1 | tail -n 5`
Expected: **0 failed**（333 + 新增例）。这是本轮第一次全绿。

---

### Task 5: server 换成两道闸，fixture 改为 draft

**Files:**
- Modify: `server/src/spec-source.ts:1`（import）、`:33-52`（循环体）
- Modify: `server/src/__tests__/fixture.ts:1`（import）、`:37-60`（`landingDraft`）
- Modify: `server/src/__tests__/spec-source.test.ts`
- Modify: `server/src/__tests__/spec-view.test.ts:1-9`
- Modify: `server/src/__tests__/app.test.ts:16-17,53,158,188,450,478,502`（机械改名）

**Interfaces:**
- Consumes: `deriveSpecInput`（Task 3，`@vudt/blocks`）
- Produces: `draftSpec()` 的签名与返回值不变（`{ spec, input, attempts }`），`runTask()`（`server/src/runner.ts:51-57`）因此不用改。`fixture.ts` 导出 `landingDraft()` 取代 `landingSpecInput()`，后续测试一律用它。

- [ ] **Step 1: 改 fixture（先让引用它的测试报错）**

`server/src/__tests__/fixture.ts:1` 的 blocks import 整行删掉（改名后不再需要 `derivePageAssets`）。`:37-60` 的 `landingSpecInput()` 替换为：

```ts
/**
 * The raw object a drafter is expected to return: a draft, not a spec. Blocks
 * carry subject text only — every aspectRatio/renderSize/id is derived from the
 * sidecars by `deriveSpecInput`, so hand-writing geometry here would test a
 * shape the model is never allowed to produce.
 */
export function landingDraft(): unknown {
  return {
    meta: {
      name: 'Acme Landing',
      description: 'A marketing landing page for a developer tooling product.',
      targetStack: 'vue3',
    },
    theme,
    styleBible,
    pages: [
      {
        route: '/',
        title: 'Home',
        pageType: 'landing',
        blocks: [
          { component: 'NavBarSimple', props: { brand: 'Acme' } },
          {
            component: 'HeroSplit',
            props: {
              headline: 'Ship faster',
              subhead: 'Tooling that gets out of the way',
              primaryCta: 'Get started',
            },
            content: { illustration: { prompt: 'a developer at a desk', alt: 'Developer at a desk' } },
          },
          { component: 'FooterSimple', props: { brand: 'Acme', note: '(c) 2026' } },
        ],
      },
    ],
  }
}
```

（`theme` 与 `styleBible` 两个常量原样保留；`landingDraft` 派生出的资产与旧的 `landingSpecInput` 完全一致——同样是 HeroSplit 的那一张图，所以依赖「任务有 1 张图」的既有断言不受影响。）

`app.test.ts` 里 7 处引用是纯改名：

```bash
sed -i 's/landingSpecInput/landingDraft/g' server/src/__tests__/app.test.ts
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run server/src/__tests__/spec-source.test.ts 2>&1 | tail -n 20`
Expected: FAIL —— 编译期报 `landingSpecInput` 不存在（`spec-source.test.ts` 还没改）。

- [ ] **Step 3: 实现 `spec-source.ts` 的两道闸**

`server/src/spec-source.ts:1` 的 import 改为：

```ts
import { deriveSpecInput } from '@vudt/blocks'
import { finalizeSpec, parseProjectSpecInput, type ProjectSpec, type ProjectSpecInput } from '@vudt/spec'
import { ServerError } from './errors.js'
```

`draftSpec()` 的文档注释与循环体（`:33-52`）替换为：

```ts
/**
 * Asks the drafter for a draft until it derives into a spec that passes Zod.
 *
 * Two gates, in this order:
 *   1. `deriveSpecInput` — the draft's shape, plus geometry and asset ids from
 *      the block sidecars. The model never writes those.
 *   2. `parseProjectSpecInput` — the spec schema proper. It is what catches
 *      duplicate routes, which derivation does not look at.
 *
 * Both failures are carried back verbatim: the schema is the platform's only
 * defence against structural drift, so the fix for a rejected draft is a better
 * prompt, never a looser schema.
 */
export async function draftSpec(
  drafter: SpecDrafter,
  description: string,
  options: DraftSpecOptions = {},
): Promise<{ spec: ProjectSpec; input: ProjectSpecInput; attempts: number }> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  let feedback: string | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const raw = await drafter.draft(
      feedback === undefined ? { description, attempt } : { description, feedback, attempt },
    )

    const derived = deriveSpecInput(raw)
    if (!derived.ok) {
      feedback = derived.feedback
      continue
    }

    const parsed = parseProjectSpecInput(derived.value)
    if (parsed.ok) {
      return { spec: finalizeSpec(parsed.value), input: parsed.value, attempts: attempt }
    }
    feedback = parsed.feedback
  }

  throw new ServerError(
    `the model did not produce a valid spec in ${maxAttempts} attempts`,
    422,
    feedback,
  )
}
```

- [ ] **Step 4: 改 `spec-source.test.ts`**

import 行改为：

```ts
import { ScriptedDrafter, landingDraft } from './fixture.js'
```

三个 `landingSpecInput()` 引用改成 `landingDraft()`。第四条测试（`rejects a draft whose geometry contradicts its aspect ratio`，`:44-58`）**整条删除**，换成下面两条：

```ts
  it('rejects content for a slot the block does not declare, naming the legal ones', async () => {
    // The model can no longer send geometry, so the interesting failure moved:
    // an invented slot name is the shape mistake that still costs a retry.
    const draft = landingDraft() as { pages: { blocks: unknown[] }[] }
    draft.pages[0]!.blocks = [{ component: 'HeroSplit', content: { banner: { prompt: 'x' } } }]

    let caught: unknown
    try {
      await draftSpec(new ScriptedDrafter([draft]), 'x', { maxAttempts: 1 })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ServerError)
    expect((caught as ServerError).detail).toMatch(/has no slot "banner"/)
  })

  it('rejects duplicate routes — the check derivation does not do', async () => {
    // Slotless blocks on purpose: with slots, the second page would collide on
    // asset ids first and this would stop proving gate 2 does anything.
    const draft = landingDraft() as { pages: unknown[] }
    draft.pages = [
      { route: '/', title: 'Home', pageType: 'landing', blocks: [{ component: 'NavBarSimple' }] },
      { route: '/', title: 'Home again', pageType: 'landing', blocks: [{ component: 'NavBarSimple' }] },
    ]

    let caught: unknown
    try {
      await draftSpec(new ScriptedDrafter([draft]), 'x', { maxAttempts: 1 })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ServerError)
    expect((caught as ServerError).detail).toMatch(/duplicate route/)
  })
```

同时检查该文件里的 `landingSpecInput() as { assets: … }` 之类的类型断言已随删除消失；`retries with the validator feedback appended to the request` 用的 `{ meta: { name: 'x' } }` 仍然有效（缺 theme 等 → 闸 1 报路径）。

- [ ] **Step 5: 改 `spec-view.test.ts`**

`:1-9` 改为：

```ts
import { describe, expect, it } from 'vitest'
import { deriveSpecInput } from '@vudt/blocks'
import { finalizeSpec } from '@vudt/spec'
import { toSpecView } from '../spec-view.js'
import { landingDraft } from './fixture.js'

/** The fixture is a draft; deriving is how it gains a spec's geometry and ids. */
function landingSpec() {
  const derived = deriveSpecInput(landingDraft())
  if (!derived.ok) throw new Error(derived.feedback)
  return finalizeSpec(derived.value)
}
```

- [ ] **Step 6: 跑 server 的四个测试文件**

Run: `npx vitest run server/src/__tests__/spec-source.test.ts server/src/__tests__/spec-view.test.ts server/src/__tests__/app.test.ts 2>&1 | tail -n 20`
Expected: PASS。若 `app.test.ts` 报找不到 `landingDraft`，说明 Step 1 的 `sed` 没跑。

- [ ] **Step 7: 跑全仓**

Run: `npx vitest run 2>&1 | tail -n 5`
Expected: **0 failed**。

- [ ] **Step 8: 全仓 typecheck**

Run: `pnpm -r typecheck 2>&1 | tail -n 20`
Expected: 无错误。

---

### Task 6: 真端到端验收（唯一验收终点）

**Files:** 无代码改动。这是验收任务：`deriveSpecInput` 让单测全绿并不代表服务能跑起来——本仓库刚吃过「绿测试但服务起不来」的亏。

- [ ] **Step 1: 起服务前确认端口归属**

Run: `netstat -ano | grep LISTENING | grep -E ':(4300|5173)'`
Expected: 要么空，要么是自己起的进程。4300 上可能有别的 mock 占着（它也会回 `/health` 200，但 `/api/*` 全 404）。

- [ ] **Step 2: 起后端**

Run（新终端）: `cd server && npx tsx --env-file=.env src/main.ts`
Expected: 监听 127.0.0.1:4300。

- [ ] **Step 3: 确认真后端在**

Run: `curl -s http://127.0.0.1:4300/api/settings | head -c 300`
Expected: JSON（含 `settings`/`sources`）。401/404 说明连错了进程。注意 `baseUrl` 只能填到 `/v1`——provider 自己拼 `/chat/completions`。

- [ ] **Step 4: 提交一个真任务**

Run:
```bash
curl -s -X POST http://127.0.0.1:4300/tasks \
  -H 'content-type: application/json' \
  -d '{"description":"一个面向独立开发者的 SaaS 落地页，强调快速上线"}' | head -c 200
```
Expected: 202 + 任务 JSON（记下 `id`）。

- [ ] **Step 5: 盯到终态**

Run（每 5 秒一次，直到不再是 `queued`/`drafting`/`building`）:
```bash
for i in $(seq 1 60); do curl -s http://127.0.0.1:4300/tasks/<id> | head -c 400; echo; sleep 5; done
```
Expected: 终态 `ready`，`providerCalls` 有值。

- [ ] **Step 6: 判定验收**

- `ready` → 打开 `http://127.0.0.1:4300/preview/<id>/`，确认页面渲染且 hero 的图**真的是图**（不是碎图）、文案非空（props 键名对上了）。这是本轮唯一验收终点。
- `failed` → 读 `error.detail`，它现在是闸 1 与闸 2 的原文（路径前缀，例如 `theme.mode: Invalid option…` 或 `block "HeroSplit" has no slot "banner" (declares: illustration)`），直接把那段原文当成下一轮改 prompt 的输入。**不要**为了让它过而放宽 schema 或删 `derivePageAssets` 的检查。

- [ ] **Step 7: 关服务**

Run: 在起后端的终端 Ctrl+C。（`tsx` 不热重载，改 `.env` 必须重启。）

---

## 收尾对照（Self-Review 结果）

- **Spec 覆盖**：draft 形状与归属 → Task 3；两道闸与 `spec-source` 接线 → Task 5；prompt 形状/枚举/catalogue/props → Task 4；未知组件错误清单 → Task 1；props 侧车 + SFC 守卫 → Task 2；测试改动面（providers 两条、server fixture、spec-source、app/spec-view）→ Task 4/5；验证方式 → Task 6。**无遗漏**。
- **未做的事（spec 明确写不做）**：不删 `parseProjectSpecInput`、不改 `SpecDrafter` 签名、不动 `derivePageAssets` 的几何不变量、不动 `maxAssets`、不做进度可见性。
- **已知缺口（spec「已知边界」）**：`/a/b` 与 `/a-b` 会撞 asset id，本轮不修。
