# 产出丰富度提升（区块扩展 + 内容大纲）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 6 个 props-only 区块（StatsBand/LogoStrip/PricingCard/TestimonialRow/FAQAccordion/AuthPanel），并让 drafter 先产出页面级内容大纲、再填更高质量的文案与 theme，使生成的站点更完善耐看。

**Architecture:** 区块按仓库既有「侧车（`.slots.ts`）→ 底座 SFC（`vue3-base/src/blocks/*.vue`）→ `registry.ts` 注册 → 对齐测试」流程纯横向扩展；codegen 读 `BLOCK_REGISTRY` 自动渲染新块 props，`derivePageAssets` 对 slotless 块天然零资产。内容大纲只在 drafter 的 system prompt 里引导模型，**不改任何 schema**（未知 key 由 `z.object` 默认剥除兜底）。

**Tech Stack:** TypeScript 5.9、zod 4、Vue 3.5 SFC（`<script setup>` + `defineProps<{…}>()`）、vitest 3。

**Spec:** `docs/superpowers/specs/2026-09-22-output-richness-design.md`

## Global Constraints

- **几何只来自侧车**：`content` 是模型唯一的文字入口；`aspectRatio/renderSize/transparent/composition` 永不由模型写（draft schema 里根本没有这些键）。
- **props 走 const+v-bind**：codegen 把 props 序列化进 `const propsN = {…}` 再用 `v-bind`，**绝不 inline 进属性**（vue-tsc 的实体陷阱）。
- **区块 props 名与底座 SFC 的 `defineProps<{…}>()` 一字不差**（`sfc-props.test.ts` 会遍历 `BLOCK_REGISTRY` 自动断言）。
- **块内不硬编码颜色**：一律读 `--color-*` / `--radius` / `--space-unit` / `--font-*` tokens。
- **不引第三方**：新区块只用原生 `<details>/<summary>`、`<input>`、`.button` 等模板自带工具类。
- **零图片槽**：6 个新区块 `slots: []`，building 阶段不触发任何图片请求。
- 测试门槛：每个任务结束 `pnpm --filter <pkg> test` 与 `pnpm --filter <pkg> typecheck` 必须绿；全仓最后 `pnpm -r test` + `pnpm -r typecheck` 全绿。
- 单文件测试命令（`--` 传不进去）：在包目录用 `npx vitest run <path>`，或 `pnpm --filter <pkg> exec vitest run <path>`。

## 既有参考（所有任务共用）

- 侧车写法：`packages/templates/blocks/src/blocks/footer-simple.slots.ts`（slotless 最简）。
- 底座 SFC 写法：`packages/templates/vue3-base/src/blocks/FooterSimple.vue`、`NavBarSimple.vue`（tokens 用法、`.container`/`.section`/`.button` 工具类）。
- 工具类（`base.css`）：`.container`（max-width 1120px 居中）、`.section`（`padding: calc(var(--space-unit) * 4) 0`）、`.button`（主色实心）、`.button--ghost`（描边）。
- 区块注册：`packages/templates/blocks/src/registry.ts` 的 `definitions` 数组。
- derive 测试模式：`packages/templates/blocks/src/__tests__/derive.test.ts`。
- drafter prompt：`packages/providers/src/openai-spec-drafter.ts` 的 `systemPrompt()`；其测试 `packages/providers/src/__tests__/openai-spec-drafter.test.ts`。
- SFC 对齐测试：`packages/templates/blocks/src/__tests__/sfc-props.test.ts`（自动遍历 `BLOCK_REGISTRY`）。

---

### Task 1: `StatsBand` 区块（侧车 + 底座 + 注册 + 测试）

**Files:**
- Create: `packages/templates/blocks/src/blocks/stats-band.slots.ts`
- Create: `packages/templates/vue3-base/src/blocks/StatsBand.vue`
- Modify: `packages/templates/blocks/src/registry.ts`（导入 + `definitions` 数组加一项）
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`（补一条 slotless 新块的 derive 断言）

**Interfaces:**
- Produces: `StatsBand` 区块。侧车 `props: { heading: 'string', subheading: 'string', stats: '{ label, value, suffix? }[]' }`，`slots: []`，`pageTypes: ['landing']`。底座 `defineProps<{ heading?: string; subheading?: string; stats?: Stat[] }>()`（`Stat = { label: string; value: string; suffix?: string }`）。注册后 `getBlockDefinition('StatsBand')` 可查。

- [ ] **Step 1: 写侧车**

```ts
import type { BlockDefinition } from '../slot.js'

export const StatsBand: BlockDefinition = {
  component: 'StatsBand',
  pageTypes: ['landing'],
  props: { heading: 'string', subheading: 'string', stats: '{ label, value, suffix? }[]' },
  slots: [],
}
```

- [ ] **Step 2: 写底座 SFC**

```vue
<script setup lang="ts">
interface Stat {
  label: string
  value: string
  suffix?: string
}

withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    stats?: Stat[]
  }>(),
  { heading: '', subheading: '', stats: () => [] },
)
</script>

<template>
  <section class="section stats">
    <div class="container">
      <header v-if="heading || subheading" class="stats__head">
        <h2 v-if="heading" class="stats__title">{{ heading }}</h2>
        <p v-if="subheading" class="stats__sub">{{ subheading }}</p>
      </header>
      <dl v-if="stats.length > 0" class="stats__grid">
        <div v-for="stat in stats" :key="stat.label" class="stats__cell">
          <dt class="stats__value">
            {{ stat.value }}<span v-if="stat.suffix" class="stats__suffix">{{ stat.suffix }}</span>
          </dt>
          <dd class="stats__label">{{ stat.label }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.stats__head {
  text-align: center;
  margin-bottom: calc(var(--space-unit) * 3);
}

.stats__title {
  font-family: var(--font-heading);
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  margin: 0 0 var(--space-unit);
}

.stats__sub {
  color: var(--color-muted);
  max-width: 48ch;
  margin: 0 auto;
}

.stats__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: calc(var(--space-unit) * 2);
  margin: 0;
}

.stats__cell {
  text-align: center;
  padding: calc(var(--space-unit) * 2);
  border-radius: var(--radius);
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
}

.stats__value {
  font-family: var(--font-heading);
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  color: var(--color-primary);
}

.stats__suffix {
  font-size: 0.6em;
}

.stats__label {
  color: var(--color-muted);
  margin-top: var(--space-unit);
}

@media (max-width: 640px) {
  .stats__grid {
    grid-template-columns: 1fr;
  }
}
</style>
```

- [ ] **Step 3: 注册**

在 `packages/templates/blocks/src/registry.ts` 顶部加 `import { StatsBand } from './blocks/stats-band.slots.js'`，并在 `definitions` 数组里追加 `StatsBand`。

- [ ] **Step 4: 在 derive.test.ts 补一条 slotless 新块断言**

```ts
it('derives no assets for the new slotless StatsBand', () => {
  const { blocks, assets } = derivePageAssets('/', [
    { component: 'NavBarSimple' },
    { component: 'StatsBand', props: { heading: 'By the numbers', stats: [{ label: 'Users', value: '12k' }] } },
  ])
  expect(assets).toHaveLength(0)
  expect(blocks[1]!.props).toEqual({
    heading: 'By the numbers',
    stats: [{ label: 'Users', value: '12k' }],
  })
})
```

（把 `StatsBand` 加入 `derive.test.ts` 顶部的 `import`。）

- [ ] **Step 5: 跑测试验证**

Run: `cd packages/templates/blocks && npx vitest run src/__tests__/derive.test.ts src/__tests__/sfc-props.test.ts src/__tests__/sfc-geometry.test.ts`
Expected: 全过。`sfc-props` 自动覆盖 `StatsBand`（props 与 SFC 对齐）。

- [ ] **Step 6: typecheck + 提交**

Run: `pnpm --filter @vudt/blocks typecheck && pnpm --filter @vudt/template-vue3-base typecheck`
Expected: 全绿。

```bash
git add packages/templates/blocks/src/blocks/stats-band.slots.ts packages/templates/blocks/src/registry.ts packages/templates/vue3-base/src/blocks/StatsBand.vue packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): add StatsBand block"
```

---

### Task 2: `LogoStrip` 区块

**Files:**
- Create: `packages/templates/blocks/src/blocks/logo-strip.slots.ts`
- Create: `packages/templates/vue3-base/src/blocks/LogoStrip.vue`
- Modify: `packages/templates/blocks/src/registry.ts`
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`

**Interfaces:**
- Produces: `LogoStrip` 区块。`props: { heading: 'string', logos: '{ name, to }[]' }`，`slots: []`，`pageTypes: ['landing']`。底座 `defineProps<{ heading?: string; logos?: Logo[] }>()`（`Logo = { name: string; to: string }`）。

- [ ] **Step 1: 写侧车**

```ts
import type { BlockDefinition } from '../slot.js'

export const LogoStrip: BlockDefinition = {
  component: 'LogoStrip',
  pageTypes: ['landing'],
  props: { heading: 'string', logos: '{ name, to }[]' },
  slots: [],
}
```

- [ ] **Step 2: 写底座 SFC**

```vue
<script setup lang="ts">
interface Logo {
  name: string
  to: string
}

withDefaults(
  defineProps<{
    heading?: string
    logos?: Logo[]
  }>(),
  { heading: '', logos: () => [] },
)
</script>

<template>
  <section class="section logos">
    <div class="container">
      <p v-if="heading" class="logos__heading">{{ heading }}</p>
      <div v-if="logos.length > 0" class="logos__row">
        <a
          v-for="logo in logos"
          :key="logo.to"
          :href="logo.to"
          class="logos__item"
        >{{ logo.name }}</a>
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
  text-decoration: none;
  opacity: 0.75;
  transition: opacity 0.15s ease;
}

.logos__item:hover {
  opacity: 1;
  color: var(--color-foreground);
}
</style>
```

- [ ] **Step 3: 注册**：`registry.ts` 导入 `LogoStrip` 并加入 `definitions`。

- [ ] **Step 4: derive.test.ts 补断言**（模式同 Task 1，验证 slotless + props 原样进入 `Block.props`）。

- [ ] **Step 5: 跑测试**：`cd packages/templates/blocks && npx vitest run src/__tests__/derive.test.ts src/__tests__/sfc-props.test.ts src/__tests__/sfc-geometry.test.ts`，Expected: 全过。

- [ ] **Step 6: typecheck + 提交**

```bash
git add packages/templates/blocks/src/blocks/logo-strip.slots.ts packages/templates/blocks/src/registry.ts packages/templates/vue3-base/src/blocks/LogoStrip.vue packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): add LogoStrip block"
```

---

### Task 3: `PricingCard` 区块

**Files:**
- Create: `packages/templates/blocks/src/blocks/pricing-card.slots.ts`
- Create: `packages/templates/vue3-base/src/blocks/PricingCard.vue`
- Modify: `packages/templates/blocks/src/registry.ts`
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`

**Interfaces:**
- Produces: `PricingCard` 区块。`props: { heading: 'string', subheading: 'string', plans: '{ name, price, period?, tagline?, features: string[], ctaLabel?, featured? }[]', note?: 'string' }`，`slots: []`，`pageTypes: ['landing']`。底座 `defineProps<{ heading?: string; subheading?: string; plans?: Plan[]; note?: string }>()`（`Plan = { name: string; price: string; period?: string; tagline?: string; features: string[]; ctaLabel?: string; featured?: boolean }`）。

- [ ] **Step 1: 写侧车**

```ts
import type { BlockDefinition } from '../slot.js'

export const PricingCard: BlockDefinition = {
  component: 'PricingCard',
  pageTypes: ['landing'],
  props: {
    heading: 'string',
    subheading: 'string',
    plans: '{ name, price, period?, tagline?, features: string[], ctaLabel?, featured? }[]',
    note: 'string',
  },
  slots: [],
}
```

- [ ] **Step 2: 写底座 SFC**

```vue
<script setup lang="ts">
interface Plan {
  name: string
  price: string
  period?: string
  tagline?: string
  features: string[]
  ctaLabel?: string
  featured?: boolean
}

withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    plans?: Plan[]
    note?: string
  }>(),
  { heading: '', subheading: '', plans: () => [], note: '' },
)
</script>

<template>
  <section class="section pricing">
    <div class="container">
      <header v-if="heading || subheading" class="pricing__head">
        <h2 v-if="heading" class="pricing__title">{{ heading }}</h2>
        <p v-if="subheading" class="pricing__sub">{{ subheading }}</p>
      </header>
      <div v-if="plans.length > 0" class="pricing__grid">
        <article
          v-for="plan in plans"
          :key="plan.name"
          class="pricing__card"
          :class="{ 'pricing__card--featured': plan.featured }"
        >
          <h3 class="pricing__name">{{ plan.name }}</h3>
          <p v-if="plan.tagline" class="pricing__tagline">{{ plan.tagline }}</p>
          <p class="pricing__price">
            <span class="pricing__amount">{{ plan.price }}</span>
            <span v-if="plan.period" class="pricing__period">/ {{ plan.period }}</span>
          </p>
          <ul class="pricing__features">
            <li v-for="feature in plan.features" :key="feature" class="pricing__feature">
              {{ feature }}
            </li>
          </ul>
          <a
            v-if="plan.ctaLabel"
            href="#pricing"
            class="button"
            :class="{ 'button--ghost': !plan.featured }"
          >{{ plan.ctaLabel }}</a>
        </article>
      </div>
      <p v-if="note" class="pricing__note">{{ note }}</p>
    </div>
  </section>
</template>

<style scoped>
.pricing__head {
  text-align: center;
  margin-bottom: calc(var(--space-unit) * 3);
}

.pricing__title {
  font-family: var(--font-heading);
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  margin: 0 0 var(--space-unit);
}

.pricing__sub {
  color: var(--color-muted);
  max-width: 48ch;
  margin: 0 auto;
}

.pricing__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: calc(var(--space-unit) * 2);
  align-items: stretch;
}

.pricing__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-unit);
  padding: calc(var(--space-unit) * 2);
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.pricing__card--featured {
  border-color: var(--color-primary);
  box-shadow: 0 4px 24px color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.pricing__name {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  margin: 0;
}

.pricing__tagline {
  color: var(--color-muted);
  font-size: 0.9rem;
  margin: 0;
}

.pricing__price {
  margin: 0;
}

.pricing__amount {
  font-family: var(--font-heading);
  font-size: 2rem;
  font-weight: 700;
}

.pricing__period {
  color: var(--color-muted);
}

.pricing__features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-unit);
  flex: 1;
}

.pricing__feature::before {
  content: '✓';
  margin-right: 0.5em;
  color: var(--color-accent);
}

.pricing__note {
  text-align: center;
  color: var(--color-muted);
  margin-top: calc(var(--space-unit) * 2);
}
</style>
```

- [ ] **Step 3: 注册**：`registry.ts` 导入 `PricingCard` 并加入 `definitions`。

- [ ] **Step 4: derive.test.ts 补断言**：`derivePageAssets('/', [{ component: 'PricingCard', props: { heading: 'Pick a plan', plans: [{ name: 'Pro', price: '$29', features: ['a', 'b'] }] } }])` → `assets` 为空、`blocks[0].props` 原样含该 plans。

- [ ] **Step 5: 跑测试**：同前（derive/sfc-props/sfc-geometry），Expected: 全过。

- [ ] **Step 6: typecheck + 提交**

```bash
git add packages/templates/blocks/src/blocks/pricing-card.slots.ts packages/templates/blocks/src/registry.ts packages/templates/vue3-base/src/blocks/PricingCard.vue packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): add PricingCard block"
```

---

### Task 4: `TestimonialRow` 区块

**Files:**
- Create: `packages/templates/blocks/src/blocks/testimonial-row.slots.ts`
- Create: `packages/templates/vue3-base/src/blocks/TestimonialRow.vue`
- Modify: `packages/templates/blocks/src/registry.ts`
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`

**Interfaces:**
- Produces: `TestimonialRow` 区块。`props: { heading: 'string', testimonials: '{ quote, author, role? }[]' }`，`slots: []`，`pageTypes: ['landing']`。底座 `defineProps<{ heading?: string; testimonials?: Testimonial[] }>()`（`Testimonial = { quote: string; author: string; role?: string }`）。

- [ ] **Step 1: 写侧车**

```ts
import type { BlockDefinition } from '../slot.js'

export const TestimonialRow: BlockDefinition = {
  component: 'TestimonialRow',
  pageTypes: ['landing'],
  props: { heading: 'string', testimonials: '{ quote, author, role? }[]' },
  slots: [],
}
```

- [ ] **Step 2: 写底座 SFC**

```vue
<script setup lang="ts">
interface Testimonial {
  quote: string
  author: string
  role?: string
}

withDefaults(
  defineProps<{
    heading?: string
    testimonials?: Testimonial[]
  }>(),
  { heading: '', testimonials: () => [] },
)
</script>

<template>
  <section class="section quotes">
    <div class="container">
      <h2 v-if="heading" class="quotes__title">{{ heading }}</h2>
      <div v-if="testimonials.length > 0" class="quotes__grid">
        <figure v-for="(item, index) in testimonials" :key="item.author" class="quotes__card">
          <blockquote class="quotes__quote">“{{ item.quote }}”</blockquote>
          <figcaption class="quotes__byline">
            <strong class="quotes__author">{{ item.author }}</strong>
            <span v-if="item.role" class="quotes__role">{{ item.role }}</span>
          </figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>

<style scoped>
.quotes__title {
  font-family: var(--font-heading);
  text-align: center;
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  margin: 0 0 calc(var(--space-unit) * 3);
}

.quotes__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: calc(var(--space-unit) * 2);
}

.quotes__card {
  margin: 0;
  padding: calc(var(--space-unit) * 2);
  border-radius: var(--radius);
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-unit);
}

.quotes__quote {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.6;
}

.quotes__byline {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.quotes__author {
  font-family: var(--font-heading);
}

.quotes__role {
  color: var(--color-muted);
  font-size: 0.875rem;
}
</style>
```

- [ ] **Step 3: 注册**：`registry.ts` 导入 `TestimonialRow` 并加入 `definitions`。

- [ ] **Step 4: derive.test.ts 补断言**：slotless + props 原样进入 `Block.props`。

- [ ] **Step 5: 跑测试**：同前，Expected: 全过。

- [ ] **Step 6: typecheck + 提交**

```bash
git add packages/templates/blocks/src/blocks/testimonial-row.slots.ts packages/templates/blocks/src/registry.ts packages/templates/vue3-base/src/blocks/TestimonialRow.vue packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): add TestimonialRow block"
```

---

### Task 5: `FAQAccordion` 区块（原生 `<details>`）

**Files:**
- Create: `packages/templates/blocks/src/blocks/faq-accordion.slots.ts`
- Create: `packages/templates/vue3-base/src/blocks/FAQAccordion.vue`
- Modify: `packages/templates/blocks/src/registry.ts`
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`

**Interfaces:**
- Produces: `FAQAccordion` 区块。`props: { heading: 'string', subheading?: 'string', faqs: '{ question, answer }[]' }`，`slots: []`，`pageTypes: ['landing', 'form']`。底座 `defineProps<{ heading?: string; subheading?: string; faqs?: Faq[] }>()`（`Faq = { question: string; answer: string }`）。

- [ ] **Step 1: 写侧车**

```ts
import type { BlockDefinition } from '../slot.js'

export const FAQAccordion: BlockDefinition = {
  component: 'FAQAccordion',
  pageTypes: ['landing', 'form'],
  props: { heading: 'string', subheading: 'string', faqs: '{ question, answer }[]' },
  slots: [],
}
```

- [ ] **Step 2: 写底座 SFC（原生 `<details>` 手风琴，零 JS）**

```vue
<script setup lang="ts">
interface Faq {
  question: string
  answer: string
}

withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    faqs?: Faq[]
  }>(),
  { heading: '', subheading: '', faqs: () => [] },
)
</script>

<template>
  <section class="section faq">
    <div class="container faq__inner">
      <header v-if="heading || subheading" class="faq__head">
        <h2 v-if="heading" class="faq__title">{{ heading }}</h2>
        <p v-if="subheading" class="faq__sub">{{ subheading }}</p>
      </header>
      <div v-if="faqs.length > 0" class="faq__list">
        <details v-for="faq in faqs" :key="faq.question" class="faq__item">
          <summary class="faq__question">{{ faq.question }}</summary>
          <p class="faq__answer">{{ faq.answer }}</p>
        </details>
      </div>
    </div>
  </section>
</template>

<style scoped>
.faq__head {
  text-align: center;
  margin-bottom: calc(var(--space-unit) * 3);
}

.faq__title {
  font-family: var(--font-heading);
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  margin: 0 0 var(--space-unit);
}

.faq__sub {
  color: var(--color-muted);
  max-width: 48ch;
  margin: 0 auto;
}

.faq__list {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-unit);
}

.faq__item {
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  border-radius: var(--radius);
  background: var(--color-surface);
  padding: 0 calc(var(--space-unit) * 1.5);
}

.faq__question {
  cursor: pointer;
  padding: calc(var(--space-unit) * 1.25) 0;
  font-family: var(--font-heading);
  font-weight: 600;
  list-style: none;
}

.faq__question::-webkit-details-marker {
  display: none;
}

.faq__answer {
  color: var(--color-muted);
  padding-bottom: calc(var(--space-unit) * 1.25);
  margin: 0;
}
</style>
```

- [ ] **Step 3: 注册**：`registry.ts` 导入 `FAQAccordion` 并加入 `definitions`。

- [ ] **Step 4: derive.test.ts 补断言**：slotless + props 原样进入 `Block.props`。

- [ ] **Step 5: 跑测试**：同前，Expected: 全过。

- [ ] **Step 6: typecheck + 提交**

```bash
git add packages/templates/blocks/src/blocks/faq-accordion.slots.ts packages/templates/blocks/src/registry.ts packages/templates/vue3-base/src/blocks/FAQAccordion.vue packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): add FAQAccordion block"
```

---

### Task 6: `AuthPanel` 区块

**Files:**
- Create: `packages/templates/blocks/src/blocks/auth-panel.slots.ts`
- Create: `packages/templates/vue3-base/src/blocks/AuthPanel.vue`
- Modify: `packages/templates/blocks/src/registry.ts`
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`

**Interfaces:**
- Produces: `AuthPanel` 区块。`props: { mode: 'sign-in' | 'sign-up', heading: 'string', subheading?: 'string', fields: '{ label, type, placeholder }[]', submitLabel: 'string', altActionLabel?: 'string', note?: 'string' }`，`slots: []`，`pageTypes: ['auth']`。底座 `defineProps<{ mode?: 'sign-in' | 'sign-up'; heading?: string; subheading?: string; fields?: Field[]; submitLabel?: string; altActionLabel?: string; note?: string }>()`（`Field = { label: string; type: string; placeholder?: string }`）。

- [ ] **Step 1: 写侧车**

```ts
import type { BlockDefinition } from '../slot.js'

export const AuthPanel: BlockDefinition = {
  component: 'AuthPanel',
  pageTypes: ['auth'],
  props: {
    mode: 'sign-in | sign-up',
    heading: 'string',
    subheading: 'string',
    fields: '{ label, type, placeholder? }[]',
    submitLabel: 'string',
    altActionLabel: 'string',
    note: 'string',
  },
  slots: [],
}
```

- [ ] **Step 2: 写底座 SFC（原生 `<input>` + `.button`，不引 antd）**

```vue
<script setup lang="ts">
interface Field {
  label: string
  type: string
  placeholder?: string
}

withDefaults(
  defineProps<{
    mode?: 'sign-in' | 'sign-up'
    heading?: string
    subheading?: string
    fields?: Field[]
    submitLabel?: string
    altActionLabel?: string
    note?: string
  }>(),
  {
    mode: 'sign-in',
    heading: '',
    subheading: '',
    fields: () => [],
    submitLabel: '',
    altActionLabel: '',
    note: '',
  },
)
</script>

<template>
  <section class="section auth">
    <div class="container auth__inner">
      <div class="auth__panel">
        <header class="auth__head">
          <h2 class="auth__title">{{ heading }}</h2>
          <p v-if="subheading" class="auth__sub">{{ subheading }}</p>
        </header>
        <form class="auth__form" @submit.prevent>
          <label v-for="field in fields" :key="field.label" class="auth__field">
            <span class="auth__label">{{ field.label }}</span>
            <input
              class="auth__input"
              :type="field.type"
              :placeholder="field.placeholder"
              :autocomplete="field.type === 'password' ? 'current-password' : 'on'"
            />
          </label>
          <button class="button auth__submit" type="submit">{{ submitLabel }}</button>
        </form>
        <a v-if="altActionLabel" class="auth__alt" href="#auth">{{ altActionLabel }}</a>
        <p v-if="note" class="auth__note">{{ note }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.auth__inner {
  max-width: 440px;
}

.auth__panel {
  padding: calc(var(--space-unit) * 2.5);
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.auth__head {
  text-align: center;
  margin-bottom: calc(var(--space-unit) * 2);
}

.auth__title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  margin: 0 0 var(--space-unit);
}

.auth__sub {
  color: var(--color-muted);
  margin: 0;
}

.auth__form {
  display: flex;
  flex-direction: column;
  gap: calc(var(--space-unit) * 1.5);
}

.auth__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.auth__label {
  font-size: 0.875rem;
  font-weight: 600;
}

.auth__input {
  padding: 0.7em 0.9em;
  border: 1px solid color-mix(in srgb, var(--color-muted) 40%, transparent);
  border-radius: var(--radius);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit;
}

.auth__input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.auth__submit {
  width: 100%;
  text-align: center;
}

.auth__alt {
  display: block;
  text-align: center;
  margin-top: calc(var(--space-unit) * 1.5);
  color: var(--color-primary);
  text-decoration: none;
  font-size: 0.9rem;
}

.auth__note {
  text-align: center;
  color: var(--color-muted);
  font-size: 0.85rem;
  margin-top: var(--space-unit);
}
</style>
```

- [ ] **Step 3: 注册**：`registry.ts` 导入 `AuthPanel` 并加入 `definitions`。

- [ ] **Step 4: derive.test.ts 补断言**：slotless + `mode`/`fields` 原样进入 `Block.props`。

- [ ] **Step 5: 跑测试**：同前，Expected: 全过。

- [ ] **Step 6: typecheck + 提交**

```bash
git add packages/templates/blocks/src/blocks/auth-panel.slots.ts packages/templates/blocks/src/registry.ts packages/templates/vue3-base/src/blocks/AuthPanel.vue packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): add AuthPanel block"
```

---

### Task 7: 子任务 C —— drafter 内容大纲 + 主题增强

**Files:**
- Modify: `packages/providers/src/openai-spec-drafter.ts`（`systemPrompt()` 加引导段）
- Modify: `packages/providers/src/__tests__/openai-spec-drafter.test.ts`（补 2 条断言）
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`（或新增 `draft.test.ts`）补 1 条「未知 key 被剥除」断言

**Interfaces:**
- Consumes: 现有 `createOpenAISpecDrafter` 签名不变；`draft()` 返回形状不变。
- Produces: system prompt 新增「Design process」段落；一个 `DraftKeyGuard` 行为（`z.object` 剥未知 key）。

- [ ] **Step 1: 改 `systemPrompt()`**

在 `packages/providers/src/openai-spec-drafter.ts` 的 `systemPrompt()` 数组里，把开头的两行：

```ts
'You design Vue 3 marketing and app pages as a single JSON "draft" object.',
'Reply with one JSON object only, no prose and no code fences.',
```

改为：

```ts
'You design Vue 3 marketing and app pages as a single JSON "draft" object.',
'Reply with one JSON object only, no prose and no code fences.',
'',
'Design process (never output this — think it in your head before writing the JSON):',
'- For each page, first outline in 2-3 lines what the page must communicate, who it is for,',
'  and in what order the sections should appear. Choose block components that actually',
'  serve that outline.',
'- Then fill copy that is concrete and brand-flavoured, not placeholder text.',
'- Pick a theme with a distinctive palette (do not default to a generic blue-grey), a',
'  font pair with character, and radius/spacing/mode that match the page mood.',
```

- [ ] **Step 2: 写一条 provider 测试（断言引导段存在）**

在 `openai-spec-drafter.test.ts` 的 `describe('createOpenAISpecDrafter')` 里补：

```ts
test('asks the model to plan an outline before writing the draft', async () => {
  const { calls, drafter } = drafterWith(chatReply('{}'))

  await drafter.draft({ description: 'a landing page', attempt: 1 })

  const system = systemOf(calls[0]!)
  expect(system).toMatch(/outline/i)
  expect(system).toMatch(/design process/i)
  expect(system).toMatch(/brand-flavoured/i)
})
```

- [ ] **Step 3: 写一条 derive 测试（未知 key 被剥除）**

在 `packages/templates/blocks/src/__tests__/derive.test.ts` 补一条 `it(...)`（文件顶部 import 需加上 `deriveSpecInput`）：

```ts
import { deriveSpecInput } from '../draft.js'

it('silently strips unknown keys a model might add (e.g. an outline)', () => {
  const result = deriveSpecInput({
    meta: { name: 'Acme', description: 'x', targetStack: 'vue3' },
    theme: { colorTokens: { primary: '#111', secondary: '#222', accent: '#333', background: '#fff', surface: '#fafafa', foreground: '#111', muted: '#777' }, radius: 'md', spacing: 'normal', fontPair: { heading: 'Inter', body: 'Inter' }, mode: 'light' },
    styleBible: { artStyle: 'flat-vector', lineWeight: 'none', shading: 'flat', perspective: 'front', palette: ['#111'], backgroundTreatment: 'solid', negativePrompt: '', seed: 1 },
    pages: [{ route: '/', title: 'Home', pageType: 'landing', blocks: [{ component: 'NavBarSimple', outline: 'hero first, then value' }] }],
  })
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.value.pages[0]!.blocks[0]!.props).toEqual({})
  }
})
```

- [ ] **Step 4: 跑测试验证**

Run: `cd packages/providers && npx vitest run src/__tests__/openai-spec-drafter.test.ts` 和 `cd packages/templates/blocks && npx vitest run src/__tests__/derive.test.ts`
Expected: 全过（含新增两条）。

> 关于新增的未知 key 剥除测试：`deriveSpecInput` 返回 `{ ok: true; value }` 时 `value` 是 `ProjectSpecInput`，其 `pages[i].blocks[i]` 是 spec 的 `Block`（含 `props`）。用例断言带 `outline` 的 draft 能被剥除并正常派生——这同时验证「模型写进 JSON 的大纲会被 `z.object` 静默剥掉、不会让任务失败」这一兜底行为。

- [ ] **Step 5: typecheck + 提交**

```bash
git add packages/providers/src/openai-spec-drafter.ts packages/providers/src/__tests__/openai-spec-drafter.test.ts packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(providers): ask the drafter to plan an outline and richer theme"
```

---

### Task 8: 全仓回归 + 端到端手验

**Files:**
- 无新增代码；验证产物。

**Interfaces:**
- Consumes: 前 7 个任务全部完成。

- [ ] **Step 1: 全仓测试与类型**

Run: `pnpm -r test`（Expected: 全绿，`@vudt/blocks` 用例数应明显增加）+ `pnpm -r typecheck`（Expected: 全绿）。

- [ ] **Step 2: 真任务手验（需要 API key）**

若 `server/.env` 已有真 key，从仓库根起服务（`./server/node_modules/.bin/tsx --env-file=server/.env server/src/main.ts`），前端 `cd web && npx vite`，提交一条含新块的描述（如「做一个含价格方案与客户评价的 SaaS 落地页」），确认：

- 详情页 preview 正常渲染新块（价格卡、评价卡、FAQ 手风琴可展开）
- 结构树能显示新区块
- 导出 source / dist 正常

- [ ] **Step 3: 提交（若手验产物有修复）**

```bash
git add -A
git commit -m "test: verify output richness end-to-end"
```

（若无需修复，此步跳过。）
