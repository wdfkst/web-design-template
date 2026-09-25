# 数据模型 + 操作语义（Data Model）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让生成的后台从「静态内容展示」升级为「可操作的后台」——表格可搜索/排序/分页、表单可校验/保存（toast）、指标带迷你图表、页级操作工具条，且旧 spec 生成的工程逐字节不变。

**Architecture:** 在 spec 中新增三个全可选声明 `collections[]` / `forms[]` / `pages[].operations[]`，经 codegen 落成 `src/data/mock.ts` + `src/data/store.ts`（内存态 mock，无后端/落盘），`renderPage` 按声明生成块绑定（DataTable `:data`/`:columns`/`:searchable` 等、FormPanel `:fields`/`:on-save`、页顶 ops 工具条），四个后台块 SFC 内置交互逻辑。缺省字段回退到静态渲染，实现旧 spec 零破坏。

**Tech Stack:** Zod 4（schema）、Vue 3.5.22 + vue-router 4.5.1（生成工程）、TypeScript 5.9.2、vitest 3.2.4。生成工程保持零第三方依赖。

**Spec:** `docs/superpowers/specs/2026-09-25-data-model-design.md`（本 plan 从该 spec 立论，执行者两个都读）。

## Global Constraints

- **旧 spec 零破坏**：不写 `collections`/`forms`/`operations` 的任务，生成项目与今日完全一致；全仓既有测试基线全绿。
- **几何不变量**：`aspectRatio/renderSize/transparent/composition` 只来自侧车；props 走 `const propsN` + `v-bind`（vue-tsc HTML 实体陷阱，复用 `page.ts` 的 `literal()`）。
- **SFC-prop 不变量**：侧车 `props` 键与 SFC `defineProps<{…}>()` 键一字不差（`sfc-props.test.ts` 自动遍历断言）。新 prop 必须同时进两侧。
- **字符串变宽陷阱**：SFC 新 props 类型只用 `string`/`number`/`boolean`/数组/函数，**禁用 string-literal union**（AuthPanel `mode?: string` 先例；`chart` 是 `string`，运行时用 `=== 'line'` 判定）。
- **生成工程编译门槛**：`write.test.ts` 对生成工程跑 vue-tsc + vite build；新生成代码必须满足 vue3-base 的独立 tsconfig（strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`，**无** `exactOptionalPropertyTypes`）。
- **块内颜色只用 tokens**：`--color-*` / `--radius` / `--space-unit` / `--font-*`；工具类只复用 `base.css` 的 `.container` / `.section` / `.button` / `.button--ghost`。
- **store/mock 纯净**：无异步、无定时器、无 localStorage、无落盘；每页独立实例化，路由切换/刷新即重置。
- **生成文件只在** `src/data/`、`src/pages/`；越界由 `writeProject.safeJoin` 拦截（`write.ts` 已对 `src/data/` 自动 `mkdir`，模板无需改动）。
- **提交纪律**：显式 `git add <path>` 或 `git add -u`，绝不 `git add -A`；commit 消息以 `Co-Authored-By: Claude Code <noreply@anthropic.com>` 结尾；`.claude/`、`README.md`、`docs/superpowers/plans/2026-09-22-output-richness.md` 三个文件永不提交。
- **测试纪律**：TDD（先写红测试 → 跑红 → 最小实现 → 跑绿 → 提交）；每任务跑该包定向测试；收尾全仓 `pnpm -r test` + `pnpm -r typecheck`。

### 对 spec 的五处补全（本 plan 的明确决策，偏离处都注明理由）

1. **`FormSchema` 增 `collection?: string`**：spec §5.4 承诺 onSave「写回 collection store」，但 §4.2 的 FormSchema 没有写回目标字段，无它无法知道写哪个集合。可选，缺省只 toast 不写回。配套第 4 条引用检查「form.collection 必须是已声明 collection」。
2. **`DataTable` 增 `rowActions?: string`**：spec §6.1 承诺「行操作（edit/delete 在 actions）时 emit save/delete」，但 prop 表未列开关 prop；用逗号串 `'edit,delete'` 控制行操作按钮渲染。
3. **`DataTable` 增 `searchText?: string`**：spec 承诺 `operations.filter` 行为，但 DataTable 搜索是内部 ref；外部工具条按钮经 `:search-text` ref 驱动内部搜索框。
4. **`searchable`/`sortable`/`pageable` 映射规则**（spec 只给默认值未给映射）：三者同源于 `actions.includes('search')`——声明了 `search` 的集合是「可操作数据表」，即可搜索、可排序、可翻页；`page-size` 恒为 8。分页器在 `pageable` 时即渲染（哪怕只有一页，按钮禁用但能力可见），不按 `seed > 8` 裁切。
5. **`store.update` 采用 upsert**：行带 id 则替换，无 id 则追加并生成 `row-{length+1}` id——表单新建行无需自己造 id。

---

## 文件结构

**spec 层（packages/spec/src）**
- Create: `collection.ts`（FieldTypeSchema / FieldModelSchema / CollectionSchema）
- Create: `form.ts`（FormFieldSchema / FormSchema）
- Create: `operation.ts`（OperationSchema）
- Modify: `project-spec.ts`（baseShape 挂 `collections`/`forms`，`checkReferentialIntegrity` 加 4 条检查）
- Modify: `page.ts`（PageSchema 挂 `operations`）
- Modify: `index.ts`（导出三个新模块）
- Test: `__tests__/data-model.test.ts`（新文件）

**codegen 层（packages/codegen/src）**
- Create: `data.ts`（`renderCollections` → `src/data/mock.ts` 的字符串）
- Create: `store.ts`（`renderStore` → `src/data/store.ts` 的字符串）
- Modify: `project.ts`（有 collections 时输出两个 data 文件）
- Modify: `page.ts`（DataTable/FormPanel 绑定、ops 工具条、注入 props 剥离、script const、style 块）
- Modify: `index.ts`（导出 data.ts/store.ts）
- Test: `__tests__/data.test.ts`（新文件）、`__tests__/project.test.ts`、`__tests__/page.test.ts`
- Modify: `__tests__/fixture.ts`（增 `dataModelSpec()`）

**blocks 层（packages/templates/blocks）**
- Modify: `blocks/data-table.slots.ts`、`blocks/form-panel.slots.ts`、`blocks/stats-grid.slots.ts`、`blocks/status-card.slots.ts`（props 增补）
- Modify: `draft.ts`（ProjectDraftSchema/DraftPageSchema 增新字段，`deriveSpecInput` 输出透传）
- Test: `__tests__/derive.test.ts`（slotless 断言补 collection/form 透传）

**vue3-base 模板**
- Modify: `src/blocks/DataTable.vue`、`src/blocks/FormPanel.vue`、`src/blocks/StatsGrid.vue`、`src/blocks/StatusCard.vue`

**providers 层（packages/providers）**
- Modify: `src/openai-spec-drafter.ts`（Draft shape 段 + 「Data semantics」段）
- Test: `src/__tests__/openai-spec-drafter.test.ts`（数据语义断言）

**收尾**
- Modify: `packages/codegen/src/__tests__/write.test.ts`（data-model spec 的 vue-tsc + vite build 集成用例）
- 手动：4301 隔离实例真任务验证 + 截图对比

---

### Task 1: spec 层——三个新 schema + 挂载 + 引用完整性检查

**Files:**
- Create: `packages/spec/src/collection.ts`
- Create: `packages/spec/src/form.ts`
- Create: `packages/spec/src/operation.ts`
- Modify: `packages/spec/src/project-spec.ts`（baseShape、`Checked` 类型、`checkReferentialIntegrity`）
- Modify: `packages/spec/src/page.ts`（PageSchema 加 `operations`）
- Modify: `packages/spec/src/index.ts`（导出）
- Test: `packages/spec/src/__tests__/data-model.test.ts`（新文件）

**Interfaces:**
- Produces: `CollectionSchema` / `FormSchema` / `OperationSchema`（类型 `Collection` / `Form` / `Operation`）；`ProjectSpecInput`/`ProjectSpec` 增加 `collections: Collection[]`、`forms: Form[]`（默认 `[]`）；`Page` 增加 `operations: Operation[]`（默认 `[]`）。后序任务全部从 `@vudt/spec` 消费这些类型。

- [ ] **Step 1: 写三个新 schema 文件（先建文件，测试随后）**

`packages/spec/src/collection.ts`（照 spec §4.1，唯一区别是 `fields` 校验留给引用完整性检查而非 schema 内自校验——字段键引用检查需要跨字段）：

```ts
import { z } from 'zod'

export const FieldTypeSchema = z.enum(['string', 'number', 'date', 'enum', 'boolean'])

export const FieldModelSchema = z.object({
  type: FieldTypeSchema,
  label: z.string().min(1).max(40),
  options: z.array(z.string()).optional(), // 仅 enum 使用
})

export const CollectionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/), // kebab-case，跨页引用
  label: z.string().min(1).max(40),
  model: z.record(z.string(), FieldModelSchema),
  fields: z.array(z.string()).min(1), // 列/表单显示顺序（必须是 model 的键）
  seed: z.number().int().min(1).max(50).default(8),
  actions: z.array(z.enum(['create', 'edit', 'delete', 'search', 'export'])).default([]),
})

export type Collection = z.infer<typeof CollectionSchema>
export type FieldModel = z.infer<typeof FieldModelSchema>
```

`packages/spec/src/form.ts`（照 spec §4.2，补 `collection?: string`，见 Global Constraints 补全 #1）：

```ts
import { z } from 'zod'
import { FieldTypeSchema } from './collection.js'

export const FormFieldSchema = z.object({
  key: z.string(), // 对应 collection.model 的键（可无 collection）
  label: z.string().min(1).max(40),
  type: FieldTypeSchema,
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  validate: z
    .object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().optional(),
      pattern: z.enum(['email']).optional(),
    })
    .default({}),
})

export const FormSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().min(1).max(40),
  /** 写回目标集合（可选）：onSave 写入该 collection 的 store；缺省只 toast。 */
  collection: z.string().optional(),
  fields: z.array(FormFieldSchema).min(1),
  submit: z
    .object({
      label: z.string().min(1).max(20),
      toast: z.string().min(1).max(40),
    })
    .default({ label: '保存', toast: '已保存' }),
})

export type Form = z.infer<typeof FormSchema>
export type FormField = z.infer<typeof FormFieldSchema>
```

`packages/spec/src/operation.ts`（照 spec §4.3）：

```ts
import { z } from 'zod'

export const OperationSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().min(1).max(20),
  kind: z.enum(['refresh', 'route', 'export', 'filter']),
  target: z.string(), // collection id 或路由
  param: z.string().optional(), // filter 用：搜索词
})

export type Operation = z.infer<typeof OperationSchema>
```

- [ ] **Step 2: 挂载到 ProjectSpec 与 PageSchema**

`packages/spec/src/page.ts`（PageSchema 加一行，原路由/标题等不动）：

```ts
export const PageSchema = z.object({
  route: z.string().regex(/^\/[a-z0-9\-/:]*$/, 'must start with / and be lowercase'),
  title: z.string().min(1).max(120),
  pageType: PageTypeSchema,
  blocks: z.array(BlockSchema).min(1),
  operations: z.array(OperationSchema).default([]),
})
```

并把 `import { OperationSchema } from './operation.js'` 加到 page.ts 顶部。

`packages/spec/src/project-spec.ts`：

```ts
import { z } from 'zod'
import { AssetInputSchema, AssetSchema, renderSizeMatchesRatio } from './asset.js'
import { CollectionSchema } from './collection.js'
import { FormSchema } from './form.js'
import { PageSchema } from './page.js'
import { StyleBibleSchema } from './style-bible.js'
import { ThemeSchema } from './theme.js'

const baseShape = {
  meta: MetaSchema,
  theme: ThemeSchema,
  styleBible: StyleBibleSchema,
  collections: z.array(CollectionSchema).default([]),
  forms: z.array(FormSchema).default([]),
  pages: z.array(PageSchema).min(1),
}
```

`Checked` 类型扩为：

```ts
type Checked = {
  collections: z.infer<typeof CollectionSchema>[]
  forms: z.infer<typeof FormSchema>[]
  pages: z.infer<typeof PageSchema>[]
  assets: { id: string; aspectRatio: string; renderSize: { w: number; h: number } }[]
}
```

- [ ] **Step 3: 引用完整性检查加 4 条**

在 `checkReferentialIntegrity` 内、既有循环前后追加（spec §4.4 的三条 + 补全 #1 的 form.collection 检查；operations 检查顺带校验页内 op id 唯一——重复 id 会让 codegen 生成同名 const 而编译失败）：

```ts
  const seenCollectionIds = new Set<string>()
  for (const [index, collection] of spec.collections.entries()) {
    if (seenCollectionIds.has(collection.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['collections', index, 'id'],
        message: `duplicate collection id "${collection.id}"`,
      })
    }
    seenCollectionIds.add(collection.id)

    for (const [fieldIndex, field] of collection.fields.entries()) {
      if (!(field in collection.model)) {
        ctx.addIssue({
          code: 'custom',
          path: ['collections', index, 'fields', fieldIndex],
          message: `collection "${collection.id}" field "${field}" is not a model key`,
        })
      }
    }

    if (
      (collection.actions.includes('edit') || collection.actions.includes('delete')) &&
      !('id' in collection.model)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['collections', index, 'actions'],
        message: `collection "${collection.id}" actions include edit/delete but its model has no "id" key`,
      })
    }
  }

  for (const [index, form] of spec.forms.entries()) {
    if (form.collection !== undefined && !seenCollectionIds.has(form.collection)) {
      ctx.addIssue({
        code: 'custom',
        path: ['forms', index, 'collection'],
        message: `form "${form.id}" references unknown collection "${form.collection}"`,
      })
    }
  }

  const declaredRoutes = new Set(spec.pages.map((page) => page.route))
  for (const [pageIndex, page] of spec.pages.entries()) {
    const seenOpIds = new Set<string>()
    for (const [opIndex, operation] of page.operations.entries()) {
      if (seenOpIds.has(operation.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['pages', pageIndex, 'operations', opIndex, 'id'],
          message: `duplicate operation id "${operation.id}" on route "${page.route}"`,
        })
      }
      seenOpIds.add(operation.id)

      if (operation.target.startsWith('/')) {
        if (!declaredRoutes.has(operation.target)) {
          ctx.addIssue({
            code: 'custom',
            path: ['pages', pageIndex, 'operations', opIndex, 'target'],
            message: `operation target "${operation.target}" is not a declared route`,
          })
        }
      } else if (!seenCollectionIds.has(operation.target)) {
        ctx.addIssue({
          code: 'custom',
          path: ['pages', pageIndex, 'operations', opIndex, 'target'],
          message: `operation target "${operation.target}" is not a declared collection id`,
        })
      }
    }
  }
```

`packages/spec/src/index.ts` 增加两行：

```ts
export * from './collection.js'
export * from './form.js'
export * from './operation.js'
```

- [ ] **Step 4: 写失败测试**

`packages/spec/src/__tests__/data-model.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { finalizeSpec } from '../hash.js'
import { parseProjectSpecInput } from '../parse.js'
import { validSpecInput } from './fixture.js'

/** 一个合法的最小后台 spec（三页，含 collection/form/operations）。 */
function dataModelSpecInput() {
  const base = validSpecInput()
  return {
    ...base,
    theme: { ...base.theme, radius: 'sm', spacing: 'compact' },
    pages: [
      {
        route: '/orders',
        title: '订单管理',
        pageType: 'list-detail',
        blocks: [
          { component: 'DataTable', props: { collection: 'orders' }, assetBindings: {} },
          { component: 'StatsGrid', props: { heading: '概览' }, assetBindings: {} },
        ],
        operations: [
          { id: 'refresh-orders', label: '刷新', kind: 'refresh', target: 'orders' },
          { id: 'export-orders', label: '导出', kind: 'export', target: 'orders' },
        ],
      },
      {
        route: '/orders/new',
        title: '新建订单',
        pageType: 'form',
        blocks: [{ component: 'FormPanel', props: { form: 'order-form' }, assetBindings: {} }],
      },
      {
        route: '/settings',
        title: '设置',
        pageType: 'settings',
        blocks: [{ component: 'FormPanel', props: {}, assetBindings: {} }],
      },
    ],
    collections: [
      {
        id: 'orders',
        label: '订单',
        model: {
          id: { type: 'string', label: 'ID' },
          customer: { type: 'string', label: '客户' },
          amount: { type: 'number', label: '金额' },
          status: { type: 'enum', label: '状态', options: ['待处理', '已发货', '已完成'] },
          created: { type: 'date', label: '创建日期' },
          active: { type: 'boolean', label: '启用' },
        },
        fields: ['customer', 'amount', 'status', 'created', 'active'],
        seed: 4,
        actions: ['search', 'edit', 'delete', 'export'],
      },
    ],
    forms: [
      {
        id: 'order-form',
        label: '新建订单',
        collection: 'orders',
        fields: [
          { key: 'customer', label: '客户', type: 'string', required: true },
          { key: 'amount', label: '金额', type: 'number', validate: { min: 0, max: 999999 } },
          { key: 'status', label: '状态', type: 'enum' },
        ],
        submit: { label: '保存订单', toast: '订单已保存' },
      },
    ],
  }
}

describe('data model schemas', () => {
  it('accepts a spec with collections, forms and operations', () => {
    const result = parseProjectSpecInput(dataModelSpecInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.collections[0]!.seed).toBe(4)
    expect(result.value.collections[0]!.actions).toEqual(['search', 'edit', 'delete', 'export'])
    expect(result.value.pages[0]!.operations).toHaveLength(2)
    expect(result.value.forms[0]!.submit).toEqual({ label: '保存订单', toast: '订单已保存' })
  })

  it('defaults collections, forms and operations to empty for old specs (zero-break)', () => {
    const result = parseProjectSpecInput(validSpecInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.collections).toEqual([])
    expect(result.value.forms).toEqual([])
    expect(result.value.pages[0]!.operations).toEqual([])
  })

  it('finalizeSpec passes the new fields through (hash does not drop them)', () => {
    const parsed = parseProjectSpecInput(dataModelSpecInput())
    if (!parsed.ok) throw new Error(parsed.feedback)
    const spec = finalizeSpec(parsed.value)
    expect(spec.collections).toHaveLength(1)
    expect(spec.forms).toHaveLength(1)
    expect(spec.pages[0]!.operations).toHaveLength(2)
  })

  it('rejects a collection field that is not a model key', () => {
    const input = dataModelSpecInput()
    input.collections![0]!.fields = ['customer', 'ghost']
    const result = parseProjectSpecInput(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('collections[0].fields[1]')
    expect(result.feedback).toContain('not a model key')
  })

  it('rejects edit/delete actions without an id key in the model', () => {
    const input = dataModelSpecInput()
    const { id: _omitted, ...modelWithoutId } = input.collections![0]!.model
    input.collections![0]!.model = modelWithoutId
    const result = parseProjectSpecInput(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('collections[0].actions')
    expect(result.feedback).toContain('no "id" key')
  })

  it('rejects an operation target that is neither a route nor a collection', () => {
    const input = dataModelSpecInput()
    input.pages![0]!.operations[0]!.target = 'ghost-collection'
    const result = parseProjectSpecInput(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('not a declared collection id')
  })

  it('rejects an operation target that is a route no page declares', () => {
    const input = dataModelSpecInput()
    input.pages![0]!.operations[0]!.target = '/nope'
    const result = parseProjectSpecInput(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('not a declared route')
  })

  it('rejects duplicate operation ids on a page', () => {
    const input = dataModelSpecInput()
    input.pages![0]!.operations.push({ id: 'refresh-orders', label: '刷新', kind: 'refresh', target: 'orders' })
    const result = parseProjectSpecInput(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('duplicate operation id')
  })

  it('rejects a form that references an unknown collection', () => {
    const input = dataModelSpecInput()
    input.forms![0]!.collection = 'customers'
    const result = parseProjectSpecInput(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('unknown collection "customers"')
  })

  it('accepts an operation target that names a declared route', () => {
    const input = dataModelSpecInput()
    input.pages![0]!.operations[0]!.kind = 'route'
    input.pages![0]!.operations[0]!.target = '/orders/new'
    expect(parseProjectSpecInput(input).ok).toBe(true)
  })
})
```

- [ ] **Step 5: 跑测试确认失败**

Run: `cd packages/spec && npx vitest run src/__tests__/data-model.test.ts`
Expected: 编译失败（`../collection.js` 不存在 / `dataModelSpecInput` 用了尚未存在的挂载字段），或断言失败。

- [ ] **Step 6: 让测试通过（本任务已实现 schema + 挂载 + 检查）**

跑一遍上面 Step 1-3 的代码后：

Run: `cd packages/spec && npx vitest run src/__tests__/data-model.test.ts`
Expected: 10 例全绿。

Run: `cd packages/spec && npx vitest run`（全包回归：parse/hash/fixture 不受影响）
Expected: 既有测试全绿。

Run: `cd packages/spec && npx tsc --noEmit`（typecheck，spec 是 tsconfig.base 含 exactOptionalPropertyTypes）
Expected: 0 错误。

- [ ] **Step 7: 提交**

```bash
git add packages/spec/src/collection.ts packages/spec/src/form.ts packages/spec/src/operation.ts packages/spec/src/project-spec.ts packages/spec/src/page.ts packages/spec/src/index.ts packages/spec/src/__tests__/data-model.test.ts
git commit -m "feat(spec): add collections/forms/operations declarations with referential checks

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: codegen——renderCollections（mock.ts）+ renderStore（store.ts）

**Files:**
- Create: `packages/codegen/src/data.ts`
- Create: `packages/codegen/src/store.ts`
- Modify: `packages/codegen/src/index.ts`（导出两个新模块）
- Test: `packages/codegen/src/__tests__/data.test.ts`（新文件）
- Modify: `packages/codegen/src/__tests__/fixture.ts`（增 `dataModelSpec()`，本任务就建，Task 3/8 复用）

**Interfaces:**
- Consumes: `ProjectSpec`（含 `collections`/`forms`，Task 1）。
- Produces: `renderCollections(spec: ProjectSpec): string`、`renderStore(spec: ProjectSpec): string`；生成的 mock.ts 导出 `type Row` 与 `MOCK_ROWS: Record<string, Row[]>`；store.ts 导出 `CollectionStore` / `createCollectionStore` / `useCollectionRows(id)` / `downloadCsv(name, rows)` / `rowsToCsv(rows)`。Task 3 的 page.ts 与生成的页面 SFC 消费这些名字。

- [ ] **Step 1: 在 fixture 里加 `dataModelSpec()`（复用 Task 1 的构造，但按 codegen fixture 的惯例用 derivePageAssets 拿几何）**

`packages/codegen/src/__tests__/fixture.ts` 末尾追加：

```ts
/**
 * A back-office spec: collections/forms/operations plus the four app blocks,
 * derived through derivePageAssets like the platform will. Task 3/8 reuse it.
 */
export function dataModelSpec(): ProjectSpec {
  const ordersList: BlockSelection[] = [
    {
      component: 'DataTable',
      props: { heading: '订单列表', collection: 'orders' },
    },
    {
      component: 'StatsGrid',
      props: { heading: '概览', stats: [{ label: '今日订单', value: '128', delta: '+12%', chart: 'line', series: [3, 5, 4, 8, 6, 9, 7] }] },
    },
  ]
  const orderForm: BlockSelection[] = [
    { component: 'FormPanel', props: { heading: '新建订单', form: 'order-form' } },
    { component: 'EmptyStatePanel', props: { headline: '还没有订单', body: '点击「保存订单」创建第一笔订单。' } },
  ]
  const settings: BlockSelection[] = [
    { component: 'FormPanel', props: { heading: '系统设置' } },
    {
      component: 'StatusCard',
      props: { heading: '系统状态', items: [{ label: 'CPU', value: '42%', tone: 'good', chart: 'bar', series: [2, 4, 3, 6, 5] }] },
    },
  ]

  const ordersDerived = derivePageAssets('/orders', ordersList)
  const formDerived = derivePageAssets('/orders/new', orderForm)
  const settingsDerived = derivePageAssets('/settings', settings)

  const input = {
    meta: { name: 'Acme Console', description: 'A back-office management system for orders.', targetStack: 'vue3' },
    theme: {
      colorTokens: {
        primary: '#345b7a',
        secondary: '#5a7d9a',
        accent: '#d97706',
        background: '#f5f6f8',
        surface: '#ffffff',
        foreground: '#1f2937',
        muted: '#6b7280',
      },
      radius: 'sm',
      spacing: 'compact',
      fontPair: { heading: 'Inter', body: 'Inter' },
      mode: 'light',
    },
    styleBible,
    pages: [
      {
        route: '/orders',
        title: '订单管理',
        pageType: 'list-detail',
        blocks: ordersDerived.blocks,
        operations: [
          { id: 'refresh-orders', label: '刷新', kind: 'refresh', target: 'orders' },
          { id: 'export-orders', label: '导出', kind: 'export', target: 'orders' },
          { id: 'create-order', label: '新建', kind: 'route', target: '/orders/new' },
        ],
      },
      { route: '/orders/new', title: '新建订单', pageType: 'form', blocks: formDerived.blocks },
      { route: '/settings', title: '设置', pageType: 'settings', blocks: settingsDerived.blocks },
    ],
    collections: [
      {
        id: 'orders',
        label: '订单',
        model: {
          id: { type: 'string', label: 'ID' },
          customer: { type: 'string', label: '客户' },
          amount: { type: 'number', label: '金额' },
          status: { type: 'enum', label: '状态', options: ['待处理', '已发货', '已完成'] },
          created: { type: 'date', label: '创建日期' },
          active: { type: 'boolean', label: '启用' },
        },
        fields: ['customer', 'amount', 'status', 'created', 'active'],
        seed: 2,
        actions: ['search', 'edit', 'delete', 'export'],
      },
    ],
    forms: [
      {
        id: 'order-form',
        label: '新建订单',
        collection: 'orders',
        fields: [
          { key: 'customer', label: '客户', type: 'string', required: true, placeholder: '客户名称' },
          { key: 'amount', label: '金额', type: 'number', validate: { min: 0, max: 999999 } },
          { key: 'status', label: '状态', type: 'enum' },
        ],
        submit: { label: '保存订单', toast: '订单已保存' },
      },
    ],
    assets: mergeDerivedAssets([ordersDerived, formDerived, settingsDerived]),
  }

  return finalizeSpec(ProjectSpecInputSchema.parse(input))
}
```

`styleBible` 已在 fixture 顶部定义，`BlockSelection` 已导入——确认两个名字在作用域内即可（已存在）。

- [ ] **Step 2: 写失败测试**

`packages/codegen/src/__tests__/data.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { renderCollections } from '../data.js'
import { renderStore } from '../store.js'
import { dataModelSpec } from './fixture.js'

describe('renderCollections (src/data/mock.ts)', () => {
  const mock = renderCollections(dataModelSpec())

  it('exports MOCK_ROWS with one entry per collection', () => {
    expect(mock).toContain('export type Row = Record<string, unknown> & { id: string }')
    expect(mock).toContain('export const MOCK_ROWS: Record<string, Row[]> = {')
    expect(mock).toContain('"orders": [')
  })

  it('generates the requested number of rows, each with a deterministic id', () => {
    // seed: 2 → row-1, row-2（JSON.stringify 紧凑格式，键后无空格）
    expect(mock).toContain('"id":"row-1"')
    expect(mock).toContain('"id":"row-2"')
    expect(mock).not.toContain('"id":"row-3"')
  })

  it('generates field values deterministically by type', () => {
    // string: pool[row % 8]-{row+1}；number: 100 + (row+1)*17；
    // date: 2026-09-01 起偏移；enum: options[row % len]；boolean: (row+1) % 2 === 0
    expect(mock).toContain('"customer":"订单-1"')
    expect(mock).toContain('"customer":"客户-2"')
    expect(mock).toContain('"amount":117')
    expect(mock).toContain('"amount":134')
    expect(mock).toContain('"created":"2026-09-01"')
    expect(mock).toContain('"created":"2026-09-02"')
    expect(mock).toContain('"status":"待处理"')
    expect(mock).toContain('"status":"已发货"')
    expect(mock).toContain('"active":false')
    expect(mock).toContain('"active":true')
  })

  it('is deterministic: same spec in, identical bytes out', () => {
    expect(renderCollections(dataModelSpec())).toBe(renderCollections(dataModelSpec()))
  })

  it('emits an empty object for a spec without collections (zero-break)', () => {
    expect(renderCollections({ ...dataModelSpec(), collections: [] })).toContain(
      'export const MOCK_ROWS: Record<string, Row[]> = {\n}',
    )
  })})

describe('renderStore (src/data/store.ts)', () => {
  const store = renderStore(dataModelSpec())

  it('exports a per-collection store factory with the spec contract methods', () => {
    expect(store).toContain('export interface CollectionStore {')
    expect(store).toContain('search(query: string): Row[]')
    expect(store).toContain(`sort(field: string, dir: 'asc' | 'desc'): Row[]`)
    expect(store).toContain('page(pageSize: number, pageNum: number): Row[]')
    expect(store).toContain('add(row: Row): void')
    expect(store).toContain('remove(id: string): void')
  })

  it('implements update as an upsert for form-created rows', () => {
    expect(store).toContain('Upsert')
    expect(store).toContain('id: `row-${rows.length + 1}`')
  })

  it('exposes useCollectionRows and a pure CSV helper for export ops', () => {
    expect(store).toContain('export function useCollectionRows(id: string): CollectionStore')
    expect(store).toContain('export function rowsToCsv(rows: readonly Row[]): string')
    expect(store).toContain('export function downloadCsv(name: string, rows: readonly Row[]): void')
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd packages/codegen && npx vitest run src/__tests__/data.test.ts`
Expected: FAIL（`../data.js` / `../store.js` 不存在）。

- [ ] **Step 4: 实现 `renderCollections`**

`packages/codegen/src/data.ts`：

```ts
import type { Collection, ProjectSpec } from '@vudt/spec'

/** 确定性中文样例词库（string 字段按行号取模 + 序号）。 */
const WORD_POOL = ['订单', '客户', '商品', '员工', '项目', '工单', '渠道', '报表']

/**
 * Renders `src/data/mock.ts`: deterministic mock rows derived from the spec's
 * collections. Same spec in, byte-identical rows out — hashed, tested, and
 * never touching the network. Every row carries `id` so the store can edit it.
 */
export function renderCollections(spec: ProjectSpec): string {
  const entries = spec.collections.map((collection) => {
    const rows = Array.from({ length: collection.seed }, (_, rowIndex) =>
      buildRow(collection, rowIndex),
    )
    const body = rows.map((row) => `    ${JSON.stringify(row)},`).join('\n')
    return `  ${JSON.stringify(collection.id)}: [\n${body}\n  ]`
  })

  return [
    "// Deterministic mock data derived from the spec's collections.",
    '// Every row carries an id so the store can edit and delete it.',
    'export type Row = Record<string, unknown> & { id: string }',
    '',
    'export const MOCK_ROWS: Record<string, Row[]> = {',
    ...entries,
    '}',
    '',
  ].join('\n')
}

function buildRow(collection: Collection, rowIndex: number): Record<string, unknown> {
  const row: Record<string, unknown> = { id: `row-${rowIndex + 1}` }
  for (const field of collection.fields) {
    const model = collection.model[field]
    if (model === undefined) continue // 引用检查已拦，这里防御性跳过
    row[field] = mockValue(model.type, rowIndex, model.options)
  }
  return row
}

function mockValue(type: string, rowIndex: number, options?: readonly string[]): unknown {
  switch (type) {
    case 'string':
      return `${WORD_POOL[rowIndex % WORD_POOL.length]}-${rowIndex + 1}`
    case 'number':
      return 100 + (rowIndex + 1) * 17
    case 'date':
      return new Date(Date.UTC(2026, 8, 1 + rowIndex)).toISOString().slice(0, 10)
    case 'enum':
      return options?.[rowIndex % options.length] ?? ''
    case 'boolean':
      return (rowIndex + 1) % 2 === 0
    default:
      return ''
  }
}```

- [ ] **Step 5: 实现 `renderStore`**

`packages/codegen/src/store.ts`：

```ts
import type { ProjectSpec } from '@vudt/spec'

/**
 * Renders `src/data/store.ts`: an in-memory store factory. Each page calls
 * `useCollectionRows` once and holds its own store — refresh or navigation
 * re-instantiates, so data resets (no backend, no persistence, no timers).
 */
export function renderStore(_spec: ProjectSpec): string {
  return [
    '// In-memory store factory. Pages instantiate their own store per route;',
    '// refresh or navigation resets the data (no backend, no persistence).',
    "import { MOCK_ROWS, type Row } from './mock'",
    '',
    'export interface CollectionStore {',
    '  rows: Row[]',
    '  search(query: string): Row[]',
    "  sort(field: string, dir: 'asc' | 'desc'): Row[]",
    '  page(pageSize: number, pageNum: number): Row[]',
    '  getById(id: string): Row | undefined',
    '  add(row: Row): void',
    '  /** Upsert: replace by id, or append with a generated id when absent. */',
    '  update(row: Record<string, unknown> & { id?: string }): void',
    '  remove(id: string): void',
    '}',
    '',
    'export function createCollectionStore(initial: Row[]): CollectionStore {',
    '  const rows = [...initial]',
    '  return {',
    '    rows,',
    '    search(query: string): Row[] {',
    "      const term = query.trim().toLowerCase()",
    "      if (term === '') return rows",
    '      return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(term))',
    '    },',
    "    sort(field: string, dir: 'asc' | 'desc'): Row[] {",
    '      const factor = dir === \'asc\' ? 1 : -1',
    "      return [...rows].sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * factor)",
    '    },',
    '    page(pageSize: number, pageNum: number): Row[] {',
    '      const start = (pageNum - 1) * pageSize',
    '      return rows.slice(start, start + pageSize)',
    '    },',
    '    getById(id: string): Row | undefined {',
    '      return rows.find((row) => row.id === id)',
    '    },',
    '    add(row: Row): void {',
    '      rows.push(row)',
    '    },',
    '    update(row: Record<string, unknown> & { id?: string }): void {',
    '      const index = rows.findIndex((existing) => existing.id === row.id)',
    '      if (index >= 0) rows[index] = row as Row',
    '      else rows.push({ ...row, id: `row-${rows.length + 1}` } as Row)',
    '    },',
    '    remove(id: string): void {',
    '      const index = rows.findIndex((row) => row.id === id)',
    '      if (index >= 0) rows.splice(index, 1)',
    '    },',
    '  }',
    '}',
    '',
    'export function useCollectionRows(id: string): CollectionStore {',
    '  return createCollectionStore(MOCK_ROWS[id] ?? [])',
    '}',
    '',
    'export function rowsToCsv(rows: readonly Row[]): string {',
    "  if (rows.length === 0) return ''",
    '  const headers = Object.keys(rows[0]!)',
    "  const lines = [headers.join(',')]",
    '  for (const row of rows) {',
    "    lines.push(headers.map((header) => String(row[header] ?? '')).join(','))",
    '  }',
    "  return lines.join('\\n')",
    '}',
    '',
    'export function downloadCsv(name: string, rows: readonly Row[]): void {',
    "  const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' })",
    '  const url = URL.createObjectURL(blob)',
    '  const anchor = document.createElement(\'a\')',
    '  anchor.href = url',
    '  anchor.download = `${name}.csv`',
    '  anchor.click()',
    '  URL.revokeObjectURL(url)',
    '}',
    '',
  ].join('\n')
}
```

`packages/codegen/src/index.ts` 增加两行：

```ts
export * from './data.js'
export * from './store.js'
```

- [ ] **Step 6: 跑测试确认通过**

Run: `cd packages/codegen && npx vitest run src/__tests__/data.test.ts`
Expected: 9 例全绿。

Run: `cd packages/codegen && npx tsc --noEmit`
Expected: 0 错误。

- [ ] **Step 7: 提交**

```bash
git add packages/codegen/src/data.ts packages/codegen/src/store.ts packages/codegen/src/index.ts packages/codegen/src/__tests__/data.test.ts packages/codegen/src/__tests__/fixture.ts
git commit -m "feat(codegen): render deterministic mock data and an in-memory store

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: codegen——project.ts 输出 data 文件 + page.ts 块绑定与 ops 工具条

**Files:**
- Modify: `packages/codegen/src/project.ts`（有 collections 时输出 `src/data/mock.ts` + `src/data/store.ts`）
- Modify: `packages/codegen/src/page.ts`（绑定 + 工具条 + 注入 props 剥离 + script const + style 块）
- Test: `packages/codegen/src/__tests__/project.test.ts`（data 文件输出 + 零破坏断言）
- Test: `packages/codegen/src/__tests__/page.test.ts`（绑定/工具条断言）

**Interfaces:**
- Consumes: `renderCollections`/`renderStore`（Task 2）；`ProjectSpec`（含新字段，Task 1）。
- Produces: `renderPage(spec, page)` 的新输出约定（Task 4/5 的 SFC 按此接 prop）：DataTable 收到 `:data="data{Camel}"`、`:columns="columns{Camel}"`、`:searchable`/`:sortable`/`:pageable`/`:page-size`、`:row-actions`、`@save="save{Camel}"`、`@delete="delete{Camel}"`、`:search-text="search{Camel}"`；FormPanel 收到 `:fields="formFields{Camel}"`、`:submit-label`、`:on-save="onSave{Camel}"`。页面 script 从 `../data/store` 导入 `useCollectionRows`/`downloadCsv`，从 `vue` 导入 `ref`。

- [ ] **Step 1: 写失败测试（page.test.ts）**

`packages/codegen/src/__tests__/page.test.ts` 顶部 import 加 `dataModelSpec`，末尾追加一个 describe：

```ts
import { dataModelSpec } from './fixture.js'

describe('renderPage data-model bindings', () => {
  const spec = dataModelSpec()
  const orders = spec.pages.find((page) => page.route === '/orders')!
  const form = spec.pages.find((page) => page.route === '/orders/new')!

  it('binds a DataTable to its collection: store const, data ref, columns const', () => {
    const sfc = renderPage(spec, orders)
    expect(sfc).toContain(`const storeOrders = useCollectionRows('orders')`)
    expect(sfc).toContain(`const dataOrders = ref(storeOrders.rows)`)
    // renderColumns 返回单层 JSON 文本（`[{"key":...}]`），断言只包一层 stringify
    expect(sfc).toContain(`const columnsOrders = ${JSON.stringify([
      { key: 'id', label: 'ID' },
      { key: 'customer', label: '客户' },
      { key: 'amount', label: '金额' },
      { key: 'status', label: '状态' },
      { key: 'created', label: '创建日期' },
      { key: 'active', label: '启用' },
    ])}`)
    expect(sfc).toContain(`:data="dataOrders"`)
    expect(sfc).toContain(`:columns="columnsOrders"`)
  })

  it('maps collection actions onto table capabilities and row actions', () => {
    const sfc = renderPage(spec, orders)
    expect(sfc).toContain(`:searchable="true"`)
    expect(sfc).toContain(`:sortable="true"`)
    expect(sfc).toContain(`:pageable="true"`)
    expect(sfc).toContain(`:page-size="8"`)
    expect(sfc).toContain(`:row-actions="'edit,delete'"`)
  })

  it('strips the collection selector from the model props const', () => {
    const sfc = renderPage(spec, orders)
    expect(sfc).not.toContain('collection:')
    expect(sfc).toContain('"heading": "订单列表"')
  })

  it('binds row ops to page handlers that re-snapshot the table', () => {
    const sfc = renderPage(spec, orders)
    expect(sfc).toContain('@save="saveOrders"')
    expect(sfc).toContain('@delete="deleteOrders"')
    expect(sfc).toContain('const saveOrders = (row: Record<string, unknown>) => { storeOrders.update(row); dataOrders.value = [...storeOrders.rows] }')
    expect(sfc).toContain('const deleteOrders = (row: Record<string, unknown>) => { storeOrders.remove(String(row.id)); dataOrders.value = [...storeOrders.rows] }')
  })

  it('renders an ops toolbar above the blocks with one handler per operation', () => {
    const sfc = renderPage(spec, orders)
    expect(sfc).toContain('<div class="container ops" role="toolbar">')
    expect(sfc).toContain('@click="refreshOrders"')
    expect(sfc).toContain('@click="exportOrders"')
    // route 操作在模板里内联 $router.push，不在 script 里生成 const
    expect(sfc).toContain(`@click="$router.push('/orders/new')"`)
    expect(sfc).toContain('const refreshOrders = () => { dataOrders.value = [...storeOrders.rows] }')
    expect(sfc).toContain(`const exportOrders = () => { downloadCsv('订单', storeOrders.rows) }`)
    expect(sfc).toContain(`<style scoped>`)
    expect(sfc).toContain(`.ops {`)
  })

  it('binds a FormPanel to its form: fields const, submit label, on-save handler', () => {
    const sfc = renderPage(spec, form)
    // renderFormFields 返回单层 JSON 文本，断言只包一层 stringify
    expect(sfc).toContain(`const formFieldsOrderForm = ${JSON.stringify([
      { key: 'customer', label: '客户', type: 'string', required: true, placeholder: '客户名称' },
      { key: 'amount', label: '金额', type: 'number', validate: { min: 0, max: 999999 } },
      { key: 'status', label: '状态', type: 'enum', options: ['待处理', '已发货', '已完成'] },
    ])}`)
    expect(sfc).toContain(`:fields="formFieldsOrderForm"`)
    expect(sfc).toContain(`:submit-label="'保存订单'"`)
    expect(sfc).toContain(`:on-save="onSaveOrderForm"`)
    // /orders/new 页没有 DataTable，refreshes 为空——onSave 只写 store，不带表格刷新
    expect(sfc).toContain(`const onSaveOrderForm = (row: Record<string, unknown>) => { storeOrders.update(row) }`)
    // form 选择器与 onSave 都不出现在模型 props const 里（codegen 注入/剥离）
    expect(sfc).not.toContain('"form":')
    expect(sfc).not.toContain('"collection":')
  })

  it('keeps a static FormPanel (no form) on the old code path', () => {
    const settings = spec.pages.find((page) => page.route === '/settings')!
    const sfc = renderPage(spec, settings)
    expect(sfc).not.toContain('formFields')
    expect(sfc).not.toContain('useCollectionRows')
    // 无 form 绑定的 FormPanel 走旧路径：props 直接 v-bind，没有 :fields 注入
    expect(sfc).toContain('v-bind="props0"')
    expect(sfc).not.toContain('<div class="container ops"')
  })
})
```

> settings 页 FormPanel 是第 0 个块（page 内唯一块），props const 名是 `props0`。若实现后序号不同，以实际输出为准调整断言（既有 `propsN` 命名沿用 blockIndex）。settings 页的 DataTable 绑定只在页面引用了 collection 的块上发生——settings 页的 FormPanel（无 `form`）与 StatusCard 都不触发，所以断言全负。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/codegen && npx vitest run src/__tests__/page.test.ts`
Expected: 新增 describe 失败（尚无绑定逻辑）。

- [ ] **Step 3: 写失败测试（project.test.ts）**

`packages/codegen/src/__tests__/project.test.ts` 加 import `dataModelSpec`，加两条：

```ts
  it('emits data files only when the spec declares collections (zero-break)', () => {
    const withData = generateProject(dataModelSpec())
    expect(Object.keys(withData.files)).toContain('src/data/mock.ts')
    expect(Object.keys(withData.files)).toContain('src/data/store.ts')

    const withoutData = generateProject(landingSpec())
    expect(Object.keys(withoutData.files)).not.toContain('src/data/mock.ts')
    expect(Object.keys(withoutData.files)).not.toContain('src/data/store.ts')
  })
```

- [ ] **Step 4: 跑测试确认失败**

Run: `cd packages/codegen && npx vitest run src/__tests__/project.test.ts`
Expected: 新用例失败。

- [ ] **Step 5: 实现 project.ts 条件输出**

`packages/codegen/src/project.ts` 顶部 import 加 `renderCollections`/`renderStore`，`generateProject` 内加：

```ts
  if (spec.collections.length > 0) {
    files['src/data/mock.ts'] = renderCollections(spec)
    files['src/data/store.ts'] = renderStore(spec)
  }
```

- [ ] **Step 6: 实现 page.ts 块绑定 + ops 工具条**

`packages/codegen/src/page.ts` 顶部加 import：

```ts
import type { Collection, Page, ProjectSpec } from '@vudt/spec'
```

`renderPage` 重构为：先收集本页引用的集合与表单（helper 函数），再走既有循环；`propsN` const 的 propEntries 过滤注入键；末尾追加 ops 工具条与 style 块。核心新增逻辑：

```ts
/** kebab-case id → camelCase 标识符（const 名用）。 */
function camelOf(id: string): string {
  return id
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('')
    .replace(/^./, (c) => c.toLowerCase())
}

/** 从 spec 找集合/表单（按 id）。 */
function collectionById(spec: ProjectSpec, id: string): Collection | undefined {
  return spec.collections.find((collection) => collection.id === id)
}
function formById(spec: ProjectSpec, id: string): ProjectSpec['forms'][number] | undefined {
  return spec.forms.find((form) => form.id === id)
}

/** codegen 拥有、不得出现在模型 props const 里的键。 */
const INJECTED_PROPS = new Set([
  'collection', 'form', 'onSave', 'data', 'columns', 'searchable', 'sortable',
  'pageable', 'pageSize', 'rowActions', 'searchText',
])
```

- [ ] **Step 6b: 块绑定与页面级 script const**

`renderPage` 主体（替换原 for 循环里的 props const 部分；**原循环里 `const name = \`props${blockIndex}\`` 改名 `propsName` 以免与页面级 `data${name}` 等 const 的 `name` 变量冲突**）：

> 原 `renderPage` 的**两块既有行为必须原样保留**：① 循环顶部对 layoutOnly 组件的抛错（`getBlockDefinition(block.component)?.layoutOnly === true` → `CodegenError`，NavBarSimple/FooterSimple 会命中）；② 循环末尾的 `assertCtaTargets(page.route, page.blocks, routes)` 跨页 CTA 校验。新逻辑只插在两者之间。`renderBlockAssets`/`assetsById`/`literal`/`renderTag` 全部保持不动——`propsN` const 改名只影响 `consts.push` 处，模板组装仍用 `attrs`。

```ts
    const propEntries = Object.entries(block.props).filter(
      ([key, value]) => value !== undefined && !INJECTED_PROPS.has(key),
    )
    if (propEntries.length > 0) {
      const propsName = `props${blockIndex}`
      const body = propEntries
        .map(([key, value]) => `  ${JSON.stringify(key)}: ${literal(value)},`)
        .join('\n')
      consts.push(`const ${propsName} = {\n${body}\n}`)
      attrs.push(`v-bind="${propsName}"`)
    }
```

块绑定注入（在既有 assets 处理之后追加）：

```ts
    if (block.component === 'DataTable') {
      const collectionId = typeof block.props.collection === 'string' ? block.props.collection : undefined
      const collection = collectionId === undefined ? undefined : collectionById(spec, collectionId)
      if (collection !== undefined) {
        const name = camelOf(collection.id)
        pageCollections.add(collection.id)
        pageCollectionTableIds.add(collection.id)
        attrs.push(`:data="data${name}"`)
        attrs.push(`:columns="columns${name}"`)
        const actions = new Set(collection.actions)
        // searchable/sortable/pageable 三合一：声明 search 的集合就是「可操作数据表」
        attrs.push(`:searchable="${actions.has('search')}"`)
        attrs.push(`:sortable="${actions.has('search')}"`)
        attrs.push(`:pageable="${actions.has('search')}"`)
        attrs.push(`:page-size="8"`)
        const rowActions = ['edit', 'delete'].filter((kind) => actions.has(kind)).join(',')
        if (rowActions !== '') attrs.push(`:row-actions="'${rowActions}'"`)
        if (pageFilterTargets.has(collection.id)) {
          attrs.push(`:search-text="search${name}"`)
        }
        if (actions.has('edit')) attrs.push(`@save="save${name}"`)
        if (actions.has('delete')) attrs.push(`@delete="delete${name}"`)
      }
    }

    if (block.component === 'FormPanel') {
      const formId = typeof block.props.form === 'string' ? block.props.form : undefined
      const form = formId === undefined ? undefined : formById(spec, formId)
      if (form !== undefined) {
        const formName = camelOf(form.id)
        pageForms.add(form.id)
        attrs.push(`:fields="formFields${formName}"`)
        attrs.push(`:submit-label="${JSON.stringify(form.submit.label)}"`)
        attrs.push(`:on-save="onSave${formName}"`)
      }
    }
```

> FormPanel 绑定细节：`form.collection` 是可选字段。`onSave${formName}` 的生成规则见下方 script const 段——有 collection 且能解析到集合时写 store（同页有该集合的 DataTable 时再带刷新），否则生成 `void row` 空操作（只 toast，不写回）。

页面级 script const（循环结束后、`scriptLines` 组装前）：

```ts
  const scriptLines: string[] = []
  const usedCollections = [...pageCollections].sort()
  const usedForms = [...pageForms].sort()

  // `ref` 只在有集合绑定或有 ops 时需要；`useCollectionRows` 只要有集合就需要；
  // `downloadCsv` 只在本页有真 export handler 时导入（避免未使用 import 的
  // verbatimModuleSyntax 编译警告）。
  if (usedCollections.length > 0 || pageOps.length > 0) scriptLines.push(`import { ref } from 'vue'`)
  const storeImports: string[] = []
  if (usedCollections.length > 0) storeImports.push('useCollectionRows')
  if (pageOps.some((op) => op.kind === 'export' && pageCollections.has(op.target))) {
    storeImports.push('downloadCsv')
  }
  if (storeImports.length > 0) {
    scriptLines.push(`import { ${storeImports.join(', ')} } from '../data/store'`)
  }
  // 保留既有行为：页面上任一块有 slot 时，assetsN const 需要 SlotAssets 类型。
  if (needsSlotAssets) scriptLines.push(`import type { SlotAssets } from '../asset'`)
  scriptLines.push(imports)
  if (consts.length > 0) scriptLines.push('')

  for (const id of usedCollections) {
    const name = camelOf(id)
    scriptLines.push(`const store${name} = useCollectionRows('${id}')`)
    if (pageCollectionTableIds.has(id)) {
      scriptLines.push(`const data${name} = ref(store${name}.rows)`)
      scriptLines.push(`const columns${name} = ${renderColumns(collectionById(spec, id)!)}`)
    }
    const actions = new Set(collectionById(spec, id)!.actions)
    if (actions.has('edit')) {
      scriptLines.push(`const save${name} = (row: Record<string, unknown>) => { store${name}.update(row); data${name}.value = [...store${name}.rows] }`)
    }
    if (actions.has('delete')) {
      scriptLines.push(`const delete${name} = (row: Record<string, unknown>) => { store${name}.remove(String(row.id)); data${name}.value = [...store${name}.rows] }`)
    }
    if (pageFilterTargets.has(id)) {
      scriptLines.push(`const search${name} = ref('')`)
    }
    // filter 的 script const 只在绑定 DataTable 时才用到（:search-text 注入），
    // 但 filter 可以挂在没有 DataTable 的页上——此时 ref 存在却无人读，无害。
  }

  for (const id of usedForms) {
    const form = formById(spec, id)!
    const name = camelOf(id)
    scriptLines.push(`const formFields${name} = ${renderFormFields(form)}`)
    if (form.collection !== undefined && collectionById(spec, form.collection) !== undefined) {
      const storeName = camelOf(form.collection)
      const refreshes = pageCollectionTableIds.has(form.collection)
        ? `; data${storeName}.value = [...store${storeName}.rows]`
        : ''
      scriptLines.push(`const onSave${name} = (row: Record<string, unknown>) => { store${storeName}.update(row)${refreshes} }`)
    } else {
      // 无 collection 或集合解析失败：只 toast 不写回（FormPanel 内已 toast）
      scriptLines.push(`const onSave${name} = (row: Record<string, unknown>) => { void row }`)
    }
  }

  for (const op of pageOps) {
    const name = camelOf(op.id)
    // 集合型操作只在「该集合本页有引用」时生成真 handler（store/data const 只在
    // usedCollections 循环里声明）。目标未在本页引用的操作生成无害空操作兜底——
    // 工具条模板对每个非 route 操作都引用 `@click="${camelOf(op.id)}"`，const 必须
    // 存在，否则生成的 SFC 引用未声明变量，vue-tsc 编译失败。
    if (op.kind === 'refresh' && pageCollections.has(op.target) && pageCollectionTableIds.has(op.target)) {
      const storeName = camelOf(op.target)
      scriptLines.push(`const ${name} = () => { data${storeName}.value = [...store${storeName}.rows] }`)
    } else if (op.kind === 'export' && pageCollections.has(op.target)) {
      const storeName = camelOf(op.target)
      scriptLines.push(`const ${name} = () => { downloadCsv(${JSON.stringify(collectionById(spec, op.target)!.label)}, store${storeName}.rows) }`)
    } else if (op.kind === 'filter' && pageCollections.has(op.target)) {
      const storeName = camelOf(op.target)
      scriptLines.push(`const ${name} = () => { search${storeName}.value = ${JSON.stringify(op.param ?? '')} }`)
    } else if (op.kind !== 'route') {
      // 目标未在本页引用（跨页操作）或非法 target 的兜底：无害空操作。
      scriptLines.push(`const ${name} = () => { void 0 }`)
    }
    // route 操作不在此生成 const——工具条模板里已内联 `@click="$router.push(...)"`。
  }
  // refresh/export/filter 的 ops handler 都引用 pageCollections 里的 store；route
  // 操作永远不生成 const，模板内联处理。所有 ops const 只存在于本函数内联的
  // scriptLines，约束见上方注意段落。

  scriptLines.push(...consts)
```

注意：五个收集器都是 `renderPage` 内声明的局部变量（在循环前初始化）：`const pageOps = page.operations`；`const pageCollections = new Set<string>()`；`const pageForms = new Set<string>()`；`const pageCollectionTableIds = new Set<string>()`（循环里绑定 DataTable 时 `add(collection.id)`）；`const pageFilterTargets = new Set(page.operations.filter((op) => op.kind === 'filter' && op.target.startsWith('/') === false).map((op) => op.target))`。`renderColumns` 是模块级纯函数（只吃 `collection`，实现见下）；`renderFormFields` 需要 `spec` 闭包，是 `renderPage` 内的局部函数（实现见下）。`pageOps` 里 route 类操作也会进 `usages` 工具条渲染，但**不**进 script const 循环（见上方 ops 循环的注释）。

```ts
/** 从集合 model 生成列定义（id 列恒在首位）。 */
function renderColumns(collection: Collection): string {
  const columns = [
    { key: 'id', label: 'ID' },
    ...collection.fields
      .filter((field) => collection.model[field] !== undefined)
      .map((field) => ({ key: field, label: collection.model[field]!.label })),
  ]
  return JSON.stringify(columns)
}

// renderPage 内部（闭包可见 spec）：
function renderFormFields(form: ProjectSpec['forms'][number]): string {
  const linked = form.collection === undefined ? undefined : collectionById(spec, form.collection)
  return JSON.stringify(
    form.fields.map((field) => {
      const emitted: Record<string, unknown> = {
        key: field.key,
        label: field.label,
        type: field.type,
      }
      if (field.required) emitted.required = true
      if (field.placeholder !== undefined) emitted.placeholder = field.placeholder
      if (Object.keys(field.validate).length > 0) emitted.validate = field.validate
      // enum 的 options 从关联集合的 model 取，不写在 form 里（表单 schema 没有
      // options 字段）；无关联集合时缺省由 FormPanel 渲染文本输入。
      if (field.type === 'enum' && linked !== undefined) {
        const options = linked.model[field.key]?.options
        if (options !== undefined) emitted.options = options
      }
      return emitted
    }),
  )
}
```

ops 工具条模板与 style（`usages` 组装前）：

```ts
  if (pageOps.length > 0) {
    const buttons = pageOps
      .map((op) => {
        const click =
          op.kind === 'route' && op.target.startsWith('/')
            ? `@click="$router.push(${JSON.stringify(op.target)})"`
            : `@click="${camelOf(op.id)}"`
        return `    <button class="button button--ghost ops__button" ${click}>${op.label}</button>`
      })
      .join('\n')
    usages.unshift(`  <div class="container ops" role="toolbar">\n${buttons}\n  </div>`)
  }
```

style 块（仅当有 ops 时追加）：

```ts
  const styleBlock =
    pageOps.length > 0
      ? `\n\n<style scoped>\n.ops {\n  display: flex;\n  flex-wrap: wrap;\n  gap: calc(var(--space-unit) * 0.75);\n  padding: calc(var(--space-unit) * 1.5) 0 0;\n}\n.ops__button {\n  padding: 0.4em 0.9em;\n  font-size: 0.85rem;\n}\n</style>\n`
      : ''

  return (
    `<script setup lang="ts">\n` +
    `${scriptLines.join('\n')}\n` +
    `</script>\n\n` +
    `<template>\n` +
    `${usages.join('\n')}\n` +
    `</template>` +
    styleBlock
  )
```

> `styleBlock` 拼在 `</template>` 之后、`<style scoped>` 是 SFC 最后一块；`scriptLines` 已在前面组装好（页面级 script const + 既有 consts）。既有返回语句同样被 `styleBlock` 替换（无 ops 时为空串，输出与今天完全一致）。

- [ ] **Step 7: 跑测试确认通过**

Run: `cd packages/codegen && npx vitest run src/__tests__/page.test.ts src/__tests__/project.test.ts`
Expected: 全绿（含既有用例——旧路径无 collections/forms/operations 时注入零发生）。

Run: `cd packages/codegen && npx tsc --noEmit`
Expected: 0 错误（注意 page.ts 在 tsconfig.base 的 exactOptionalPropertyTypes 下：`emitted.required = true` 等是对象赋值，无可选属性问题；`attrs`/`consts` 只用 `push`）。若既有 page.test 因 `renderPage` 返回语句被 `styleBlock` 替换（无 ops 时为空串）而输出差异——不影响断言（既有断言不检查文件结尾），确认不 regress 即可。

- [ ] **Step 8: 提交**

```bash
git add packages/codegen/src/project.ts packages/codegen/src/page.ts packages/codegen/src/__tests__/project.test.ts packages/codegen/src/__tests__/page.test.ts
git commit -m "feat(codegen): emit data files and bind tables/forms/ops on data-model specs

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: blocks——DataTable.vue 交互升级（搜索/排序/分页/行操作）

**Files:**
- Modify: `packages/templates/blocks/src/blocks/data-table.slots.ts`
- Modify: `packages/templates/vue3-base/src/blocks/DataTable.vue`
- Test: `packages/templates/blocks/src/__tests__/derive.test.ts`（DataTable slotless 断言补 `collection` 透传）

**Interfaces:**
- Consumes: Task 3 的绑定约定（`:data="dataX"`、`:columns="columnsX"`、`:searchable` 等、`@save`/`@delete`、`:search-text`）。
- Produces: DataTable 接受新 props；emit `save(row)`/`delete(row)`（`DataRow` 载荷）。

- [ ] **Step 1: 更新侧车 props（sfc-props 测试会立刻红）**

`packages/templates/blocks/src/blocks/data-table.slots.ts`：

```ts
import type { BlockDefinition } from '../slot.js'

/**
 * Data table for list-detail pages. Static usage (columns/rows) still works;
 * a bound collection switches it to live data with search/sort/paging and,
 * when actions allow, row-level edit/delete emitting save/delete.
 */
export const DataTable: BlockDefinition = {
  component: 'DataTable',
  pageTypes: ['list-detail', 'dashboard'],
  props: {
    heading: 'string',
    subheading: 'string',
    columns: '{ key, label, kind? }[]',
    rows: '{ cells: string[] }[]',
    // Codegen-consumed selector; stripped from the emitted props const.
    collection: 'string',
    // Bound by codegen from the collection (search/sort/page/row ops).
    data: '{ id?: string, [key: string]: unknown }[]',
    searchable: 'boolean',
    sortable: 'boolean',
    pageable: 'boolean',
    pageSize: 'number',
    rowActions: 'string',
    searchText: 'string',
  },
  slots: [],
}
```

- [ ] **Step 2: 跑 sfc-props 确认红**

Run: `cd packages/templates/blocks && npx vitest run src/__tests__/sfc-props.test.ts`
Expected: `DataTable declares exactly the props its SFC accepts` 失败（SFC 还没加）。

- [ ] **Step 3: 重写 DataTable.vue script**

保留全部既有渲染（旧 `rows`/`cells` 路径原样，仅加 `props.` 前缀），新增数据路径与交互状态。script 部分替换为：

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface Column {
  key: string
  label: string
  kind?: string
}

interface LegacyRow {
  cells: string[]
}

interface DataRow {
  id?: string
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    columns?: Column[]
    rows?: LegacyRow[]
    collection?: string
    data?: DataRow[]
    searchable?: boolean
    sortable?: boolean
    pageable?: boolean
    pageSize?: number
    rowActions?: string
    searchText?: string
  }>(),
  {
    heading: '',
    subheading: '',
    columns: () => [],
    rows: () => [],
    collection: '',
    data: () => [],
    searchable: false,
    sortable: false,
    pageable: false,
    pageSize: 8,
    rowActions: '',
    searchText: '',
  },
)

const emit = defineEmits<{
  save: [row: DataRow]
  delete: [row: DataRow]
}>()

// Live-data path: search / sort / page are component-local state.
const dataMode = computed(() => props.data.length > 0)const query = ref(props.searchText)
const sortField = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
watch(() => props.searchText, (value) => { query.value = value ?? '' })const sorted = computed(() => {
  let rows = [...props.data]
  const term = query.value.trim().toLowerCase()
  if (term !== '') {
    rows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(term))
  }
  if (sortField.value !== '') {
    const field = sortField.value
    const factor = sortDir.value === 'asc' ? 1 : -1
    const sortedCopy = [...rows].sort((a, b) =>
      String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * factor,
    )
    rows = sortedCopy
  }
  return rows
})
const pageCount = computed(() => Math.max(1, Math.ceil(sorted.value.length / props.pageSize)))
const paged = computed(() => {
  const start = (page.value - 1) * props.pageSize
  return sorted.value.slice(start, start + props.pageSize)
})
const rowActions = computed(() =>
  props.rowActions.split(',').map((kind) => kind.trim()).filter((kind) => kind !== ''),
)
function toggleSort(key: string): void {
  if (sortField.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortField.value = key
    sortDir.value = 'asc'
  }
}
function cellOf(row: DataRow, column: Column): string {
  return String(row[column.key] ?? '')
}
</script>
```

> 注意：`row[field]` 索引 DataRow 时类型为 `unknown`——`String(a[field] ?? '')` 已处理。`sortDir` 声明为 `ref<'asc' | 'desc'>('asc')` 是局部 ref 字面量类型，不是 prop，不违反「SFC props 禁用 union」（该约束只约束 props）。

- [ ] **Step 4: 重写 DataTable.vue template（旧路径原样 + `props.` 前缀；数据路径新块）**

```vue
<template>
  <section class="section table">
    <div class="container">
      <header v-if="props.heading || props.subheading" class="table__head">
        <h2 v-if="props.heading" class="table__title">{{ props.heading }}</h2>
        <p v-if="props.subheading" class="table__sub">{{ props.subheading }}</p>
      </header>

      <template v-if="dataMode">
        <div class="table__toolbar">
          <input
            v-if="props.searchable"
            v-model="query"
            class="table__search"
            type="search"
            placeholder="搜索…"
          />
        </div>
        <div v-if="props.columns.length > 0" class="table__wrap">
          <table class="table__grid">
            <thead>
              <tr>
                <th
                  v-for="column in props.columns"
                  :key="column.key"
                  scope="col"
                  class="table__th"
                  :class="{ 'table__th--sortable': props.sortable }"
                  :aria-sort="sortField === column.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined"
                  @click="props.sortable && toggleSort(column.key)"
                >
                  {{ column.label }}
                </th>
                <th v-if="rowActions.length > 0" scope="col" class="table__th">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in paged" :key="row.id ?? JSON.stringify(row)" class="table__row">
                <td v-for="column in props.columns" :key="column.key" class="table__td">
                  {{ cellOf(row, column) }}
                </td>
                <td v-if="rowActions.length > 0" class="table__td table__actions">
                  <button
                    v-if="rowActions.includes('edit')"
                    class="table__action"
                    @click="emit('save', row)"
                  >编辑</button>
                  <button
                    v-if="rowActions.includes('delete')"
                    class="table__action table__action--danger"
                    @click="emit('delete', row)"
                  >删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="props.pageable" class="table__pager">
          <button
            class="button button--ghost table__page"
            :disabled="page <= 1"
            @click="page -= 1"
          >上一页</button>
          <span class="table__pageinfo">{{ page }} / {{ pageCount }}</span>
          <button
            class="button button--ghost table__page"
            :disabled="page >= pageCount"
            @click="page += 1"
          >下一页</button>
        </div>
      </template>

      <div v-else-if="props.columns.length > 0" class="table__wrap">
        <table class="table__grid">
          <thead>
            <tr>
              <th v-for="column in props.columns" :key="column.key" scope="col" class="table__th">
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in props.rows" :key="i" class="table__row">
              <td v-for="(column, j) in props.columns" :key="j" class="table__td">
                <template v-if="column.kind === 'badge'">
                  <span class="table__badge">{{ row.cells[j] ?? '' }}</span>
                </template>
                <template v-else-if="column.kind === 'status'">
                  <span class="table__status">{{ row.cells[j] ?? '' }}</span>
                </template>
                <template v-else-if="column.kind === 'link'">
                  <span class="table__link">{{ row.cells[j] ?? '' }}</span>
                </template>
                <template v-else>
                  {{ row.cells[j] ?? '' }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
```

style 块末尾追加（tokens only，全部走 `var(--color-*)`）：

```css
.table__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: calc(var(--space-unit) * 0.75);
}

.table__search {
  padding: 0.45em 0.9em;
  border: 1px solid color-mix(in srgb, var(--color-muted) 40%, transparent);
  border-radius: var(--radius);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit;
  font-size: 0.85rem;
  width: 16rem;
}

.table__th--sortable {
  cursor: pointer;
  user-select: none;
}

.table__actions {
  white-space: nowrap;
}

.table__action {
  background: none;
  border: 0;
  padding: 0;
  margin-right: 0.75rem;
  color: var(--color-primary);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.table__action--danger {
  color: color-mix(in srgb, var(--color-foreground) 70%, red);
}

.table__pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: calc(var(--space-unit) * 0.75);
  padding: calc(var(--space-unit) * 0.75) 0;
}

.table__page {
  padding: 0.35em 0.9em;
  font-size: 0.85rem;
}

.table__pageinfo {
  color: var(--color-muted);
  font-size: 0.85rem;
}
```

- [ ] **Step 5: 更新 derive.test 的 DataTable/FormPanel slotless 断言（补透传）**

> 透传机制说明（为什么这里只补两个断言）：`derivePageAssets` 对 props 是「原样拷回」——模型写的 `props`（含 `collection`/`form` 选择器）逐字节进 `blocks[].props`，不校验、不剥离；codegen（Task 3 的 INJECTED_PROPS）才做剥离。Task 4/5 只需在既有「derives no assets」断言里把新选择器加进 props 并同步 `toEqual` 即可。

`packages/templates/blocks/src/__tests__/derive.test.ts` 的 DataTable 用例（第 143-152 行附近）props 加 `collection` 并同步断言：

```ts
  it('derives no assets for the slotless DataTable', () => {
    const { blocks, assets } = derivePageAssets('/', [
      {
        component: 'DataTable',
        props: {
          columns: [{ key: 'name', label: 'Name' }],
          rows: [{ cells: ['Acme'] }],
          collection: 'orders',
        },
      },
    ])
    expect(assets).toHaveLength(0)
    expect(blocks[0]!.props).toEqual({
      columns: [{ key: 'name', label: 'Name' }],
      rows: [{ cells: ['Acme'] }],
      collection: 'orders',
    })
  })
```

Task 5 同一文件里的 FormPanel 用例（第 154-163 行附近）同步改（新 props 里 `onSave` 是函数值，作为 draft 输入时跳过——sidecar 只是文档，draft 时模型不写它；此处断言只测 `form` 透传）：

```ts
  it('derives no assets for the slotless FormPanel', () => {
    const { blocks, assets } = derivePageAssets('/', [
      {
        component: 'FormPanel',
        props: {
          fields: [{ key: 'name', label: 'Name', type: 'string' }],
          submitLabel: 'Save',
          form: 'order-form',
        },
      },
    ])
    expect(assets).toHaveLength(0)
    expect(blocks[0]!.props).toEqual({
      fields: [{ key: 'name', label: 'Name', type: 'string' }],
      submitLabel: 'Save',
      form: 'order-form',
    })
  })
```

> 既有「derives no assets」断言里的 `fields: [{ label: 'Name', type: 'text' }]` 旧形状（无 `key`）透传照样通过——透传是逐字节拷回，不校验 props 形状。Task 5 Step 1 的侧车 `fields` 文档升为 `'{ key, label, type, required?, placeholder?, validate?, options? }[]'` 不影响透传断言。这里不更新旧形状也是可以的；想顺带升到新形状（加 `key`）同样通过。若因其他原因改了旧断言，记得 `toEqual` 一并更新。

- [ ] **Step 6: 跑测试确认通过**

Run: `cd packages/templates/blocks && npx vitest run`（sfc-props + derive + draft + registry 全包）
Expected: 全绿（stats-grid 等侧车未动，仍与旧 SFC 对齐）。

- [ ] **Step 7: 提交**

```bash
git add packages/templates/blocks/src/blocks/data-table.slots.ts packages/templates/vue3-base/src/blocks/DataTable.vue packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): make DataTable searchable, sortable, pageable with row ops

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: blocks——FormPanel.vue 交互升级（校验/提交 toast）

**Files:**
- Modify: `packages/templates/blocks/src/blocks/form-panel.slots.ts`
- Modify: `packages/templates/vue3-base/src/blocks/FormPanel.vue`
- Test: `packages/templates/blocks/src/__tests__/derive.test.ts`（FormPanel slotless 断言补 `form`/`onSave` 透传）

**Interfaces:**
- Consumes: Task 3 的绑定约定（`:fields="formFieldsX"`、`:submit-label`、`:on-save="onSaveX"`）。
- Produces: FormPanel 校验 `required`/`min`/`max`/`pattern:email`，通过后调用 `props.onSave(row)` 并显示本地 toast。

- [ ] **Step 1: 更新侧车 props**

`packages/templates/blocks/src/blocks/form-panel.slots.ts`：

```ts
import type { BlockDefinition } from '../slot.js'

/**
 * Sectioned settings form: labelled inputs and one submit. Static usage still
 * renders the fields; a bound form adds per-field validation and a submit
 * toast, calling the codegen-injected onSave handler.
 */
export const FormPanel: BlockDefinition = {
  component: 'FormPanel',
  pageTypes: ['settings', 'form'],
  props: {
    heading: 'string',
    subheading: 'string',
    fields: '{ key, label, type, required?, placeholder?, validate?, options? }[]',
    submitLabel: 'string',
    // Codegen-consumed selector; stripped from the emitted props const.
    form: 'string',
    // Injected by codegen; the model never writes it.
    onSave: '(row: Record<string, unknown>) => void',
  },
  slots: [],
}
```

- [ ] **Step 2: 跑 sfc-props 确认红**

Run: `cd packages/templates/blocks && npx vitest run src/__tests__/sfc-props.test.ts`
Expected: FormPanel 用例失败。

- [ ] **Step 3: 重写 FormPanel.vue script**

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'

interface FormField {
  key: string
  label: string
  type: string
  required?: boolean
  placeholder?: string
  validate?: { min?: number; max?: number; pattern?: string }
  options?: string[]
}

const props = withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    fields?: FormField[]
    submitLabel?: string
    form?: string
    onSave?: (row: Record<string, unknown>) => void
  }>(),
  {
    heading: '',
    subheading: '',
    fields: () => [],
    submitLabel: '',
    form: '',
    onSave: undefined,
  },
)

// Form state lives per component instance: navigation or refresh resets it.
const model = reactive<Record<string, unknown>>({})
const errors = reactive<Record<string, string>>({})
const toast = ref('')

function errorOf(field: FormField): string {
  const value = model[field.key]
  if (field.required && (value === undefined || value === null || String(value).trim() === '')) {
    return '此项必填'
  }
  const validate = field.validate
  if (validate === undefined) return ''
  if (field.type === 'number' && value !== undefined && value !== '') {
    const num = Number(value)
    if (validate.min !== undefined && num < validate.min) return `不能小于 ${validate.min}`
    if (validate.max !== undefined && num > validate.max) return `不能大于 ${validate.max}`
  }
  if (validate.pattern === 'email' && value !== undefined && value !== '') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) return '邮箱格式不正确'
  }
  return ''
}

function validate(): boolean {
  let valid = true
  for (const field of props.fields) {
    const message = errorOf(field)
    if (message !== '') {
      errors[field.key] = message
      valid = false
    }
  }
  return valid
}

function submit(): void {
  if (!validate()) return
  const row: Record<string, unknown> = {}
  for (const field of props.fields) row[field.key] = model[field.key]
  props.onSave?.(row)
  toast.value = props.submitLabel !== '' ? props.submitLabel : '已保存'
  window.setTimeout(() => { toast.value = '' }, 2500)
  for (const key of Object.keys(model)) delete model[key]
}
</script>
```

- [ ] **Step 4: 重写 FormPanel.vue template（旧字段结构 + 校验/错误/toast）**

```vue
<template>
  <section class="section form-panel">
    <div class="container form-panel__inner">
      <header v-if="props.heading || props.subheading" class="form-panel__head">
        <h2 v-if="props.heading" class="form-panel__title">{{ props.heading }}</h2>
        <p v-if="props.subheading" class="form-panel__sub">{{ props.subheading }}</p>
      </header>
      <form
        v-if="props.fields.length > 0 || props.submitLabel"
        class="form-panel__form"
        @submit.prevent="submit"
      >
        <label v-for="field in props.fields" :key="field.key" class="form-panel__field">
          <span class="form-panel__label">
            {{ field.label }}<span v-if="field.required" class="form-panel__required"> *</span>
          </span>
          <select
            v-if="field.type === 'enum' && field.options && field.options.length > 0"
            v-model="model[field.key]"
            class="form-panel__input"
          >
            <option value="" disabled>请选择</option>
            <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
          </select>
          <input
            v-else-if="field.type === 'boolean'"
            v-model="model[field.key]"
            class="form-panel__check"
            type="checkbox"
          />
          <input
            v-else
            v-model="model[field.key]"
            class="form-panel__input"
            :type="field.type === 'string' || field.type === 'enum' ? 'text' : field.type"
            :placeholder="field.placeholder"
          />
          <span v-if="errors[field.key]" class="form-panel__error">{{ errors[field.key] }}</span>
        </label>
        <button v-if="props.submitLabel" class="button form-panel__submit" type="submit">
          {{ props.submitLabel }}
        </button>
      </form>
      <Transition name="form-panel__toast">
        <p v-if="toast" class="form-panel__toast" role="status">{{ toast }}</p>
      </Transition>
    </div>
  </section>
</template>
```

style 末尾追加：

```css
.form-panel__required {
  color: color-mix(in srgb, var(--color-foreground) 70%, red);
}

.form-panel__check {
  align-self: flex-start;
  margin-top: 0.25rem;
}

.form-panel__error {
  color: color-mix(in srgb, var(--color-foreground) 70%, red);
  font-size: 0.8rem;
}

.form-panel__toast {
  margin: calc(var(--space-unit) * 1) 0 0;
  padding: 0.6em 1em;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  font-size: 0.875rem;
  font-weight: 600;
}

.form-panel__toast-enter-active,
.form-panel__toast-leave-active {
  transition: opacity 0.2s ease;
}

.form-panel__toast-enter-from,
.form-panel__toast-leave-to {
  opacity: 0;
}
```

> `Transition` 组件无需 import（Vue 内建）。toast 里的 `window.setTimeout` 是块级 SFC 行为，不违反「store 无定时器」约束。

- [ ] **Step 5: 更新 derive.test 的 FormPanel slotless 断言**

Task 4 Step 5 里已给出本文件的 FormPanel 新断言全文（`fields` 加 `key`/`form: 'order-form'`），此处直接落地它（在 derive.test.ts 里做同样替换）。注意 `fields` 类型从 `'{ label, type, placeholder? }[]'` 升为 `'{ key, label, type, required?, placeholder?, validate?, options? }[]'`——既有 slotless 断言若写的是旧 `{ label, type }` 会因 `key` 缺失而失败，一并更新。侧车只是文档，`onSave` 的 `(row) => void` 是函数值，模型不会写进 draft，无需透传断言。更新时同步改 `toEqual`（透传逐字节拷回，若断言里加了 `form`/`key` 而 `toEqual` 没跟上会红）。

- [ ] **Step 6: 跑测试确认通过**

Run: `cd packages/templates/blocks && npx vitest run`
Expected: 全绿。

- [ ] **Step 7: 提交**

```bash
git add packages/templates/blocks/src/blocks/form-panel.slots.ts packages/templates/vue3-base/src/blocks/FormPanel.vue packages/templates/blocks/src/__tests__/derive.test.ts
git commit -m "feat(blocks): validate and toast in FormPanel with a bound onSave

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: blocks——StatsGrid/StatusCard 迷你图表

**Files:**
- Modify: `packages/templates/blocks/src/blocks/stats-grid.slots.ts`
- Modify: `packages/templates/blocks/src/blocks/status-card.slots.ts`
- Modify: `packages/templates/vue3-base/src/blocks/StatsGrid.vue`
- Modify: `packages/templates/vue3-base/src/blocks/StatusCard.vue`

**Interfaces:**
- Consumes: Task 3 fixture 里 StatsGrid/StatusCard 的 `chart`/`series` props。
- Produces: 每个 stat/item 可选 `chart?: 'line' | 'bar'`（SFC 类型 `string`）与 `series?: number[]`；缺省渲染与今天完全一致。

- [ ] **Step 1: 更新两个侧车（sfc-props 会红）**

`stats-grid.slots.ts`：`stats: '{ label, value, delta?, suffix?, chart?, series? }[]'`
`status-card.slots.ts`：`items: '{ label, value, tone?, chart?, series? }[]'`（heading/icon 不变）

- [ ] **Step 2: 跑 sfc-props 确认红**

Run: `cd packages/templates/blocks && npx vitest run src/__tests__/sfc-props.test.ts`
Expected: StatsGrid/StatusCard 失败（SFC 类型未对齐——注意 props **键**没变，为何红？侧车 props 键未变、SFC 键未变，此步其实不红；真正红的条件是键不一致。因此本任务第一步实际是**同步改 SFC 接口与侧车 props 字符串**，sfc-props 测试作为键一致性兜底保持不变。若 SFC 与侧车键一致则不会红——跳过「确认红」这一步，直接实现）。）

- [ ] **Step 3: StatsGrid.vue 加图表**

script：`Stat` 接口加 `chart?: string; series?: number[]`；新增 helper（`<script setup>` 内）：

```ts
/** 迷你 SVG 折线的 points 串（值归一化到 100×30 viewBox）。 */
function sparkPoints(series?: number[]): string {
  if (series === undefined || series.length === 0) return ''
  const max = Math.max(...series)
  const span = max === 0 ? 1 : max
  return series
    .map((value, index) => {
      const x = (index / (series.length - 1)) * 100
      const y = 30 - (value / span) * 26 - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** 迷你 SVG 柱状条：每柱宽固定、高度按值归一化。 */
function sparkBars(series?: number[]): string {
  if (series === undefined || series.length === 0) return ''
  const max = Math.max(...series)
  const span = max === 0 ? 1 : max
  const width = 100 / series.length
  return series
    .map((value, index) => {
      const height = (value / span) * 26
      return `<rect x="${(index * width + width * 0.2).toFixed(1)}" y="${(28 - height).toFixed(1)}" width="${(width * 0.6).toFixed(1)}" height="${height.toFixed(1)}" />`
    })
    .join('')
}
```

template：`stats-grid__cell` 内、`dt` 之前加：

```vue
          <svg
            v-if="stat.chart === 'line' && stat.series && stat.series.length > 0"
            class="stats-grid__spark"
            viewBox="0 0 100 30"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              :points="sparkPoints(stat.series)"
              fill="none"
              stroke="var(--color-primary)"
              stroke-width="2"
            />
          </svg>
          <svg
            v-else-if="stat.chart === 'bar' && stat.series && stat.series.length > 0"
            class="stats-grid__spark"
            viewBox="0 0 100 30"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <g v-html="sparkBars(stat.series)" fill="var(--color-primary)" />
          </svg>
```

style 追加：

```css
.stats-grid__spark {
  display: block;
  width: 100%;
  height: 40px;
  margin-bottom: calc(var(--space-unit) * 0.75);
}
```

- [ ] **Step 4: StatusCard.vue 加图表**

script：`Item` 接口加 `chart?: string; series?: number[]`；复制 `sparkPoints`/`sparkBars`（TONE_CLASS 保留原样；`Item` 接口在 `TONE_CLASS` 声明之前——确认 `TONE_CLASS` 的 `Record<string, string>` 与新增的 `Stat`/`Item` 接口并存不冲突）。template：`status-card__item` 内、`dd.status-card__value` 之后加同样的 svg 块（class 用 `status-card__spark`；每个 item 的 svg 与其 `dt/dd` 平行，`key` 仍用 `item.label`）。style 追加：

```css
.status-card__spark {
  display: block;
  width: 100%;
  height: 32px;
  margin-top: calc(var(--space-unit) * 0.5);
}
```

> 两个 SFC 的图表 helper 代码重复是刻意的：生成工程的块 SFC 是自包含拷贝，不共享工具模块（模板只有 `asset.ts` 一个共享文件）。

- [ ] **Step 5: 跑测试确认通过**

Run: `cd packages/templates/blocks && npx vitest run`（含 sfc-props 键一致性 + StatusCard TONE_CLASS 静态断言）
Expected: 全绿。

- [ ] **Step 6: 提交**

```bash
git add packages/templates/blocks/src/blocks/stats-grid.slots.ts packages/templates/blocks/src/blocks/status-card.slots.ts packages/templates/vue3-base/src/blocks/StatsGrid.vue packages/templates/vue3-base/src/blocks/StatusCard.vue
git commit -m "feat(blocks): add token-only mini line/bar charts to stats blocks

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: drafter 数据语义段 + draft.ts 透传

**Files:**
- Modify: `packages/providers/src/openai-spec-drafter.ts`（Draft shape 段 + 「Data semantics」段）
- Modify: `packages/templates/blocks/src/draft.ts`（ProjectDraftSchema/DraftPageSchema + `deriveSpecInput` 输出——**关键修复**：schema 与输出映射都必须加新字段，否则 codegen 永远看不到 draft 里的 collections/forms/operations）
- Test: `packages/providers/src/__tests__/openai-spec-drafter.test.ts`（数据语义断言）
- Test: `packages/templates/blocks/src/__tests__/draft.test.ts`（透传断言）

**Interfaces:**
- Consumes: `CollectionSchema`/`FormSchema`/`OperationSchema`（Task 1）。
- Produces: 从 `deriveSpecInput` 输出的 spec 携带 `collections`/`forms`/`pages[].operations`，codegen（Task 3）才见得到。（**若不改 schema 与输出映射，本任务的透传测试与 Task 8 的真任务都会失败**——collections/forms 不会出现在 spec 里，codegen 只输出静态块。）

- [ ] **Step 1: 写失败测试（blocks draft.test.ts）**

`packages/templates/blocks/src/__tests__/draft.test.ts` 末尾追加：

```ts
describe('deriveSpecInput data-model passthrough', () => {
  it('carries collections, forms and page operations into the derived spec', () => {
    const draft = landingDraft([
      homePage(),
      {
        route: '/orders',
        title: 'Orders',
        pageType: 'list-detail',
        blocks: [
          { component: 'DataTable', props: { collection: 'orders' } },
          { component: 'StatsGrid', props: { heading: 'Overview' } },
        ],
        operations: [{ id: 'refresh-orders', label: 'Refresh', kind: 'refresh', target: 'orders' }],
      },
      fillerPage('/settings', 'Settings'),
    ])
    draft.collections = [
      {
        id: 'orders',
        label: 'Orders',
        model: { id: { type: 'string', label: 'ID' }, name: { type: 'string', label: 'Name' } },
        fields: ['name'],
        seed: 4,
        actions: ['search', 'edit', 'delete', 'export'],
      },
    ]
    draft.forms = [
      {
        id: 'order-form',
        label: 'Order form',
        collection: 'orders',
        fields: [{ key: 'name', label: 'Name', type: 'string', required: true }],
        submit: { label: '保存', toast: '已保存' },
      },
    ]

    const value = okValue(deriveSpecInput(draft))
    expect(value.collections[0]!.id).toBe('orders')
    expect(value.forms[0]!.id).toBe('order-form')
    const orders = value.pages.find((page) => page.route === '/orders')!
    expect(orders.operations).toHaveLength(1)
    expect(orders.operations[0]!.kind).toBe('refresh')
    expect(parseProjectSpecInput(value).ok).toBe(true)
  })

  it('defaults the new fields away for drafts without them (zero-break)', () => {
    const value = okValue(deriveSpecInput(landingDraft()))
    expect(value.collections).toEqual([])
    expect(value.forms).toEqual([])
    expect(value.pages[0]!.operations).toEqual([])
  })
})
```

`draft.test.ts` Step 1 测试里的 `landingDraft()` 需在 `pages` 数组模板里加一行 `operations: []`（因为透传断言测 `value.pages[0]!.operations`——若 DraftPageSchema 的 `operations` 没默认 `[]`，既有 `homePage()` 造的 draft 就缺字段而解析失败；但 schema 已有 `.default([])`，所以不加也不会失败，加了更明确）。为保险，`homePage()`/`fillerPage()` 的 blocks 有 2 个，draft 三页满足 min(3) 与每页 min(2)。透传测试里 `operations: [{ id: 'refresh-orders', label: 'Refresh', kind: 'refresh', target: 'orders' }]` 挂在 `/orders` 页上——`target: 'orders'` 是 collection id，不要求是已声明路由（`deriveSpecInput` 的 CTA 检查只查 `to` props，不查 operations 的 target）。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/templates/blocks && npx vitest run src/__tests__/draft.test.ts`
Expected: FAIL（draft schema 还没新字段，`value.collections` 类型/值不存在）。

- [ ] **Step 3: 实现 draft.ts**

`packages/templates/blocks/src/draft.ts`：

import 增：

```ts
import {
  BlockSchema,
  CollectionSchema,
  FormSchema,
  MetaSchema,
  OperationSchema,
  PageSchema,
  PageTypeSchema,
  StyleBibleSchema,
  ThemeSchema,
  formatIssues,
  type ProjectSpecInput,
} from '@vudt/spec'
```

`DraftPageSchema` 增 `operations`：

```ts
const DraftPageSchema = z.object({
  route: PageSchema.shape.route,
  title: PageSchema.shape.title,
  pageType: PageTypeSchema,
  blocks: z.array(DraftBlockSchema).min(2),
  operations: z.array(OperationSchema).default([]),
})
```

`ProjectDraftSchema` 增 `collections`/`forms`：

```ts
export const ProjectDraftSchema = z.object({
  meta: MetaSchema,
  theme: ThemeSchema,
  styleBible: StyleBibleSchema,
  collections: z.array(CollectionSchema).default([]),
  forms: z.array(FormSchema).default([]),
  pages: z.array(DraftPageSchema).min(3),
})
```

> 这四行是「数据语义声明」在 pipeline 上的第一道闸：`ProjectDraftSchema.safeParse` 现在接收并校验 draft 里的 `collections`/`forms`/`operations`；`DraftPageSchema` 复用 `OperationSchema`，`ProjectDraftSchema` 复用 `CollectionSchema`/`FormSchema`，与 spec schema 同一来源，不会漂移。

`deriveSpecInput` 的 destructure 与输出（**输出映射必须透传这三个字段**——只加 schema 不够，映射里漏掉它们 codegen 依然看不到）：

```ts
  const { meta, theme, styleBible, collections, forms, pages } = parsed.data
  ...
    return {
      ok: true,
      value: {
        meta,
        theme,
        styleBible,
        collections,
        forms,
        pages: derivations.map(({ page, derived }) => ({
          route: page.route,
          title: page.title,
          pageType: page.pageType,
          blocks: derived.blocks,
          operations: page.operations,
        })),
        assets,
      },
    }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/templates/blocks && npx vitest run src/__tests__/draft.test.ts`
Expected: 全绿（含既有 12 例 + 新 2 例透传——第 2 例验证旧 drafts 三个字段默认 `[]`，这是旧任务零破坏在 draft 层的兜底）。

- [ ] **Step 5: 写失败测试（providers）**

`packages/providers/src/__tests__/openai-spec-drafter.test.ts` 末尾追加：

```ts
  test('documents the data semantics section and the new draft keys', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a management system', attempt: 1 })

    const system = systemOf(calls[0]!)
    expect(system).toMatch(/Data semantics/i)
    expect(system).toMatch(/searchable\/sortable\/pageable|becomes searchable/i)
    expect(system).toMatch(/omit collections\/forms entirely/i)
    expect(system).toMatch(/"collections"/)
    expect(system).toMatch(/"forms"/)
    expect(system).toMatch(/operations/)
    // 老锚点保持通过（块目录、主题规则、页面下限等）
    expect(system).toMatch(/APP blocks \(back-office \/ management systems only\)/i)
    expect(system).toMatch(/near-white|#f5f6f8/i)
    expect(system).toMatch(/3-6 pages/)
  })
```

- [ ] **Step 6: 跑测试确认失败**

Run: `cd packages/providers && npx vitest run src/__tests__/openai-spec-drafter.test.ts`
Expected: 新用例失败（prompt 还没有数据语义段）。

- [ ] **Step 7: 实现 providers prompt**

`packages/providers/src/openai-spec-drafter.ts` 的 `systemPrompt()` 内，Draft shape 段（`'  "pages": ['` 行块之前）加可选键说明，并在整个 Draft shape 段之后插入「Data semantics」段。具体插入（在 `'    }',` 与 `'  ]',` 之间调整——即在 `pages` 数组样板后、`'}'` 前保持原样；在 Draft shape 段结束后追加）：

在 `'  "styleBible": {'` 段前无需动。两处追加：

1. Draft shape 的 `pages` 数组样板内、`blocks` 之后加：

```ts
    '        { "component": <a component listed below>,',
    '          "props": { <the copy for that block, see its props below> },',
    '          "content": { "illustration": { "prompt": string, "alt": string } },',
    '          "operations": [ { "id": string, "label": string,',
    '            "kind": "refresh" | "route" | "export" | "filter",',
    '            "target": <a collection id or a route starting with "/">,',
    '            "param"?: string } ]  // optional',
    '        }',
```

2. Draft shape 整体（`'}'` 之后）追加（缩进对齐现有样板；各段之间用一个空字符串隔开，保持既有 `','`/`''` 数组项风格）：

```ts
    '',
    '  "collections" (optional): [ { "id": "orders", "label": "订单",',
    '    "model": { "customer": { "type": "string", "label": "客户" },',
    '               "amount": { "type": "number", "label": "金额" },',
    '               "status": { "type": "enum", "label": "状态",',
    '                 "options": ["待处理", "已发货"] } },',
    '    "fields": ["customer", "amount", "status"],',
    '    "seed": 8, "actions": ["search", "edit", "delete", "export"] } ]',
    '  "forms" (optional): [ { "id": "order-form", "label": "新建订单",',
    '    "collection": "orders",',
    '    "fields": [ { "key": "customer", "label": "客户", "type": "string",',
    '      "required": true, "placeholder": "客户名称" } ],',
    '    "submit": { "label": "保存", "toast": "已保存" } } ]',
    '',
    'Data semantics (optional — only when the project needs it):',
    '- A back-office list page usually needs a collection: give the table a data model',
    '  (field types + seed rows) and it becomes searchable/sortable/pageable, not a',
    '  static snapshot. Give the collection actions it truly supports.',
    '- A settings/employee form usually needs a "forms" entry with validation, not just',
    '  display fields.',
    '- "operations" on a page render a toolbar: "route" navigates to a declared route,',
    '  "refresh"/"export"/"filter" act on the target collection.',
    '- If the description does not call for live data, omit collections/forms entirely —',
    '  static blocks are fine for a marketing site.',
```

（保持 `renderBlockCatalogue()` 的行格式不变——目录渲染只读侧车 props 字符串，sidecar 变更后目录自动带上 `collection`/`form` 等新 props 说明。）

- [ ] **Step 8: 跑测试确认通过**

Run: `cd packages/providers && npx vitest run src/__tests__/openai-spec-drafter.test.ts`
Expected: 全绿（56 既有 + 1 新）。

Run: `cd packages/providers && npx tsc --noEmit`
Expected: 0 错误。

- [ ] **Step 9: 提交**

```bash
git add packages/templates/blocks/src/draft.ts packages/templates/blocks/src/__tests__/draft.test.ts packages/providers/src/openai-spec-drafter.ts packages/providers/src/__tests__/openai-spec-drafter.test.ts
git commit -m "feat(providers,blocks): draft data semantics and pass collections/forms through

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: 全仓回归 + 旧 spec 零破坏 + data-model 工程构建 + 真任务手验（4301）

**Files:**
- Modify: `packages/codegen/src/__tests__/write.test.ts`（data-model spec 的 vue-tsc + vite build 集成用例）

**Interfaces:**
- Consumes: 全部前序任务的产物。
- Produces: 交付确认（代码 + 截图证据），不产新文件。

- [ ] **Step 1: write.test.ts 加 data-model 构建用例**

`packages/codegen/src/__tests__/write.test.ts` 的 `describe('the generated project builds')` 内追加（在既有 vue-tsc/vite 用例之后；`writeProject`/`generateProject`/`run`/`mkdtemp`/`writeFile`/`rm`/`TEMPLATE_DIR` 均已在文件里 import/定义，只需在顶部 import 加 `dataModelSpec`）：

```ts
  it('builds a data-model project: data files, bound tables and forms typecheck', async () => {
    const dataOut = await mkdtemp(join(tmpdir(), 'vudt-data-'))
    try {
      await writeProject(dataModelSpec(), {
        templateDir: TEMPLATE_DIR,
        outDir: dataOut,
        nodeModules: 'link',
      })

      const { expectedAssets } = generateProject(dataModelSpec())
      for (const asset of expectedAssets) {
        await writeFile(join(dataOut, asset.path), Buffer.alloc(0))
      }

      await run('node', [
        resolve(TEMPLATE_DIR, 'node_modules/vue-tsc/bin/vue-tsc.js'),
        '--noEmit',
        '-p',
        join(dataOut, 'tsconfig.json'),
      ])
    } finally {
      await rm(dataOut, { recursive: true, force: true })
    }
  }, 180_000)
```

顶部加 `dataModelSpec` import。此用例是全计划最关键的类型闸：生成工程的 `mock.ts`/`store.ts`/页面 SFC 全部过 vue-tsc，绑定的 props 类型（`:data`/`:columns`/`:on-save`/`:search-text`/`@save`）在真实 DataTable/FormPanel 上编译通过。

Run: `cd packages/codegen && npx vitest run src/__tests__/write.test.ts`
Expected: 全部通过（含既有 landingSpec 构建——旧路径零破坏且无 `src/data/`；data-model 构建 180s 上限内绿）。

- [ ] **Step 2: 全仓回归**

Run: `pnpm -r test`
Expected: 9 包全绿（spec/codegen/blocks/providers 等所有既有用例 + 本计划新增）。

Run: `pnpm -r typecheck`
Expected: 0 错误。

- [ ] **Step 3: 旧 spec 零破坏自动验证（无新字段任务与今天逐字节一致）**

- `landingSpec()`（无 collections/forms/operations）的既有断言已覆盖：project.test「emits data files only when collections」反例 + write.test 构建用例——确认它们仍绿（Step 2 已含）。
- 跑一个真实旧形态任务作人工对照（见 Step 5）。

- [ ] **Step 4: 起服务与提交真任务（4301 隔离实例，用仓库根的新代码）**

按 `docs/superpowers/plans/2026-09-24-admin-blocks.md` 与记忆 `settings-page-env` 的方法：

```bash
# 1) 确认 4300/5173 端口归属，杀旧进程（新代码必须重启才生效）
netstat -ano | grep LISTENING | grep -E ':(4300|5173)'
taskkill //PID <old-pid> //F

# 2) 从仓库根起后端（新代码已含本计划全部改动）
./server/node_modules/.bin/tsx --env-file=server/.env server/src/main.ts

# 3) 前端
cd web && npx vite
```

> 若 4300 上还有别人的在途任务，改起隔离实例：换 cwd 放 `.vudt/settings.json` + `VUDT_PORT=4301` + 四个可覆盖路径，模板/缓存/产物指回真实目录（照记忆 `settings-page-env` 第六节）。

settings 校验（`curl -s http://127.0.0.1:4300/api/settings`）：spec 模型是 `deepseek-v4-flash`（或 `.vudt/settings.json` 里配的），`sources` 不是 default；若中转站拒绝 `response_format`，设 `{"spec":{"sendResponseFormat":false}}` 后重启。

提交任务（中文描述必须走文件，防 curl Content-Length 坑）：

```bash
cat > body.json <<'EOF'
{ "description": "一个订单管理后台系统：仪表盘展示今日订单量、销售额、待发货数等指标卡片，订单列表支持搜索、排序、分页和编辑删除，有新建订单表单页面，系统设置页面可以修改公司名称、通知邮箱。" }
EOF
curl -s -H "Content-Type: application/json" --data-binary @body.json http://127.0.0.1:4300/tasks
```

- [ ] **Step 5: 验收真任务（对照 spec 验收 §九）**

等待任务到 `ready`，然后检查 `workspace/<taskId>/`：

1. **生成文件**：`src/data/mock.ts` 与 `src/data/store.ts` 存在；`src/pages/OrdersPage.vue`（或对应名）含 `useCollectionRows`、`:data`、`:columns`、ops 工具条。
2. **preview 交互**（web 控制台 preview iframe 或 `vite preview`）：
   - 订单表格**可搜索、点表头排序、分页**；
   - 行上有**编辑/删除**按钮，点删除行消失；
   - **新建订单**表单：空提交报「此项必填」，邮箱格式错报错，提交成功出 toast，数据写回表格；
   - 指标卡带**迷你折线/柱状图**；
   - 页顶有**刷新/导出/新建**工具条，导出下载 CSV。
3. **截图对比**：新任务仪表盘/订单页截图 vs 旧静态版（`d3847631`/`0e712ec1`），存到 `$CLAUDE_JOB_DIR/tmp/data-model-*.png`。
4. **旧形态对照**：再提交一条纯营销描述（如「一个精品咖啡烘焙品牌官网」）→ 生成工程**无** `src/data/`，渲染与今天一致。

- [ ] **Step 6: 收尾验证**

- [ ] `pnpm -r test` / `pnpm -r typecheck` 全绿
- [ ] `git status --porcelain` 干净（除 `.claude/`、`README.md`、`docs/superpowers/plans/2026-09-22-output-richness.md` 三个永不提交文件）
- [ ] 分支可发布；origin/main 落后时按既有流程 push

**本任务不提交**（交付物是确认与证据）。

---

## 提交本计划与待提交改动（用户批准后）

工作区当前已有三处未提交改动（来自 spec 获批前的实现），连同本计划一起提交：

```bash
git add docs/superpowers/plans/2026-09-25-data-model.md docs/superpowers/specs/2026-09-25-data-model-design.md packages/providers/src/openai-spec-drafter.ts packages/providers/src/__tests__/openai-spec-drafter.test.ts
git commit -m "docs(providers): data-model design, plan, and the rewritten spec drafter prompt

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

（显式路径，不含 `.claude/`、`README.md`。）
