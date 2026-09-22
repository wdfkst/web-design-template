# 多页完整项目（导航布局 + 路由化 CTA + 逼多页）— 设计文档

日期：2026-09-22
状态：定稿（用户已逐段确认）

## 目标

用户报的症状：**生成的项目只有一个页面能看，点其它页面没有内容。**

本设计要让每次生成都产出一套**导航互通、路由可达、每页非空**的前端系统，而不是一张孤立的单页。

**不做**：不改 `packages/spec` 的 schema；不做列表→详情的业务跳转（带路由参数的区块、`:id` 动态路由、假数据联动）；不强制侧车的 `pageTypes`；不动图片生成与构建沙箱；不加 SSE（那是另一份 spec）。

## 背景：为什么现在是「单页死路」

不是导航栏写错了一个属性，是**跨页结构从来没有被建模过**。

实测证据（2026-09-22，`.vudt/tasks/` 下 4 个真任务）：4 个里 3 个只生成了 `HomePage.vue`，第 4 个生成了 `HomePage.vue` + `DashboardPage.vue`；而那个两页任务的导航指向 `/analytics`、`/settings`，`router.ts` 里根本没有这两条路由。

产物里**没有一条能用的链接**：

| 位置 | 现状 | 实际结果 |
|---|---|---|
| `vue3-base/src/blocks/NavBarSimple.vue:22` | `<a :href="link.to">`，而 router 用的是 `createWebHashHistory` | 点 `/pricing` 真跳 HTTP → 404/白屏 |
| `NavBarSimple.vue:24` | `href="#cta"`（导航 CTA） | 只在同页恰好有 CtaBanner 时有效 |
| `HeroSplit.vue:23` | `href="#cta"`（硬编码） | 同上 |
| `HeroSplit.vue:24` | `href="#features"`（硬编码） | 页面里没有 `id="features"` → 原地不动 |
| `HeroCentered.vue:31` | `href="#cta"`（硬编码） | 死的 |
| `CtaBanner.vue:34` | `href="#"`（硬编码） | 死的 |
| `PricingCard.vue:50` | `href="#pricing"`（硬编码） | 死的 |
| `EmptyStatePanel.vue:31` | `<button type="button">` | 根本没有跳转行为 |
| `LogoStrip.vue:24` | `:href="logo.to"`，值是模型编出来的外部域名 | 指向不存在的站点 |

三个根因，叠加：

1. **导航链接是裸 `<a href>`，而历史模式是 hash** —— 唯一那个直接的 bug。
2. **drafter 几乎总是只出一页。** prompt 里写着 `Keep the page count and the block count small: 1-3 pages`，还补了一句 `prefer a few well-chosen sections over a long page` —— 等于在劝模型只做一页。
3. **导航条目与 CTA 目标是模型自由发挥的文案，没有任何一致性校验。** 在模型的先验里，「导航栏」和「路由表」是两件互不相干的事。

## 已定决策

1. 导航升为**项目级布局**，条目由 codegen 从 `spec.pages` 生成，模型不再写 `links`。
2. CTA 改成 **`{ label, to }` 两段式**，`to` 由 derive 校验必须命中真实 route；**禁止锚点**。
3. 多页不变量钉在 **draft schema** 上（`pages.min(3)`、每页 `blocks.min(2)`），**不动 `packages/spec`**。
4. 布局形态由 **pageType 推导**（顶栏 / 侧栏），不加 `spec.layout` 字段。

这四条的共同思路，是这个仓库本来的立身之本：**结构性事实由代码保证，文案才归模型**。几何就是这么处理的（侧车声明，模型只能填 `prompt`/`alt`）。导航恰恰也是结构，却一直让模型自由发挥，所以必然漂移。

## 第 1 节：导航升为项目级布局

### 底座新增两个手写布局组件

静态文件，和 `base.css` 一样走「拷底座」路线（`write.ts:75` 的 `copyTemplate` 逐文件复制，codegen 只覆盖 `generated.files` 里列出的路径）：

- `vue3-base/src/layouts/AppShell.vue` —— 顶栏布局：`NavBarSimple` → `<slot />` → `FooterSimple`
- `vue3-base/src/layouts/SidebarShell.vue` —— 侧栏布局：左侧竖向 `NavBarSimple` + 右侧主内容区

### codegen 新增 `src/App.vue` 的生成

新增 `packages/codegen/src/app.ts`，产出：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from './layouts/AppShell.vue'

const brand = "…"   // 派生自 spec.meta.name
const links = [ … ] // 派生自 spec.pages
const cta = { … }   // 派生，见下表
const note = "…"    // 派生自 spec.meta.description

const route = useRoute()
const chromeless = computed(() => route.meta.chrome === false)
</script>

<template>
  <AppShell :brand="brand" :links="links" :cta="cta" :note="note" :chromeless="chromeless">
    <RouterView />
  </AppShell>
</template>
```

`SidebarShell` 版本同理，无 `cta`。

`<router-link>` 与 `<RouterView>` 由 `app.use(router)` 全局注册，不需要 import —— 现有 `App.vue` 就是这么用 `<RouterView />` 的。

### 四条派生规则（纯函数，住 `packages/codegen/src/layouts.ts`）

| 决策 | 规则 |
|---|---|
| 顶栏还是侧栏 | `spec.pages` 中存在 `pageType` 为 `dashboard` / `settings` / `list-detail` 的页 → `SidebarShell`；否则 `AppShell` |
| 导航条目 | `spec.pages` 中**排除 `pageType: 'auth'`**，其余按声明顺序；`label` 取 `page.title`，`to` 取 `page.route` |
| 无 chrome | `pageType === 'auth'` 的页 → `renderRouter` 给该路由写 `meta: { chrome: false }` |
| 顶栏 CTA | 取第一个 `pageType: 'auth'` 的页（`label` 取其 `title`）；没有 auth 页则 CTA 留空 |

**CTA 这条规则补掉了一个否则会漏的洞**：auth 页被排除出导航条目后，就再没有任何入口能到它。把它放在导航右侧按钮上，既符合「免费开始 → 登录/注册」的常识，又保证可达。

### NavBarSimple / FooterSimple 不再是页内区块

侧车的 `BlockDefinition` 新增 `layoutOnly?: boolean`，`NavBarSimple` 与 `FooterSimple` 标上。四处生效：

1. `openai-spec-drafter.ts` 的 `renderBlockCatalogue()` 跳过它们 —— 模型不再有机会选。
2. `derivePageAssets` 遇到布局型组件时抛 `BlockDerivationError`，错误文本写明「它是布局，不属于 `pages[].blocks`」。错误文本要**说清原因**而不是复用「unknown component」：后者会让模型换个块重试，白白烧掉一次 1-4 分钟的重试回路。
3. `renderPage` 同样拒绝，抛 `CodegenError`。理由：不是所有 spec 都来自 draft 路径（`derive.ts` 里 `BlockSelection` 的注释就写着「the caller (template preset or LLM)」），而一个手写 spec 把 `NavBarSimple` 放进页里，会渲染出**第二个导航**（布局已经渲染了一个），把我们刚修掉的 bug 从侧门放回来。
4. **仍留在 `BLOCK_REGISTRY` 里，不挪文件** —— 这样 `sfc-props.test.ts` 的遍历断言继续覆盖它们的 props ↔ SFC 对齐。这一条不是可有可无的：`NavBarSimple` 的 props 这次正好也要改（见第 2 节），全靠这个测试兜住侧车与 SFC 的同步。

> 这条的副作用是要点：**`pages[].blocks` 从此只装内容区块**，「不允许空白页」于是变成一个能被校验的结构性不变量，而不是一句 prompt 里的请求。

## 第 2 节：CTA 从死锚点改成真实路由

### 约定：`to` = 内部路由

递归遍历 `block.props`，**任何名为 `to` 的字符串值必须命中 `spec.pages[].route`**，否则 `deriveSpecInput` 返回带路径的 feedback，走 `draftSpec` 既有的重试回路。

选约定式而不是「侧车显式声明哪些 prop 是路由」，是因为约定是**全量的**：新增区块时不可能忘记声明。代价是任何叫 `to` 的 prop 都会被当成路由 —— 这是好约束，因为在这个平台里「跨页去向」和这个名字应该永远是同一件事。

**禁止锚点**：`#xxx` 一律不合法。跨页站点就该链到 `/pricing`；留着锚点等于把「点了没反应」这条路重新打开。

### 校验为什么住在 blocks 包，不住 spec 包

`packages/spec` **不能** import `@vudt/blocks`：依赖方向是反的（`slot.ts` import `@vudt/spec` 的 `AspectRatio`/`AssetPurpose`，`draft.ts` import `PageSchema`），反过来成环。而规则本身是跨页的（要拿全部 route 比对），所以最合适的位置是 `deriveSpecInput` —— 它本来就握着整个 draft 与全部页面。

同理，`packages/spec` 里已有的 `checkReferentialIntegrity`（asset id 唯一、route 唯一、`assetBindings` 必须指向已声明 asset、`renderSize` 与 `aspectRatio` 一致）保持原样不动。

### 受影响的区块（5 个内容块 + 1 个布局块）

| 区块 | 现在 | 改成 |
|---|---|---|
| `HeroSplit` | `primaryCta: 'string'`、`secondaryCta: 'string'` | `primaryCta: '{ label, to }'`、`secondaryCta: '{ label, to }'` |
| `HeroCentered` | `primaryCta: 'string'` | `primaryCta: '{ label, to }'` |
| `CtaBanner` | `ctaLabel: 'string'` | `cta: '{ label, to }'` |
| `EmptyStatePanel` | `ctaLabel: 'string'`（渲染成无行为的 `<button>`） | `cta: '{ label, to }'` |
| `PricingCard` | `plans[].ctaLabel?: string` | `plans[].cta?: '{ label, to }'` |

底座 SFC 里 `<a href>` 与 `<button>` 一律换成 `<router-link :to>`。

**`NavBarSimple` 也得改**：布局传给它的不再是一段 CTA 文字，而是一个 `{ label, to }`，所以侧车第 1 节那张表里的 `ctaLabel: 'string'` 要变成 `cta: '{ label, to }'`，`NavBarSimple.vue:24` 的 `<a href="#cta">` 同步换成 `<router-link :to="cta.to">`，`defineProps` 一并改。它不是内容块，但 `sfc-props.test.ts` 遍历的是整个 `BLOCK_REGISTRY`（**含 `layoutOnly` 项**），所以侧车与 SFC 必须同步改到位，改一半它会红。

### LogoStrip 的 `to` 要改名

`LogoStrip` 现在就有 `logos: '{ name, to }[]'`，`LogoStrip.vue:24` 渲染成 `:href="logo.to"`，语义是「外部品牌站」。新的 `to` 约定会立刻和它冲突，必须处理。

**决定：改成 `logos: 'string[]'`，渲染成 `<span>`，不再有链接。**

理由：平台生成的是虚构产品，它无法保证任何外部域名真实存在，模型只能编。编出来的域名比不渲染更糟 —— 「点了没反应」正是这次要消灭的东西。logo 墙是信任信号，不是导航。

### AuthPanel 不动

它有 `altActionLabel`（登录/注册面板底部的切换文字），语义是同页 `mode` 切换，不是跨页去向。名字里没有 `to`，新约定碰不到它。

## 第 3 节：逼模型出多页

### prompt 改写（`openai-spec-drafter.ts` 的 `systemPrompt()`）

- 删掉 `Keep the page count and the block count small: 1-3 pages...` 整条，以及 `prefer a few well-chosen sections over a long page`
- 换成：**3-6 页 —— 一个首页 + 至少 2 个内页；每页 2-5 个内容区块**
- 给 `title` 加约束：**短（2-6 个词）**，并写明原因「导航栏直接拿它当链接文字，auth 页的 title 还会当导航右侧按钮的文字」
- 说明新约定：`to` 必须是已声明页面的 route，不许写锚点
- 说明 nav / footer 不再是区块：`NavBarSimple` 与 `FooterSimple` 不在目录里，不要选

### 不变量钉在 draft schema 上（`packages/templates/blocks/src/draft.ts`）

- `ProjectDraftSchema.pages`：`.min(1)` → `.min(3)`
- `DraftPageSchema.blocks`：`.min(1)` → `.min(2)`

**只改 draft schema，不动 `packages/spec`。** 全仓 8 个文件里 13 处 `pages: [` 夹具因此全部不用动（`packages/{build,codegen,imagegen,spec}/src/__tests__/fixture.ts`、`server/src/__tests__/fixture.ts`、`web/src/api/__tests__/client.test.ts`、`codegen/src/__tests__/page.test.ts`、`blocks/src/__tests__/derive.test.ts`）。

理由：「完整站点」是 **drafter 的契约**，不是 spec 容器的契约 —— spec 仍要允许单页，模板预设与手改 spec 都用得上它。这也和 `spec-package-design-deviations` 记的那条一致：不要为了让某次 LLM 输出通过而放宽 spec 的校验；反过来，也不该为了让 spec 宽松而放松 drafter 的契约。

### 成本影响（已核算）

带图的区块只有 `HeroSplit`(1 slot)、`HeroCentered`(1)、`CtaBanner`(1)、`EmptyStatePanel`(1)、`FeatureTriad`(3)。产出丰富度那一轮新增的 6 个区块全是 `slots: []`。

所以页数从 1 涨到 5，图片从约 2 张涨到约 6 张，离 `maxAssets: 24` 还很远，等待时间不会线性变长 —— **前提是模型按 prompt 用 props-only 区块去填内页**。

## 第 4 节：明确不做的事

- **不做列表→详情的业务跳转**。带路由参数的区块（DataTable / DetailPanel）、`:id` 动态路由、列表与详情的假数据联动都不在范围内。
- **不强制 `pageTypes`**。侧车里的 `pageTypes` 保持 advisory。强制它会明显增加重试 churn，而它不解决本次报的问题。若之后发现模型把 Hero 放到 dashboard 上，再单开。
- **不动 `packages/spec` 的 schema**（第 1、3 节都做到了零改动）。
- **不加 SSE、不改任务进度字段** —— 那是另一份 spec（进度可见性）。

## 数据流（变化点）

```
描述
 └─ drafter（prompt 改：3-6 页、title 要短、to 是路由、nav/footer 不在目录里）
     └─ draft { pages[].blocks[] 只含内容区块 }
         └─ deriveSpecInput（改：拒绝 layoutOnly 区块；校验所有 `to` 命中 route）
             └─ ProjectSpecInput → finalizeSpec → ProjectSpec
                 └─ generateProject
                     ├─ renderPage      （不变）
                     ├─ renderRouter    （改：auth 页写 meta.chrome = false）
                     ├─ renderApp       （新：App.vue，选 shell + 注入 brand/links/cta/note）
                     └─ renderTokensCss （不变）
                         └─ writeProject（copyTemplate 已把 src/layouts/ 拷过去）
```

## 我擅自定的点（可否决）

1. **布局用 pageType 推导，不加 `spec.layout` 字段。** 想要显式控制权就得动 `packages/spec`，代价不成比例。
2. **`LogoStrip` 改为纯名字列表**（见第 2 节）。备选是保留 `{ name, href }` 并放行外部链接；我选了「不生成无法保证的东西」。
3. **`PricingCard.plans[].ctaLabel` 直接改名 `cta`**（破坏性改动）。备选是保留 `ctaLabel` 再加 `ctaTo`，那会让「两段式」在五处里出现两种写法。
4. **导航 CTA 取第一个 auth 页。** 备选是识别 route 字符串（`/contact`、`/signup`），太脆。
5. **禁止锚点。** 备选是放行 `#xxx` 但校验对应 `id` 存在 —— 不值得为它引入一套 DOM id 契约。
6. **页脚 `note` 取 `meta.description` 的第一句**（按 `。！？.!?` 切，截断 140 字符）；为空则回退 `© {年} {meta.name}`。备选是加 `spec.meta.footerNote` 字段。

## 顺带发现（不修，记在这里）

`packages/codegen/src/project.ts:50` 的 `REPLACED_TEMPLATE_FILES` **是死代码** —— 全仓只有定义、没有任何消费者（`write.ts:105` 的 `prunePlaceholderPages` 走的是 `generated.files`）。

所以**不要**把 `src/App.vue` 加进去：那是空操作。`copyTemplate` 先全量拷贝，`generated.files` 再逐个覆盖，App.vue 本来就会被覆盖。建议直接删掉这个常量，但与本设计无关，可另开一轮。

## 测试改动面

### 新增

- `packages/codegen/src/__tests__/layouts.test.ts`：顶栏/侧栏判定表；导航条目排除 auth 页且保序；CTA 取第一个 auth 页 / 无 auth 页时为空；`note` 的派生与兜底。
- `packages/codegen/src/__tests__/app.test.ts`：`renderApp` 的 SFC 文本快照（顶栏、侧栏两版），断言 brand / links / cta 字面量正确。

### 改写既有断言

- `packages/codegen/src/__tests__/page.test.ts`：`renderRouter` 对 auth 页写 `meta.chrome === false`；:87-98 那个「只含 NavBarSimple 的页」的用例改写成 `renderPage` **拒绝** layoutOnly 的断言（现有 `expect(sfc).toContain('<NavBarSimple v-bind="props0" />')` 整段作废）；:18/:28/:32 的组件名清单与 :54 的注释跟着 fixture 走。
- `packages/templates/blocks/src/__tests__/derive.test.ts`：新增 `to` 校验四条（合法命中、非法 route、嵌套在 `plans[]` 里、锚点被拒）与「layoutOnly 组件被拒，且错误文本点明它是布局而非未知组件」。**既有断言要重构**：文件顶部的 `landing` fixture（:7-13）里 `NavBarSimple` 与 `FooterSimple` 占了两席，去掉后 `blocks` 长度 5→3、`blocks[i]` 的下标全部要顺移；:90 的 `available:` 错误文本断言不受影响（registry 仍是 13 个）；:124 与 :235 两处用 `NavBarSimple` 当「无 slot 的填充块」的地方换成 `StatsBand`。
- `packages/templates/blocks/src/__tests__/draft.test.ts`：:45 与 :50 的 nav/footer 块换成内容块；新增 `pages.min(3)` 与 `blocks.min(2)` 各自的反馈文本断言。
- `packages/templates/blocks/src/__tests__/registry.test.ts`：`exposes the expected component set` 不变（13 个仍全在 registry），新增一条「`NavBarSimple` 与 `FooterSimple` 标了 `layoutOnly`，其余都没有」。
- providers 的 drafter 测试：prompt 含 `3-6`、不含 `Keep the page count`、不含 `NavBarSimple` / `FooterSimple`。
- `sfc-props.test.ts` 本身不改代码，但 6 个区块的 props 变了（5 个内容块 + `NavBarSimple`），侧车与 SFC 必须同步，否则它红 —— 这正是它存在的意义。
- `server/src/__tests__/spec-source.test.ts`：:72-73「两页同 route」那个用例拿 `NavBarSimple` 当填充块，换成内容块。

### 连带：`renderPage` 拒绝 layoutOnly 会打到 6 个 fixture

这条是自审时才发现的，不是可选项：`renderPage` 一旦拒绝，凡是 `pages[].blocks` 里带 nav/footer 的 spec 夹具都会抛错。

| 文件 | 要改的行 |
|---|---|
| `packages/codegen/src/__tests__/fixture.ts` | :39、:61、:65、:67 |
| `packages/build/src/__tests__/fixture.ts` | :39、:61、:65、:67 |
| `packages/imagegen/src/__tests__/fixture.ts` | :39、:61、:65、:67 |
| `server/src/__tests__/fixture.ts` | :52、:62 |

改法是把 nav/footer 那两处换成内容块（`StatsBand` / `FeatureTriad` 之类）。四个文件改完，页面里的块数会变，连带 `page.test.ts:18/:28/:32` 与 build/imagegen 里依赖块数的断言。

### 不动

- `packages/spec`：schema 与它的 13 例测试全不碰。
- `web`：`client.test.ts` 的 spec 夹具是 `pages: []`，不含块，不受影响。
- 图片生成与构建沙箱的逻辑代码。

## 交付顺序

1. **底座 SFC 层**：`NavBarSimple` 的 `<a href>` → `<router-link>`、`ctaLabel` → `cta`；5 个内容块的 CTA 改两段式；`LogoStrip` 去链接；新增 `AppShell.vue` / `SidebarShell.vue`。
2. **侧车**：`layoutOnly` 字段 + nav/footer 标记 + 6 个区块的 props 改写 + `LogoStrip` 改 `string[]`。此步收尾时 `sfc-props.test.ts` 与 `sfc-geometry.test.ts` 必须绿。
3. **两道闸 + draft 下限**：`derivePageAssets` 拒绝 layoutOnly 并校验 `to`；`renderPage` 拒绝 layoutOnly；draft schema 的 `pages.min(3)` / `blocks.min(2)`。**这一步会打到 6 个 fixture（见「测试改动面」），一并改完。**
4. **codegen 新产出**：`layouts.ts`、`app.ts`、`renderRouter` 的 `meta.chrome`。
5. **provider**：prompt 改写。
6. **全仓回归 + 真任务端到端手验**（见「验证」）。

## 验证

1. 全仓 `pnpm -r test` + `pnpm -r typecheck` 全绿。**本轮开始时的实测基线：38 个文件 / 374 例全绿**（providers 47、build 25、spec 13、codegen 37、imagegen 29、blocks 64、server 111、web 48；2026-09-22 实跑）。
2. **一次真任务跑到 `ready`**：按「配置页手验环境」那份记录从仓库根起 server，提交一句能触发多页的描述（例如「一个 SaaS 产品的营销站，带定价、关于我们和联系方式」），在预览里逐页点导航、点 CTA，确认：
   - 导航条目数 == `spec.pages` 去掉 auth 页后的数量
   - 每一页都有内容，不是空白
   - 每个导航条目与 CTA 都能真的到达对应页面，不白屏
3. **再用一个应用型描述跑一次**（例如「一个后台管理系统，带登录、控制台、列表和设置」），确认侧栏布局分支生效、auth 页确实无 chrome。
4. 若多页产出仍不达标：读 `error.detail`，它是闸 1 / 闸 2 的原文（带路径），直接就是下一轮改 prompt 的输入。
