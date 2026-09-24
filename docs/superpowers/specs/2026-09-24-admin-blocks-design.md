# 后台管理系统内容形态（应用型区块）— 设计文档

日期：2026-09-24
状态：定稿（已确认）

## 目标

让「SaaS 落地页」和「后台管理系统」生成出**形态不同**的站点。当前所有描述都拼出 landing 块的组合（7 个营销块 + 缺后台材料），主题也整站一份 —— 所以 SaaS 生成后台时观感与落地页无异。

## 根因（本次改动前的事实）

- `SHELL_BY_PAGE_TYPE`（`packages/codegen/src/layouts.ts:30-37`）已把 `dashboard / settings / list-detail` 派给 `SidebarShell`，`pickShell` 已生效 —— **后台壳已经存在**，问题在页面内容。
- 13 个块中，`landing` 专属有 HeroSplit / FeatureTriad / CtaBanner / StatsBand / LogoStrip / PricingCard / TestimonialRow（7 个营销块）；`dashboard/list-detail` 只有 `EmptyStatePanel`（空状态块）；`settings/form` 只有 FAQAccordion。**模型没有后台块可用，只能拿营销块拼。**
- `theme` 是任务级一份（`ProjectDraftSchema.theme`），不区分页面类型。

## 决策

### 1. 新增 4 个后台块（全部 props-only，即 `slots: []`）

每块都要：`packages/templates/blocks/src/blocks/<name>.slots.ts`、`packages/templates/vue3-base/src/blocks/<Name>.vue`、在 `registry.ts` 注册、SFC 对齐测试自动覆盖新块。

| 组件 | `pageTypes` | `props`（侧车声明） | `slots` |
|---|---|---|---|
| `StatsGrid` | dashboard | `heading`, `stats: '{ label, value, delta?, suffix? }[]'` | `[]` |
| `DataTable` | list-detail, dashboard | `heading`, `subheading?`, `columns: '{ key, label, kind? }[]'`（`kind` ∈ `'text'\|'badge'\|'link'\|'status'`）, `rows: '{ cells: string[] }[]'` | `[]` |
| `FormPanel` | settings, form | `heading`, `subheading?`, `fields: '{ label, type, placeholder? }[]'`, `submitLabel` | `[]` |
| `StatusCard` | dashboard, list-detail | `heading`, `items: '{ label, value, tone? }[]'`, `icon?` | `[]`（`icon` 是 props 里的 icon 名，非图片槽） |

- **props-only 意味着零图片**，building 阶段不发任何图片请求（复用既有 `slots: []` 路径）。
- props 名与底座 SFC 的 `defineProps<{…}>()` 一字不差（`sfc-props.test.ts` 自动遍历校验）。
- 数组对象 props 走侧车「shape note」进入 drafter 的 prompt，值由模型在 `props` 里给。

### 2. 改造两个既有块（保留/补图片槽）

- `AuthPanel`（auth）：**保留** `illustration` 槽（登录页插画），**新增** `icon` 槽（`purpose: 'logo-mark'`，`aspectRatio: '1:1'`，`transparent: true`）—— 图标类图片走这里。AuthPanel 从 `slots: []` 变成有 2 个槽。
- `EmptyStatePanel`（dashboard, list-detail）：已有 `illustration` 槽（`purpose: 'empty-state'`），保留。异常状态图片（`purpose: 'error-state'`）不在本设计新增槽位 —— EmptyStatePanel 的 `illustration` 已覆盖空态，error 态图片留给未来按需加（本设计不做）。

### 3. `theme` 按任务类型引导（不改 schema）

`ProjectDraftSchema.theme` 不动。在 drafter system prompt 加引导：描述是后台/管理系统类时，主题选**克制的配色 + `spacing: compact` + 小 radius**（后台观感）；是营销站点时选**有辨识度配色 + 丰富的 radius/spacing**。`mode` 跟随页面气质。

### 4. `form` 页面类型挪到 SidebarShell

`packages/codegen/src/layouts.ts:30-37` 的 `SHELL_BY_PAGE_TYPE` 把 `form` 从 `'AppShell'` 改为 `'SidebarShell'`。理由：后台任务的设置/表单页应在侧边栏壳里（与 dashboard/settings 一致），当前 form 落在 AppShell 是「落入默认」而非有意。这是本次唯一动 codegen 的地方。

## 不变量的位置（必须钉死）

| 不变量 | 落在哪 | 本设计是否触碰 |
|---|---|---|
| 几何只来自侧车 | `packages/templates/blocks/src/slot.ts`（`SlotSpec`）、`derive.ts`（`derivePageAssets`） | **不碰**。模型只填 `props`/`content`（prompt/alt），几何字段不在 draft schema 里 |
| props 走 const+v-bind、w/h 只来自侧车 | `packages/codegen/src/page.ts` | **不碰**。新块照既有流程 |
| 零依赖 | 模板自带工具类 + tokens（`--color-*`/`--radius`/`--space-unit`/`--font-*`） | **不碰**。后台块手写 antd 风格（表格行、徽标、分页、表单栅格、侧边栏高亮），不引第三方 |
| 后台壳已存在 | `layouts.ts` / `SidebarShell.vue` | **只改一处**：`form` 派给 SidebarShell |

## 数据流（变化点）

```
drafter（按描述判断站点类型 → 主题风格引导 + 用后台块组后台页）
  → deriveSpecInput（不变：shape 校验 → 逐页 derivePageAssets → merge）
  → 零图片块无资产槽 → 无图 → 直接 vite build
  → 带图块（AuthPanel）走既有图片管线
  → codegen 渲染新块 props（const+v-bind）→ SidebarShell 壳
```

## 测试分布（预计新增）

| 包 | 新增 |
|---|---|
| `packages/templates/blocks` | 4 个新块的 derive 测试 + AuthPanel 改造后对齐测试 + 注册/对齐自动覆盖 |
| `packages/providers` | 1 条 drafter prompt 主题引导断言 |
| `packages/codegen` | `layouts.test.ts` 补 `form → SidebarShell` 断言 |

全仓 `pnpm -r test` / `typecheck` 必须绿。真任务端到端手验（出一个包含后台块与登录页的页面，确认预览/导出正常）。

## 待确认（已确认）

- 4 个新块的 props 形状已确认（`StatsGrid`/`DataTable`/`FormPanel`/`StatusCard`）。
- 登录页/异常状态保留插画（AuthPanel 保留 `illustration`），icon 图走 `logo-mark` 槽。确认。
- `theme` 按任务类型引导（不改 schema）。确认。
- `form → SidebarShell`。确认。
