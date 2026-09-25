# 数据模型 + 操作语义（Spec Data Model）设计

> **日期：** 2026-09-25
> **状态：** 已与人类伙伴确认（C 方向）
> **目标：** 把生成的前端从「静态内容展示」升级为「可操作的后台」——表格可搜索/排序/分页、表单可编辑/校验/保存、指标有图表、操作有反馈。对齐「Claude Code / Codex 直接写」的能力方向，但在现有模板拼装器架构内实现，不引入 UI 框架、不引入真后端。

## 一、问题陈述

当前生成的后台页面（`d3847631`、`0e712ec1` 等真任务）视觉上已是后台形态（SidebarShell + APP 块 + 克制主题），但**功能上是静态的**：

- `DataTable` 只渲染 `columns`/`rows`，无搜索、排序、分页、行操作。
- `FormPanel` 只渲染 `fields`，无校验、无提交反馈。
- `StatsGrid`/`StatusCard` 只有数字，无图表。
- 页面 = 块堆叠，无「工具条 + 表格 + 分页」「指标行 + 图表」这类后台功能骨架。

用户的直观感受是「很简陋、像单页面、无法达到后台系统的使用程度」。根因不是提示词，是**数据语义在 spec 中不存在**——LLM 只能描述静态文案，没有表达「数据集合、字段类型、操作」的词汇。

## 二、设计目标（成功判据）

1. 用**同一个「后台管理系统」描述**生成的站：订单表格**可搜索/排序/分页**，表单**可校验/保存**（有 toast 反馈），指标卡带迷你图表。
2. **旧 spec 零破坏**：不写新字段的任务仍生成与今天完全一致的项目（回退路径），全仓既有测试基线全绿。
3. **架构不漂移**：不引入 UI 框架/后端/数据库；几何仍只来自侧车；props 仍走 const+v-bind；块内颜色仍只用 tokens。
4. 生成工程仍可在 preview iframe 与 `vite preview` 中自洽运行（数据为内存态 mock，无外部依赖）。

## 三、方案总览

在 spec 中新增**三个可选声明**，经 codegen 落成「数据层文件 + 块绑定」，块 SFC 内置交互逻辑：

```
LLM spec
 ├─ collections[]（可选）──→ codegen renderCollections ──→ src/data/mock.ts + src/data/store.ts
 ├─ forms[]（可选）───────→ codegen renderForms ────────→ 表单模型并入 store.ts（可选）
 └─ pages[].operations[]（可选）→ codegen renderOperations ──→ 页级操作按钮/工具条
pages[].blocks ─────────────→ codegen renderPage ────────────→ 块绑定 :data/:columns/:on-save 等
块 SFC（DataTable/FormPanel/StatsGrid/StatusCard）内置交互逻辑
```

数据语义在 spec 中**是可选字段**，缺省回退到现状（静态 props 渲染）。这样：

- 旧任务/旧 spec 完全不变。
- 新任务只要模型在描述里表达「订单管理、可筛选分页」之类，drafter 引导它声明 `collections`。

## 四、Spec 层（packages/spec）

### 4.1 新增 `CollectionSchema`（`packages/spec/src/collection.ts`）

```ts
export const FieldTypeSchema = z.enum(['string', 'number', 'date', 'enum', 'boolean'])

export const FieldModelSchema = z.object({
  type: FieldTypeSchema,
  label: z.string().min(1).max(40),
  options: z.array(z.string()).optional(),   // 仅 enum 使用
})

export const CollectionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),   // kebab-case，跨页引用
  label: z.string().min(1).max(40),             // 集合名，UI 展示
  model: z.record(z.string(), FieldModelSchema), // 字段名 -> 字段模型
  fields: z.array(z.string()).min(1),           // 列/表单显示顺序（必须是 model 的键）
  seed: z.number().int().min(1).max(50).default(8), // mock 行数
  actions: z.array(z.enum(['create','edit','delete','search','export'])).default([]),
})
```

### 4.2 新增 `FormSchema`（`packages/spec/src/form.ts`）

```ts
export const FormFieldSchema = z.object({
  key: z.string(),                              // 对应 collection.model 的键（可无 collection）
  label: z.string().min(1).max(40),
  type: FieldTypeSchema,
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  validate: z.object({
    min: z.number().int().min(0).optional(),
    max: z.number().int().optional(),
    pattern: z.enum(['email']).optional(),
  }).default({}),
})

export const FormSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().min(1).max(40),
  fields: z.array(FormFieldSchema).min(1),
  submit: z.object({
    label: z.string().min(1).max(20),
    toast: z.string().min(1).max(40),
  }).default({ label: '保存', toast: '已保存' }),
})
```

### 4.3 新增 `OperationSchema`（`packages/spec/src/operation.ts`）

```ts
export const OperationSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().min(1).max(20),
  kind: z.enum(['refresh', 'route', 'export', 'filter']),
  target: z.string(),            // collection id 或路由
  param: z.string().optional(),  // filter 用：字段名
})
```

### 4.4 挂载到 ProjectSpec（`project-spec.ts`）

- `ProjectSpecInputSchema` / `ProjectSpecSchema` 的 `baseShape` 增加：
  ```ts
  collections: z.array(CollectionSchema).default([]),
  forms: z.array(FormSchema).default([]),
  ```
  `operations` 挂在 `PageSchema` 上（`page.ts`）：`operations: z.array(OperationSchema).default([])`。
- `checkReferentialIntegrity` 新增三条检查：
  1. `collection.fields` 每项必须是 `collection.model` 的键。
  2. `collection.actions` 含 `edit/delete` 时，`collection.model` 必须有主键字段（约定键名 `id`）——缺主键时 codegen 用 `rowIndex` 兜底，但 spec 校验给出告警。
  3. `page.operations[].target` 若以 `/` 开头必须是已声明路由，否则必须是已声明 collection id。

**兼容性**：三个字段全默认 `[]`/`{}`，旧 spec 解析结果与今天完全一致。

## 五、Codegen 层（packages/codegen）

### 5.1 新增 `src/data.ts`：`renderCollections(spec)` → `src/data/mock.ts`

确定性生成 mock 数据（同一 spec 每次生成相同内容，可哈希、可测试）：

- 每个 collection 生成 `seed` 行。
- 按 `model[field].type` 生成确定性值：
  - `string`：品牌化中文样例词（从词库按行号索引取，如 `["订单","客户","商品","员工","项目"]` × 序号）。
  - `number`：确定性范围数（行号派生，如 `100 + row * 17`）。
  - `date`：确定性 ISO 日期（基准 2026-09-01 起按行偏移）。
  - `enum`：从 `options` 按行号取模。
  - `boolean`：行号奇偶。
- 每行固定带 `id`（`row-{index}`）保证可编辑/删除。

### 5.2 新增 `src/store.ts`：`renderStore(spec)` → `src/data/store.ts`

轻量内存 store（纯函数式，无外部依赖，可被单测直接断言）：

- 每 collection 一个 store 工厂：`createCollectionStore(initial)` 返回 `{ rows, search(q), sort(field, dir), page(pageSize, pageNum), add(row), update(row), remove(id), getById(id) }`。
- 统一行类型 `Row = Record<string, unknown> & { id: string }`。
- 每页独立实例化（`useData()` 或组件内 `ref` 持有），不跨页共享、不落盘。
- 无异步、无定时器、无 localStorage。

### 5.3 `project.ts` `generateProject()` 增加输出

```ts
if (spec.collections.length > 0) {
  files['src/data/mock.ts'] = renderCollections(spec)
  files['src/data/store.ts'] = renderStore(spec)
}
```

### 5.4 `page.ts` `renderPage()` 增加块绑定

- 若 block 是 `DataTable` 且 page 引用了某 collection：
  - 用 `collection` 生成 `columns`（key/label/kind）。
  - 注入 `:data="data"`、`:searchable`、`:sortable`、`:pageable`、`:page-size`。
  - script 增加 `const data = useCollectionRows('orders')`（从 store 读 mock 数据）。
- 若 block 是 `FormPanel` 且 page 引用了某 form：
  - 注入 `:fields`（含校验/占位）、`:submit-label`、`:on-save="onSave"`。
  - script 增加 `const onSave = (row) => { ... }`（写回 collection store / toast）。
- 若 page 有 `operations`：
  - 页顶部生成工具条 `<div class="ops">` + 按钮，绑定各 kind 行为。
- **不生成任何新文件类型之外的东西**；老路径（无 collections/forms/operations）完全不动。

### 5.5 约束对齐（实现时必须遵守）

- 新绑定全部走 **const + v-bind**（vue-tsc 实体陷阱，`page.ts` 现有 `literal()` 复用）。
- 生成代码只用 `--color-*`/`--radius`/`--space-unit`/`--font-*` tokens，不硬编码颜色。
- 生成文件都在 `src/data/`、`src/pages/*.vue` 内，经 `writeProject` 的 `safeJoin` 校验（现有机制）。

## 六、块层（packages/templates/blocks）

### 6.1 `DataTable.vue` 升级（新增 props，全部可选、带默认值）

| prop | 类型 | 默认 | 行为 |
|---|---|---|---|
| `data` | `Row[]` | `[]` | 数据行（无则回退旧 `rows`） |
| `columns` | `{key,label,kind?}[]` | 旧 `columns` | 列定义 |
| `searchable` | `boolean` | `false` | 渲染搜索框，过滤 `data` |
| `sortable` | `boolean` | `false` | 表头点击排序 |
| `pageable` | `boolean` | `false` | 渲染分页器（内置页码） |
| `pageSize` | `number` | `8` | 每页行数 |

- 排序/搜索/分页全部**组件内状态**（`ref`），纯前端。
- 行操作（若 `edit/delete` 在 actions）：emit `save(row)` / `delete(row)`。
- 老用法（无 `data`）仍渲染 `rows`——**零破坏**。

### 6.2 `FormPanel.vue` 升级（新增 props）

| prop | 类型 | 默认 | 行为 |
|---|---|---|---|
| `fields` | `{key,label,type,required?,placeholder?,validate?}[]` | 旧 `fields` | 表单字段（含校验） |
| `submitLabel` | `string` | `'保存'` | 提交按钮文案 |
| `onSave` | `(row) => void` | `undefined` | 提交回调（undefined 时按钮禁用或只本地 toast） |

- 内置校验：`required`、`min`/`max`、`pattern: email`。不通过则行内错误文案 + 不提交。
- 提交成功 → 本地 toast（组件内，无需外部）。
- 老用法（`fields: {label,type,placeholder?}`）兼容——新 prop `validate/required` 缺省即旧行为。

### 6.3 `StatsGrid.vue` / `StatusCard.vue` 升级

- 新增可选 `chart?: 'line' | 'bar'` 与 `series?: number[]`。
- 用纯 SVG 迷你趋势图（无第三方库），颜色只用 tokens。
- 缺省时行为与今天完全一致。

### 6.4 侧车 props 更新（`data-table.slots.ts` 等）

- props 描述字符串更新（补充 `data/searchable/sortable/pageable/pageSize` 等），**props 名必须与 SFC `defineProps` 一字不差**（既有 SFC-alignment 测试会自动遍历）。

## 七、Drafter 层（packages/providers）

- `renderBlockCatalogue()` 每块行不变（格式保持 `- ${component} [pages: …] props: …`）。
- `systemPrompt()` 的 Draft shape 段新增（全可选）：
  ```
  "collections": [ { id, label, model: { field: { type, label, options? } },
                     fields: [...], seed?, actions? } ],   // optional
  "forms": [ { id, label, fields: [ { key, label, type, required?, placeholder?, validate? } ],
               submit: { label?, toast? } } ],              // optional
  pages[].operations: [ { id, label, kind, target, param? } ]  // optional
  ```
- 新增「数据语义」段（放在 Draft shape 之后）：
  ```
  'Data semantics (optional — only when the project needs it):',
  '- A back-office list page usually needs a collection: give the table a data model',
  '  (field types + seed rows) and it becomes searchable/sortable/pageable, not a',
  '  static snapshot. Give the collection actions it truly supports.',
  '- A settings/employee form usually needs a "forms" entry with validation, not just',
  '  display fields.',
  '- If the description does not call for live data, omit collections/forms entirely —',
  '  static blocks are fine for a marketing site.',
  ```
- **测试锚点**：新增断言锁「数据语义」段存在且 `collections`/`forms`/`operations` 三词出现在 prompt；既有断言（`outline`/`3-6 pages`/`never fewer than 2`/`dashboard.*settings.*list-detail.*form`/`never landing`/`restrained`/26 个 key/全部枚举/目录行）全部保持通过。

## 八、持久化策略

- **内存态 mock，不落盘、无后端**。理由：
  - preview iframe 与 `vite preview` 自洽运行（`source/dist` 导出可直接跑）。
  - 加真后端 CRUD 属于新架构（server 端数据层 + 持久化 + API），工程量数倍，超出本次范围。
- 数据在页面刷新/路由切换后重置（页面组件重新实例化 store）。
- 后续若要真持久化，在现有 store 之上加一层 `localStorage` 或后端 API 即可，不影响本次设计。

## 九、验收

1. **全仓回归绿**（含新增：`packages/spec` collection/form/operation schema 测试、`packages/codegen` data/store/mock 测试、blocks SFC-alignment 与 props 测试、providers prompt 数据语义测试、server 端到端——若涉及）。
2. **旧 spec 零破坏**：跑一个旧任务（不写新字段）→ 生成项目与今天完全一致。
3. **真任务手验**：4301 隔离实例提交「后台管理系统」描述 → 仪表盘/订单表格**可搜索/排序/分页**、表单**可校验/保存（toast）**、指标带迷你图表 → preview 截图对比（vs 旧静态版）。
4. **导出验证**：`export/source` 的生成工程可 `vite preview` 独立跑起来，交互可用。

## 十、范围边界（不做）

- 不引入 Element Plus / Ant Design / ECharts 等第三方 UI 库（保持零依赖生成工程）。
- 不做真后端 CRUD、不做权限、不做跨页持久化。
- 不动营销块（HeroSplit/FeatureTriad 等）——只升级 4 个后台块。
- 不改几何不变量、props 侧车不变量、两处硬编码清单、TONE_CLASS、颜色 token 规则。

## 十一、风险与缓解

| 风险 | 缓解 |
|---|---|
| 新字段让 LLM 过度声明（生成大量冗余 collection） | 数据语义段明确「可选、描述不需要就省略」；schema `seed` 上限 50 |
| 块升级破坏旧渲染 | 全部新 props 带默认值，老用法路径保持原样；SFC-alignment + 全仓回归兜底 |
| mock 数据「一眼假」 | 确定性词库 + 品牌化中文样例；`seed` 可调 |
| codegen 新文件与模板冲突 | 全部写入 `src/data/`、`src/pages/`，`writeProject.safeJoin` 已拦越界 |
| 数据语义只在后台触发、营销站误用 | drafter 引导「营销站省略」；schema 默认空数组 |

## 十二、任务拆解（供 plan 引用）

- **Task 1**：spec 层新增 collection/form/operation schema + 挂载 + 引用完整性检查（含测试）。
- **Task 2**：codegen `data.ts`（renderCollections → mock.ts，确定性数据）+ `store.ts`（内存 store 工厂）（含测试）。
- **Task 3**：codegen `project.ts` 挂载新文件输出 + `page.ts` 块绑定（DataTable 数据/FormPanel 表单/operations 工具条）（含测试）。
- **Task 4**：blocks `DataTable.vue` 交互升级（搜索/排序/分页/行操作）。
- **Task 5**：blocks `FormPanel.vue` 交互升级（校验/提交 toast）。
- **Task 6**：blocks `StatsGrid.vue`/`StatusCard.vue` 迷你图表。
- **Task 7**：drafter prompt 数据语义段 + 测试锚点；draft.ts schema/passthrough 修复（collections/forms/operations 透传 + 默认空）；providers 定向测试。
- **Task 8**：全仓回归 + 旧 spec 零破坏验证 + 真任务手验（4301）+ 截图对比。
