# `to` 的读路径闸 + 三处 Minor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「`to` 只能指向已声明路由」这条约定补到读路径上，并顺手清掉多页 plan 遗留的三处 Minor。

**Architecture:** `assertCtaTargets` 今天只在写路径（`deriveSpecInput`）被调用，`renderPage` 手里有完整 `spec` 却不检查 `to` —— 一份手写 spec 能渲染出死的 `<router-link>`（空白页、零报错）。在 `renderPage` 的逐块循环**之后**补一道同样的检查（双保险，不搬走写路径那道），再把 codegen 那两处 Minor 与 `CtaBanner.vue` 的孤儿 id 清掉。`packages/spec` 零改动。

**Tech Stack:** TypeScript 5.9 / zod 4 / vitest 3 / pnpm workspaces / Vue 3.5 SFC / vue-tsc / Vite

**Spec:** `docs/superpowers/specs/2026-09-23-cta-read-path-and-minors-design.md`

## Global Constraints

以下约束对**每个任务**都成立，逐条抄自 spec：

- **读路径的闸是「有意为之的双保险」，不是搬家。** `assertCtaTargets` 在 `draft.ts:94` 的调用**保留不动** —— 它的错误原文是 `spec-source.ts` 重试时喂回给模型的独立 user turn，搬走等于拆掉反馈链。
- **`packages/spec` 的 schema 零改动。** 本计划承诺 spec 包仍是 2 文件 / 13 例。
- **不动 `draft.ts` 的任何下限与闸、不动 drafter prompt、不动图片生成、不动构建沙箱。**
- **第四条 Minor（两个 auth 页让第二个不可达）只写文档，不加 pin 测试。** 本计划不为它写任何用例。
- **读路径上一切 spec 违约都抛 `CodegenError`。** `assertCtaTargets` 抛的 `BlockDerivationError` 必须在 `renderPage` 边界上被转换为 `CodegenError`（其消息原文已经是好消息，逐字重抛，不改写）。
- **闸只加在 `renderPage`。** `renderApp` 的导航与 CTA 不加闸（它们的 `to` 由 `spec.pages` 直接映射而来，构造上不可能指向未声明的路由）；`generateProject` 也不再加一道。
- **每条实现任务收尾必须全绿。** `pnpm --filter <pkg> test` 与 `pnpm --filter <pkg> typecheck`（本计划基线：**2026-09-23 全仓 41 文件 / 427 例绿；`pnpm -r typecheck` Scope 9 of 10 全清**）。

## 本计划对 spec 的一处修正（执行前先读，别当成笔误）

**Task 1 的失败测试要保留另外两个页面，不照抄 spec 里 `pages: [{ ...page, blocks: … }]` 那个草图。**

spec 第 200 行给的构造是「只留首页、把首页某个 `to` 改成 `'/nope'`」。但那份 spec 自己的构造纪律写着「篡改后的页面必须**只有新闸一种可能抛错**」—— 而只留首页会**同时**把 `'/pricing'` 与 `'/signin'` 从已声明路由集里删掉，于是同页 `CtaBanner.cta.to = '/pricing'` 也成了违规。测试照样会绿（walker 按块序走，块 0 先抛），但它测的就变成了「页面被删了」，而断言 `/"\/nope"/` 想钉住的是「篡改的那个值被报出来了」。

改法：保留原 spec 的三页，**只**改首页 `HeroSplit` 的 `primaryCta.to`。见 Task 1 Step 1 的代码。

---

## File Structure

**改动（按包分组）**

| 文件 | 职责 | 任务 |
|---|---|---|
| `packages/codegen/src/page.ts` | `renderPage` 逐块循环之后补 `assertCtaTargets`，`BlockDerivationError` → `CodegenError` | 1 |
| `packages/codegen/src/__tests__/page.test.ts` | 新用例进已有的 `describe('renderPage contract violations')` | 1 |
| `packages/codegen/src/app.ts` | AppShell 分支：无 `cta` 时不再发射 `const cta = undefined` 与 `:cta="cta"` | 2 |
| `packages/codegen/src/__tests__/app.test.ts` | 新用例：无 auth 页的 AppShell 项目不含任何 cta 常量 | 2 |
| `packages/codegen/src/layouts.ts` | `SIDEBAR_PAGE_TYPES` → `SHELL_BY_PAGE_TYPE: Record<PageType, ShellName>` | 2 |
| `packages/codegen/src/__tests__/layouts.test.ts` | 新用例：pin「`form` 走 AppShell」这条今天还隐式的默认 | 2 |
| `packages/templates/vue3-base/src/blocks/CtaBanner.vue` | 去掉失去目标的 `id="cta"` | 3 |

**不新建文件。** 四个测试用例全部落进已有的 `describe` 块（`page.test.ts:97`、`app.test.ts:18`、`layouts.test.ts:19`）。

**任务边界**：Task 1 与 Task 2 同包但**不同交付物**（一个是读路径的闸，一个是两处 Minor），评审可以各自否决；Task 2 的两处 Minor 同包同性质，按 spec 的交付顺序走**一次**评审。

---

## Task 1: `to` 的读路径闸

**Files:**
- Modify: `packages/codegen/src/page.ts`（import 在第 2 行；新代码插在逐块循环结束的第 128 行之后、`const scriptLines` 之前）
- Test: `packages/codegen/src/__tests__/page.test.ts`（新用例进 `describe('renderPage contract violations')`，第 97 行起，追加在文件末尾第 158 行之后）

**Interfaces:**
- Consumes: `assertCtaTargets(route: string, selections: readonly BlockSelection[], routes: ReadonlySet<string>): void`（`packages/templates/blocks/src/derive.ts:169`）与 `class BlockDerivationError extends Error`（同文件 `:20`）—— 两者都由 `packages/templates/blocks/src/index.ts` 的 `export * from './derive.js'` 导出，因此从 `@vudt/blocks` 直接 import 即可。`BlockSelection` 是 `{ component: string; props?: Record<string, unknown>; content?: Record<string, SlotContent> }`，与 spec 的 `Block`（多一个 `assetBindings`，且 `props` 非可选）结构兼容，传 `page.blocks` 不需要转换。
- Produces: `renderPage(spec: ProjectSpec, page: Page): string` 签名不变；**新增一种失败模式** —— 页内任何名为 `to` 的 prop 指向未声明路由（或为空、或以 `#` 开头）时抛 `CodegenError`，消息即 `BlockDerivationError` 的原文。

- [ ] **Step 1: 写失败测试**

在 `packages/codegen/src/__tests__/page.test.ts` 的 `describe('renderPage contract violations')` 块**末尾**（`'throws on an unknown component'` 那条之后、块闭合的 `})` 之前）追加：

```ts
  it('throws when a block names a route no page declares', () => {
    const spec = landingSpec()
    const page = homePage(spec)
    // Only the `to` string changes. The other two pages stay declared and every
    // component, slot, asset and binding stays legal, so the new gate is the one
    // and only thing in here that can throw.
    const broken: ProjectSpec = {
      ...spec,
      pages: spec.pages.map((candidate) =>
        candidate.route !== '/'
          ? candidate
          : {
              ...candidate,
              blocks: candidate.blocks.map((block, index) =>
                index === 0
                  ? {
                      ...block,
                      props: {
                        ...block.props,
                        primaryCta: { label: 'See pricing', to: '/nope' },
                      },
                    }
                  : block,
              ),
            },
      ),
    }
    expect(() => renderPage(broken, homePage(broken))).toThrow(CodegenError)
    expect(() => renderPage(broken, homePage(broken))).toThrow(/not a declared route/)
    expect(() => renderPage(broken, homePage(broken))).toThrow(/"\/nope"/)
  })
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm --filter @vudt/codegen test page.test.ts`
Expected: **FAIL** —— 1 failed / 12 passed。失败原因是 `expected function to throw an error, but it didn't throw`（今天 `renderPage` 对 `'/nope'` 一声不吭，直接渲染出死的 `<router-link>`）。

**这一步不能跳。** 若它直接绿了，说明闸已经在别处生效、或者测试构造出的不是那份 spec —— 先停下来查清楚。

- [ ] **Step 3: 在 `renderPage` 里加闸**

改 `packages/codegen/src/page.ts` 第 2 行的 import：

```ts
import { assertCtaTargets, BlockDerivationError, getBlockDefinition, getSlot } from '@vudt/blocks'
```

然后在逐块循环的闭合花括号（今天第 128 行）之后、`const scriptLines = [`（今天第 130 行）之前插入：

```ts
  // A spec does not have to come from the draft path here either — a hand-edited
  // spec reaches this function directly, and `props` is `z.unknown` in the schema,
  // so a bad `to` gets this far. It would render a dead <router-link>: a blank
  // page with no error at all, which is the exact symptom this series exists to
  // remove. The draft path keeps its own copy of this check because its error
  // text is fed back to the model as a retry turn.
  const routes = new Set(spec.pages.map((declared) => declared.route))
  try {
    assertCtaTargets(page.route, page.blocks, routes)
  } catch (error) {
    // The message already names the route, the prop path, the offending value and
    // every declared route, so it is re-thrown verbatim under this module's error.
    if (error instanceof BlockDerivationError) throw new CodegenError(error.message)
    throw error
  }
```

**为什么排在循环之后**：`NavBarSimple` 自己就带 `to`（`links[].to`、`cta.to`）。一个被误放进 `pages[].blocks` 的布局件会**同时**违反两条规则，而更准确的那条是「你放了一个 shell 已经渲染过的布局件」—— 循环里的 `layoutOnly` 检查先报它。**为什么整页调一次**：`assertCtaTargets` 的签名本来就收一个 selection 数组，一次调用天然覆盖整页。

- [ ] **Step 4: 跑测试确认全绿**

Run: `pnpm --filter @vudt/codegen test`
Expected: **PASS** —— 6 文件 / **58** 例（基线 57 + 新增 1）。已有的 4 条 contract-violation 用例全部在**循环内**抛错（缺资产、尺寸漂移、未知组件、未声明槽位），根本走不到新闸，因此不受影响。

Run: `pnpm --filter @vudt/codegen typecheck`
Expected: 无输出、exit 0。

再跑一遍**闸的影响面**（新闸会拒绝任何指向未声明路由的 `to`，这三个包的夹具都过一遍）：

Run: `pnpm --filter @vudt/blocks test && pnpm --filter @vudt/build test && pnpm --filter @vudt/server test`
Expected: **PASS** —— blocks 6/93、build 4/25、server 10/111。三个夹具里每一个 `to`（`/pricing`、`/pricing`、`/`、`/pricing`）都指向已声明的路由。**若有包红，先怀疑夹具而不是闸** —— 那说明全仓某处真的存在一个指向未声明路由的 `to`，那是本次要抓的真缺陷，别改闸去迁就它。

- [ ] **Step 5: 提交**

```bash
git add packages/codegen/src/page.ts packages/codegen/src/__tests__/page.test.ts
git commit -m "fix(codegen): enforce the \`to\` convention on the read path too

assertCtaTargets 只在 deriveSpecInput（写路径）被调用。renderPage 手里有完整
spec 与全部路由，却只挡 layoutOnly 不挡 to —— props 在 schema 里是 z.unknown，
所以一份手写 spec 能把 primaryCta.to 写成不存在的路由，渲染出一个死的
<router-link>：空白页、零报错，正是这套设计要杀掉的症状从侧门回来。

闸排在逐块循环之后，让「布局件被误放进 blocks」报出更准确的那条错。写路径
那道保留不搬：它的错误原文是 spec-source.ts 喂回给模型重试的 user turn。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 2: codegen 的两处 Minor（`app.ts` 死 const + `layouts.ts` 编译期耦合）

**Files:**
- Modify: `packages/codegen/src/app.ts:24-27`
- Modify: `packages/codegen/src/layouts.ts:20-33`
- Test: `packages/codegen/src/__tests__/app.test.ts`（新用例进 `describe('renderApp')`）
- Test: `packages/codegen/src/__tests__/layouts.test.ts`（新用例进 `describe('pickShell')`，第 19 行起）

**Interfaces:**
- Consumes: `planLayout(spec): LayoutPlan` 的 `cta?: NavLink` 可选语义（`layouts.ts:11-18`，**保持不动** —— 它是「缺席而非 undefined」这条意图的源头）；`PageType` 与 `ShellName` 两个类型（分别来自 `@vudt/spec` 与 `./layouts.js` 自身）。
- Produces: `renderApp(spec: ProjectSpec): string` 签名不变，但**无 auth 页的 AppShell 项目不再含 `cta` 相关行**；`pickShell(spec: ProjectSpec): ShellName` 签名不变，改由 `SHELL_BY_PAGE_TYPE: Record<PageType, ShellName>` 决定。

- [ ] **Step 1: 写 `app.test.ts` 的失败测试**

在 `packages/codegen/src/__tests__/app.test.ts` 的 `describe('renderApp')` 块内（`'is deterministic…'` 那条之前）追加：

```ts
  // `planLayout` omits the cta key rather than setting it to undefined so this
  // branch can tell the two cases apart; emitting `const cta = undefined` next to
  // `:cta="cta"` hands the shell a dead prop it cannot distinguish from a real one,
  // and defeats exactly that.
  it('emits no cta const at all when an AppShell project has no auth page', () => {
    const spec = withPages(landingSpec(), [page('/', 'Home', 'landing')])
    const sfc = renderApp(spec)

    expect(sfc).toContain(`import AppShell from './layouts/AppShell.vue'`)
    expect(sfc).not.toContain('const cta')
    expect(sfc).not.toContain(':cta=')
    expect(sfc).toContain('const note = ')
  })
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm --filter @vudt/codegen test app.test.ts`
Expected: **FAIL** —— 1 failed / 6 passed，失败在 `expect(sfc).not.toContain('const cta')`：今天无 auth 页时 `app.ts:25` 仍发射 ``const cta = undefined``，`:26-27` 仍绑 `:cta="cta"`。

- [ ] **Step 3: 改 `app.ts`**

把 `packages/codegen/src/app.ts` 的 `if (shell === 'AppShell') { … }` 分支（今天第 24-27 行）替换为：

```ts
  if (shell === 'AppShell') {
    // `planLayout` leaves `cta` absent rather than undefined so the two cases stay
    // distinguishable — binding `:cta` to a dead `undefined` const would throw that
    // distinction away. `cta` is an optional prop on AppShell, so omitting the
    // binding and passing `undefined` are the same thing at runtime.
    if (cta !== undefined) {
      consts.push(`const cta = ${linkLiteral(cta)}`)
      attrs.push(`  :cta="cta"`)
    }
    consts.push(`const note = ${JSON.stringify(note)}`)
    attrs.push(`  :note="note"`)
  } else if (cta !== undefined) {
```

`else if` 分支（侧栏）**一个字不动** —— 它的 `cta` 只有在确实存在时才发射，本来就对。

- [ ] **Step 4: 跑 `app.test.ts` 确认绿**

Run: `pnpm --filter @vudt/codegen test app.test.ts`
Expected: **PASS** —— 7 例。已有的两条断言 `toContain('const cta = { label: "Sign in", to: "/signin" }')`（第 33、70 行）仍然成立：它们用的 spec 都声明了 auth 页。

- [ ] **Step 5: 写 `layouts.test.ts` 的失败测试**

在 `packages/codegen/src/__tests__/layouts.test.ts` 的 `describe('pickShell')` 块内（`for` 循环之后）追加：

```ts
  // `form` has always landed on the AppShell — but only by falling through the
  // `SIDEBAR_PAGE_TYPES.includes()` check. The Record turns that into a written
  // decision; this pins it so a new page type cannot drift to a shell unnoticed.
  it('sends a form page to the AppShell', () => {
    const spec = withPages(landingSpec(), [
      page('/', 'Home', 'landing'),
      page('/contact', 'Contact', 'form'),
    ])
    expect(pickShell(spec)).toBe('AppShell')
  })
```

**注意：这一条是 pin 测试，不是红-绿测试。** 它在改动前后都绿（`SIDEBAR_PAGE_TYPES.includes('form')` 今天就是 `false`）。**Step 6 会看到它绿 —— 那是预期，不是写错了。** 它的价值在于让 Step 7 的重构**不可能**偷偷把 `form` 挪到侧栏，并把一条今天只存在于 to-list 里的隐式默认钉成断言。

- [ ] **Step 6: 跑它，确认它绿**

Run: `pnpm --filter @vudt/codegen test layouts.test.ts`
Expected: **PASS** —— 14 例（13 + 新增 1）。见上：这条用例本来就是绿的。

- [ ] **Step 7: 改 `layouts.ts`**

改 `packages/codegen/src/layouts.ts`：第 1 行的 import 加上 `PageType`：

```ts
import type { PageType, ProjectSpec } from '@vudt/spec'
```

把第 20-33 行（`SIDEBAR_PAGE_TYPES` 的注释与常量 + `pickShell`）整体替换为：

```ts
/**
 * The shell each page type wants. Derived rather than declared as `spec.layout`,
 * because adding that field would mean touching the spec schema for a preference
 * the page types already express.
 *
 * Written as a complete `Record` rather than a list of sidebar types on purpose:
 * a `readonly PageType[]` would not constrain exhaustiveness, so a seventh page
 * type added to `PageTypeSchema` would silently keep falling through to AppShell.
 * This form turns that into a compile error.
 */
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
    ? 'SidebarShell'
    : 'AppShell'
}
```

- [ ] **Step 8: 跑测试确认全绿**

Run: `pnpm --filter @vudt/codegen test`
Expected: **PASS** —— 6 文件 / **60** 例（Task 1 后的 58 + 本次 2）。

Run: `pnpm --filter @vudt/codegen typecheck`
Expected: 无输出、exit 0。**若 `SHELL_BY_PAGE_TYPE` 少一个键，这里会报 `Property 'x' is missing`** —— 那是这个 Record 存在的意义，补上而不是改成可选。

Run: `pnpm --filter @vudt/codegen test write.test.ts`
Expected: **PASS** —— 10 例。它会拿底座真生成一个项目并跑 vue-tsc + vite build，是本次改动的真集成面。

- [ ] **Step 9: 提交**

```bash
git add packages/codegen/src/app.ts packages/codegen/src/layouts.ts packages/codegen/src/__tests__/app.test.ts packages/codegen/src/__tests__/layouts.test.ts
git commit -m "refactor(codegen): make the shell choice exhaustive and drop the dead cta const

layouts.ts 的 SIDEBAR_PAGE_TYPES 是 readonly string[]，加第七个页型照样静默
落进 AppShell。换成 Record<PageType, ShellName>，新页型不进映射就编译不过。
它同时把 form 今天靠 includes 落空而默认走 AppShell 这件事写成明写的决定。

app.ts 无 auth 页时发射 const cta = undefined 加 :cta=\"cta\"，与 layouts.ts 的
注释和 layouts.test.ts 的断言（cta 缺席而非 undefined，就是为了不发射这个死
const）直接冲突。改成有 cta 才发射。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 3: `CtaBanner.vue` 去孤儿 id

**Files:**
- Modify: `packages/templates/vue3-base/src/blocks/CtaBanner.vue:21`

**Interfaces:**
- Consumes: 无。
- Produces: 生成的站点里 `CtaBanner` 的根 `<section>` 不再带 `id`。**这是模板 SFC，改它等于改每个生成站点的产物。**

- [ ] **Step 1: 确认这个 id 真的没人用**

Run: `grep -rn 'id="cta"\|#cta' packages server web --include=*.ts --include=*.vue --include=*.json`
Expected: 只有两处，且都不是引用 —— `packages/templates/vue3-base/src/blocks/CtaBanner.vue:21`（要删的那行）与 `packages/templates/blocks/src/__tests__/sfc-navigation.test.ts:13`（一条解释「这套设计要杀掉的症状」的注释，不依赖 id 存在）。**若冒出第三处真引用，停下来汇报，别删。**

- [ ] **Step 2: 删掉它**

把 `packages/templates/vue3-base/src/blocks/CtaBanner.vue` 第 21 行：

```html
  <section id="cta" class="section cta">
```

改为：

```html
  <section class="section cta">
```

其余一个字不动。

**这一步没有新测试可写**（spec 的「测试改动面」没有它的用例）—— 去掉一个没人引用的 id 没有可断言的失败行为。验证靠下面的真构建。

- [ ] **Step 3: 跑底座自身的 vue-tsc**

Run: `pnpm --filter @vudt/template-vue3-base typecheck`
Expected: 无输出、exit 0。这是模板 SFC 改动的**必修关**，spec 点名要求。

- [ ] **Step 4: 跑两处会真生成并构建站点的地方**

Run: `pnpm --filter @vudt/blocks test`
Expected: **PASS** —— 6 文件 / 93 例（`sfc-props`、`sfc-geometry`、`sfc-navigation` 都遍历底座 SFC，删一个 id 不该动它们；红了说明改错了行）。

Run: `pnpm --filter @vudt/codegen test write.test.ts`
Expected: **PASS** —— 10 例，其中 `'the generated project builds'` 会跑真 vue-tsc 与真 vite build。

Run: `pnpm --filter @vudt/build test`
Expected: **PASS** —— 4 文件 / 25 例，`pipeline.test.ts` 走 code → images → build 全链。

**若 Task 3 动过模板 SFC 后有任何一处异常，停下来查清楚再继续。**

- [ ] **Step 5: 提交**

```bash
git add packages/templates/vue3-base/src/blocks/CtaBanner.vue
git commit -m "chore(templates): drop the orphaned id on CtaBanner

id=\"cta\" 是多页 plan 拆掉的那套硬编码锚点导航的最后一件残留：NavBarSimple、
HeroSplit、HeroCentered、PricingCard 当时都以 href=\"#cta\" 指向它，现在全部
走 router-link。全仓已无任何地方引用这个 id，也没有测试断言它存在。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 4: 全仓回归

**Files:** 无（除非发现缺陷）

**Interfaces:**
- Consumes: Task 1-3 的全部改动。
- Produces: 一份「全绿」的确认；**无缺陷就不提交**（spec 的交付顺序第 4 条）。

- [ ] **Step 1: 全仓测试**

Run: `pnpm -r test`
Expected: **PASS** —— 8 个包全绿，合计 **41 文件 / 430 例**（基线 41/427，本计划新增 3 例）：

| 包 | 文件 / 例 |
|---|---|
| `packages/spec` | 2 / 13（**必须仍是 13** —— 本计划承诺不碰它） |
| `web` | 6 / 48 |
| `packages/templates/blocks` | 6 / 93 |
| `packages/codegen` | 6 / **60** |
| `packages/imagegen` | 4 / 29 |
| `packages/providers` | 3 / 51 |
| `packages/build` | 4 / 25 |
| `server` | 10 / 111 |

（`packages/templates/vue3-base` 没有 `test` 脚本，只有 `typecheck` —— 所以是 8 个包不是 9 个。）

- [ ] **Step 2: 全仓类型检查**

Run: `pnpm -r typecheck`
Expected: **PASS** —— `Scope: 9 of 10 workspace projects`，9 个项目全部 `Done`、exit 0。

- [ ] **Step 3: 逐项复核 spec 的「预期不受影响」清单**

Run: `grep -rn "to: '" packages/codegen/src/__tests__/fixture.ts packages/build/src/__tests__/fixture.ts server/src/__tests__/fixture.ts`
Expected: 4 处，值与 spec 记的一致 —— codegen / build 夹具是 `/pricing`、`/pricing`、`/`（路由集 `{'/', '/pricing', '/signin'}`），server 夹具是 `/pricing`（路由集 `{'/', '/about', '/pricing'}`）。全部已声明。

- [ ] **Step 4: 不提交**

全绿即结案，**不产生提交**。若 Step 1/2 有红：那是一个真缺陷，先查清根因、按 Ruling 记录，**不要**为了让测试变绿而放松闸或改夹具迁就。

**不要求真任务端到端重跑** —— 闸在 LLM 路径上早已生效，本计划没有放松任何东西。

---

## Self-Review

**1. Spec coverage** —— 逐节核对：

| spec 章节 | 落在哪个任务 |
|---|---|
| §1 闸加在 `renderPage`、排在逐块循环之后 | Task 1 Step 3 |
| §1 错误类型转换（`BlockDerivationError` → `CodegenError`，消息逐字） | Task 1 Step 3 |
| §1 依赖合法（`@vudt/blocks` 已在 codegen 依赖里） | Task 1 Step 3（只改 import 行，无新依赖边） |
| §1 覆盖面（`writeProject` → `generateProject` → `renderPage` 同一路径） | Task 1 Step 4 的 `write.test.ts`、Task 3 Step 4 |
| §1 决策 2：derive 路径的闸保留不搬 | 全计划未触碰 `draft.ts` |
| §1 决策 3：`renderApp` 不加闸 | 全计划未触碰 `renderApp` 的链接生成 |
| §2 `app.ts` 死 const | Task 2 Step 1-4 |
| §2「不是顺手改，是对齐已写下的注释」 | Task 2 Step 1 的用例注释与 Step 3 的实现注释都引了那两处（`layouts.ts:15-16`、`layouts.test.ts:107-108`） |
| §3 `Record<PageType, ShellName>` | Task 2 Step 7 |
| §3 为什么不是 `ReadonlyArray<PageType>` | Task 2 Step 7 的常量注释 |
| §3 `form` 显式映射 | Task 2 Step 5、Step 7 |
| §4 `CtaBanner.vue` 去 id + 底座 vue-tsc | Task 3 Step 1-4 |
| §5 两个 auth 页的取舍只写文档 | **本计划零代码改动**（按用户圈定的范围，不加 pin 测试） |
| 测试改动面：3 条新用例、都在已有 describe 块 | Task 1 Step 1、Task 2 Step 1/5 |
| 「先写、先跑、先看它红」 | Task 1 Step 1-2、Task 2 Step 1-2 |
| 预期不受影响清单 | Task 1 Step 4（三个包的夹具）、Task 4 Step 3 |
| 验证 4 条 | Task 1 Step 4、Task 3 Step 3、Task 4 Step 1-2 |
| 交付顺序 1-4 | Task 1 / Task 2 / Task 3 / Task 4 |
| 「我擅自定的点」4 条 | 1→Task 2 Step 7；2→Task 1 Step 3；3→Task 2 Step 7 的 `form: 'AppShell'`；4→未触碰 |

无遗漏。

**2. Placeholder scan** —— 已通读：没有 TBD / TODO /「稍后实现」/「类似 Task N」/「加上适当的错误处理」。每个代码步骤都给了可直接落盘的完整替换片段，每条命令都给了确切的期望输出与例数。

**3. Type consistency** —— 逐项核对：

- `assertCtaTargets(route, selections, routes)`：Task 1 的调用与 `derive.ts:169` 的定义逐字一致（三个参数、顺序、`ReadonlySet<string>`）。
- `BlockDerivationError`：Task 1 用 `instanceof` 判它 —— 所以是**值导入**不是 `import type`，`import` 行里不能加 `type` 前缀。
- `routes` 用 `new Set(spec.pages.map((declared) => declared.route))`：回调参数特意取名 `declared` 而**不是** `page` —— `renderPage` 的第二个形参就叫 `page`，同名会在回调里遮蔽它。
- `SHELL_BY_PAGE_TYPE: Record<PageType, ShellName>`：`PageType` 来自 `@vudt/spec`（`packages/spec/src/page.ts:29`，经 `src/index.ts` 的 `export * from './page.js'` 导出），取值为那 6 个字面量、与 `PageTypeSchema` 的 6 个值逐一对应；`ShellName` 是本文件第 4 行已有的类型。
- 测试里用到的 `withPages` / `page` 帮手：`app.test.ts:6-16` 与 `layouts.test.ts:7-17` **各自都有一份**（同名同形，不是 import）—— Task 2 的两个新用例都能就近拿到。
- `homePage(spec)`：`page.test.ts:8` 已有，Task 1 直接复用。
- Task 4 的例数账：57 → 58（Task 1）→ 60（Task 2）→ 60（Task 3，无新增）→ 全仓 427 → 430。

**4. 两条给执行者的提醒（不是缺陷，是顺序/预期）**：

1. **Task 2 Step 5/6 的新用例是 pin 测试，改动前就是绿的** —— 已在步骤里写明「那是预期，不是写错了」，免得执行者去「修」一个不该红的测试。
2. **Task 1 Step 2 必须真看到红** —— 那 12 例里新增的那条若直接绿，说明构造错了，不是闸生效了。

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-23-cta-read-path-and-minors.md`. Two execution options:**

**1. Subagent-Driven (recommended)** —— 每个任务派一个全新 subagent，任务之间我来评审，迭代快

**2. Inline Execution** —— 在本会话里用 executing-plans 批量执行，带检查点停下来给你看

**选哪种？**
