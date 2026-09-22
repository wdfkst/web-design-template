# 多页完整项目（导航布局 + 路由化 CTA + 逼多页）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让每次生成都产出一套导航互通、路由可达、每页非空的前端项目，而不是一张孤立单页。

**Architecture:** 把「跨页结构」从 LLM 手里拿走，交给 codegen —— 和「几何只来自侧车」同一个思路。导航升为项目级布局（侧车标 `layoutOnly`，条目由 codegen 从 `spec.pages` 生成），CTA 改成 `{ label, to }` 两段式且 `to` 必须命中真实 route，多页不变量钉在 draft schema 上。`packages/spec` 零改动。

**Tech Stack:** TypeScript 5.9 / zod 4 / vitest 3 / pnpm workspaces / Vue 3.5 SFC / vue-router（hash history）/ vue-tsc / Vite

**Spec:** `docs/superpowers/specs/2026-09-22-multi-page-project-design.md`

## Global Constraints

以下约束对**每个任务**都成立，逐条抄自 spec：

- **`packages/spec` 的 schema 零改动。** 多页不变量钉在 draft schema（`packages/templates/blocks/src/draft.ts`），不是 spec 容器。全仓 8 个文件里 13 处 `pages: [` 夹具因此不用动。
- **不做列表→详情的业务跳转。** 不带路由参数的区块（DataTable / DetailPanel），不引入 `:id` 动态路由，不做列表与详情的假数据联动。
- **不强制侧车的 `pageTypes`。** 它保持 advisory。
- **不动图片生成的逻辑代码，不动构建沙箱。**
- **禁止锚点。** 任何名为 `to` 的值以 `#` 开头一律不合法，没有例外。
- **依赖方向不可反。** `packages/spec` 不得 import `@vudt/blocks`（`slot.ts` 已 import `@vudt/spec`，反过来成环）。跨页校验因此住在 `packages/templates/blocks`。
- **几何只来自侧车。** LLM 只能填 `prompt`/`alt`；`aspectRatio`/`renderSize`/`transparent`/`composition`/asset id 一律由 `derivePageAssets` 注入，本轮不得放宽。
- **props 走 `const propsN = {…}` + `v-bind`，绝不内联进属性。** 内联 JSON 需要 HTML 实体转义，而 vue-tsc 读的是转义前的原文 → vite 能过、typecheck 挂。
- **拷底座而非全量生成。** `copyTemplate` 逐文件复制 `vue3-base`，codegen 只覆盖 `generated.files` 里列出的路径。
- **每条实现任务收尾必须全绿。** `pnpm --filter <pkg> test` 与 `pnpm --filter <pkg> typecheck`（本计划的基线：2026-09-22 全仓 38 文件 / 374 例绿）。

## 本计划对 spec 的三处修正（执行前先读，别当成笔误）

1. **spec 的「交付顺序」把 SFC 改动（步骤 1）与侧车改动（步骤 2）拆成两步，但 `sfc-props.test.ts` 遍历整个 `BLOCK_REGISTRY`** —— 只改 SFC 不改侧车，该测试必红。本计划把每个区块的 SFC 与侧车放在**同一个任务**里改，保证每个任务收尾都是绿的。
2. **spec 的「测试改动面」漏了 `pages.min(3)` 的连带面。** 它只提了 `draft.test.ts` 里 nav/footer 两处要换块。实际上 `draft.test.ts` 有 **6 处单页覆盖**、`server/src/__tests__/fixture.ts` 的 `landingDraft()` 与 `spec-source.test.ts` 的 2 页覆盖，在 `.min(3)` 落地后都会先在 schema 闸上失败，而不是走到它们各自要断言的逻辑。这些必须一起多页化（Task 5）。
3. **spec 的 `app.ts` 草图写「`SidebarShell` 版本同理，无 `cta`」，与它自己 §1 的规则表矛盾。** 那张表给 CTA 的定位理由就是「auth 页被排除出导航条目后，再没有任何入口能到它」。侧栏分支若没有 CTA，同一个洞就还在。本计划给**两个 shell 都传 `cta`**（`note` 仍只有顶栏有）。

---

## File Structure

**改动（按包分组）**

| 文件 | 职责 | 任务 |
|---|---|---|
| `packages/templates/vue3-base/src/blocks/{NavBarSimple,HeroSplit,HeroCentered,CtaBanner,EmptyStatePanel,PricingCard,LogoStrip}.vue` | 7 个区块的 CTA 改 `<router-link>`；LogoStrip 去链接 | 1 |
| `packages/templates/blocks/src/blocks/{nav-bar-simple,hero-split,hero-centered,cta-banner,empty-state-panel,pricing-card,logo-strip}.slots.ts` | 侧车 props 同步（`{ label, to }` / `string[]` / `orientation`） | 1 |
| `packages/templates/vue3-base/src/layouts/AppShell.vue`（新） | 顶栏布局：NavBar → slot → Footer | 2 |
| `packages/templates/vue3-base/src/layouts/SidebarShell.vue`（新） | 侧栏布局：左 NavBar（vertical）+ 右主内容区 | 2 |
| `packages/templates/blocks/src/slot.ts` | `BlockDefinition` 新增 `layoutOnly?: boolean` | 2 |
| `packages/templates/blocks/src/blocks/{nav-bar-simple,footer-simple}.slots.ts` | 标 `layoutOnly: true` | 2 |
| `packages/templates/blocks/src/derive.ts` | `derivePageAssets` 拒绝 `layoutOnly`；新增 `assertCtaTargets` | 3 |
| `packages/templates/blocks/src/draft.ts` | 调 `assertCtaTargets`；`pages.min(3)` / `blocks.min(2)` | 3、5 |
| `packages/codegen/src/page.ts` | `renderPage` 拒绝 `layoutOnly` | 4 |
| `packages/codegen/src/layouts.ts`（新） | 纯函数：选 shell、导航条目、CTA、页脚 note | 6 |
| `packages/codegen/src/app.ts`（新） | `renderApp` → `src/App.vue` | 6 |
| `packages/codegen/src/router.ts` | auth 页写 `meta: { chrome: false }` | 6 |
| `packages/codegen/src/project.ts` | 产出 `src/App.vue` | 6 |
| `packages/providers/src/openai-spec-drafter.ts` | 目录跳过 `layoutOnly`；prompt 改写 | 7 |

**新建测试**

- `packages/templates/blocks/src/__tests__/sfc-navigation.test.ts`（Task 1、2）
- `packages/codegen/src/__tests__/layouts.test.ts`（Task 6）
- `packages/codegen/src/__tests__/app.test.ts`（Task 6）

**改写测试**

`registry.test.ts`(2)、`derive.test.ts`(3)、`page.test.ts`(4)、`codegen/fixture.ts`(4、6)、`build/fixture.ts`(4)、`imagegen/fixture.ts`(4)、`draft.test.ts`(5)、`server/fixture.ts`(5)、`spec-source.test.ts`(5)、`project.test.ts`(6)、`openai-spec-drafter.test.ts`(7)。

---

## Task 1: 区块 SFC 的导航路由化与 CTA 两段式

把 7 个区块里所有「看起来像导航、实际到不了任何地方」的标记换成真实路由。

**Files:**
- Create: `packages/templates/blocks/src/__tests__/sfc-navigation.test.ts`
- Modify: `packages/templates/vue3-base/src/blocks/NavBarSimple.vue`（整文件重写）
- Modify: `packages/templates/vue3-base/src/blocks/LogoStrip.vue`（整文件重写）
- Modify: `packages/templates/vue3-base/src/blocks/HeroSplit.vue`（script + template 的 actions 段）
- Modify: `packages/templates/vue3-base/src/blocks/HeroCentered.vue`（script + CTA 行）
- Modify: `packages/templates/vue3-base/src/blocks/CtaBanner.vue`（script + CTA 行）
- Modify: `packages/templates/vue3-base/src/blocks/EmptyStatePanel.vue`（script + CTA 行）
- Modify: `packages/templates/vue3-base/src/blocks/PricingCard.vue`（`Plan` 接口 + CTA 行）
- Modify: `packages/templates/vue3-base/src/blocks/AuthPanel.vue`（死锚点 → `<button>`，见 Step 9b）
- Modify: `packages/templates/blocks/src/blocks/nav-bar-simple.slots.ts`
- Modify: `packages/templates/blocks/src/blocks/hero-split.slots.ts`
- Modify: `packages/templates/blocks/src/blocks/hero-centered.slots.ts`
- Modify: `packages/templates/blocks/src/blocks/cta-banner.slots.ts`
- Modify: `packages/templates/blocks/src/blocks/empty-state-panel.slots.ts`
- Modify: `packages/templates/blocks/src/blocks/pricing-card.slots.ts`
- Modify: `packages/templates/blocks/src/blocks/logo-strip.slots.ts`

**Interfaces:**
- Consumes: 无（第一个任务）
- Produces:
  - 区块 SFC 层统一约定：任何被点一下就走的元素都是 `<router-link :to="…">`，`to` 是字符串路由。
  - `NavBarSimple` 的 props：`{ brand?: string; links?: { label: string; to: string }[]; cta?: { label: string; to: string }; orientation?: 'horizontal' | 'vertical' }` —— Task 2 的 shell 直接绑这五个。
  - `HeroSplit.primaryCta` / `secondaryCta`、`HeroCentered.primaryCta`、`CtaBanner.cta`、`EmptyStatePanel.cta`、`PricingCard.plans[].cta` 全部是 `{ label: string; to: string }`。
  - `LogoStrip.logos` 变成 `string[]`。

- [ ] **Step 1: 写失败测试**

Create `packages/templates/blocks/src/__tests__/sfc-navigation.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BLOCK_REGISTRY } from '../registry.js'

const blockSfcDir = fileURLToPath(new URL('../../../vue3-base/src/blocks/', import.meta.url))

function readSfc(component: string): string {
  return readFileSync(`${blockSfcDir}${component}.vue`, 'utf8')
}

/**
 * The symptom this whole design exists to kill: a hardcoded `href="#cta"` looks
 * like navigation and is not. The router runs on hash history, so an in-page
 * anchor can only move the scroll position — and only when some element happens
 * to carry that id. A cross-page destination has to be a real route.
 */
describe('block SFCs navigate with router-link, never with an anchor', () => {
  for (const definition of BLOCK_REGISTRY.values()) {
    it(`${definition.component} hardcodes no anchor href`, () => {
      expect(readSfc(definition.component)).not.toMatch(/href="#/)
    })
  }

  it('LogoStrip renders brand names as plain text, with nothing to click', () => {
    const sfc = readSfc('LogoStrip')
    expect(sfc).not.toContain('<a')
    expect(sfc).not.toContain('href')
  })

  it('EmptyStatePanel offers a real route instead of a button that does nothing', () => {
    const sfc = readSfc('EmptyStatePanel')
    expect(sfc).not.toContain('<button')
    expect(sfc).toContain('<router-link')
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm --filter @vudt/blocks test -- sfc-navigation`
Expected: FAIL —— 至少 `NavBarSimple`、`HeroSplit`、`HeroCentered`、`CtaBanner`、`PricingCard`、`EmptyStatePanel`、`LogoStrip` 七个 `hardcodes no anchor href` 全红，加上 LogoStrip/EmptyStatePanel 两条。

- [ ] **Step 3: 重写 `NavBarSimple.vue`**

整文件替换为：

```vue
<script setup lang="ts">
interface NavLink {
  label: string
  to: string
}

withDefaults(
  defineProps<{
    brand?: string
    links?: NavLink[]
    cta?: NavLink
    orientation?: 'horizontal' | 'vertical'
  }>(),
  { brand: 'Acme', links: () => [], orientation: 'horizontal' },
)
</script>

<template>
  <header class="nav" :class="`nav--${orientation}`">
    <div class="container nav__inner">
      <!--
        The brand is deliberately not a link: the platform cannot promise that a
        project declares "/", and a brand that points nowhere is the exact defect
        this file was rewritten to remove.
      -->
      <span class="nav__brand">{{ brand }}</span>
      <nav class="nav__links">
        <router-link
          v-for="link in links"
          :key="link.to"
          class="nav__link"
          :to="link.to"
        >{{ link.label }}</router-link>
      </nav>
      <router-link v-if="cta" class="button" :to="cta.to">{{ cta.label }}</router-link>
    </div>
  </header>
</template>

<style scoped>
.nav {
  border-bottom: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  background: var(--color-background);
}

.nav__inner {
  display: flex;
  align-items: center;
  gap: calc(var(--space-unit) * 2);
  padding-block: var(--space-unit);
}

.nav__brand {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 1.125rem;
}

.nav__links {
  display: flex;
  gap: calc(var(--space-unit) * 1.5);
  margin-inline-end: auto;
}

.nav__link {
  color: var(--color-muted);
  text-decoration: none;
}

.nav__link:hover,
.nav__link.router-link-active {
  color: var(--color-foreground);
}

/* The sidebar shell stacks this same nav down the left edge. */
.nav--vertical {
  border-bottom: 0;
  border-inline-end: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  height: 100%;
}

.nav--vertical .nav__inner {
  flex-direction: column;
  align-items: flex-start;
  gap: calc(var(--space-unit) * 1.5);
  padding-block: calc(var(--space-unit) * 2);
}

.nav--vertical .nav__links {
  flex-direction: column;
  margin-inline-end: 0;
}
</style>
```

- [ ] **Step 4: 重写 `LogoStrip.vue`**

整文件替换为：

```vue
<script setup lang="ts">
withDefaults(
  defineProps<{
    heading?: string
    logos?: string[]
  }>(),
  { heading: '', logos: () => [] },
)
</script>

<template>
  <section class="section logos">
    <div class="container">
      <p v-if="heading" class="logos__heading">{{ heading }}</p>
      <!--
        Names only, no links. The product is fictional, so any domain the model
        writes is invented — and an invented domain is worse than no link at all.
      -->
      <div v-if="logos.length > 0" class="logos__row">
        <span v-for="(name, index) in logos" :key="index" class="logos__item">{{ name }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.logos__heading {
  text-align: center;
  color: var(--color-muted);
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: calc(var(--space-unit) * 2);
}

.logos__row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: calc(var(--space-unit) * 2) calc(var(--space-unit) * 4);
}

.logos__item {
  color: var(--color-muted);
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 1.125rem;
  opacity: 0.75;
}
</style>
```

- [ ] **Step 5: 把 `HeroSplit.vue` 的 CTA 改成两段式**

`<script setup>` 块整体替换为：

```vue
<script setup lang="ts">
import type { SlotAssets } from '../asset'

interface Cta {
  label: string
  to: string
}

withDefaults(
  defineProps<{
    headline?: string
    subhead?: string
    primaryCta?: Cta
    secondaryCta?: Cta
    assets?: SlotAssets
  }>(),
  { headline: '', subhead: '', assets: () => ({}) },
)
</script>
```

模板里 `<div class="hero__actions">` 内的两个 `<a>`（原文件第 23-26 行）替换为：

```vue
        <div class="hero__actions">
          <router-link v-if="primaryCta" class="button" :to="primaryCta.to">
            {{ primaryCta.label }}
          </router-link>
          <router-link v-if="secondaryCta" class="button button--ghost" :to="secondaryCta.to">
            {{ secondaryCta.label }}
          </router-link>
        </div>
```

- [ ] **Step 6: 把 `HeroCentered.vue` 的 CTA 改成两段式**

`<script setup>` 块整体替换为：

```vue
<script setup lang="ts">
import type { SlotAssets } from '../asset'

interface Cta {
  label: string
  to: string
}

withDefaults(
  defineProps<{
    headline?: string
    subhead?: string
    primaryCta?: Cta
    assets?: SlotAssets
  }>(),
  { headline: '', subhead: '', assets: () => ({}) },
)
</script>
```

模板里原第 31 行 `<a v-if="primaryCta" class="button" href="#cta">{{ primaryCta }}</a>` 替换为：

```vue
      <router-link v-if="primaryCta" class="button" :to="primaryCta.to">
        {{ primaryCta.label }}
      </router-link>
```

- [ ] **Step 7: 把 `CtaBanner.vue` 的 CTA 改成两段式**

`<script setup>` 块整体替换为：

```vue
<script setup lang="ts">
import type { SlotAssets } from '../asset'

interface Cta {
  label: string
  to: string
}

withDefaults(
  defineProps<{
    headline?: string
    body?: string
    cta?: Cta
    assets?: SlotAssets
  }>(),
  { headline: '', body: '', assets: () => ({}) },
)
</script>
```

模板里原第 34 行 `<a v-if="ctaLabel" class="button" href="#">{{ ctaLabel }}</a>` 替换为：

```vue
      <router-link v-if="cta" class="button" :to="cta.to">{{ cta.label }}</router-link>
```

- [ ] **Step 8: 把 `EmptyStatePanel.vue` 的按钮改成路由**

`<script setup>` 块整体替换为：

```vue
<script setup lang="ts">
import type { SlotAssets } from '../asset'

interface Cta {
  label: string
  to: string
}

withDefaults(
  defineProps<{
    headline?: string
    body?: string
    cta?: Cta
    assets?: SlotAssets
  }>(),
  { headline: '', body: '', assets: () => ({}) },
)
</script>
```

模板里原第 31 行 `<button v-if="ctaLabel" class="button" type="button">{{ ctaLabel }}</button>` 替换为：

```vue
    <router-link v-if="cta" class="button" :to="cta.to">{{ cta.label }}</router-link>
```

- [ ] **Step 9: 把 `PricingCard.vue` 的套餐 CTA 改成两段式**

在 `interface Plan` **之前**插入：

```ts
interface Cta {
  label: string
  to: string
}
```

把 `interface Plan` 里的 `ctaLabel?: string` 改成 `cta?: Cta`。

模板里原第 48-53 行的 `<a v-if="plan.ctaLabel" href="#pricing" …>` 替换为：

```vue
          <router-link
            v-if="plan.cta"
            :to="plan.cta.to"
            class="button"
            :class="{ 'button--ghost': !plan.featured }"
          >{{ plan.cta.label }}</router-link>
```

- [ ] **Step 9b: 把 `AuthPanel.vue` 的死锚点换成 `<button>`**

`packages/templates/vue3-base/src/blocks/AuthPanel.vue:50` 是 `<a v-if="altActionLabel" class="auth__alt" href="#auth">{{ altActionLabel }}</a>` —— 而整个文件里没有 `id="auth"`，所以点「Create an account」原地不动。这正是本次要消灭的症状，Step 1 的 `hardcodes no anchor href` 会遍历到它。

把那一行替换为：

```vue
        <button v-if="altActionLabel" class="auth__alt" type="button">
          {{ altActionLabel }}
        </button>
```

> **为什么在 spec 说「AuthPanel 不动」的情况下还改它**：spec 把它排除在外的理由是「`altActionLabel` 语义是同页 `mode` 切换，名字里没有 `to`，新约定碰不到它」—— 这条依然成立，本步**不改任何 props**，侧车也不动。但 `href="#auth"` 是一个死锚点，而 spec 自己在 LogoStrip 那条里定过调子：「编出来的域名比不渲染更糟 ——『点了没反应』正是这次要消灭的东西」。同一句话适用于这里。改成 `<button type="button">` 是对「它没有去向」的诚实表达，和 `EmptyStatePanel` 的处理一致。

- [ ] **Step 10: 跑测试确认它仍然红（SFC 改了、侧车没改）**

Run: `pnpm --filter @vudt/blocks test -- sfc-navigation sfc-props`
Expected: `sfc-navigation` PASS；`sfc-props` FAIL 六条（`NavBarSimple`、`HeroSplit`、`HeroCentered`、`CtaBanner`、`EmptyStatePanel`、`PricingCard`、`LogoStrip`）—— 侧车还写着旧的 props。这就是为什么两者必须同一个任务。

- [ ] **Step 11: 同步 7 个侧车**

`packages/templates/blocks/src/blocks/nav-bar-simple.slots.ts` 的 `props` 改为：

```ts
  props: {
    brand: 'string',
    links: '{ label, to }[]',
    cta: '{ label, to }',
    orientation: '"horizontal" | "vertical"',
  },
```

`hero-split.slots.ts`：

```ts
  props: { headline: 'string', subhead: 'string', primaryCta: '{ label, to }', secondaryCta: '{ label, to }' },
```

`hero-centered.slots.ts`：

```ts
  props: { headline: 'string', subhead: 'string', primaryCta: '{ label, to }' },
```

`cta-banner.slots.ts`：

```ts
  props: { headline: 'string', body: 'string', cta: '{ label, to }' },
```

`empty-state-panel.slots.ts`：

```ts
  props: { headline: 'string', body: 'string', cta: '{ label, to }' },
```

`pricing-card.slots.ts`：

```ts
  props: {
    heading: 'string',
    subheading: 'string',
    plans: '{ name, price, period?, tagline?, features: string[], cta?: { label, to }, featured? }[]',
    note: 'string',
  },
```

`logo-strip.slots.ts`：

```ts
  props: { heading: 'string', logos: 'string[]' },
```

- [ ] **Step 12: 跑测试确认全绿**

Run: `pnpm --filter @vudt/blocks test && pnpm --filter @vudt/blocks typecheck`
Expected: PASS —— `sfc-navigation`、`sfc-props`、`sfc-geometry`、`registry` 全绿。注意 `sfc-geometry` 只查 `<img data-asset-slot>` 的 w/h，与本次改动无关，**如果它红了说明改错了行**。

- [ ] **Step 13: 提交**

```bash
git add packages/templates/vue3-base/src/blocks packages/templates/blocks/src/blocks packages/templates/blocks/src/__tests__/sfc-navigation.test.ts
git commit -m "feat(blocks): route every CTA through router-link and drop the dead anchors

NavBarSimple 用裸 <a href> 而 router 是 hash history —— 点导航真跳 HTTP。
HeroSplit/HeroCentered/CtaBanner 的 href=\"#cta\" 只在同页恰好有 CtaBanner 时
有效；PricingCard 的 href=\"#pricing\" 和 EmptyStatePanel 的 <button> 从来没
有跳转行为；LogoStrip 渲染的是模型编出来的外部域名。

全部换成 <router-link :to> 或去掉链接。CTA 从一段文案改成 { label, to }
两段式 —— to 的合法性由 Task 3 的闸校验。NavBarSimple 的 brand 不再是链接：
平台无法保证项目声明了 \"/\"。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 2: 布局层 —— `layoutOnly` 标记与两个 shell

导航升为项目级布局：底座新增两个手写布局组件，`NavBarSimple` / `FooterSimple` 从「页内区块」降级为「布局件」。

**Files:**
- Create: `packages/templates/vue3-base/src/layouts/AppShell.vue`
- Create: `packages/templates/vue3-base/src/layouts/SidebarShell.vue`
- Modify: `packages/templates/blocks/src/slot.ts`（`BlockDefinition` 加一个字段）
- Modify: `packages/templates/blocks/src/blocks/nav-bar-simple.slots.ts`
- Modify: `packages/templates/blocks/src/blocks/footer-simple.slots.ts`
- Modify: `packages/templates/blocks/src/__tests__/registry.test.ts`
- Modify: `packages/templates/blocks/src/__tests__/sfc-navigation.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `NavBarSimple` props（`brand` / `links` / `cta` / `orientation`）与 `FooterSimple` 的 `brand` / `note`。
- Produces:
  - `BlockDefinition.layoutOnly?: boolean` —— Task 3（derive 闸）、Task 4（renderPage 闸）、Task 7（prompt 目录）都读它。`true` 的只有 `NavBarSimple` 与 `FooterSimple`。
  - `AppShell` props：`{ brand?: string; links?: {label,to}[]; cta?: {label,to}; note?: string; chromeless?: boolean }`，模板含 `<slot />`。
  - `SidebarShell` props：`{ brand?: string; links?: {label,to}[]; cta?: {label,to}; chromeless?: boolean }`，模板含 `<slot />`。
  - `chromeless` 语义：为 `true` 时不渲染 nav 与 footer，只留 `<slot />`，供 auth 页使用。

- [ ] **Step 1: 写失败测试**

先把 `BlockDefinition` 的用法断言加到 `registry.test.ts`，在文件末尾（最后一个 `it` 之后、`})` 之前）插入：

```ts
  // Layout components stay in the registry so `sfc-props.test.ts` keeps checking
  // their props against their SFCs — but the drafter must never offer them as
  // page blocks, and the derivation must reject them if it does.
  it('marks exactly NavBarSimple and FooterSimple as layout-only', () => {
    const layoutOnly = [...BLOCK_REGISTRY.values()]
      .filter((definition) => definition.layoutOnly === true)
      .map((definition) => definition.component)
      .sort()
    expect(layoutOnly).toEqual(['FooterSimple', 'NavBarSimple'])
  })
```

再往 `sfc-navigation.test.ts` 末尾追加（`readSfc` 之外新增一个读 layouts 目录的函数）：

```ts
const layoutSfcDir = fileURLToPath(new URL('../../../vue3-base/src/layouts/', import.meta.url))

function readLayout(name: string): string {
  return readFileSync(`${layoutSfcDir}${name}.vue`, 'utf8')
}

describe('layout shells', () => {
  it('AppShell wraps nav, the router outlet and the footer', () => {
    const sfc = readLayout('AppShell')
    expect(sfc).toContain('<NavBarSimple')
    expect(sfc).toContain('<slot />')
    expect(sfc).toContain('<FooterSimple')
  })

  it('SidebarShell keeps the nav beside the content and drops the footer', () => {
    const sfc = readLayout('SidebarShell')
    expect(sfc).toContain('<NavBarSimple')
    expect(sfc).toContain('orientation="vertical"')
    expect(sfc).toContain('<slot />')
    expect(sfc).not.toContain('<FooterSimple')
  })

  // Without this the auth page would render the shell it was supposed to escape.
  // Guarded per chrome element, so a dropped guard fails rather than passing on
  // the other one: nav + footer in AppShell, the aside alone in SidebarShell.
  it('both shells hide their chrome when the route asks for it', () => {
    expect(readLayout('AppShell').match(/v-if="!chromeless"/g)).toHaveLength(2)
    expect(readLayout('SidebarShell').match(/v-if="!chromeless"/g)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm --filter @vudt/blocks test -- registry sfc-navigation`
Expected: FAIL —— `marks exactly NavBarSimple and FooterSimple as layout-only` 得到 `[]`；`layout shells` 三条报 `ENOENT … layouts/AppShell.vue`。

- [ ] **Step 3: 给 `BlockDefinition` 加字段**

`packages/templates/blocks/src/slot.ts`，在 `props` 字段之后、`slots` 之前插入：

```ts
  /**
   * Rendered once per project by the App shell, never inside `pages[].blocks`.
   * The drafter's catalogue skips these, and both gates reject them — a page
   * that carried its own nav would render a second one under the layout's.
   */
  layoutOnly?: boolean
```

- [ ] **Step 4: 标记两个布局侧车**

`nav-bar-simple.slots.ts`：在 `slots: [],` 之前插入 `layoutOnly: true,`。

`footer-simple.slots.ts`：在 `slots: [],` 之前插入 `layoutOnly: true,`。

- [ ] **Step 5: 新建 `AppShell.vue`**

`packages/templates/vue3-base/src/layouts/AppShell.vue`:

```vue
<script setup lang="ts">
import FooterSimple from '../blocks/FooterSimple.vue'
import NavBarSimple from '../blocks/NavBarSimple.vue'

interface NavLink {
  label: string
  to: string
}

withDefaults(
  defineProps<{
    brand?: string
    links?: NavLink[]
    cta?: NavLink
    note?: string
    chromeless?: boolean
  }>(),
  { brand: '', links: () => [], note: '', chromeless: false },
)
</script>

<template>
  <div class="shell">
    <NavBarSimple v-if="!chromeless" :brand="brand" :links="links" :cta="cta" />
    <main class="shell__main">
      <slot />
    </main>
    <FooterSimple v-if="!chromeless" :brand="brand" :note="note" />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.shell__main {
  flex: 1;
}
</style>
```

- [ ] **Step 6: 新建 `SidebarShell.vue`**

`packages/templates/vue3-base/src/layouts/SidebarShell.vue`:

```vue
<script setup lang="ts">
import NavBarSimple from '../blocks/NavBarSimple.vue'

interface NavLink {
  label: string
  to: string
}

withDefaults(
  defineProps<{
    brand?: string
    links?: NavLink[]
    cta?: NavLink
    chromeless?: boolean
  }>(),
  { brand: '', links: () => [], chromeless: false },
)
</script>

<template>
  <div class="shell">
    <aside v-if="!chromeless" class="shell__aside">
      <NavBarSimple :brand="brand" :links="links" :cta="cta" orientation="vertical" />
    </aside>
    <main class="shell__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

.shell__aside {
  height: 100%;
}

.shell__main {
  min-width: 0;
}

/* A hidden aside must not keep reserving its column. */
.shell:has(.shell__main:only-child) {
  grid-template-columns: 1fr;
}
</style>
```

> 侧栏分支同样接 `cta`（见本计划开头「三处修正」第 3 条）：auth 页被排除出导航条目后，CTA 是它唯一的入口，少了它这个洞在侧栏项目里原样保留。

- [ ] **Step 7: 跑测试确认全绿**

Run: `pnpm --filter @vudt/blocks test && pnpm --filter @vudt/blocks typecheck`
Expected: PASS —— 含新增的 `marks exactly NavBarSimple and FooterSimple as layout-only` 与 `layout shells` 三条。`sfc-props` / `sfc-geometry` 仍绿（它们只读 `src/blocks/`，不读 `src/layouts/`）。

- [ ] **Step 8: 提交**

```bash
git add packages/templates/blocks/src/slot.ts packages/templates/blocks/src/blocks packages/templates/blocks/src/__tests__ packages/templates/vue3-base/src/layouts
git commit -m "feat(templates): add project-level layout shells and mark nav/footer as layout-only

导航从「模型自由发挥的页内区块」升为项目级布局。底座新增 AppShell（顶栏 +
slot + 页脚）与 SidebarShell（左侧竖向 NavBar + 主内容区），两者都接
chromeless 供 auth 页剥掉 chrome。

侧车的 BlockDefinition 新增 layoutOnly；NavBarSimple 与 FooterSimple 标上。
两者仍留在 BLOCK_REGISTRY 里，好让 sfc-props.test.ts 继续兜住侧车与 SFC 的
props 对齐 —— 本轮它们的 props 正好都改了。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 3: 派生的两道闸 —— 拒绝 layoutOnly 与校验 `to`

在 draft → spec 的唯一入口上，把「布局件混进页里」和「`to` 指向不存在的路由」都变成带回溯路径的 feedback。

**Files:**
- Modify: `packages/templates/blocks/src/derive.ts`
- Modify: `packages/templates/blocks/src/draft.ts`
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `BlockDefinition.layoutOnly`。
- Produces:
  - `derivePageAssets(route, selections)` 对 `layoutOnly` 组件抛 `BlockDerivationError`，文案里含 `is a project-level layout`。
  - `assertCtaTargets(route: string, selections: readonly BlockSelection[], routes: ReadonlySet<string>): void` —— 从 `packages/templates/blocks` 导出，供 `deriveSpecInput` 与后续任务复用。
  - `deriveSpecInput` 的失败 feedback 现在还会带 `to` 相关文案。

- [ ] **Step 1: 写失败测试**

在 `derive.test.ts` 顶部把 `landing` 夹具换掉（`NavBarSimple` / `FooterSimple` 已不能出现在 `pages[].blocks`）：

```ts
const landing = [
  { component: 'LogoStrip' },
  { component: 'HeroSplit' },
  { component: 'FeatureTriad' },
  { component: 'CtaBanner' },
]
```

在 `packages/templates/blocks/src/__tests__/derive.test.ts` 里改三处既有断言：

- `derivePageAssets` 第一条用例（`derives one asset per declared slot…`）：`expect(blocks).toHaveLength(5)` → `toHaveLength(4)`；`assets` 仍是 `toHaveLength(5)`（LogoStrip 无 slot）；`blocks[0]?.assetBindings` 仍是 `toEqual({})`（LogoStrip 无 slot）。
- `derives no assets for the new slotless StatsBand`：把块数组改成只含 `StatsBand`，断言从 `blocks[1]!.props` 改成 `blocks[0]!.props`。
- `silently strips unknown keys a model might add (e.g. an outline)`：`{ component: 'NavBarSimple', outline: 'hero first, then value' }` → `{ component: 'StatsBand', outline: 'hero first, then value' }`。

然后在 `describe('derivePageAssets', …)` 末尾（`names the declared slots…` 之后）追加：

```ts
  // Folded into "unknown component" this message would send the model looking
  // for a different block; it has to be told to drop this one.
  it('rejects a layout component, naming it as a layout rather than an unknown block', () => {
    expect(() => derivePageAssets('/', [{ component: 'NavBarSimple' }])).toThrow(
      /NavBarSimple.*project-level layout/,
    )
    expect(() => derivePageAssets('/', [{ component: 'FooterSimple' }])).toThrow(
      /pages\[\]\.blocks/,
    )
  })
```

在 `describe('derived output against the spec schema', …)` **之前**新建一个 describe 块：

```ts
describe('assertCtaTargets', () => {
  const routes = new Set(['/', '/pricing', '/signin'])

  it('accepts a target that names a declared route', () => {
    expect(() =>
      assertCtaTargets(
        '/',
        [{ component: 'HeroSplit', props: { primaryCta: { label: 'Pricing', to: '/pricing' } } }],
        routes,
      ),
    ).not.toThrow()
  })

  it('finds a target nested inside a list prop', () => {
    expect(() =>
      assertCtaTargets(
        '/',
        [
          {
            component: 'PricingCard',
            props: { plans: [{ name: 'Pro', cta: { label: 'Choose', to: '/nope' } }] },
          },
        ],
        routes,
      ),
    ).toThrow(/plans\[0\]\.cta\.to.*"\/nope"/)
  })

  // The anchor is the defect this design exists to remove, so it gets its own
  // message rather than the generic "not a declared route".
  it('rejects an anchor even when a route of that name exists', () => {
    expect(() =>
      assertCtaTargets('/', [{ component: 'CtaBanner', props: { cta: { label: 'x', to: '#pricing' } } }], routes),
    ).toThrow(/anchor/)
  })

  it('rejects a target that is not a string', () => {
    expect(() =>
      assertCtaTargets('/', [{ component: 'CtaBanner', props: { cta: { label: 'x', to: 7 } } }], routes),
    ).toThrow(/must be a string route/)
  })

  it('ignores props that are not named to', () => {
    expect(() =>
      assertCtaTargets(
        '/',
        [{ component: 'AuthPanel', props: { altActionLabel: 'Create one', mode: 'sign-in' } }],
        routes,
      ),
    ).not.toThrow()
  })
})
```

顶部把 `assertCtaTargets` 加进 import：

```ts
import { BlockDerivationError, assertCtaTargets, derivePageAssets, mergeDerivedAssets } from '../derive.js'
```

> **`deriveSpecInput` 的闸测试不写在这个文件里。** 它归 `draft.test.ts` —— 那里已经有 `landingDraft()` / `failureOf()` / `theme` / `styleBible` 四个本地（**未导出**）帮手，而本文件一个都没有。见 Task 3 Step 1b。

- [ ] **Step 1b: 把 `to` 闸的集成测试加到 `draft.test.ts`**

`derive.test.ts` 里**没有** `landingDraft` / `failureOf` / `theme` / `styleBible` —— 那四个都是 `draft.test.ts` 的本地（未导出）帮手，`deriveSpecInput` 的闸测试本来就住在 `draft.test.ts`。在 `packages/templates/blocks/src/__tests__/draft.test.ts` 末尾追加：

```ts
describe('deriveSpecInput gate: cross-page targets', () => {
  it('rejects a CTA that points at a route no page declares', () => {
    const draft = landingDraft([
      {
        route: '/',
        title: 'Home',
        pageType: 'landing',
        blocks: [
          { component: 'HeroSplit', props: { primaryCta: { label: 'Enterprise', to: '/enterprise' } } },
          { component: 'StatsBand' },
        ],
      },
      { route: '/about', title: 'About', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
      { route: '/pricing', title: 'Pricing', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
    ])

    expect(failureOf(deriveSpecInput(draft))).toMatch(/\/enterprise.*not a declared route/)
  })

  it('accepts a CTA that names a declared route', () => {
    const value = okValue(
      deriveSpecInput(
        landingDraft([
          {
            route: '/',
            title: 'Home',
            pageType: 'landing',
            blocks: [
              { component: 'HeroSplit', props: { primaryCta: { label: 'Pricing', to: '/pricing' } } },
              { component: 'StatsBand' },
            ],
          },
          { route: '/about', title: 'About', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
          { route: '/pricing', title: 'Pricing', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
        ]),
      ),
    )

    expect(value.pages[0]!.blocks[0]!.props).toEqual({ primaryCta: { label: 'Pricing', to: '/pricing' } })
  })
})
```

> 两个 draft 都写成 **3 页 × 每页 2 块**，这不是凑数：`deriveSpecInput` 先跑 `ProjectDraftSchema.safeParse`（形状闸），**通过了才走到 derive**。Task 5 加上 `pages.min(3)` / `blocks.min(2)` 之后，写成单页的 draft 会先在形状闸上失败，`failureOf()` 拿到的是 `pages: Too small…` 而不是路由错误 —— 也就是说，先写成单页、Task 5 再回来改。这里一次写对，Task 5 不用再动它。

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm --filter @vudt/blocks test -- derive draft`
Expected: FAIL —— `assertCtaTargets is not a function`；`rejects a layout component…` 抛的是 `unknown block component`，匹配不上。

- [ ] **Step 3: 在 `derive.ts` 里加 layoutOnly 拒绝**

`packages/templates/blocks/src/derive.ts`，`derivePageAssets` 里紧跟 `unknown block component` 那个 `if` 之后插入：

```ts
    // A layout is rendered once by the app shell, not per page. Letting one into
    // `pages[].blocks` would put a second nav on the page — the bug this contract
    // exists to prevent. It is its own case rather than folded into "unknown
    // component" because that message sends the model looking for a replacement
    // block instead of deleting the one it should never have picked.
    if (definition.layoutOnly === true) {
      throw new BlockDerivationError(
        `block "${definition.component}" on route "${route}" is a project-level layout,` +
          ` not a page block: the app shell already renders it once around every page.` +
          ` Remove it from pages[].blocks.`,
      )
    }
```

- [ ] **Step 4: 在 `derive.ts` 末尾加 `assertCtaTargets`**

```ts
interface FoundTarget {
  /** Dotted path inside the component's props, for the retry prompt. */
  path: string
  value: unknown
}

/**
 * Walks a prop tree collecting every value stored under a `to` key. Nested
 * shapes count: `plans[].cta.to` is as much a destination as `primaryCta.to`.
 */
function collectTargets(value: unknown, path: string, found: FoundTarget[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectTargets(item, `${path}[${index}]`, found))
    return
  }
  if (value === null || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`
    if (key === 'to') {
      found.push({ path: childPath, value: child })
      continue
    }
    collectTargets(child, childPath, found)
  }
}

/**
 * A prop named `to` is a destination inside this project, and the only thing a
 * destination can name is a route some page declared. The convention is total on
 * purpose: a new block cannot forget to declare that one of its props is a
 * route, because there is nothing to declare.
 *
 * Anchors are rejected outright. With hash history an `#id` link cannot reach
 * another page, and "the click did nothing" is the exact symptom this exists to
 * remove.
 */
export function assertCtaTargets(
  route: string,
  selections: readonly BlockSelection[],
  routes: ReadonlySet<string>,
): void {
  for (const selection of selections) {
    const found: FoundTarget[] = []
    collectTargets(selection.props ?? {}, selection.component, found)

    for (const { path, value } of found) {
      if (typeof value !== 'string' || value === '') {
        throw new BlockDerivationError(
          `${route}: ${path} must be a string route naming a declared page`,
        )
      }
      if (value.startsWith('#')) {
        throw new BlockDerivationError(
          `${route}: ${path} is the anchor "${value}", and an anchor cannot reach another page.` +
            ` Use the route of a page declared in "pages" instead.`,
        )
      }
      if (!routes.has(value)) {
        throw new BlockDerivationError(
          `${route}: ${path} points at "${value}", which is not a declared route` +
            ` (declared: ${[...routes].join(', ')})`,
        )
      }
    }
  }
}
```

- [ ] **Step 5: 在 `draft.ts` 里调它**

`packages/templates/blocks/src/draft.ts`：import 里加 `assertCtaTargets`：

```ts
import {
  BlockDerivationError,
  assertCtaTargets,
  derivePageAssets,
  mergeDerivedAssets,
  type BlockSelection,
} from './derive.js'
```

`deriveSpecInput` 的 `try` 块整体替换为：

```ts
  try {
    const routes = new Set(pages.map((page) => page.route))
    const derivations = pages.map((page) => {
      const selections = page.blocks.map(toSelection)
      return { page, selections, derived: derivePageAssets(page.route, selections) }
    })

    // Targets are checked after derivation so a layout block is reported as a
    // layout (and an invented component as unknown) rather than as a bad route —
    // a draft carrying NavBarSimple would otherwise trip the `to` check first,
    // because its `links` prop is full of `to` keys.
    for (const entry of derivations) {
      assertCtaTargets(entry.page.route, entry.selections, routes)
    }

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
```

- [ ] **Step 6: 跑测试确认全绿**

Run: `pnpm --filter @vudt/blocks test && pnpm --filter @vudt/blocks typecheck`
Expected: PASS。若 `draft.test.ts` 因夹具里出现 `NavBarSimple`/`FooterSimple` 而红，那属于 Task 5 的范围 —— 本步允许 `draft.test.ts` 红，其余必须绿。（`draft.test.ts` 的 `landingDraft` 用了 `NavBarSimple` 与 `FooterSimple`，现在会被闸 1 拒掉，Task 5 一并处理。）

- [ ] **Step 7: 提交**

```bash
git add packages/templates/blocks/src/derive.ts packages/templates/blocks/src/draft.ts packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): reject layout blocks and unrouteable CTAs at derivation

derivePageAssets 现在拒绝 layoutOnly 组件，且错误文本点明「它是项目级布局，
不是页内区块」—— 折进 unknown component 会让模型换个块重试，白白烧掉一次
1-4 分钟的重试回路。

新增 assertCtaTargets：递归遍历 props，任何名为 to 的值必须命中已声明的
route；锚点单独报错。约定是全量的，新增区块不可能忘记声明。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 4: `renderPage` 拒绝 layoutOnly，连带改三个 spec 夹具

spec 不只来自 draft 路径（模板预设、手写 spec 都走 `renderPage`），所以第二道闸必须也在 codegen 层。这一步会打到 `pages[].blocks` 里带 nav/footer 的全部 spec 夹具。

**Files:**
- Modify: `packages/codegen/src/page.ts`
- Modify: `packages/codegen/src/__tests__/page.test.ts`
- Modify: `packages/codegen/src/__tests__/fixture.ts`
- Modify: `packages/build/src/__tests__/fixture.ts`
- Modify: `packages/imagegen/src/__tests__/fixture.ts`

**Interfaces:**
- Consumes: Task 2 的 `BlockDefinition.layoutOnly`；Task 1 的 `HeroSplit.primaryCta: {label,to}`、`CtaBanner.cta: {label,to}`。
- Produces: `renderPage(spec, page)` 对 `layoutOnly` 组件抛 `CodegenError`，文案含 `already renders around every page`。三个 `landingSpec()` 夹具的首页块序变为 `[HeroSplit, StatsBand, FeatureTriad, CtaBanner]`，`/pricing` 页变为 `[HeroCentered, PricingCard]` —— 后续任务引用 `props0`/`assets0` 等下标时以此为准。

- [ ] **Step 1: 写失败测试**

`packages/codegen/src/__tests__/page.test.ts`，把 `omits the SlotAssets import when no block on the page has a slot` 这一条（原第 83-99 行）整体替换为：

```ts
  it('throws when a page carries a layout component the shell already renders', () => {
    const spec = landingSpec()
    const broken: ProjectSpec = {
      ...spec,
      pages: [
        {
          route: '/bare',
          title: 'Bare',
          pageType: 'landing',
          blocks: [{ component: 'NavBarSimple', props: {}, assetBindings: {} }],
        },
      ],
    }
    expect(() => renderPage(broken, broken.pages[0]!)).toThrow(CodegenError)
    expect(() => renderPage(broken, broken.pages[0]!)).toThrow(
      /NavBarSimple.*already renders around every page/,
    )
  })
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm --filter @vudt/codegen test -- page`
Expected: FAIL —— 该用例现在渲染出了 `<NavBarSimple v-bind="props0" />` 而不是抛错。

- [ ] **Step 3: 在 `renderPage` 里加闸**

`packages/codegen/src/page.ts`，`renderPage` 的循环体开头（`const attrs: string[] = []` 之前）插入：

```ts
    // A spec does not have to come from the draft path — a template preset or a
    // hand-edited spec reaches this function directly. Rendering a nav here would
    // put a second one under the shell's, reintroducing through the side door the
    // exact bug the layout work removed.
    if (getBlockDefinition(block.component)?.layoutOnly === true) {
      throw new CodegenError(
        `route "${page.route}" block ${blockIndex} is the layout component "${block.component}",` +
          ` which App.vue already renders around every page — remove it from pages[].blocks`,
      )
    }
```

- [ ] **Step 4: 改三个 `landingSpec()` 夹具**

`packages/codegen/src/__tests__/fixture.ts`、`packages/build/src/__tests__/fixture.ts`、`packages/imagegen/src/__tests__/fixture.ts` 三个文件的这一区域**逐字相同**，做同样的替换。

`const home: BlockSelection[] = [` 那一整段替换为：

```ts
  const home: BlockSelection[] = [
    {
      component: 'HeroSplit',
      props: {
        headline: 'Ship faster',
        subhead: 'A "quoted" & ampersanded subhead',
        primaryCta: { label: 'See pricing', to: '/pricing' },
      },
      content: { illustration: { prompt: 'a developer at a desk', alt: 'Developer at a desk' } },
    },
    {
      component: 'StatsBand',
      props: {
        heading: 'By the numbers',
        stats: [
          { label: 'Users', value: '12k' },
          { label: 'Uptime', value: '99.9', suffix: '%' },
        ],
      },
    },
    {
      component: 'FeatureTriad',
      props: {
        heading: 'Why Acme',
        features: [
          { title: 'Fast', body: 'Very fast.' },
          { title: 'Safe', body: 'Very safe.' },
          { title: 'Simple', body: 'Very simple.' },
        ],
      },
    },
    { component: 'CtaBanner', props: { headline: 'Ready?', cta: { label: 'Choose a plan', to: '/pricing' } } },
  ]
```

`const pricing: BlockSelection[] = [` 那一整段替换为：

```ts
  const pricing: BlockSelection[] = [
    { component: 'HeroCentered', props: { headline: 'Pricing' } },
    {
      component: 'PricingCard',
      props: {
        heading: 'Pick a plan',
        plans: [
          {
            name: 'Pro',
            price: '$29',
            features: ['Unlimited projects', 'Priority support'],
            cta: { label: 'Start with Pro', to: '/' },
            featured: true,
          },
        ],
      },
    },
  ]
```

> `StatsBand` 是有意放进首页的：它没有 slot，正是 `page.test.ts` 里「有 slot 的块才有 `assetsN`」那条断言的对照组。

- [ ] **Step 5: 改 `page.test.ts` 的下标与清单断言**

`imports each distinct block component exactly once`：

```ts
    expect(names).toEqual(['CtaBanner', 'FeatureTriad', 'HeroSplit', 'StatsBand'])
```

`emits one tag per block, in spec order`：

```ts
    expect(order).toEqual(['HeroSplit', 'StatsBand', 'FeatureTriad', 'CtaBanner'])
```

`takes w/h from the sidecar, not from the manifest entry`、`references images by contentHash under ./assets/`：不变。

`declares an assets const only for blocks that have slots` 整条替换为：

```ts
  it('declares an assets const only for blocks that have slots', () => {
    const spec = landingSpec()
    const sfc = renderPage(spec, homePage(spec))
    // StatsBand (index 1) is slotless; the other three each own slot images.
    expect(sfc).not.toContain('const assets1')
    expect(sfc).toContain('const assets0: SlotAssets')
    expect(sfc).toContain('const assets2: SlotAssets')
    expect(sfc).toContain('const assets3: SlotAssets')
  })
```

`keeps prop values in the script block, never inline in attributes`：

```ts
    // Quotes and ampersands survive verbatim as a JS string in the script…
    expect(sfc).toContain('"subhead": "A \\"quoted\\" & ampersanded subhead"')
    // …and the template only ever references the const, so no HTML entity
    // escaping is needed and vue-tsc sees a plain identifier.
    expect(template).toContain('v-bind="props0"')
    expect(template).not.toContain('&quot;')
    expect(template).not.toContain('subhead')
```

`binds props and assets separately so blocks without slots stay bare`：

```ts
    expect(sfc).toContain('const props0 = {')
    expect(sfc).toContain('const props1 = {')
    expect(sfc).not.toContain('const assets1')
```

- [ ] **Step 6: 跑测试确认全绿**

Run: `pnpm --filter @vudt/codegen test && pnpm --filter @vudt/build test && pnpm --filter @vudt/imagegen test`
Expected: PASS。三个包的 `landingSpec()` 夹具都改了，所以三个包都要跑 —— 只跑 codegen 会漏掉 build/imagegen 里引用同一夹具的断言。

- [ ] **Step 7: 提交**

```bash
git add packages/codegen/src/page.ts packages/codegen/src/__tests__ packages/build/src/__tests__/fixture.ts packages/imagegen/src/__tests__/fixture.ts
git commit -m "feat(codegen): refuse to render a layout block inside a page

spec 不只来自 draft 路径（模板预设、手写 spec 都直达 renderPage），一个把
NavBarSimple 放进 pages[].blocks 的手写 spec 会渲染出第二个导航，把刚修掉的
bug 从侧门放回来。

连带改三个 landingSpec() 夹具：nav/footer 换成内容块，首页块序变为
[HeroSplit, StatsBand, FeatureTriad, CtaBanner]。StatsBand 是有意选的对照组
—— 它没 slot，保住 page.test.ts 里「只有带 slot 的块才有 assetsN」的断言。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 5: draft 下限（`pages.min(3)` / `blocks.min(2)`）与夹具多页化

「完整站点」是 drafter 的契约，不是 spec 容器的契约，所以下限钉在 draft schema 上，`packages/spec` 不动。

**Files:**
- Modify: `packages/templates/blocks/src/draft.ts`
- Modify: `packages/templates/blocks/src/__tests__/draft.test.ts`
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`（:231 那处 `deriveSpecInput` 的单页 draft）
- Modify: `server/src/__tests__/fixture.ts`
- Modify: `server/src/__tests__/spec-source.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `assertCtaTargets` 与 layoutOnly 拒绝（都已在 `deriveSpecInput` 里生效）。
- Produces:
  - `ProjectDraftSchema`：`pages` 至少 3 项，每页 `blocks` 至少 2 项。feedback 走 `formatIssues`，是路径前缀文本，例如 `pages: Too small…` 与 `pages.0.blocks: Too small…`。
  - `server/src/__tests__/fixture.ts` 的 `landingDraft()` 变成 3 页（首页 + `/about` + `/pricing`）—— `spec-source.test.ts` 里凡覆盖 `draft.pages` 的地方同样必须给够 3 页。

- [ ] **Step 1: 写失败测试**

`packages/templates/blocks/src/__tests__/draft.test.ts`，把 `landingDraft` 与它下面的两个 helper 区域（原第 33-65 行）整体替换为：

```ts
/**
 * The draft contract demands a small site, not a single page. Fixtures have to
 * satisfy it or every assertion below would fail on the shape gate instead of on
 * the behaviour it means to test.
 */
function contentBlock(component: string, props?: unknown, content?: unknown): Record<string, unknown> {
  return {
    component,
    ...(props === undefined ? {} : { props }),
    ...(content === undefined ? {} : { content }),
  }
}

function homePage(blocks?: unknown): Record<string, unknown> {
  return {
    route: '/',
    title: 'Home',
    pageType: 'landing',
    blocks: blocks ?? [
      contentBlock(
        'HeroSplit',
        { primaryCta: { label: 'See pricing', to: '/pricing' } },
        { illustration: { prompt: 'a developer at a desk', alt: 'Developer at a desk' } },
      ),
      contentBlock('StatsBand', { heading: 'By the numbers' }),
    ],
  }
}

/** A legal filler page: three pages minimum, two blocks each. */
function fillerPage(route: string, title: string): Record<string, unknown> {
  return {
    route,
    title,
    pageType: 'landing',
    blocks: [contentBlock('StatsBand'), contentBlock('TestimonialRow')],
  }
}

/** What the model is expected to send: blocks carry subject text, not geometry. */
function landingDraft(pages?: unknown): Record<string, unknown> {
  return {
    meta: { name: 'Acme', description: 'A landing page for Acme', targetStack: 'vue3' },
    theme,
    styleBible,
    pages: pages ?? [homePage(), fillerPage('/about', 'About'), fillerPage('/pricing', 'Pricing')],
  }
}
```

改三处既有断言：

- `binds every slot and takes its geometry from the sidecar`：`value.pages[0]!.blocks[1]!.assetBindings.illustration` → `value.pages[0]!.blocks[0]!.assetBindings.illustration`，并加一条 `expect(value.pages[1]!.blocks).toHaveLength(2)`（顺带验证填充页也过了闸）。`expect(value.assets).toHaveLength(1)` 不变（只有 HeroSplit 有 slot）。
- `falls back to the sidecar default when a slot is left out`：`landingDraft([...])` 的单页参数改成

```ts
        landingDraft([
          homePage([contentBlock('HeroSplit')]),
          fillerPage('/about', 'About'),
          fillerPage('/pricing', 'Pricing'),
        ]),
```

- `names the declared slots when the draft invents one` 与 `names the available components when the draft picks an unknown one`：同样把单页参数换成 `[homePage([...]), fillerPage('/about', 'About'), fillerPage('/pricing', 'Pricing')]`，其中第一项分别是

```ts
          homePage([contentBlock('HeroSplit', undefined, { banner: { prompt: 'anything' } })]),
```
```ts
          homePage([contentBlock('MadeUpBlock'), contentBlock('StatsBand')]),
```

- `rejects two pages that derive the same asset id`：`landingDraft([page, page])` → `landingDraft([page, page, fillerPage('/about', 'About')])`，其中 `page` 改为

```ts
    const page = {
      route: '/',
      title: 'Home',
      pageType: 'landing',
      blocks: [contentBlock('HeroSplit'), contentBlock('StatsBand')],
    }
```

在文件末尾追加：

```ts
describe('deriveSpecInput gate: the draft has to be a site, not a page', () => {
  it('rejects a draft that plans only one page, naming the path', () => {
    const feedback = failureOf(deriveSpecInput(landingDraft([homePage()])))

    expect(feedback).toMatch(/^pages: /m)
  })

  it('rejects a page with a single block, naming the page', () => {
    const feedback = failureOf(
      deriveSpecInput(
        landingDraft([
          homePage([contentBlock('StatsBand')]),
          fillerPage('/about', 'About'),
          fillerPage('/pricing', 'Pricing'),
        ]),
      ),
    )

    expect(feedback).toMatch(/^pages\.0\.blocks: /m)
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm --filter @vudt/blocks test -- draft`
Expected: FAIL —— 两条新用例报 `expected failure`（下限还没加，单页 draft 仍然通过），并且原来的 `names the available components…` 会因为夹具已多页化而恰好仍然通过（说明夹具改造本身是对的）。

- [ ] **Step 3: 加下限**

`packages/templates/blocks/src/draft.ts`：

`DraftPageSchema` 的 `blocks` 改为：

```ts
  blocks: z.array(DraftBlockSchema).min(2),
```

`ProjectDraftSchema` 的 `pages` 改为：

```ts
  pages: z.array(DraftPageSchema).min(3),
```

并在 `ProjectDraftSchema` 上方补一条注释：

```ts
/**
 * "A complete site" is the drafter's contract, not the spec container's: a spec
 * is still allowed to hold one page, because template presets and hand-edited
 * specs use it that way. Relaxing the spec to fit one model run — or tightening
 * it to force one — is the mistake this split avoids.
 */
```

- [ ] **Step 3b: 把 `derive.test.ts` 里那处单页 draft 也改成 3 页**

`packages/templates/blocks/src/__tests__/derive.test.ts` 的 `silently strips unknown keys a model might add (e.g. an outline)` 直接调了 `deriveSpecInput`，而它的 draft 只有 **1 页 1 块** —— 下限一加，形状闸先失败，`result.ok` 变成 `false`，这条测试的两个断言会一起崩。Task 3 只把组件名从 `NavBarSimple` 换成了 `StatsBand`，页数与块数没动。

把那一处 `pages:` 替换为：

```ts
      pages: [
        { route: '/', title: 'Home', pageType: 'landing', blocks: [{ component: 'StatsBand', outline: 'hero first, then value' }, { component: 'TestimonialRow' }] },
        { route: '/about', title: 'About', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
        { route: '/pricing', title: 'Pricing', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
      ],
```

两条断言（`result.ok === true`、`blocks[0].props` 等于 `{}`）保持不变 —— `outline` 仍然是被静默剥掉的未知键，填充页仍是无 slot 的内容块。

> 仓库里另外两处 `deriveSpecInput` 调用不用动：`server/src/__tests__/spec-view.test.ts:9` 调的是 `landingDraft()` 无参形式，会直接拿到 Step 4 改好的 3 页夹具；`server/src/spec-source.ts:53` 是生产代码。

- [ ] **Step 4: 把服务端夹具改成 3 页**

`server/src/__tests__/fixture.ts` 的 `landingDraft()` 里 `pages: [...]` 那一项替换为：

```ts
    pages: [
      {
        route: '/',
        title: 'Home',
        pageType: 'landing',
        blocks: [
          {
            component: 'HeroSplit',
            props: {
              headline: 'Ship faster',
              subhead: 'Tooling that gets out of the way',
              primaryCta: { label: 'See pricing', to: '/pricing' },
            },
            content: { illustration: { prompt: 'a developer at a desk', alt: 'Developer at a desk' } },
          },
          { component: 'StatsBand', props: { heading: 'By the numbers' } },
        ],
      },
      {
        route: '/about',
        title: 'About',
        pageType: 'landing',
        blocks: [
          { component: 'StatsBand', props: { heading: 'Our story' } },
          { component: 'TestimonialRow', props: { heading: 'What people say' } },
        ],
      },
      {
        route: '/pricing',
        title: 'Pricing',
        pageType: 'landing',
        blocks: [
          { component: 'HeroCentered', props: { headline: 'Pricing' } },
          { component: 'PricingCard', props: { heading: 'Pick a plan' } },
        ],
      },
    ],
```

- [ ] **Step 5: 修 `spec-source.test.ts` 的两页覆盖**

`rejects duplicate routes — the check derivation does not do`（原第 67-85 行）里 `draft.pages` 的赋值替换为：

```ts
    draft.pages = [
      { route: '/', title: 'Home', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
      { route: '/', title: 'Home again', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
      { route: '/pricing', title: 'Pricing', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
    ]
```

并把上面那句注释补全：

```ts
    // Slotless blocks on purpose: with slots, the second page would collide on
    // asset ids first and this would stop proving gate 2 does anything. Three
    // pages because the draft contract demands a site, not a single page.
```

- [ ] **Step 6: 跑测试确认全绿**

Run: `pnpm --filter @vudt/blocks test && pnpm --filter @vudt/server test && pnpm --filter @vudt/blocks typecheck`
Expected: PASS。若 `draft.test.ts` 还有红的，检查是不是漏了某处单页覆盖 —— 夹具改造要覆盖文件里**每一处** `landingDraft([...])` 的单页参数。

- [ ] **Step 7: 提交**

```bash
git add packages/templates/blocks/src/draft.ts packages/templates/blocks/src/__tests__/draft.test.ts server/src/__tests__/fixture.ts server/src/__tests__/spec-source.test.ts
git commit -m "feat(blocks): require at least three pages with two blocks each

「完整站点」是 drafter 的契约，不是 spec 容器的契约 —— spec 仍要允许单页，
模板预设与手改 spec 都用得上它。所以下限钉在 draft schema 上，
packages/spec 零改动。zod 的 feedback 自带路径前缀（pages: 与
pages.0.blocks:），可以直接喂回重试回路。

连带：server 的 landingDraft() 与 draft.test.ts 的 6 处单页覆盖都改成 3 页，
否则它们会先在 shape 闸上失败，而不是走到各自要断言的逻辑。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 6: codegen 的布局产物（`layouts.ts` / `app.ts` / `meta.chrome`）

导航条目、布局形态、顶栏 CTA、页脚 note 全部从 `spec.pages` 派生 —— 模型一个字都碰不到，所以「导航指向不存在的页」在结构上不可能发生。

**Files:**
- Create: `packages/codegen/src/layouts.ts`
- Create: `packages/codegen/src/app.ts`
- Create: `packages/codegen/src/__tests__/layouts.test.ts`
- Create: `packages/codegen/src/__tests__/app.test.ts`
- Modify: `packages/codegen/src/router.ts`
- Modify: `packages/codegen/src/project.ts`
- Modify: `packages/codegen/src/__tests__/project.test.ts`
- Modify: `packages/codegen/src/__tests__/fixture.ts`

**Interfaces:**
- Consumes: Task 2 的 `AppShell` / `SidebarShell`（底座路径 `src/layouts/<Shell>.vue`，props 见 Task 2）。
- Produces:
  - `type ShellName = 'AppShell' | 'SidebarShell'`
  - `interface NavLink { label: string; to: string }`
  - `interface LayoutPlan { shell: ShellName; brand: string; links: NavLink[]; cta?: NavLink; note: string }`
  - `pickShell(spec): ShellName`、`navLinks(spec): NavLink[]`、`topBarCta(spec): NavLink | undefined`、`footerNote(spec): string`、`planLayout(spec): LayoutPlan` —— 全部从 `packages/codegen/src/layouts.ts` 导出
  - `renderApp(spec: ProjectSpec): string` —— 从 `packages/codegen/src/app.ts` 导出
  - `renderRouter(spec)` 对 `pageType === 'auth'` 的页写 `meta: { chrome: false }`
  - `generateProject(spec).files` 新增键 `src/App.vue`

- [ ] **Step 1: 先给夹具加一个 auth 页**

这一步**必须排在写新断言之前**：下面 `layouts.test.ts` 与 `app.test.ts` 的四处断言都依赖 `landingSpec()` 里存在一个 auth 页（顶栏 CTA 才有东西可取）。夹具先改，断言才写得对；反过来先写断言再改夹具，会写出两组互相矛盾的期望。

`packages/codegen/src/__tests__/fixture.ts`：在 `const pricing: BlockSelection[] = […]` 之后、`const homeDerived = …` 之前插入：

```ts
  const signin: BlockSelection[] = [
    {
      component: 'AuthPanel',
      props: {
        mode: 'sign-in',
        heading: 'Sign in to Acme',
        fields: [{ label: 'Email', type: 'email' }],
        submitLabel: 'Sign in',
        altActionLabel: 'Create an account',
      },
    },
    { component: 'TestimonialRow', props: { heading: 'Loved by developers' } },
  ]
```

把 `const homeDerived = derivePageAssets('/', home)` 那一行下面改成三行：

```ts
  const homeDerived = derivePageAssets('/', home)
  const pricingDerived = derivePageAssets('/pricing', pricing)
  const signinDerived = derivePageAssets('/signin', signin)
```

`pages:` 数组加一项（放在 `/pricing` 之后）：

```ts
      { route: '/signin', title: 'Sign in', pageType: 'auth', blocks: signinDerived.blocks },
```

`assets:` 改成：

```ts
    assets: mergeDerivedAssets([homeDerived, pricingDerived, signinDerived]),
```

> `AuthPanel` 与 `TestimonialRow` 都是 `slots: []`，所以 `signinDerived.assets` 是空数组，`mergeDerivedAssets` 收下它不影响既有 asset 断言。两块的写法同时满足 Task 5 的 `blocks.min(2)`（虽然 codegen 夹具走 `derivePageAssets` + `ProjectSpecInputSchema`，**不**经过 `deriveSpecInput`，下限对它并不生效 —— 保持同形是为了让夹具与真实产出长得一样）。

- [ ] **Step 2: 写失败测试 —— `layouts.test.ts`**

Create `packages/codegen/src/__tests__/layouts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ProjectSpec } from '@vudt/spec'
import { footerNote, navLinks, pickShell, planLayout, topBarCta } from '../layouts.js'
import { landingSpec } from './fixture.js'

/** Replaces the page list while keeping a schema-valid spec around it. */
function withPages(spec: ProjectSpec, pages: ProjectSpec['pages']): ProjectSpec {
  return { ...spec, pages }
}

function page(
  route: string,
  title: string,
  pageType: ProjectSpec['pages'][number]['pageType'],
): ProjectSpec['pages'][number] {
  return { route, title, pageType, blocks: [] }
}

describe('pickShell', () => {
  it('uses the top bar for a marketing site', () => {
    expect(pickShell(landingSpec())).toBe('AppShell')
  })

  for (const pageType of ['dashboard', 'settings', 'list-detail'] as const) {
    it(`uses the sidebar when a ${pageType} page is declared`, () => {
      const spec = withPages(landingSpec(), [
        page('/', 'Home', 'landing'),
        page('/console', 'Console', pageType),
      ])
      expect(pickShell(spec)).toBe('SidebarShell')
    })
  }
})

describe('navLinks', () => {
  it('lists every page in declaration order, labelled with its title', () => {
    expect(navLinks(landingSpec())).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Pricing', to: '/pricing' },
    ])
  })

  // The auth page is reached through the top-bar CTA instead; leaving it in the
  // nav as well would put a sign-in link in the middle of the menu.
  it('leaves auth pages out without disturbing the order of the rest', () => {
    const spec = withPages(landingSpec(), [
      page('/', 'Home', 'landing'),
      page('/signin', 'Sign in', 'auth'),
      page('/pricing', 'Pricing', 'landing'),
    ])
    expect(navLinks(spec)).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Pricing', to: '/pricing' },
    ])
  })
})

describe('topBarCta', () => {
  it('names the first auth page so it stays reachable', () => {
    expect(topBarCta(landingSpec())).toEqual({ label: 'Sign in', to: '/signin' })
  })

  it('takes the first of several auth pages', () => {
    const spec = withPages(landingSpec(), [
      page('/', 'Home', 'landing'),
      page('/signin', 'Sign in', 'auth'),
      page('/signup', 'Sign up', 'auth'),
    ])
    expect(topBarCta(spec)).toEqual({ label: 'Sign in', to: '/signin' })
  })

  it('is undefined when the project declares no auth page', () => {
    expect(topBarCta(withPages(landingSpec(), [page('/', 'Home', 'landing')]))).toBeUndefined()
  })
})

describe('footerNote', () => {
  it('takes the first sentence of the description', () => {
    expect(footerNote(landingSpec())).toBe('A marketing landing page for a developer tooling product.')
  })

  it('truncates a first sentence that would run long in a footer', () => {
    const spec = {
      ...landingSpec(),
      meta: { ...landingSpec().meta, description: `${'x'.repeat(200)}.` },
    }
    const note = footerNote(spec)
    expect(note.endsWith('…')).toBe(true)
    expect(note.length).toBeLessThanOrEqual(141)
  })
})

describe('planLayout', () => {
  it('assembles the whole plan from the spec alone', () => {
    expect(planLayout(landingSpec())).toEqual({
      shell: 'AppShell',
      brand: 'Acme Landing',
      links: [
        { label: 'Home', to: '/' },
        { label: 'Pricing', to: '/pricing' },
      ],
      cta: { label: 'Sign in', to: '/signin' },
      note: 'A marketing landing page for a developer tooling product.',
    })
  })

  // `cta` is absent rather than undefined so the rendered App.vue can tell the
  // two cases apart without emitting a dead `const cta = undefined`.
  it('omits the cta key entirely when there is no auth page', () => {
    const spec = withPages(landingSpec(), [page('/', 'Home', 'landing')])
    expect(planLayout(spec)).not.toHaveProperty('cta')
  })
})
```

- [ ] **Step 3: 写失败测试 —— `app.test.ts`**

Create `packages/codegen/src/__tests__/app.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ProjectSpec } from '@vudt/spec'
import { renderApp } from '../app.js'
import { landingSpec } from './fixture.js'

function withPages(spec: ProjectSpec, pages: ProjectSpec['pages']): ProjectSpec {
  return { ...spec, pages }
}

function page(
  route: string,
  title: string,
  pageType: ProjectSpec['pages'][number]['pageType'],
): ProjectSpec['pages'][number] {
  return { route, title, pageType, blocks: [] }
}

describe('renderApp', () => {
  it('selects the shell the layout plan asked for', () => {
    const sfc = renderApp(landingSpec())

    expect(sfc).toContain(`import AppShell from './layouts/AppShell.vue'`)
    expect(sfc).toContain('<AppShell')
    expect(sfc).toContain('<RouterView />')
  })

  it('writes the brand, the nav entries and the cta as script consts', () => {
    const sfc = renderApp(landingSpec())

    expect(sfc).toContain('const brand = "Acme Landing"')
    expect(sfc).toContain('{ label: "Home", to: "/" }')
    expect(sfc).toContain('{ label: "Pricing", to: "/pricing" }')
    expect(sfc).toContain('const cta = { label: "Sign in", to: "/signin" }')
    // Every destination is a declared route, so no link can dangle.
    expect(sfc).toContain(':links="links"')
  })

  it('passes a chromeless flag so auth pages can drop the shell chrome', () => {
    const sfc = renderApp(landingSpec())

    expect(sfc).toContain(`import { computed } from 'vue'`)
    expect(sfc).toContain(`import { useRoute } from 'vue-router'`)
    expect(sfc).toContain('route.meta.chrome === false')
    expect(sfc).toContain(':chromeless="chromeless"')
  })

  it('renders the sidebar shell without the footer note', () => {
    const spec = withPages(landingSpec(), [
      page('/', 'Home', 'landing'),
      page('/console', 'Console', 'dashboard'),
    ])
    const sfc = renderApp(spec)

    expect(sfc).toContain(`import SidebarShell from './layouts/SidebarShell.vue'`)
    expect(sfc).not.toContain('const note')
  })

  // Dropping the cta on the sidebar branch would reopen the hole the top-bar cta
  // exists to close: an auth page is in no nav entry, so the button is its only
  // way in — and the sidebar has one too.
  it('still passes the auth cta to the sidebar shell', () => {
    const spec = withPages(landingSpec(), [
      page('/', 'Home', 'landing'),
      page('/console', 'Console', 'dashboard'),
      page('/signin', 'Sign in', 'auth'),
    ])
    const sfc = renderApp(spec)

    expect(sfc).toContain(`import SidebarShell from './layouts/SidebarShell.vue'`)
    expect(sfc).toContain('const cta = { label: "Sign in", to: "/signin" }')
    expect(sfc).toContain(':cta="cta"')
    expect(sfc).not.toContain('const note')
  })

  it('is deterministic: same spec in, byte-identical output out', () => {
    expect(renderApp(landingSpec())).toBe(renderApp(landingSpec()))
  })
})
```

- [ ] **Step 4: 更新 `project.test.ts` 的期望**

`packages/codegen/src/__tests__/project.test.ts`：

`emits one page file per spec page plus router and tokens` 的期望列表替换为：

```ts
    expect(Object.keys(files).sort()).toEqual([
      'src/App.vue',
      'src/pages/HomePage.vue',
      'src/pages/PricingPage.vue',
      'src/pages/SigninPage.vue',
      'src/router.ts',
      'src/styles/tokens.css',
    ])
```

`describe('renderRouter', …)` 里追加：

```ts
  it('drops the shell chrome on auth routes', () => {
    const router = renderRouter(landingSpec())

    expect(router).toMatch(/path: "\/signin"[\s\S]*?meta: \{ chrome: false \}/)
    // The flag is per page, so it must not leak onto the marketing routes.
    expect(router).not.toMatch(/path: "\/"[\s\S]{0,90}chrome/)
  })
```

- [ ] **Step 5: 跑测试确认它红**

Run: `pnpm --filter @vudt/codegen test -- layouts app project`
Expected: FAIL —— `Cannot find module '../layouts.js'`、`Cannot find module '../app.js'`；`emits one page file…` 报缺 `src/App.vue`。

- [ ] **Step 6: 建 `packages/codegen/src/layouts.ts`**

```ts
import type { ProjectSpec } from '@vudt/spec'

/** The layout component a project renders once around every page. */
export type ShellName = 'AppShell' | 'SidebarShell'

export interface NavLink {
  label: string
  to: string
}

export interface LayoutPlan {
  shell: ShellName
  brand: string
  links: NavLink[]
  /** Top-bar call to action; absent when the project declares no auth page. */
  cta?: NavLink
  note: string
}

/**
 * Page types that want a sidebar rather than a top bar. Derived rather than
 * declared as `spec.layout`, because adding that field would mean touching the
 * spec schema for a preference the page types already express.
 */
const SIDEBAR_PAGE_TYPES: readonly string[] = ['dashboard', 'settings', 'list-detail']

const NOTE_LIMIT = 140

export function pickShell(spec: ProjectSpec): ShellName {
  return spec.pages.some((page) => SIDEBAR_PAGE_TYPES.includes(page.pageType))
    ? 'SidebarShell'
    : 'AppShell'
}

/**
 * Every page the visitor can navigate to, in the order the spec declared them.
 * Auth pages are excluded because they are reached through the top-bar CTA —
 * and because a "Sign in" entry in the middle of the menu reads as a mistake.
 */
export function navLinks(spec: ProjectSpec): NavLink[] {
  return spec.pages
    .filter((page) => page.pageType !== 'auth')
    .map((page) => ({ label: page.title, to: page.route }))
}

/**
 * Reserving the CTA for the first auth page closes a hole that would otherwise
 * open the moment auth pages leave the nav: with no nav entry and no CTA, there
 * would be no way to reach the sign-in page at all.
 */
export function topBarCta(spec: ProjectSpec): NavLink | undefined {
  const auth = spec.pages.find((page) => page.pageType === 'auth')
  return auth === undefined ? undefined : { label: auth.title, to: auth.route }
}

/** The first sentence of the description, because a footer is not a paragraph. */
export function footerNote(spec: ProjectSpec): string {
  const description = spec.meta.description.trim()
  const firstSentence = description.split(/(?<=[。！？.!?])/)[0]?.trim() ?? ''
  const note = firstSentence === '' ? description : firstSentence

  if (note === '') return `© ${spec.meta.name}`
  return note.length > NOTE_LIMIT ? `${note.slice(0, NOTE_LIMIT).trimEnd()}…` : note
}

export function planLayout(spec: ProjectSpec): LayoutPlan {
  const cta = topBarCta(spec)
  return {
    shell: pickShell(spec),
    brand: spec.meta.name,
    links: navLinks(spec),
    ...(cta === undefined ? {} : { cta }),
    note: footerNote(spec),
  }
}
```

> `MetaSchema` 要求 `description` 非空，所以 `© {name}` 那条兜底对合规 spec 不可达 —— 它存在只是为了让 `footerNote` 对任何输入都返回字符串。没有取当前年份，所以输出是确定性的，`project.test.ts` 的「同 spec 进、同字节出」仍然成立。

- [ ] **Step 7: 建 `packages/codegen/src/app.ts`**

```ts
import type { ProjectSpec } from '@vudt/spec'
import { planLayout } from './layouts.js'

function linkLiteral(link: { label: string; to: string }): string {
  return `{ label: ${JSON.stringify(link.label)}, to: ${JSON.stringify(link.to)} }`
}

/**
 * Builds the project-level App.vue.
 *
 * This is where the cross-page invariant becomes structural: the nav entries and
 * the CTA are written here from `spec.pages`, so a link can only ever name a
 * route the router actually declares. The model never writes any of it.
 */
export function renderApp(spec: ProjectSpec): string {
  const { shell, brand, links, cta, note } = planLayout(spec)

  const consts = [
    `const brand = ${JSON.stringify(brand)}`,
    `const links = [\n${links.map((link) => `  ${linkLiteral(link)},`).join('\n')}\n]`,
  ]
  const attrs = [`  :brand="brand"`, `  :links="links"`]

  if (shell === 'AppShell') {
    consts.push(`const cta = ${cta === undefined ? 'undefined' : linkLiteral(cta)}`)
    consts.push(`const note = ${JSON.stringify(note)}`)
    attrs.push(`  :cta="cta"`, `  :note="note"`)
  } else if (cta !== undefined) {
    // The sidebar shell has a cta slot too: an auth page is in no nav entry, so
    // this button is its only way in.
    consts.push(`const cta = ${linkLiteral(cta)}`)
    attrs.push(`  :cta="cta"`)
  }

  attrs.push(`  :chromeless="chromeless"`)

  const script = [
    `import { computed } from 'vue'`,
    `import { useRoute } from 'vue-router'`,
    `import ${shell} from './layouts/${shell}.vue'`,
    '',
    ...consts,
    '',
    `const route = useRoute()`,
    `const chromeless = computed(() => route.meta.chrome === false)`,
  ].join('\n')

  return (
    `<script setup lang="ts">\n` +
    `${script}\n` +
    `</script>\n\n` +
    `<template>\n` +
    `  <${shell}\n` +
    `${attrs.join('\n')}\n` +
    `  >\n` +
    `    <RouterView />\n` +
    `  </${shell}>\n` +
    `</template>\n`
  )
}
```

> `<router-link>` 与 `<RouterView>` 由 `app.use(router)` 全局注册，不需要 import —— 现有 `App.vue` 就是这么用 `<RouterView />` 的。`<script setup>` 本身不需要 `defineComponent`。

- [ ] **Step 8: 让 `renderRouter` 给 auth 页写 `chrome: false`**

`packages/codegen/src/router.ts` 的 `entries` 映射替换为：

```ts
  const entries = spec.pages
    .map((page) => {
      const name = pageComponentName(page.route)
      // Auth pages render without the shell. The flag rides on the route so the
      // generated App.vue can decide per navigation instead of per project.
      const meta = page.pageType === 'auth' ? `\n    meta: { chrome: false },` : ''
      return (
        `  {\n` +
        `    path: ${JSON.stringify(page.route)},\n` +
        `    name: ${JSON.stringify(routeName(page.route))},\n` +
        `    component: ${name},${meta}\n` +
        `  },`
      )
    })
    .join('\n')
```

> `meta` 能通过 vue-tsc 是因为 vue-router 的 `RouteMeta extends Record<string | number | symbol, unknown>`，任意键都合法。

- [ ] **Step 9: 让 `generateProject` 产出 `App.vue`**

`packages/codegen/src/project.ts`：import 加一行

```ts
import { renderApp } from './app.js'
```

`generateProject` 里 `files['src/router.ts'] = renderRouter(spec)` **之前**插入：

```ts
  files['src/App.vue'] = renderApp(spec)
```

并把 `generateProject` 的文档注释末尾补一句：

```ts
 * App.vue is generated rather than copied because the nav, the CTA and the
 * shell choice all come from `spec.pages` — it is the one file where the
 * project's cross-page structure is written down.
```

> **不要**把 `src/App.vue` 加进 `REPLACED_TEMPLATE_FILES` —— 那个常量是死代码（全仓无消费者），加进去是空操作。`copyTemplate` 先全量拷贝、`generated.files` 再逐个覆盖，App.vue 本来就会被覆盖。

- [ ] **Step 10: 跑测试确认全绿**

Run: `pnpm --filter @vudt/codegen test && pnpm --filter @vudt/build test && pnpm --filter @vudt/imagegen test && pnpm --filter @vudt/server test`
Expected: PASS。build / imagegen / server 各自有自己的夹具副本，不受 codegen 夹具加页影响 —— 如果它们红了，说明改动漏进了共享代码。

- [ ] **Step 11: 提交**

```bash
git add packages/codegen/src
git commit -m "feat(codegen): generate a project-level App.vue from the page list

新增 layouts.ts（纯函数：选 shell、导航条目、顶栏 CTA、页脚 note）与 app.ts
（renderApp → src/App.vue）。导航条目与 CTA 全部从 spec.pages 写出，所以
「链接指向不存在的路由」在结构上不可能发生 —— 模型一个字都碰不到。

布局形态由 pageType 推导（dashboard/settings/list-detail → 侧栏），不加
spec.layout 字段。auth 页由 renderRouter 写 meta.chrome=false，App.vue 据此
剥掉 shell chrome；同时它被排除出导航条目，靠顶栏 CTA 保住可达性 ——
SidebarShell 分支也传 cta，否则侧栏项目里这个洞原样保留。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 7: drafter prompt 改写

prompt 里那句 `Keep the page count and the block count small: 1-3 pages` 加上 `prefer a few well-chosen sections over a long page`，等于在劝模型只做一页 —— 实测 4 个真任务里 3 个只生成了 `HomePage.vue`。

**Files:**
- Modify: `packages/providers/src/openai-spec-drafter.ts`
- Modify: `packages/providers/src/__tests__/openai-spec-drafter.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `BlockDefinition.layoutOnly`（走 `BLOCK_REGISTRY`）。
- Produces: `renderBlockCatalogue()` 跳过 `layoutOnly` 项；`systemPrompt()` 要求 3-6 页、每页 2-5 块、`title` 2-6 词、`to` 必须是已声明 route。目录行格式仍是 `- <Component> [pages: …] props: … | slots: …`（测试按 `^- <Component>` 断言行首）。

- [ ] **Step 1: 写失败测试**

`packages/providers/src/__tests__/openai-spec-drafter.test.ts`：import 区加

```ts
import { BLOCK_REGISTRY, listBlockComponents } from '@vudt/blocks'
```

把 `lists every registered block component in the system prompt` 整条替换为：

```ts
  test('lists every content block in the catalogue and no layout component', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    for (const definition of BLOCK_REGISTRY.values()) {
      const listed = new RegExp(`^- ${definition.component}\\b`, 'm').test(system)
      // Nav and footer are rendered once by the shell, so offering them here
      // would invite the model to put a second one inside a page.
      expect(listed, `${definition.component} layoutOnly=${definition.layoutOnly}`).toBe(
        definition.layoutOnly !== true,
      )
    }
  })
```

在文件末尾（最后一个 `test` 之后）追加：

```ts
  test('asks for a small site rather than a single page', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    expect(system).toMatch(/3-6 pages/)
    expect(system).toMatch(/at least two inner pages|home page plus/i)
    // The line that used to talk the model out of a second page.
    expect(system).not.toContain('Keep the page count')
    expect(system).not.toContain('prefer a few well-chosen sections')
  })

  test('constrains titles, because the nav bar reuses them verbatim', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    expect(system).toMatch(/2-6 words/)
    expect(system).toMatch(/nav bar/i)
  })

  test('documents the to-is-a-route convention', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    expect(system).toMatch(/prop named "to"/)
    expect(system).toMatch(/never write an anchor|#pricing/i)
  })

  // A draft that is not a site never reaches gate 1, so the prompt has to say so
  // before the model spends a whole turn on one page.
  test('states the page and block minimums the draft schema enforces', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    expect(systemOf(calls[0]!)).toMatch(/2-5 content blocks|2-5 blocks/)
  })
```

`listBlockComponents` 若在替换后不再被本文件使用，把它从 import 里去掉（`BLOCK_REGISTRY` 就够了）。

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm --filter @vudt/providers test -- openai-spec-drafter`
Expected: FAIL —— `lists every content block…` 对 `NavBarSimple` / `FooterSimple` 报 `expected true, received false`；`asks for a small site…` 报 `expected '…' to match /3-6 pages/`。

- [ ] **Step 3: 让目录跳过布局件**

`packages/providers/src/openai-spec-drafter.ts` 的 `renderBlockCatalogue()`，把循环体开头改成：

```ts
  for (const component of [...BLOCK_REGISTRY.keys()].sort()) {
    const definition = BLOCK_REGISTRY.get(component)!
    // Nav and footer are project-level layout: the app shell renders them once
    // from the spec's own page list. Listing them would offer the model a block
    // that gate 1 rejects, burning a whole retry on a guaranteed failure.
    if (definition.layoutOnly === true) continue
    const pageTypes = definition.pageTypes.join(', ')
```

并把函数的文档注释补一句：

```ts
 * Layout components are left out on purpose — see the loop below.
```

- [ ] **Step 4: 改写 `systemPrompt()` 的规则段**

`packages/providers/src/openai-spec-drafter.ts` 里这两行

```ts
    '- Keep the page count and the block count small: 1-3 pages, 2-5 blocks per page. Every slot you',
    '  use costs one image, so prefer a few well-chosen sections over a long page.',
```

替换为：

```ts
    '- Plan a small site, not one page: 3-6 pages — a home page plus at least two inner pages a',
    '  visitor would actually want (pricing, about, docs, contact, sign in).',
    '- Give each page 2-5 content blocks.',
    '- "title" is short: 2-6 words. The nav bar uses it verbatim as the link text, and the first',
    '  auth page\'s title becomes the button at the end of the nav bar — so write the page names a',
    '  menu would show, not sentences.',
    '- Any prop named "to" is a destination inside this project: it must be the route of a page you',
    '  declared in "pages". Never write an anchor such as "#pricing" — an anchor cannot reach',
    '  another page.',
    '- NavBarSimple and FooterSimple are project-level layout, not page blocks: the platform renders',
    '  them once around every page, derived from your own page list. They are not in the catalogue',
    '  above, and must never appear in "pages".',
```

同时把「设计过程」那段的第一条改掉，让它先排站点结构：

```ts
    '- First plan the site: list the pages a visitor needs, in the order the nav bar should show',
    '  them. Then, for each page, outline in 2-3 lines what it must communicate and who it is for,',
    '  and choose block components that actually serve that outline.',
```

（原本是 `- For each page, first outline in 2-3 lines what the page must communicate, who it is for,` / `  and in what order the sections should appear. Choose block components that actually` / `  serve that outline.` —— 用上面三行替换。）

- [ ] **Step 5: 跑测试确认全绿**

Run: `pnpm --filter @vudt/providers test && pnpm --filter @vudt/providers typecheck`
Expected: PASS。注意 `documents every value the spec schema accepts as an enum` 与 `names every key the model has to emit` 两条**不能**被这次改写弄红 —— 它们遍历 schema 里的枚举与键名，改写时不要删掉 shape 段。

- [ ] **Step 6: 提交**

```bash
git add packages/providers/src
git commit -m "feat(providers): ask the drafter for a site, not a single page

prompt 里写着「1-3 pages」还补一句「prefer a few well-chosen sections over a
long page」，等于在劝模型只做一页 —— 实测 4 个真任务里 3 个只生成了
HomePage.vue。换成 3-6 页（首页 + 至少 2 个内页）、每页 2-5 块，并把 draft
schema 的下限明写出来，免得模型拿一整轮换一个注定被闸 1 拒掉的单页 draft。

另加两条约定：title 要 2-6 词（导航栏直接拿它当链接文字），任何名为 to 的
prop 必须是已声明页面的 route（禁止锚点）。目录里不再列出 NavBarSimple 与
FooterSimple —— 它们是项目级布局，选它们只会烧掉一次重试。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 8: 全仓回归与真任务端到端手验

绿的测试不等于服务能起来 —— 本仓库有过这个教训。

**Files:** 无（除非发现缺陷）

**Interfaces:**
- Consumes: Task 1-7 的全部产出。
- Produces: 一份回归结论 + 一次真任务的端到端验收记录。

- [ ] **Step 1: 全仓测试**

Run: `pnpm -r test 2>&1 | tail -n 60`
Expected: 全绿。基线是 38 文件 / 374 例（providers 47、build 25、spec 13、codegen 37、imagegen 29、blocks 64、server 111、web 48），本次会多出 `sfc-navigation.test.ts`、`layouts.test.ts`、`app.test.ts` 三个文件，例数相应增加。**spec 包的 13 例必须不变** —— 变了就说明 `packages/spec` 被误改了。

- [ ] **Step 2: 全仓 typecheck**

Run: `pnpm -r typecheck 2>&1 | tail -n 40`
Expected: 全绿。这一条比测试更重要：`router-link`、`route.meta.chrome`、两个 shell 的 props 传递都是 vue-tsc 才会发现的问题。

- [ ] **Step 3: 底座自身能不能编译**

Run: `cd packages/templates/vue3-base && pnpm typecheck`
Expected: PASS。两个新 shell 在 `src/layouts/`，tsconfig 的 `include` 是 `["src", "vite.config.ts"]`，已被覆盖；若报 `Cannot find module './layouts/AppShell.vue'`，检查文件名大小写是否与 `renderApp` 写出的路径逐字一致（Windows 不区分大小写，Linux 构建会挂）。

- [ ] **Step 4: 起服务（必须从仓库根起）**

Run: `pnpm --filter @vudt/server dev`（**cwd 必须是仓库根**）

> cwd 有若干处依赖，起错会静默跌回默认模型 → 503。另外 4300 端口上可能是你自己的旧进程，先确认。

- [ ] **Step 5: 营销站形态手验**

提交一句能触发多页的描述，例如「一个 SaaS 产品的营销站，带定价、关于我们和联系方式」。等任务到 `ready`，在预览里：

- 导航条目数 == `spec.pages` 去掉 auth 页后的数量
- 每一页都有内容，不是空白
- 每个导航条目都能真的到达对应页面，不白屏
- 页面内 CTA（Hero 按钮、PricingCard 按钮、CtaBanner 按钮）都能到达对应页面
- 布局是顶栏（`AppShell`），不是侧栏

- [ ] **Step 6: 应用形态手验**

再用一句应用型描述跑一次，例如「一个后台管理系统，带登录、控制台、列表和设置」。确认：

- 布局是侧栏（`SidebarShell`）
- 导航里**没有**登录页，但侧栏的 CTA 能到登录页
- 登录页确实**没有**导航栏和页脚（`meta.chrome === false` 生效），且**有内容**（不是空白）
- 控制台/列表/设置页都有内容

- [ ] **Step 7: 不达标时的下一步**

若多页产出仍不达标：读 `error.detail`，它是闸 1 / 闸 2 的原文（带路径），直接就是下一轮改 prompt 的输入。不要靠猜。

- [ ] **Step 8: 提交任何手验中发现并修复的缺陷**

```bash
git add -A
git commit -m "fix: <手验中发现的缺陷>

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

若没有发现缺陷，跳过这一步（不要为空提交建一次提交）。

---

## Self-Review

**1. Spec coverage** —— 逐节核对：

| spec 章节 | 落在哪个任务 |
|---|---|
| §1 底座新增两个布局组件 | Task 2 Step 5-6 |
| §1 codegen 新增 `src/App.vue` 生成 | Task 6 Step 4、6 |
| §1 四条派生规则（顶栏/侧栏、导航条目、无 chrome、顶栏 CTA） | Task 6 Step 1/3/5 |
| §1 `layoutOnly` 的四处生效 | 目录 Task 7、derive Task 3、renderPage Task 4、仍在 registry Task 2 |
| §2 `to` 约定与禁止锚点 | Task 3 Step 4 |
| §2 校验住在 blocks 包 | Task 3（`assertCtaTargets` 在 `derive.ts`，`packages/spec` 零改动） |
| §2 5 个内容块 + NavBarSimple 的 props 改写 | Task 1 Step 5-11 |
| §2 LogoStrip 去链接 | Task 1 Step 4、11 |
| §2 AuthPanel 不动 | Task 1 未触碰；`altActionLabel` 不含 `to`，Task 3 的 walker 不命中 |
| §3 prompt 改写四点 | Task 7 Step 3-4 |
| §3 draft schema 下限 | Task 5 Step 3 |
| §4 不做的事 | 全计划未触碰 `packages/spec` schema、未加动态路由、未强制 `pageTypes`、未动 imagegen/build 逻辑 |
| 数据流变化点 | `renderPage` 不变（Task 4 只加闸）、`renderRouter` Task 6、`renderApp` Task 6、`renderTokensCss` 不变、`copyTemplate` 已拷 `src/layouts/`（Task 2 建目录即被覆盖） |
| 「我擅自定的点」6 条 | 1→Task 6 `pickShell`；2→Task 1 Step 4；3→Task 1 Step 9；4→Task 6 `topBarCta`；5→Task 3 Step 4；6→Task 6 `footerNote` |
| 「顺带发现」`REPLACED_TEMPLATE_FILES` 死代码 | 本计划**不动**它（spec 明确说加 `App.vue` 是空操作） |
| 验证 4 条 | Task 8 |

无遗漏。

**2. Placeholder scan** —— 已通读全文：没有 TBD / TODO / 「稍后实现」/「类似 Task N」/「加上适当的错误处理」。每个代码步骤都给了可直接落盘的完整代码或完整的替换片段。

**3. Type consistency** —— 逐项核对：

- `BlockDefinition.layoutOnly?: boolean`：Task 2 定义，Task 3/4/7 读取。三处都写成 `=== true` 严格比较（`undefined` 与 `false` 都不是布局件）。
- CTA 形状 `{ label: string; to: string }`：Task 1 的 SFC 接口名是 `Cta`（各文件本地声明），Task 1 侧车写 `'{ label, to }'`，Task 6 的 `NavLink` 同一形状。三个名字对应同一种结构，且 Task 6 的 `linkLiteral` 收 `{ label, to }`，Task 2 的 shell 本地接口也是 `NavLink` —— 一致。
- `assertCtaTargets(route, selections, routes)`：Task 3 定义并在 `draft.ts` 调用，两处签名逐字一致。
- `planLayout` 返回的 `LayoutPlan`：Task 6 Step 6 定义，`app.ts`（Task 6 Step 7）一次调用、一次解构 `{ shell, brand, links, cta, note }`，然后按 `shell` 分两个分支决定发射哪些 const 与哪些属性。
- `AppShell` props `{ brand, links, cta, note, chromeless }` 与 `renderApp` 写出的属性 `:brand :links :cta :note :chromeless` 一一对应；`SidebarShell` 的 `{ brand, links, cta, chromeless }` 对应 `:brand :links :cta :chromeless`。
- `renderApp` 的产出路径 `src/App.vue` 与 import 路径 `./layouts/<Shell>.vue`：`App.vue` 在 `src/`，shell 在 `src/layouts/` → 相对路径正确。
- Task 4 的夹具下标：首页 `[HeroSplit, StatsBand, FeatureTriad, CtaBanner]` → `assets0/2/3` 存在、`assets1` 不存在；`props0` 是 HeroSplit。Task 4 Step 5 的断言与此一致。
- Task 6 Step 1 给 codegen 夹具加的 `/signin` 页含 2 块（`AuthPanel` + `TestimonialRow`），与 Task 5 的 `blocks.min(2)` 同形。**但 codegen 夹具走的是 `derivePageAssets` + `ProjectSpecInputSchema`，不经过 `deriveSpecInput`，所以 draft 下限对它并不生效** —— 写成 2 块只是让夹具与真实产出长得一样。


**自审中发现并已修正的两处问题**（都已在正文里改掉，不是在正文外打补丁）：

1. **`app.ts` 里 `planLayout` 被调用了两次** —— 初稿写成 `const { shell, brand, links, note } = planLayout(spec)` 之后又 `planLayout(spec).cta`。既多余，又给了后来者一个把两处改成不一致的机会。正文已改为一次调用、一次解构（含 `cta`）。

2. **Task 6 的步骤顺序是错的** —— 初稿在 Step 1 就写 `layouts.test.ts` / `app.test.ts`，而给夹具加 auth 页排在 Step 7。那两组断言里有四处依赖「`landingSpec()` 存在一个 auth 页」（`topBarCta` 取到 `{ label: 'Sign in', to: '/signin' }`、`planLayout` 含 `cta`、`app.test.ts` 的 `const cta = …`、`project.test.ts` 的 `SigninPage.vue` 与 `src/App.vue`），夹具没改之前它们全红。更糟的是：先写断言、后改夹具，会写出两组互相矛盾的期望（一组假设有 auth 页、一组假设没有）。正文已把夹具改动提到 **Step 1**，并把「这一步必须排在写新断言之前」的理由写在步骤里。

**留一处需在执行时留意的顺序依赖**：Task 3 Step 6 明确允许 `draft.test.ts` 在此时是红的（它的夹具里还有 `NavBarSimple`），由 Task 5 收口。这是全计划里唯一一处「任务收尾不全绿」，已在 Task 3 Step 6 与 Task 5 的 Files 里双向标注。若要求每个任务都严格全绿，可把 Task 3 与 Task 5 合并执行。

`planLayout` 被调用两次，既多余又容易被后来者改成不一致。修订为：

```ts
  const { shell, brand, links, cta, note } = planLayout(spec)
```

（`cta` 可能是 `undefined`，下面两个分支已经各自处理了这种情况。）

**另发现一处需在执行时留意的顺序依赖**：Task 3 Step 6 明确允许 `draft.test.ts` 在此时是红的（它的夹具里还有 `NavBarSimple`），由 Task 5 收口。这是全计划里唯一一处「任务收尾不全绿」，已在 Task 3 Step 6 与 Task 5 的 Files 里双向标注。若要求每个任务都严格全绿，可把 Task 3 与 Task 5 合并执行。

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-22-multi-page-project.md`. Two execution options:**

**1. Subagent-Driven (recommended)** —— 每个任务派一个全新 subagent，任务之间我来评审，迭代快

**2. Inline Execution** —— 在本会话里用 executing-plans 批量执行，带检查点停下来给你看

**选哪种？**
