# 后台管理系统内容形态（应用型区块）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 4 个应用型后台块（StatsGrid / DataTable / FormPanel / StatusCard）并为 AuthPanel 补图片槽，同时让 drafter 按任务类型引导主题、把 form 页面挪到侧边栏壳，使「SaaS 落地页」与「后台管理系统」生成形态可区分。

**Architecture:** 仓库既有「侧车（`.slots.ts`）→ 底座 SFC（`vue3-base/src/blocks/*.vue`）→ `registry.ts` 注册 → SFC 对齐测试自动遍历」流程纯横向扩展；新后台块全部 `slots: []`（零图片、building 零图片请求）。AuthPanel 从 `slots: []` 变为带 2 槽（保留 `illustration`、新增 `icon`），走既有图片管线。`theme` 只在 drafter system prompt 里按任务类型引导，**不改任何 schema**。`form → SidebarShell` 是唯一动 codegen 的地方（`layouts.ts` 的 `SHELL_BY_PAGE_TYPE`）。

**Tech Stack:** TypeScript 5.9、zod 4、Vue 3.5 SFC（`<script setup>` + `defineProps<{…}>()`）、vitest 3。

**Spec:** `docs/superpowers/specs/2026-09-24-admin-blocks-design.md`

## Global Constraints

- **几何只来自侧车**：`content` 是模型唯一的文字入口；`aspectRatio/renderSize/transparent/composition` 永不由模型写（draft schema 里根本没有这些键）。
- **props 走 const+v-bind**：codegen 把 props 序列化进 `const propsN = {…}` 再用 `v-bind`，**绝不 inline 进属性**（vue-tsc 的实体陷阱）。
- **区块 props 名与底座 SFC 的 `defineProps<{…}>()` 一字不差**（`sfc-props.test.ts` 会遍历 `BLOCK_REGISTRY` 自动断言）。`assets` prop 由 codegen 注入，**不得**出现在侧车 props 里。
- **块内不硬编码颜色**：一律读 `--color-*` / `--radius` / `--space-unit` / `--font-*` tokens。
- **不引第三方**：新区块只用原生元素与模板自带工具类（`.container`/`.section`/`.button`/`.button--ghost`）。
- **零图片槽**：4 个新后台块 `slots: []`；AuthPanel 有 2 槽。
- **auth 页 chrome 关闭**：`router.ts` 给 auth 页 `meta: { chrome: false }`（既有，勿动）。
- 测试门槛：每个任务结束 `pnpm --filter <pkg> test` 与 `pnpm --filter <pkg> typecheck` 必须绿；全仓最后 `pnpm -r test` + `pnpm -r typecheck` 全绿。
- 单文件测试命令（`--` 传不进去）：在包目录用 `npx vitest run <path>`，或 `pnpm --filter <pkg> exec vitest run <path>`。
- **提交纪律（仓库根三条永不提交的文件）**：`.claude/`、`README.md`、`docs/superpowers/plans/2026-09-22-output-richness.md`。用显式 `git add <path>` 或 `git add -u`，**绝不 `git add -A`**。commit 消息以 `Co-Authored-By: Claude Code <noreply@anthropic.com>` 结尾。

## 既有参考（所有任务共用）

- 侧车写法：`packages/templates/blocks/src/blocks/stats-band.slots.ts`（slotless 最简）、`auth-panel.slots.ts`（props 多）。
- 底座 SFC 写法：`packages/templates/vue3-base/src/blocks/StatsBand.vue`、`EmptyStatePanel.vue`（tokens 用法、`.container`/`.section`/`.button`）。
- 带图槽 SFC 写法：`packages/templates/vue3-base/src/blocks/HeroSplit.vue`（`data-asset-slot`、`assets.illustration.src/alt`）、`EmptyStatePanel.vue`（1:1 图）。
- 工具类（`base.css`）：`.container`（max-width 1120px 居中）、`.section`（`padding: calc(var(--space-unit) * 4) 0`）、`.button`（主色实心）、`.button--ghost`（描边）。块内可用 scoped 类名，样式全部读 tokens。
- 区块注册：`packages/templates/blocks/src/registry.ts` 的 `definitions` 数组 + `src/index.ts` 的 `export *`（新块只需改 registry.ts，index 已 export registry）。
- derive 测试模式：`packages/templates/blocks/src/__tests__/derive.test.ts:130-200`（slotless 断言，逐块 `derives no assets … props pass through`）。
- drafter prompt：`packages/providers/src/openai-spec-drafter.ts` 的 `systemPrompt()`；其测试 `packages/providers/src/__tests__/openai-spec-drafter.test.ts:315-337`（`asks the model to plan an outline…` 模式）。
- SFC 对齐测试：`packages/templates/blocks/src/__tests__/sfc-props.test.ts` / `sfc-geometry.test.ts`（自动遍历 `BLOCK_REGISTRY`）。
- codegen 壳选择：`packages/codegen/src/layouts.ts` 的 `SHELL_BY_PAGE_TYPE` 与 `__tests__/layouts.test.ts`（`sends a form page to the AppShell` 测试将改）。

---

### Task 1: `StatsGrid` 区块（侧车 + 底座 + 注册 + 测试）

**Files:**
- Create: `packages/templates/blocks/src/blocks/stats-grid.slots.ts`
- Create: `packages/templates/vue3-base/src/blocks/StatsGrid.vue`
- Modify: `packages/templates/blocks/src/registry.ts`（导入 + `definitions` 数组加一项）
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`（加 slotless 断言 + 改注册表错误消息期望的正则）

**Interfaces:**
- Produces: `StatsGrid` 区块。侧车 `props: { heading: 'string', stats: '{ label, value, delta?, suffix? }[]' }`，`slots: []`，`pageTypes: ['dashboard']`。底座 `defineProps<{ heading?: string; stats?: Stat[] }>()`（`Stat = { label: string; value: string; delta?: string; suffix?: string }`）。

- [ ] **Step 1: 写侧车**

`packages/templates/blocks/src/blocks/stats-grid.slots.ts`：

```ts
import type { BlockDefinition } from '../slot.js'

/** Four-up KPI grid for a dashboard. Props-only: no image slots. */
export const StatsGrid: BlockDefinition = {
  component: 'StatsGrid',
  pageTypes: ['dashboard'],
  props: { heading: 'string', stats: '{ label, value, delta?, suffix? }[]' },
  slots: [],
}
```

- [ ] **Step 2: 写底座 SFC**

`packages/templates/vue3-base/src/blocks/StatsGrid.vue`（antd 风格：surface 卡片、大号 KPI、muted 标签、delta 用 `--color-accent`）：

```vue
<script setup lang="ts">
interface Stat {
  label: string
  value: string
  delta?: string
  suffix?: string
}

withDefaults(
  defineProps<{
    heading?: string
    stats?: Stat[]
  }>(),
  { heading: '', stats: () => [] },
)
</script>

<template>
  <section class="section stats-grid">
    <div class="container">
      <header v-if="heading" class="stats-grid__head">
        <h2 class="stats-grid__title">{{ heading }}</h2>
      </header>
      <div v-if="stats.length > 0" class="stats-grid__grid">
        <div v-for="stat in stats" :key="stat.label" class="stats-grid__cell">
          <dt class="stats-grid__value">
            {{ stat.value }}<span v-if="stat.suffix" class="stats-grid__suffix">{{ stat.suffix }}</span>
          </dt>
          <dd class="stats-grid__label">{{ stat.label }}</dd>
          <dd v-if="stat.delta" class="stats-grid__delta">{{ stat.delta }}</dd>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stats-grid__head {
  margin-bottom: calc(var(--space-unit) * 2);
}

.stats-grid__title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  margin: 0;
}

.stats-grid__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: calc(var(--space-unit) * 1.5);
}

.stats-grid__cell {
  padding: calc(var(--space-unit) * 1.5);
  border-radius: var(--radius);
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
}

.stats-grid__value {
  font-family: var(--font-heading);
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  color: var(--color-foreground);
  margin: 0;
}

.stats-grid__suffix {
  font-size: 0.6em;
  color: var(--color-muted);
}

.stats-grid__label {
  color: var(--color-muted);
  margin: var(--space-unit) 0 0;
  font-size: 0.875rem;
}

.stats-grid__delta {
  color: var(--color-accent);
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  font-weight: 600;
}

@media (max-width: 640px) {
  .stats-grid__grid {
    grid-template-columns: 1fr;
  }
}
</style>
```

- [ ] **Step 3: 注册**

`packages/templates/blocks/src/registry.ts`：
- 顶部加 `import { StatsGrid } from './blocks/stats-grid.slots.js'`
- `definitions` 数组（字母序）加 `StatsGrid,`

- [ ] **Step 4: derive 测试 + 注册错误消息正则**

`packages/templates/blocks/src/__tests__/derive.test.ts`：
- 顶部 import 加 `StatsGrid`（既有 `import { AuthPanel, HeroSplit, StatsBand, … } from '../registry.js'` 那行，追加 `StatsGrid`，保持字母序）
- 在既有 slotless 断言块里加一条（模式照 `StatsBand`）：

```ts
it('derives no assets for the slotless StatsGrid', () => {
  const { blocks, assets } = derivePageAssets('/', [
    { component: 'StatsGrid', props: { heading: 'Overview', stats: [{ label: 'Users', value: '12k', delta: '+8%' }] } },
  ])
  expect(assets).toHaveLength(0)
  expect(blocks[0]!.props).toEqual({
    heading: 'Overview',
    stats: [{ label: 'Users', value: '12k', delta: '+8%' }],
  })
})
```

- **Step 4b:** 把 :89 附近那条注册表错误消息期望（`/MadeUpBlock.*available: AuthPanel, …/` 正则）里**追加 `StatsGrid`**（保持字母序），否则它会红。

- [ ] **Step 5: 跑 blocks 测试与类型检查**

Run: `cd packages/templates/blocks && npx vitest run` 然后 `pnpm --filter @vudt/blocks typecheck`
Expected: 全绿（93 → 94 例，加 1）。SFC 对齐测试自动遍历到新块（侧车 props 与 `defineProps` 一字不差）。

- [ ] **Step 6: Commit**

```bash
git add packages/templates/blocks/src/blocks/stats-grid.slots.ts packages/templates/vue3-base/src/blocks/StatsGrid.vue packages/templates/blocks/src/registry.ts packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): add StatsGrid block"
```

---

### Task 2: `DataTable` 区块（侧车 + 底座 + 注册 + 测试）

**Files:**
- Create: `packages/templates/blocks/src/blocks/data-table.slots.ts`
- Create: `packages/templates/vue3-base/src/blocks/DataTable.vue`
- Modify: `packages/templates/blocks/src/registry.ts`
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`

**Interfaces:**
- Produces: `DataTable` 区块。侧车 `props: { heading: 'string', subheading: 'string', columns: '{ key, label, kind? }[]', rows: '{ cells: string[] }[]' }`，`slots: []`，`pageTypes: ['list-detail', 'dashboard']`。底座 `defineProps<{ heading?: string; subheading?: string; columns?: Column[]; rows?: Row[] }>()`（`Column = { key: string; label: string; kind?: string }`，`Row = { cells: string[] }`）。

- [ ] **Step 1: 写侧车**

`packages/templates/blocks/src/blocks/data-table.slots.ts`：

```ts
import type { BlockDefinition } from '../slot.js'

/** Data table for list-detail pages: header + rows of cells. Props-only. */
export const DataTable: BlockDefinition = {
  component: 'DataTable',
  pageTypes: ['list-detail', 'dashboard'],
  props: {
    heading: 'string',
    subheading: 'string',
    columns: '{ key, label, kind? }[]',
    rows: '{ cells: string[] }[]',
  },
  slots: [],
}
```

- [ ] **Step 2: 写底座 SFC**

`packages/templates/vue3-base/src/blocks/DataTable.vue`（antd 风格表格：surface 卡片、表头行 muted、单元格分隔线；`kind` ∈ `text | badge | link | status`，`badge`/`status` 用 `--color-accent` 或 `--color-primary` 显示小标签，`link` 用 `.link` 类 + `:href`——注意 `cells` 是纯字符串数组，不建模的 `to` 目标，所以 link 用 `href` 而不用 router-link）：

```vue
<script setup lang="ts">
interface Column {
  key: string
  label: string
  kind?: string
}

interface Row {
  cells: string[]
}

withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    columns?: Column[]
    rows?: Row[]
  }>(),
  { heading: '', subheading: '', columns: () => [], rows: () => [] },
)
</script>

<template>
  <section class="section table">
    <div class="container">
      <header v-if="heading || subheading" class="table__head">
        <h2 v-if="heading" class="table__title">{{ heading }}</h2>
        <p v-if="subheading" class="table__sub">{{ subheading }}</p>
      </header>
      <div v-if="columns.length > 0" class="table__wrap">
        <table class="table__grid">
          <thead>
            <tr>
              <th v-for="column in columns" :key="column.key" class="table__th">
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in rows" :key="i" class="table__row">
              <td v-for="(cell, j) in row.cells" :key="j" class="table__td">
                <template v-if="columns[j]?.kind === 'badge'">
                  <span class="table__badge">{{ cell }}</span>
                </template>
                <template v-else-if="columns[j]?.kind === 'status'">
                  <span class="table__status">{{ cell }}</span>
                </template>
                <template v-else-if="columns[j]?.kind === 'link'">
                  <a class="table__link" :href="`#${cell}`">{{ cell }}</a>
                </template>
                <template v-else>
                  {{ cell }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.table__head {
  margin-bottom: calc(var(--space-unit) * 1.5);
}

.table__title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  margin: 0 0 0.25rem;
}

.table__sub {
  color: var(--color-muted);
  margin: 0;
}

.table__wrap {
  overflow-x: auto;
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.table__grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.table__th {
  text-align: left;
  padding: 0.75rem 1rem;
  color: var(--color-muted);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
}

.table__td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-muted) 15%, transparent);
}

.table__row:last-child .table__td {
  border-bottom: 0;
}

.table__badge,
.table__status {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: calc(var(--radius) * 0.6);
  font-size: 0.8rem;
  font-weight: 600;
}

.table__badge {
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
}

.table__status {
  background: color-mix(in srgb, var(--color-accent) 15%, transparent);
  color: var(--color-accent);
}

.table__link {
  color: var(--color-primary);
}
</style>
```

- [ ] **Step 3: 注册**（照 Task 1 Step 3，加 `DataTable`）

- [ ] **Step 4: derive 测试 + 错误消息正则**（照 Task 1 Step 4，`DataTable` 样例 `columns: [{ key: 'name', label: 'Name' }], rows: [{ cells: ['Acme'] }]`）

- [ ] **Step 5: 跑 blocks 测试与类型检查**

Run: `cd packages/templates/blocks && npx vitest run` 然后 `pnpm --filter @vudt/blocks typecheck`
Expected: 全绿（95 例）。

- [ ] **Step 6: Commit**

```bash
git add packages/templates/blocks/src/blocks/data-table.slots.ts packages/templates/vue3-base/src/blocks/DataTable.vue packages/templates/blocks/src/registry.ts packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): add DataTable block"
```

---

### Task 3: `FormPanel` 区块（侧车 + 底座 + 注册 + 测试）

**Files:**
- Create: `packages/templates/blocks/src/blocks/form-panel.slots.ts`
- Create: `packages/templates/vue3-base/src/blocks/FormPanel.vue`
- Modify: `packages/templates/blocks/src/registry.ts`
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`

**Interfaces:**
- Produces: `FormPanel` 区块。侧车 `props: { heading: 'string', subheading: 'string', fields: '{ label, type, placeholder? }[]', submitLabel: 'string' }`，`slots: []`，`pageTypes: ['settings', 'form']`。底座 `defineProps<{ heading?: string; subheading?: string; fields?: Field[]; submitLabel?: string }>()`（`Field = { label: string; type: string; placeholder?: string }`）。

- [ ] **Step 1: 写侧车**

`packages/templates/blocks/src/blocks/form-panel.slots.ts`：

```ts
import type { BlockDefinition } from '../slot.js'

/** Sectioned settings form: labelled inputs and one submit. Props-only. */
export const FormPanel: BlockDefinition = {
  component: 'FormPanel',
  pageTypes: ['settings', 'form'],
  props: {
    heading: 'string',
    subheading: 'string',
    fields: '{ label, type, placeholder? }[]',
    submitLabel: 'string',
  },
  slots: [],
}
```

- [ ] **Step 2: 写底座 SFC**

`packages/templates/vue3-base/src/blocks/FormPanel.vue`（antd 风格表单：surface 卡片、标签 + 输入框纵向堆叠，`fields` 里的 `type` 直通原生 `<input :type>`，`submitLabel` 用 `.button`）：

```vue
<script setup lang="ts">
interface Field {
  label: string
  type: string
  placeholder?: string
}

withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    fields?: Field[]
    submitLabel?: string
  }>(),
  { heading: '', subheading: '', fields: () => [], submitLabel: '' },
)
</script>

<template>
  <section class="section form-panel">
    <div class="container form-panel__inner">
      <header class="form-panel__head">
        <h2 v-if="heading" class="form-panel__title">{{ heading }}</h2>
        <p v-if="subheading" class="form-panel__sub">{{ subheading }}</p>
      </header>
      <form class="form-panel__form" @submit.prevent>
        <label v-for="field in fields" :key="field.label" class="form-panel__field">
          <span class="form-panel__label">{{ field.label }}</span>
          <input
            class="form-panel__input"
            :type="field.type"
            :placeholder="field.placeholder"
          />
        </label>
        <button v-if="submitLabel" class="button form-panel__submit" type="submit">
          {{ submitLabel }}
        </button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.form-panel__inner {
  max-width: 640px;
}

.form-panel__head {
  margin-bottom: calc(var(--space-unit) * 2);
}

.form-panel__title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  margin: 0 0 0.25rem;
}

.form-panel__sub {
  color: var(--color-muted);
  margin: 0;
}

.form-panel__form {
  display: flex;
  flex-direction: column;
  gap: calc(var(--space-unit) * 1.5);
  padding: calc(var(--space-unit) * 2);
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.form-panel__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-panel__label {
  font-size: 0.875rem;
  font-weight: 600;
}

.form-panel__input {
  padding: 0.7em 0.9em;
  border: 1px solid color-mix(in srgb, var(--color-muted) 40%, transparent);
  border-radius: var(--radius);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit;
}

.form-panel__input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.form-panel__submit {
  align-self: flex-start;
}
</style>
```

- [ ] **Step 3: 注册**（照 Task 1 Step 3，加 `FormPanel`）

- [ ] **Step 4: derive 测试 + 错误消息正则**（照 Task 1 Step 4，`FormPanel` 样例 `fields: [{ label: 'Name', type: 'text' }], submitLabel: 'Save'`）

- [ ] **Step 5: 跑 blocks 测试与类型检查**

Run: `cd packages/templates/blocks && npx vitest run` 然后 `pnpm --filter @vudt/blocks typecheck`
Expected: 全绿（96 例）。

- [ ] **Step 6: Commit**

```bash
git add packages/templates/blocks/src/blocks/form-panel.slots.ts packages/templates/vue3-base/src/blocks/FormPanel.vue packages/templates/blocks/src/registry.ts packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): add FormPanel block"
```

---

### Task 4: `StatusCard` 区块（侧车 + 底座 + 注册 + 测试）

**Files:**
- Create: `packages/templates/blocks/src/blocks/status-card.slots.ts`
- Create: `packages/templates/vue3-base/src/blocks/StatusCard.vue`
- Modify: `packages/templates/blocks/src/registry.ts`
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`

**Interfaces:**
- Produces: `StatusCard` 区块。侧车 `props: { heading: 'string', items: '{ label, value, tone? }[]', icon: 'string' }`，`slots: []`，`pageTypes: ['dashboard', 'list-detail']`。底座 `defineProps<{ heading?: string; items?: Item[]; icon?: string }>()`（`Item = { label: string; value: string; tone?: string }`）。`icon` 是 props 里的 icon 名（模型填文案），非图片槽——SFC 不渲染 `<img>`。

- [ ] **Step 1: 写侧车**

`packages/templates/blocks/src/blocks/status-card.slots.ts`：

```ts
import type { BlockDefinition } from '../slot.js'

/** Status card for a dashboard: labelled values with an optional tone. Props-only. */
export const StatusCard: BlockDefinition = {
  component: 'StatusCard',
  pageTypes: ['dashboard', 'list-detail'],
  props: {
    heading: 'string',
    items: '{ label, value, tone? }[]',
    icon: 'string',
  },
  slots: [],
}
```

- [ ] **Step 2: 写底座 SFC**

`packages/templates/vue3-base/src/blocks/StatusCard.vue`（antd 风格状态卡：`icon` 以文本徽标显示在标题右侧，`tone` ∈ `good | warn | bad` 映射到 `--color-primary` / `--color-accent` / 红色（用 `color-mix` 从 `--color-foreground` 调，或直接读 `--color-accent` 双档））：

```vue
<script setup lang="ts">
interface Item {
  label: string
  value: string
  tone?: string
}

const TONE_CLASS: Record<string, string> = {
  good: 'status-card__item--good',
  warn: 'status-card__item--warn',
  bad: 'status-card__item--bad',
}

withDefaults(
  defineProps<{
    heading?: string
    items?: Item[]
    icon?: string
  }>(),
  { heading: '', items: () => [], icon: '' },
)
</script>

<template>
  <section class="section status-card">
    <div class="container status-card__inner">
      <header class="status-card__head">
        <h2 v-if="heading" class="status-card__title">
          {{ heading }}
          <span v-if="icon" class="status-card__icon">{{ icon }}</span>
        </h2>
      </header>
      <dl v-if="items.length > 0" class="status-card__list">
        <div
          v-for="item in items"
          :key="item.label"
          class="status-card__item"
          :class="TONE_CLASS[item.tone ?? '']"
        >
          <dt class="status-card__label">{{ item.label }}</dt>
          <dd class="status-card__value">{{ item.value }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.status-card__inner {
  max-width: 560px;
}

.status-card__head {
  margin-bottom: calc(var(--space-unit) * 1.5);
}

.status-card__title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
  font-size: 0.9rem;
  font-weight: 700;
}

.status-card__list {
  display: grid;
  gap: 0.75rem;
  margin: 0;
}

.status-card__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.status-card__label {
  color: var(--color-muted);
  font-size: 0.875rem;
}

.status-card__value {
  margin: 0;
  font-weight: 600;
}

.status-card__item--good .status-card__value {
  color: var(--color-primary);
}

.status-card__item--warn .status-card__value {
  color: var(--color-accent);
}

.status-card__item--bad .status-card__value {
  color: color-mix(in srgb, var(--color-foreground) 70%, red);
}
</style>
```

- [ ] **Step 3: 注册**（照 Task 1 Step 3，加 `StatusCard`）

- [ ] **Step 4: derive 测试 + 错误消息正则**（照 Task 1 Step 4，`StatusCard` 样例 `items: [{ label: 'CPU', value: '42%', tone: 'good' }], icon: '✓'`）

- [ ] **Step 5: 跑 blocks 测试与类型检查**

Run: `cd packages/templates/blocks && npx vitest run` 然后 `pnpm --filter @vudt/blocks typecheck`
Expected: 全绿（97 例）。

- [ ] **Step 6: Commit**

```bash
git add packages/templates/blocks/src/blocks/status-card.slots.ts packages/templates/vue3-base/src/blocks/StatusCard.vue packages/templates/blocks/src/registry.ts packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): add StatusCard block"
```

---

### Task 5: 改造 `AuthPanel`——保留 `illustration`、新增 `icon` 槽

**Files:**
- Modify: `packages/templates/blocks/src/blocks/auth-panel.slots.ts`（`slots: []` → 两个槽）
- Modify: `packages/templates/vue3-base/src/blocks/AuthPanel.vue`（模板加图标区 + `<img data-asset-slot="icon">`、props 加 `assets?: SlotAssets`）
- Modify: `packages/templates/blocks/src/__tests__/derive.test.ts`（改既有 `derives no assets for the slotless AuthPanel` 断言）

**Interfaces:**
- Produces: `AuthPanel` 从 `slots: []` 变为 `slots: [illustration, icon]`。`illustration` 槽：`purpose: 'hero-illustration'`，`aspectRatio: '1:1'`，`renderSize: { w: 512, h: 512 }`，`transparent: true`，`composition: 'centered'`，`defaultPrompt: 'a friendly login or sign-up illustration'`，`defaultAlt: 'Sign in illustration'`。`icon` 槽：`purpose: 'logo-mark'`，`aspectRatio: '1:1'`，`renderSize: { w: 128, h: 128 }`，`transparent: true`，`composition: 'centered'`，`defaultPrompt: 'a simple brand mark or logo icon'`，`defaultAlt: 'Brand icon'`。

- [ ] **Step 1: 改侧车**

`packages/templates/blocks/src/blocks/auth-panel.slots.ts`：

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
  slots: [
    {
      name: 'illustration',
      purpose: 'hero-illustration',
      aspectRatio: '1:1',
      renderSize: { w: 512, h: 512 },
      transparent: true,
      composition: 'centered',
      defaultPrompt: 'a friendly login or sign-up illustration, no text',
      defaultAlt: 'Sign in illustration',
    },
    {
      name: 'icon',
      purpose: 'logo-mark',
      aspectRatio: '1:1',
      renderSize: { w: 128, h: 128 },
      transparent: true,
      composition: 'centered',
      defaultPrompt: 'a simple brand mark or logo icon, no text',
      defaultAlt: 'Brand icon',
    },
  ],
}
```

- [ ] **Step 2: 改底座 SFC**

`packages/templates/vue3-base/src/blocks/AuthPanel.vue`：
- `<script setup>` 加 `import type { SlotAssets } from '../asset'`，props 加 `assets?: SlotAssets`，`withDefaults` 加 `assets: () => ({})`
- 模板：在 `<section>` 里加一个插图区（仿 `EmptyStatePanel` 的 `.empty__figure` 模式），放两个 `<img>`：

```vue
    <div class="auth__figures">
      <div class="auth__figure">
        <img
          v-if="assets.illustration"
          data-asset-slot="illustration"
          :src="assets.illustration.src"
          :alt="assets.illustration.alt"
          width="512"
          height="512"
          loading="lazy"
        />
      </div>
      <img
        v-if="assets.icon"
        data-asset-slot="icon"
        :src="assets.icon.src"
        :alt="assets.icon.alt"
        width="128"
        height="128"
        loading="lazy"
        class="auth__icon"
      />
    </div>
```

- scoped style 加（`.auth__figures` 居中、`.auth__figure` 的 `img` 圆形化、`.auth__icon` 圆形小徽标）：

```css
.auth__figures {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  margin-bottom: calc(var(--space-unit) * 1.5);
}

.auth__figure img {
  width: 100%;
  max-width: 180px;
  height: auto;
  object-fit: contain;
}

.auth__icon {
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
}
```

- [ ] **Step 3: 改 derive 测试**

`packages/templates/blocks/src/__tests__/derive.test.ts` 那条 `derives no assets for the slotless AuthPanel, and mode/fields pass through` 改为断言**现在有 2 个资产**、几何来自侧车、props 原样过：

```ts
it('derives illustration and icon assets for AuthPanel, geometry from the sidecar', () => {
  const { blocks, assets } = derivePageAssets('/', [
    { component: 'AuthPanel', props: { mode: 'sign-up', heading: 'Create Account', fields: [{ label: 'Email', type: 'email' }] } },
  ])
  expect(assets).toHaveLength(2)
  expect(assets.map((a) => a.purpose).sort()).toEqual(['hero-illustration', 'logo-mark'])
  expect(blocks[0]!.props).toEqual({
    mode: 'sign-up',
    heading: 'Create Account',
    fields: [{ label: 'Email', type: 'email' }],
  })
})
```

- **Step 3b:** 检查 `sfc-geometry.test.ts` 对 AuthPanel 的自动断言：它要求每个 slot 在 SFC 里有一个 `<img data-asset-slot>` 且 w/h 等于侧车——Step 2 的两个 `<img>` 满足（`512`/`512`、`128`/`128`）。

- [ ] **Step 4: 跑 blocks 测试与类型检查**

Run: `cd packages/templates/blocks && npx vitest run` 然后 `pnpm --filter @vudt/blocks typecheck`
Expected: 全绿（derive 那条改断言，总数 97 不变）。

- [ ] **Step 5: Commit**

```bash
git add packages/templates/blocks/src/blocks/auth-panel.slots.ts packages/templates/vue3-base/src/blocks/AuthPanel.vue packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): give AuthPanel illustration and icon slots"
```

---

### Task 6: drafter 按任务类型引导主题 + 后台块指引（提示词）

**Files:**
- Modify: `packages/providers/src/openai-spec-drafter.ts`（`systemPrompt()`）
- Modify: `packages/providers/src/__tests__/openai-spec-drafter.test.ts`（加断言）

**Interfaces:**
- Consumes: 4 个新块已注册（`renderBlockCatalogue()` 自动列出）。
- Produces: system prompt 含「站点类型判断 + 主题风格引导」段。

- [ ] **Step 1: 改 prompt**

`packages/providers/src/openai-spec-drafter.ts` 的 `systemPrompt()`，在 `'Design process (never output this — think it in your head before writing the JSON):'` 那段之后、`'Draft shape…'` 之前插入一段（保持只引导、不改 schema）：

```
'Site kind (read the project description first):',
'- If it describes a back-office or management system (admin, dashboard, console, CRM,',
'  operations, "后台", "管理系统"), plan app pages and pick app blocks: DataTable,',
'  FormPanel, StatsGrid, StatusCard, EmptyStatePanel, AuthPanel. Keep the theme',
'  restrained — a neutral palette, compact spacing, small radius, no marketing extras.',
'- Otherwise plan a marketing site and pick marketing blocks, with a distinctive palette',
'  and a radius/spacing that match the page mood.',
```

- [ ] **Step 2: 加测试**

`packages/providers/src/__tests__/openai-spec-drafter.test.ts`（在 `asks the model to plan an outline before writing the draft` 之后加）：

```ts
test('guides the theme by site kind in the system prompt', async () => {
  const { calls, drafter } = drafterWith(chatReply('{}'))

  await drafter.draft({ description: 'a management system', attempt: 1 })

  const system = systemOf(calls[0]!)
  expect(system).toMatch(/back-office or management system/i)
  expect(system).toMatch(/DataTable/)
  expect(system).toMatch(/restrained/)
})
```

- [ ] **Step 3: 跑 providers 测试与类型检查**

Run: `cd packages/providers && npx vitest run` 然后 `pnpm --filter @vudt/providers typecheck`
Expected: 全绿（51 → 52 例）。

- [ ] **Step 4: Commit**

```bash
git add packages/providers/src/openai-spec-drafter.ts packages/providers/src/__tests__/openai-spec-drafter.test.ts
git commit -m "feat(providers): guide theme and blocks by site kind"
```

---

### Task 7: `form` 页面类型挪到 SidebarShell

**Files:**
- Modify: `packages/codegen/src/layouts.ts`（`SHELL_BY_PAGE_TYPE` 一行）
- Modify: `packages/codegen/src/__tests__/layouts.test.ts`（改 `sends a form page to the AppShell` 测试）

**Interfaces:**
- Produces: `pickShell()` 对含 form 页的 spec 返回 `SidebarShell`。

- [ ] **Step 1: 改 `layouts.ts`**

`packages/codegen/src/layouts.ts:30-37` 的 `SHELL_BY_PAGE_TYPE`：

```ts
const SHELL_BY_PAGE_TYPE: Record<PageType, ShellName> = {
  landing: 'AppShell',
  auth: 'AppShell',
  form: 'SidebarShell',
  dashboard: 'SidebarShell',
  settings: 'SidebarShell',
  'list-detail': 'SidebarShell',
}
```

- [ ] **Step 2: 改测试**

`packages/codegen/src/__tests__/layouts.test.ts` 的 `sends a form page to the AppShell` 改为：

```ts
  // `form` pages (settings forms, admin forms) belong in the sidebar shell,
  // consistent with dashboard/settings. This pins the decision so a new page
  // type cannot drift to a shell unnoticed.
  it('sends a form page to the SidebarShell', () => {
    const spec = withPages(landingSpec(), [
      page('/', 'Home', 'landing'),
      page('/contact', 'Contact', 'form'),
    ])
    expect(pickShell(spec)).toBe('SidebarShell')
  })
```

- [ ] **Step 3: 跑 codegen 测试与类型检查**

Run: `cd packages/codegen && npx vitest run` 然后 `pnpm --filter @vudt/codegen typecheck`
Expected: 全绿（60 例，改 1 条不改数）。

- [ ] **Step 4: Commit**

```bash
git add packages/codegen/src/layouts.ts packages/codegen/src/__tests__/layouts.test.ts
git commit -m "feat(codegen): send form pages to the sidebar shell"
```

---

### Task 8: 全仓回归 + 端到端手验

**Files:**
- 无代码改动（交付物是确认）。

**Interfaces:**
- Consumes: 本计划全部代码改动。

- [ ] **Step 1: 全仓测试与类型检查**

Run: `pnpm -r test 2>&1 | tail -n 30` 然后 `pnpm -r typecheck 2>&1 | tail -n 30`
Expected: 全绿（blocks 97、codegen 60、providers 52；全仓 43 文件 / 466 例）。

- [ ] **Step 2: 反证（可选但推荐）**

在 `packages/providers/src/openai-spec-drafter.ts` 的 system prompt 里把 `'restrained — a neutral palette, compact spacing, small radius'` 临时改成 `'vibrant'`，跑 `cd packages/providers && npx vitest run src/__tests__/openai-spec-drafter.test.ts`，确认那条新断言变红；恢复后全绿。

- [ ] **Step 3: 真任务端到端手验（需要真 key）**

按 `docs/superpowers/plans/2026-09-20-settings-page.md` 收尾验证的方法起服务（**从仓库根起**，`./server/node_modules/.bin/tsx --env-file=server/.env server/src/main.ts`），在 `<根>/.vudt/settings.json` 配好 model，前端 `cd web && npx vite`。提交一条「后台管理系统」描述，等待任务完成，检查：
- 生成的工程用 `SidebarShell`（侧边栏壳）；
- 后台页用 `StatsGrid` / `DataTable` / `FormPanel` / `StatusCard` 之一或组合；
- `AuthPanel` 页有插画与 icon 两张图；
- 预览与导出（source / dist）正常，无 console error。

**本任务不提交**（交付物是确认）。

## 收尾验证（全部任务完成后）

- [ ] `pnpm -r test` / `pnpm -r typecheck` 全绿
- [ ] `git status --porcelain` 干净（除 `.claude/`、`README.md`、`docs/superpowers/plans/2026-09-22-output-richness.md` 三个永不提交的文件）
- [ ] 分支可发布
