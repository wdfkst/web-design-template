# 产出丰富度提升（区块扩展 + 内容大纲）— 设计文档

日期：2026-09-22
状态：草稿（待用户逐段确认后定稿）

## 目标

当前系统用 7 个区块（4 个 landing 专用）+ 模型只填 3-600 字文案，产出单调。本设计提升产出「完善、好看、像人做的」：

- **子任务 A**：新增 6 个 props-only 区块，让模型组合页面骨架的空间变大（当前只有 NavBarSimple + Hero* + FeatureTriad + CtaBanner + FooterSimple 能拼）。
- **子任务 C**：改 drafter 的 prompt，让模型像人一样设计——先给页面级「内容大纲」，再逐块填 `content`；并在 `theme` 里选更有辨识度的 palette/字体/mode/radius/spacing。

**不做**：不改 schema（`ProjectDraftSchema` / `ProjectSpecInputSchema` / `BlockSchema` 全不动）；不改 provider 接口与 drafter 签名；不改 `derivePageAssets` 契约（几何只来自侧车）；不改 codegen（props 走 const+v-bind、`w/h` 只来自侧车）；不加 SSE；不加任务阶段状态。

## 两条不变量的位置（必须在文档里先钉死）

| 不变量 | 落在哪 | 本设计是否触碰 |
|---|---|---|
| 几何只来自侧车 | `packages/templates/blocks/src/slot.ts`（`SlotSpec`）、`derive.ts`（`derivePageAssets`） | 不碰。`content` 仍是模型唯一的文字入口 |
| props 走 const+v-bind、`w/h` 只来自侧车 | `packages/codegen/src/page.ts`（`renderPage` 的 props 序列化 + 资产字面量） | 不碰。新区块的 props 照既有流程 |

## 子任务 A：6 个 props-only 区块

### 区块清单与侧车设计

每块都要：`packages/templates/blocks/src/blocks/<name>.slots.ts`、`packages/templates/vue3-base/src/blocks/<Name>.vue`、在 `registry.ts` 注册、SFC 对齐测试（`sfc-props.test.ts` / `sfc-geometry.test.ts` 自动覆盖新块）。

| 组件 | `pageTypes` | `props`（侧车声明） | `slots` |
|---|---|---|---|
| `StatsBand` | landing | `heading`, `subheading`, `stats: '{ label, value, suffix? }[]'` | `[]` |
| `LogoStrip` | landing | `heading`, `logos: '{ name, to }[]'` | `[]` |
| `PricingCard` | landing | `heading`, `subheading`, `plans: '{ name, price, period?, tagline?, features: string[], ctaLabel?, featured? }[]'`, `note?` | `[]` |
| `TestimonialRow` | landing | `heading`, `testimonials: '{ quote, author, role? }[]'` | `[]` |
| `FAQAccordion` | landing, form | `heading`, `subheading?`, `faqs: '{ question, answer }[]'` | `[]` |
| `AuthPanel` | auth | `mode: 'sign-in' | 'sign-up'`, `heading`, `subheading?`, `fields: '{ label, type, placeholder }[]'`, `submitLabel`, `altActionLabel?`, `note?` | `[]` |

要点：

- **props-only 意味着 `slots: []`**，完全复用既有 props 渲染路径，不给几何派生增加任何新东西。
- **props 名与底座 SFC 的 `defineProps<{…}>()` 一字不差**——`sfc-props.test.ts` 会遍历 `BLOCK_REGISTRY` 自动对齐校验，任何一方漏了都会红。这是「模型填的文案不落空」的防线。
- **数组对象 props**（如 `stats`、`plans`、`testimonials`、`faqs`）走侧车的「shape note」（如 `'{ label, value, suffix? }[]'`）进入 drafter 的 prompt。侧车只声明形状，不硬编码值——值由模型在 `content` 里给。

### 底座 SFC 的共同模式

- 复用模板既有 tokens（`--color-primary/secondary/accent/background/surface/foreground/muted`、`--radius`、`--space-unit`、`--font-heading/body`），**块内不许硬编码颜色**——这样改 `theme` 一处传播。
- 响应式：桌面网格，窄屏单列。参考 `HeroSplit.vue` / `NavBarSimple.vue` 的写法（`.container`、`.section`、`.button` 等工具类）。
- **每个块的模板需要一组 props 默认值**（`withDefaults`），保证预览在模型没给值时也能看。
- **不引第三方**：`FAQAccordion` 用原生 `<details>/<summary>`（无 JS 手风琴）；`AuthPanel` 的输入与按钮用现有 `.button` 类 + 原生 `<input>`，不引 antd。

### 注册与组合

- `registry.ts` 的 `definitions` 数组追加 6 项。`blocksForPageType` / `listBlockComponents` / `getBlockDefinition` 自动覆盖。
- drafter 的 system prompt 会自动列出新块及其 props/slot（`openai-spec-drafter.ts:43-44` 遍历注册表），无需改 prompt 文案——但**这正是子任务 C 要动的地方**，见下。

### 测试

- 新增块各自至少 1 个测试：**draft → `deriveSpecInput` 成功且 geometry 全来自侧车**；**props 形状经 `derivePageAssets` 原样进 `Block.props`**。
- SFC 对齐测试（`sfc-props.test.ts`）对 6 个新块全绿。
- 全仓 `pnpm -r test` / `typecheck` 必须绿。

## 子任务 C：内容大纲 + 主题增强（prompt 层）

**不改 schema。** 大纲是模型内部思考，只进 prompt、不进 draft JSON。

### drafter system prompt 改法

当前 `openai-spec-drafter.ts` 的 system prompt 告诉模型「Design Vue 3 pages as a JSON draft」。新增要求，插入到「输出 JSON」之前：

1. **先想**：对每个页面，用几行写下「这个页面想传达什么、目标用户是谁、用哪些区块按什么顺序、每块想达成什么」。这是思考草稿，**不得进入输出 JSON**。
2. **再填**：基于大纲逐块填 `content`（各 slot 的 `prompt`/`alt`）。要求文案具体、有品牌感、不是占位符；`theme` 要选有辨识度的 palette（不默认灰蓝）与有性格的字体配对、`mode`（`light/dark/both`）、`radius`、`spacing` 要跟着页面气质走。
3. **约束提醒**：几何永远来自侧车（`content` 只写字）、props 只能从列出的 keys 里取、slot 名只能从列出的里取。

（不硬编码「必须输出大纲」，因为模型可能不遵守；大纲只是 prompt 里的引导，输出形状仍由 `ProjectDraftSchema` 兜底。）

### 风险与对策

- **模型把大纲写进 JSON** → schema 会静默剥掉未知 key（`z.object` 默认 `strip`），不会让任务失败；但会浪费 token。对策：prompt 里明确「大纲只在你内部、不要输出」。
- **模型借大纲偷偷写几何** → 几何字段（`aspectRatio`/`renderSize`/`transparent`/`composition`）根本不在 draft schema 里，模型写了也会被剥。`derivePageAssets` 是唯一几何入口，不变量不受影响。
- **prompt 变长 → 单次调用变慢/变贵** → 量级是几十 token 的差异，可接受。

### 测试

- provider 的 drafter 测试（`openai-spec-drafter.test.ts`）断言：发送的请求体含「内容大纲」引导句；仍只含 `stream:false` 请求（不引入流式）。
- `deriveSpecInput` 测试补一条：**draft 里带未知 key（如 `outline`）能被剥掉、不影响派生成功**——钉死「大纲不落 JSON」的兜底行为。

## 数据流（变化点）

```
模型（现在：先想大纲，再逐块填 content/theme）
  │ draft 仍只含 meta/theme/styleBible/pages[].blocks[].{component,props,content}
  ▼
deriveSpecInput（不变：shape 校验 → 逐页 derivePageAssets → merge）
  ▼
spec → codegen 渲染新区块的 props（const+v-bind）→ 无资产槽 → 无图 → 直接 vite build
```

新区块 **props-only = 无资产槽**，所以 building 阶段**不发任何图片请求**、不增加出图成本；`maxAssets` 成本闸对它们不产生新约束。

## 测试分布（预计新增）

| 包 | 新增 |
|---|---|
| `packages/templates/blocks` | 6 个块的 derive/draft 测试 + 1 条未知 key 剥离测试 |
| `packages/providers` | 1 条 drafter prompt 含大纲引导句 |
| `packages/codegen` | 可选：1 条新块 props 渲染快照 |
| `web` | 不新增（specTree 自动展示新区块） |

## 交付顺序

1. 子任务 A：6 个侧车 + 6 个底座 SFC + 注册 + 6 个块的 derive/draft 测试 + 对齐测试全绿
2. 子任务 C：drafter prompt 加「内容大纲」引导 + 主题增强要求 + 2 条 provider/derive 测试
3. 全仓回归 + 真任务端到端手验（出一个包含新块的页面，确认预览与导出正常）

## 待确认

- 6 个区块的具体 props 形状是否符合你的预期？（尤其 `AuthPanel` 的 `mode` 枚举与 `fields` 结构）
- `FAQAccordion` 用原生 `<details>/<summary>` 无 JS 手风琴，可接受吗？（不引 antd，保持模板零依赖）
- 子任务 C 的大纲引导句文案你满意吗？（上面「drafter system prompt 改法」第 1 条）

确认后我把 spec 定稿并提交，然后进入实施计划。
