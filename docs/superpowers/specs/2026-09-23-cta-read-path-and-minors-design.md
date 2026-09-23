# `to` 的读路径闸 + 三处 Minor — 设计文档

日期：2026-09-23
状态：定稿（用户已逐段确认；范围由用户在三个选项中选定）

## 目标

上一份 plan（多页完整项目）的全支评审给出 **Ready to merge — Yes**，同时留下 **1 个 Important + 4 个 Minor**。这份 spec 处理其中**用户已圈定**的部分：

1. **Important**：`to` 的不变量只在**写路径**上被强制，读路径上没有。
2. **三处可动手的 Minor**：`app.ts` 发射的死 const、`SIDEBAR_PAGE_TYPES` 与页型枚举没有编译期耦合、`CtaBanner.vue` 上那个失去目标的 `id="cta"`。
3. **一处只写文档的 Minor**：两个 auth 页会让第二个不可达 —— 记录为已接受的取舍。

**不做**：不给「auth 页最多一个」加 draft 闸；不动 `draft.ts` 的任何下限；不动 drafter prompt；不动 `packages/spec` 的 schema；不动图片生成与构建沙箱。第四条 Minor（auth 孤儿页）**只写文档，不改代码**。

## 背景：那个 Important 到底是什么

`assertCtaTargets`（`packages/templates/blocks/src/derive.ts:169`）的约定是**完全的**：

> 任何名字叫 `to` 的 prop 都是本项目的内部目的地，而目的地只能指向某个页面声明过的路由。

它只在**一个地方**被调用 —— `packages/templates/blocks/src/draft.ts:94`，在 `deriveSpecInput` 里，也就是 spec 的**写路径**（`ProjectSpecInput` → `ProjectSpec`）。

而 `renderPage`（`packages/codegen/src/page.ts:79`）在非 draft 路径上**已经**挡了一条规则：

```ts
// page.ts:92-99
// A spec does not have to come from the draft path — a template preset or a
// hand-edited spec reaches this function directly. …
if (getBlockDefinition(block.component)?.layoutOnly === true) {
  throw new CodegenError(…)
}
```

它挡 `layoutOnly`，**却不挡 `to`** —— 尽管它手里握着完整的 `spec`（因此握着全部路由）。

后果：一份手工编写或手工改过的 spec（`props` 在 schema 里是 `z.unknown`，所以一个错的 `to` 能一路通过 `ProjectSpecInputSchema`）会渲染出一个**死的 `<router-link>`**，运行时表现为**空白页、零报错**。这正是这份 plan 系列存在的理由 —— 那个「点其它页面没内容」的原始症状，从侧门走回来了。

**关键的不对称**：几何不变量**在两条路径上都在**（`derivePageAssets` 于派生期、`renderBlockAssets` 于 `page.ts:56` 于渲染期，两者都比对侧车）。`to` 这条只有一条腿。

## 已定决策

1. 闸加在 **`renderPage`**，紧挨现有的 `layoutOnly` 检查 —— 同一个理由、同一个错误类型、同一份读者预期。
2. **derive 路径的闸保留不搬。** 这不是搬家，是**有意为之的双保险**：它的错误原文是 `spec-source.ts` 重试时喂回给模型的独立 user turn，搬走等于拆掉反馈链。
3. `renderApp` 的导航与 CTA **不加**闸 —— 它们的 `to` 由 `spec.pages` 直接映射而来，构造上不可能指向未声明的路由。
4. `SIDEBAR_PAGE_TYPES` 换成 **`Record<PageType, ShellName>`**，而不是评审建议的 `ReadonlyArray<PageType>`（理由见第 3 节）。
5. `app.ts` 的死 const 是**代码去对齐一句已经写下的注释**，不是「顺手改」（见第 2 节）。

## 第 1 节：闸加在读路径上

### 位置与顺序

放在 `renderPage` 里，**排在逐块循环之后**：

```ts
const routes = new Set(spec.pages.map((page) => page.route))
// …原有的逐块循环（内含 layoutOnly 检查）…
try {
  assertCtaTargets(page.route, page.blocks, routes)
} catch (error) {
  if (error instanceof BlockDerivationError) throw new CodegenError(error.message)
  throw error
}
```

**为什么是「循环之后」而不是「循环之内」或「之前」**：`NavBarSimple` 自己就带 `to`（`links[].to`、`cta.to`）。一个被误放进 `pages[].blocks` 的布局件会**同时**违反两条规则，而更准确的那条是「你放了一个 shell 已经渲染过的布局件」。把它排在后面，报出来的就是那条。

**为什么整页调用一次而不是逐块**：`assertCtaTargets` 的签名本来就收一个 selection 数组，一次调用天然覆盖整页；逐块调只会把同一份路由集算 N 遍。

### 错误类型

`assertCtaTargets` 抛的是 `BlockDerivationError`（`derive.ts:20`，经 `packages/templates/blocks/src/index.ts` 的 `export * from './derive.js'` 导出）。`renderPage` 的其它违约一律抛 `CodegenError`（`page.ts:32`、`:41`、`:50`、`:57`），并且 `CodegenError` 的注释明说这**就是**「spec 自相矛盾」这一类。所以捕获后按原消息重抛为 `CodegenError` —— 消息本身已经是好消息（带 route、带 prop 路径、带违规值、带已声明路由清单），不需要改写。

依赖是合法的：`packages/codegen/package.json` **已经**依赖 `@vudt/blocks`（`page.ts:2` 本来就在 `import { getBlockDefinition, getSlot }`），不引入新的依赖边。

### 覆盖面

`renderPage` 是公开 API（`packages/codegen/src/index.ts` 导出 `./page.js`），生产链 `writeProject`（`write.ts:55`）→ `generateProject`（`project.ts:34`）→ `renderPage`（`project.ts:38`）走同一条，所以两条路一起被盖住。**不需要**在 `generateProject` 里再放一道。

## 第 2 节：`app.ts` 发射的死 const

`packages/codegen/src/app.ts:24-27`：

```ts
if (shell === 'AppShell') {
  consts.push(`const cta = ${cta === undefined ? 'undefined' : linkLiteral(cta)}`)
  consts.push(`const note = ${JSON.stringify(note)}`)
  attrs.push(`  :cta="cta"`, `  :note="note"`)
}
```

无 auth 页时这里会发射 `const cta = undefined` 加 `:cta="cta"`。改成：

```ts
if (shell === 'AppShell') {
  if (cta !== undefined) {
    consts.push(`const cta = ${linkLiteral(cta)}`)
    attrs.push(`  :cta="cta"`)
  }
  consts.push(`const note = ${JSON.stringify(note)}`)
  attrs.push(`  :note="note"`)
}
```

**这不是「顺手改」，是代码去对齐一句已经写下的注释。** 两处已经把意图写死了：

- `layouts.ts:15-16`：`/** Top-bar call to action; absent when the project declares no auth page. */`
- `layouts.test.ts:107-108`：`// `cta` is absent rather than undefined so the rendered App.vue can tell the two cases apart without emitting a dead `const cta = undefined`.`

只有 `app.ts` 没照做。安全性：`AppShell` 的 `cta` 是可选 prop（`AppShell.vue` 的 `withDefaults` 没有给它默认值），省掉 `:cta` 与显式传 `undefined` 在运行时等价。

`planLayout` 的 `cta?: NavLink`（可选属性）与 `LayoutPlan` 的注释保持不动 —— 它们是这条意图的源头。

## 第 3 节：`SIDEBAR_PAGE_TYPES` 的编译期耦合

现状（`layouts.ts:25`、`:30`）：

```ts
const SIDEBAR_PAGE_TYPES: readonly string[] = ['dashboard', 'settings', 'list-detail']
export function pickShell(spec: ProjectSpec): ShellName {
  return spec.pages.some((page) => SIDEBAR_PAGE_TYPES.includes(page.pageType))
    ? 'SidebarShell' : 'AppShell'
}
```

改成：

```ts
const SHELL_BY_PAGE_TYPE: Record<PageType, ShellName> = {
  landing: 'AppShell',
  auth: 'AppShell',
  form: 'AppShell',
  dashboard: 'SidebarShell',
  settings: 'SidebarShell',
  'list-detail': 'SidebarShell',
}
export function pickShell(spec: ProjectSpec): ShellName {
  return spec.pages.some((page) => SHELL_BY_PAGE_TYPE[page.pageType] === 'SidebarShell')
    ? 'SidebarShell' : 'AppShell'
}
```

### 为什么不是评审建议的 `ReadonlyArray<PageType>`

评审给的是「`ReadonlyArray<PageType>` **或者**加一个子集测试」。但前者**兑现不了这条发现想要的东西**：`readonly PageType[]` 只约束数组元素的类型，**不约束穷尽性** —— 往 `PageTypeSchema`（`packages/spec/src/page.ts:3`）加第 7 个页型，它照样静默落进 AppShell，一个编译错误都不会有。发现的原话是「latent wrong-shell hazard」，而 `Record<PageType, ShellName>` 才是把它变成编译期错误的那一版：新页型不进映射就编译不过。

它同时把一条**现在隐式成立**的默认变成明写的决定：`PageTypeSchema` 的六个值是 `landing`、`dashboard`、`form`、`list-detail`、`auth`、`settings`，而 `SIDEBAR_PAGE_TYPES` 只有三个 —— 也就是说 **`form` 今天就在靠 `includes` 落空而默默走 AppShell**，没有任何一行代码说过它应该是这样。

改动是封闭的：`SIDEBAR_PAGE_TYPES` 是私有 const，全仓只有 `layouts.ts:30` 一处引用，没有测试 import 它。`PageType` 从 `@vudt/spec` 导入即可，`ShellName` 是本文件已有的类型。

## 第 4 节：`CtaBanner.vue` 上失去目标的锚点 id

`packages/templates/vue3-base/src/blocks/CtaBanner.vue:21` 仍是 `<section id="cta" class="section cta">`。`id="cta"` 是多页 plan 拆掉的那套硬编码锚点导航的**最后一件残留**：当时 `NavBarSimple`、`HeroSplit`、`HeroCentered`、`PricingCard` 都以 `href="#cta"` 指向它。

已核实：**全仓没有任何地方真的引用 `#cta`**，也没有任何测试断言这个 id。唯一还提到它的是 `packages/templates/blocks/src/__tests__/sfc-navigation.test.ts:13` 的一条注释，那条注释是在解释「这个设计要杀掉的症状」，不依赖 id 存在。

去掉 id，保留其余。

**注意爆炸半径**：这是**模板 SFC**，改它等于改每个生成站点的产物。所以验收里必须有「底座自身 `vue-tsc` 通过」这一条（该文件在 `packages/templates/vue3-base/src/blocks/`，tsconfig 的 `include` 覆盖到）。

## 第 5 节：两个 auth 页的取舍（只写文档，不改代码）

`navLinks`（`layouts.ts:40`）过滤掉**所有** auth 页，`topBarCta`（`layouts.ts:51`）只取**第一个** auth 页。所以一份含两个 auth 页的 spec，**第二个 auth 页没有任何入口**。

**这是已接受的取舍，不是待修的缺陷。** 理由：

- 让它可达的两种做法都更糟 —— 把 auth 页放回导航条目，与「菜单中间的 Sign in 读起来像错误」这条明写的设计意图直接冲突（`layouts.ts:36-39`）；为第二个 auth 页再开一个 CTA 位置，则是为一个模型几乎不会产出的形状增加接口。
- draft 路径已经有一道下限闸和改写过的 prompt 在把形状往少了收。

**记录在此，是为了让这个取舍是「决定」而不是「事故」。** 若日后想把它钉住，加一条 pin 测试（断言「只为第一个 auth 页保留 CTA」）即可；本 plan 不加以免超出用户圈定的范围。

## 数据流（变化点）

```
ProjectSpec ──┬─→ renderPage ──→ [新] assertCtaTargets ──→ CodegenError
              │      └─→ [原有] layoutOnly 检查
              ├─→ renderApp ──→ planLayout
              │                   ├─→ pickShell ──→ [改] SHELL_BY_PAGE_TYPE
              │                   └─→ [改] AppShell 无 cta 时不再发射 const
              └─→ renderRouter / renderTokensCss（不动）

派生写路径（不动）：
ProjectSpecInput ──→ deriveSpecInput ──→ assertCtaTargets（保留，错误原文喂回模型重试）
```

## 测试改动面

### 新增（都放进已有的 describe 块，不新开文件）

| 文件 | 用例 | 要点 |
|---|---|---|
| `packages/codegen/src/__tests__/page.test.ts` | 落在已有的 `describe('renderPage contract violations')`（`:97` 起，已有另外四种 `CodegenError` 用例）：「throws when a block's `to` names no declared route」 | 篡改 `landingSpec()` 某个 `HeroSplit` 的 `props.primaryCta.to` 为 `'/nope'` → `toThrow(CodegenError)` 且消息匹配 `/not a declared route/` |
| `packages/codegen/src/__tests__/app.test.ts` | 「emits no cta const at all when an AppShell project has no auth page」 | 用 `withPages(landingSpec(), [page('/', 'Home', 'landing')])` → `not.toContain('const cta')`、`not.toContain(':cta=')`，且仍含 `const note` |
| `packages/codegen/src/__tests__/layouts.test.ts` | 「sends a form page to the AppShell」 | pin 第 3 节里那条今天还隐式的默认 |

**第一条用例的构造纪律（这是重点）**：篡改后的页面必须**只有新闸一种可能抛错** —— 组件合法、槽位合法、资产合法、`layoutOnly` 不为真。否则它会因为**别的** `CodegenError` 而「蒙对」，而那正是本 plan 系列 21 处缺陷的同一类（断言对了，理由错了）。做法：只改 `to` 的字符串值，别的一个字不动。

照抄文件里已有的形状即可：`page.test.ts:8` 有 `homePage(spec)` 帮手，`:98-116` 那几条违约用例正是 `const spec = landingSpec(); const page = homePage(spec); const broken: ProjectSpec = { ...spec, pages: [{ ...page, blocks: … }] }`。新用例只把 `blocks` 里那个 `HeroSplit` 的 `props.primaryCta.to` 换成 `'/nope'`，其余原样。断言的消息原文是 `` `${route}: ${path} points at "${value}", which is not a declared route (declared: …)` ``（`derive.ts:190-192`），所以匹配 `/not a declared route/`，并可顺带断言它点出了 `'/nope'`。

**先写、先跑、先看它红**（写路径的闸不会替它变绿 —— `landingSpec()` 走的是 `derivePageAssets` + `ProjectSpecInputSchema.parse` + `finalizeSpec`，**从不调用 `assertCtaTargets`**，这也是这个洞在测试里可达的原因）。

### 预期不受影响（已扫过，记录以便复核）

新闸会拒绝**任何**指向未声明路由的 `to`。已逐一核对过现有夹具里的每一个 `to`：

- `packages/codegen/src/__tests__/fixture.ts`：路由集 `{'/', '/pricing', '/signin'}`；夹具里的 `to` 是 `/pricing`、`/pricing`、`/`（`PricingCard.plans[].cta.to`，嵌套在数组里也会被 `collectTargets` 递归找到）—— 全部已声明。
- `packages/build/src/__tests__/fixture.ts`：路由集是 `{'/', '/pricing'}` —— **两页，且没有 auth 页**，不是 codegen 那份的复刻；夹具里的 `to` 是 `/pricing`、`/pricing`、`/` —— 全部已声明。
- `server/src/__tests__/fixture.ts`：路由集 `{'/', '/about', '/pricing'}`；`to` 是 `/pricing` —— 已声明。
- 全仓没有 JSON 预设 spec；「template preset」这条读路径目前**只存在于注释里**，没有实现。

`packages/templates/blocks/src/__tests__/derive.test.ts:145,150` 里那个 `logos: [{ …, to: 'https://acme.com' }]` 的外部 URL **不在影响范围内** —— 那是 blocks 包的测试，直接调 `derivePageAssets`，不经 codegen。它是一条已 park 的旧 Minor，本 plan 不碰。

### 不动

`draft.ts` 的下限与闸、drafter prompt、`packages/spec`、`renderApp` 的导航/CTA 生成、`planLayout` 的 `cta?` 可选语义。

## 我擅自定的点（可否决）

1. **`Record<PageType, ShellName>` 而不是 `ReadonlyArray<PageType>`** —— 与评审的建议有分歧，理由写在第 3 节。若你更想要「贴合评审原文」，改回数组即可，但那条发现想要的编译期耦合就没了。
2. **闸排在逐块循环之后**，而不是最前面。这是为了让「布局件被放进 blocks」报出更准确的那条错。
3. **`form` 显式映射到 AppShell** —— 把今天隐式的默认写下来。
4. **第四条 Minor 不加 pin 测试**，只写文档（按你圈定的范围）。

## 交付顺序

1. `to` 的读路径闸（`page.ts` + `page.test.ts`）
2. codegen 那两处 Minor（`app.ts` + `layouts.ts` + 各自测试）—— 同包、都小，一起走一次评审
3. `CtaBanner.vue` 去 id（vue3-base）
4. 全仓回归，无缺陷就不提交

## 验证

- 全仓 `pnpm -r test` 全绿。
- 全仓 `pnpm -r typecheck` 全绿。
- `packages/templates/vue3-base` 自身 `vue-tsc` 通过（任务 3 的模板 SFC 改动必须过这一关）。
- `packages/spec` 仍是 13 例（这一份 plan 承诺不碰它）。
- 预期不受影响的夹具清单见上，实施时逐项复核。

不要求真任务端到端重跑：闸在 LLM 路径上早已生效，本 plan 没有放松任何东西；但**若任务 3 动过模板 SFC 后底座 `vue-tsc` 有任何异常，必须停下来查清楚再继续。**
