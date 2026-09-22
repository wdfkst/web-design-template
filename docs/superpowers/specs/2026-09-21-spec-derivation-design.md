# draft 阶段改为派生：模型只选块、只填主体文字

## 背景

`draft` 阶段是本平台唯一没真跑通过的一环。2026-09-21 首次带真 key 端到端，**4/4 任务全部 failed 在 drafting**。

两层根因，第二层才是关键。

**表层：prompt 从不描述 spec 的 JSON 形状。** `packages/providers/src/openai-spec-drafter.ts:41-60` 只讲区块目录与 slot 规则；顶层四个键、`theme.colorTokens` 七键、`theme.mode/radius/spacing`、`styleBible` 七枚举、`pages[].pageType` 六值、`assets[].purpose` 八值 / `composition` 四值 / `transparent` 必填 / `renderSize` 比例约束，一个字都没有。模型只能猜，三次重试收敛不了。实测报错全是猜错枚举，例：`theme.mode: Invalid option: expected one of "light"|"dark"|"both"`、`assets[0].transparent: expected boolean, received undefined`。

**深层：生产链路让模型手写几何，绕过了仓库自己的派生契约。** `packages/templates/blocks/src/derive.ts:53` 的 `derivePageAssets()` 自述 *the zero-mismatch path*：调用方（含 LLM）只能给 prompt/alt，几何逐字段从侧车抄，asset id 由位置派生。但它**只在测试 fixture 里被调用过**；真实链路让模型直接产出完整 `assets[]`，再由 `packages/codegen/src/page.ts:56` 逐字段比对侧车、对不上就抛——那句注释的原话是 *"that would mean the derivation contract was bypassed somewhere upstream"*，它正是为抓这个而写的。

于是单测全绿而全链全红：连测试 fixture 都写着 "Geometry comes from the sidecars via derivePageAssets, never hand-written"（`server/src/__tests__/fixture.ts:32`）。

本设计把生产链路改回派生路径：**模型只做两件它擅长的事——选块、写主体文字；几何与 id 全部由代码派生。**

## 范围

**做**：新增 draft 形状与「draft → spec」的派生函数；改 drafter 的 prompt；改 server 的 draft 闸门；`derivePageAssets` 的未知组件错误文本补上合法组件清单（见「附带的小改动 1」）；blocks 侧车为每个块声明 props，并加 SFC 对齐测试（见「附带的小改动 2」）；改测试 fixture 与两个 provider 测试。

**不做**：
- 不删 `parseProjectSpecInput` 这道闸（理由见第 2 段）。
- 不改 `SpecDrafter` 接口签名，因此不动 providers 与 server 里那两份刻意重复的声明。
- 不动 `derivePageAssets` 的契约本身（几何只来自侧车这条不变量不变），也不动 codegen 的侧车比对。
- 不动 `maxAssets` 图像成本闸的位置与语义。
- 「任务进度实时可见」是另一件事，另开一轮，不在本设计里。

## 第 1 段：draft 形状与它住在哪个包

### 归属

新增 `packages/templates/blocks/src/draft.ts`，并在 `index.ts` 一并导出。

放这个包而不是 `packages/spec`：`derivePageAssets` 住在这里，而 **spec 不能反向依赖 blocks**（blocks 依赖 spec，反向成环）。draft 形状与派生函数必须与 `derivePageAssets` 同住；放进 spec 包会把整个区块注册表拖进 spec。

### 形状

```ts
export const DraftBlockSchema = z.object({
  component: BlockSchema.shape.component,   // PascalCase，同 spec
  props: BlockSchema.shape.props,           // 复用，已带 default({})
  content: z.record(z.string(), SlotContentSchema).optional(),
})

export const DraftPageSchema = z.object({
  route: PageSchema.shape.route,
  title: PageSchema.shape.title,
  pageType: PageTypeSchema,
  blocks: z.array(DraftBlockSchema).min(1),
})

export const ProjectDraftSchema = z.object({
  meta: MetaSchema,
  theme: ThemeSchema,
  styleBible: StyleBibleSchema,
  pages: z.array(DraftPageSchema).min(1),
})
```

要点：

- **全部复用 spec 的 schema 片段**（`MetaSchema`/`ThemeSchema`/`StyleBibleSchema`/`PageTypeSchema`/`BlockSchema`/`PageSchema`/`SlotContentSchema`），不重抄一遍。draft 与 spec 的真实差异只有两处：块上带 `content`（主体文字）而不是 `assetBindings`（几何 + id），顶层没有 `assets[]`。
- `content` 的键是**侧车声明的 slot 名**，值是 `SlotContentSchema`（`packages/templates/blocks/src/slot.ts:36`：prompt 3-600 字、alt 1-200 字，两者都可省）。长度上限在闸 1 就把住，反馈带路径。
- `content` 整个可省：缺的 slot 走侧车 `defaultPrompt`/`defaultAlt`（`derive.ts:92-93` 已经这么写）。slotless 块（NavBarSimple / FooterSimple）不带 `content` 也合法。
- `z.object` 默认剥掉未知键，所以模型顺手多写 `id`/`renderSize`/`assetBindings` **不报错**，静默丢弃（取舍见「我擅自定的」）。

## 第 2 段：数据流与两道闸

同文件导出唯一把 draft 变成 spec 的函数：

```ts
export type DeriveSpecResult =
  | { ok: true; value: ProjectSpecInput }
  | { ok: false; feedback: string }

export function deriveSpecInput(draft: unknown): DeriveSpecResult
```

内部三步：

1. `ProjectDraftSchema.safeParse(draft)`；失败用 `formatIssues`（`packages/spec/src/parse.ts:38`）转成路径前缀文本。
2. 成功则逐页 `derivePageAssets(page.route, page.blocks.map(toSelection))`；`BlockDerivationError` 的 message 直接当 feedback（`derive.ts:71` 已把该块声明的合法 slot 名列进错误文本，正是为重试可读而写）。
3. `mergeDerivedAssets(parts)`（跨页 id 冲突在此被拒），组装 `{ meta, theme, styleBible, pages: 派生出的 blocks, assets }`。

`pages[].blocks` 用派生结果（带 `assetBindings`）而非 draft 里的块——这是几何唯一的入口。

### server 侧接线（`server/src/spec-source.ts`）

重试循环、`maxAttempts`、`ServerError(422, feedback)` 全部不动，只把循环体中间换成两道闸：

```ts
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
```

**闸 2 不能删**：

- `derivePageAssets` 完全不管 route 唯一性（它只看块与 slot），而 `checkReferentialIntegrity`（`packages/spec/src/project-spec.ts:37-42`）管。两条 route 相同是模型很容易犯的错。
- 派生结果虽然由构造保证自洽（绑定指向自己发出的 asset、`renderSize` 与 `aspectRatio` 同源），闸 2 让它继续是「spec 的唯一大门」：派生层将来任何改动都不会让 spec 校验静默失效。

`SpecDrafter` 仍是 `draft(): Promise<unknown>`，所以 providers 与 server 那两份重复声明都不动。

## 第 3 段：prompt 与连带影响

### prompt 必须写形状（表层根因的正面修法）

`systemPrompt()`（`openai-spec-drafter.ts:41`）补上：

- draft 的完整 JSON 形状：顶层 `meta/theme/styleBible/pages`；`pages[].{route,title,pageType,blocks}`；`blocks[].{component,props,content}`；`content` 的键是目录里列出的 slot 名，值是 `{prompt, alt}`。
- 仍然要模型写的枚举，逐个列全值：`theme.mode`(3) / `radius`(5) / `spacing`(3)、`styleBible.artStyle`(7) / `lineWeight`(4) / `shading`(4) / `perspective`(4) / `backgroundTreatment`(4)、`pageType`(6)。颜色是 hex；`palette` 2-8 个；`seed` 必须给一个非负整数。
- rules 去掉「每个 asset 要写 id / purpose / aspectRatio / renderSize / transparent / composition」这类要求，改成一句明确的：**几何不是你的活**。区块声明的全部 slot 都会被自动配图，你只写主体文字，不要写 id、不要写尺寸、不要写 `assetBindings`。既有测试 `tells the model geometry comes from the sidecar, not from it` 正好为此保留——它断言 prompt 里出现 `renderSize` 与 `aspectRatio` 两个词，所以规则句里这两个词要留着（作为「不是你的活」的宾语）。
- 新增一条：**页数与块数保持克制**（1-3 页、每页 2-5 块）。

### catalogue：保留 purpose/aspectRatio，并加上 props

`renderBlockCatalogue()`（`:33-40`）现在的 `slot 名 (purpose, aspectRatio)` 写法保留：这两个字段模型不再输出，但它们告诉模型这个洞是干嘛的、大致什么形状——主体文字的质量靠它。不简化成「只列 slot 名」。另按「附带的小改动 2」在同一个目录行里渲染 `props: 名 (形状)`。

### 两个 provider 测试要改写

`packages/providers/src/__tests__/openai-spec-drafter.test.ts` 现有两个 RED 测试是我按**已被否掉的**「只补 prompt 文档」方案写的（红灯原因：42 个枚举值、36 个键名缺失），走 D 后按 draft 形状改写：

- `schemaEnumValues()` 只留模型仍写的枚举：mode / radius / spacing / artStyle / lineWeight / shading / perspective / backgroundTreatment / pageType。**去掉** `AssetPurposeSchema.options`、`AssetInputSchema.shape.composition.options`、`ASPECT_RATIOS`。
- 键名清单加 `content`；去掉 `assets` / `id` / `purpose` / `aspectRatio` / `renderSize` / `w` / `h` / `transparent` / `composition`。

「枚举全列」「键名全覆盖」这两条断言本身保留：表层根因就是 prompt 没写形状，测试要继续钉住它。

## 附带的小改动 1：未知组件的错误文本补上合法清单

`derivePageAssets` 遇到未知组件时抛的是 `unknown block component "HeroSplit2" on route "/"`（`derive.ts:62`），**不含合法组件清单**；而同一个函数里未知 slot 的错误是带清单的（`derive.ts:71`，还带了一句「声明了哪些」）。这个不对称在本设计下会被放大：模型选块错误是新链路里最可能的失败之一，feedback 是要回喂给模型的原文。

改法：把 `listBlockComponents()`（`registry.ts:29`，同包，已按名字排序）拼进那条 message，与 slot 错误的写法对齐。**已获用户点头**，改动约两行。

## 附带的小改动 2：侧车声明 props 清单（写计划时发现，用户已选定）

**问题**：`renderBlockCatalogue()` 只列 slot，从不告诉模型每个组件收什么 props。真值在 SFC 的 `defineProps` 里：HeroSplit 是 `headline/subhead/primaryCta/secondaryCta`，CtaBanner 是 `headline/body/ctaLabel`，NavBarSimple 是 `brand/links/ctaLabel`……而 `BlockSchema.props` 是 `z.record(z.string(), z.unknown())`，**键名写错不报错**，只是预览里文案空着。它不影响「跑到 ready」，但直接影响用户打开预览看到的东西——本轮之后必然要修，所以并进来。

**做法**：

- `BlockDefinition`（`slot.ts:26`）加一个字段：

  ```ts
  /**
   * Props the LLM may set, as `name -> shape note`. `assets` is deliberately
   * absent: the code generator injects it from `assetBindings`.
   */
  props: Readonly<Record<string, string>>
  ```

  用 record 而不是字符串数组：`links`（`{label, to}[]`）与 `features`（`{title, body}[]`）是结构化 props，只给名字等于没给——模型会编出 `undefined` 的导航项。形状注记是自由文本，测试只钉名字（见下）。

- 七个侧车各加一行 `props`，值逐字抄自 SFC 的 `defineProps`（`packages/templates/vue3-base/src/blocks/*.vue`），**不含 `assets`**。

- `renderBlockCatalogue()` 改成从侧车渲染：`- HeroSplit [pages: landing] props: headline (string), … | slots: illustration (hero-illustration, 4:3)`。props 与 slots 同一行（既有测试 `lists the legal slot names for each block` 断言 `/HeroSplit[^\n]*illustration/`，同一行才继续成立）。

- **漂移守卫**：新增 `packages/templates/blocks/src/__tests__/sfc-props.test.ts`，照 `sfc-geometry.test.ts:20` 的既有做法读 `vue3-base` 的 SFC 文本，从 `defineProps<{ … }>()` 里抓 prop 名，断言「侧车键集合 == SFC prop 名集合（减掉 `assets`）」。没有它，改组件同样会静默漂移——这正是本仓库刚吃过的同类亏。

**注意**：侧车住在 blocks 包，SFC 住在 `vue3-base`，跨包读文件已有先例（`sfc-geometry.test.ts:7`），沿用同一路径写法。

## 固有代价

`derivePageAssets` 无条件绑定块声明的全部 slot（`derive.ts:85`），所以选中 FeatureTriad 就是 3 张图，hero-split 1 张，nav/footer 各 0 张。**图像成本随块数线性上涨**，而 `maxAssets: 24` 这道闸在 build 阶段才拦，任务会走到一半才失败。

这是设计上接受的：宁可多出几张图，也不要模型自己挑图导致的几何错配。代价记在这里，不在这一轮修。反向的收益是对称的：draft 变短（不再枚举资产、起 id、抄几何），token 与失败面都减小。

## 已知边界

asset id 由 `toKebab(route)` + 块序号 + 组件名 + slot 名派生（`derive.ts:43-46`），**没有页序号这一维**。所以 `/a/b` 与 `/a-b` 两页同位置同组件的 slot 会撞出同一个 id，被 `mergeDerivedAssets` 拒掉，feedback 是 `duplicate derived asset id "a-b-0-herosplit-illustration"`——能收敛（模型改名或删页），但没说清为什么。**不修**：改 id 方案会连带改生成代码里的引用与资源文件名，收益不抵风险。

## 我擅自定的三点（可否决）

1. **未知键剥掉而非报错**：`z.object` 默认 strip。模型多写 `assetBindings` 不报错。选它的理由：旧形状在模型先验里权重很高，为它触发一次重试不如直接忽略。
2. **catalogue 保留 purpose/aspectRatio**：见上。
3. **`content` 整个可省**，缺的 slot 走侧车默认值：让模型在「这个洞不值得专门描述」时能省略，而不是逼它编一句。

（原第四条「未知组件错误文本补合法清单」已获用户点头，见「附带的小改动」。）

## 测试改动面

- **新增** `packages/templates/blocks/src/__tests__/draft.test.ts`：合法 draft 派生出 spec；未知组件 / 未知 slot / 重复 route 各自的 feedback 内容；`content` 可省时走侧车默认值。
- **改** `packages/templates/blocks/src/__tests__/derive.test.ts`：`rejects an unknown component`（:79）与 `names the declared slots in the error to help the retry prompt`（:94）并列补一条「错误文本里点名全部合法组件」。
- **新增** `packages/templates/blocks/src/__tests__/sfc-props.test.ts`（见「附带的小改动 2」）：侧车 props 键集合与 SFC `defineProps` 名集合对齐，且永不含 `assets`。
- **改** `packages/templates/blocks/src/slot.ts` 的 `BlockDefinition` 加 `props` 字段，七个 `*.slots.ts` 各加一行 `props`（`registry.test.ts` 全走遍历，不受影响；全仓只有这七个 `BlockDefinition` 字面量）。
- **改写** providers 的两个 RED 测试（见第 3 段）。
- **`server/src/__tests__/fixture.ts`**：`landingSpecInput()` 改名 `landingDraft()`，返回 draft（块上写 `content`，顶层无 `assets[]`），不再 import `derivePageAssets`。
- **`server/src/__tests__/spec-source.test.ts`**：前三个测试只换 fixture；第四个「rejects a draft whose geometry contradicts its aspect ratio」**作废**（模型已无法提交几何），改成两条：`content` 里出现块未声明的 slot → 422 且 feedback 含合法 slot 名；两页同 route → 422 且 feedback 含 `duplicate route`。
- **`server/src/__tests__/app.test.ts` / `spec-view.test.ts`**：fixture 改名；`spec-view.test.ts:8` 改成先 `deriveSpecInput(landingDraft())` 再过 schema。
- **不动** `packages/{codegen,build,imagegen}/src/__tests__/fixture.ts`：它们直接调 `derivePageAssets` 造 spec，测的是 codegen/build 对 spec 的处理，与 draft 阶段无关。

## 验证

1. 全仓测试绿。当前实测基线：36 个文件 / 333 例，其中 **331 绿 + 2 红**，两红就是第 3 段那两个待改写的 provider 测试（`pnpm vitest run`，2026-09-21 实测）。本轮结束时 333 全绿，且 `draft.test.ts` 与改写后的两个测试是新增/替换的。
2. **一次真端到端跑到 `ready` 并看到预览**——这是本轮唯一验收终点，要花中转站调用：按配置页手验环境那份记录起 server，`POST /tasks` 提交一句描述，每 5s 采 `GET /tasks/:id` 到终态，再打开 `/preview/:id/` 确认图出来了。
3. 若 drafting 仍失败：读 `error.detail`，它现在是闸 1 / 闸 2 的原文（路径前缀），直接就是下一轮改 prompt 的输入。
