# 果冻风格后台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans（沿用用户此前选择的Inline方式）to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 用户已于2026-10-30批准本设计和计划，按Inline连续实施，不逐任务确认。

**Goal:** 让实际生成后台达到B原型的丰富、新颖和可爱程度，同时保留真实业务与旧样式兼容。
**Architecture:** 新增受控jelly主题、四种本地motif、可选封面字段；复用现有CRUD、工作台查询、图片派生与模板发射。
**Tech Stack:** Vue 3、Ant Design Vue、Zod、Vitest、vue-tsc、Vite；无新增运行依赖。
**Spec:** `docs/superpowers/specs/2026-10-30-playful-admin-design.md`

## Global Constraints

- appearance新增jelly，旧plain/soft-glass默认与presentation缺省行为保持。
- 同一worktree根操作，不读取.env/settings凭证；不自动push/merge，不调用付费模型。
- 超过200行文件分段读；命令长输出重定向到本计划workspace，不超过100行展示。
- 所有数据来自repository/config；不新增假头像、协作、收藏、上传、通知能力。
- 几何只来自侧车，LLM只填语义；本地motif使用受控SVG/CSS，不是生成资产。
- const+satisfies+v-bind，不手拼用户HTML。旧营销/auth/admin回归必须通过。
- 每任务TDD、定向测试、pnpm typecheck、pnpm test；提交仅本任务文件，末行Co-Authored-By: Claude Code <noreply@anthropic.com>。
- 最终真实导出vue-tsc+Vite；截图不可见时不能声称视觉通过。

## Review Focus

1. jelly新增字段泄漏到非jelly或营销配置，旧默认值被迁移：Task1负面契约与旧fixture。
2. 图片URL含协议相对、空白、反斜杠及危险协议，load error后又换URL：Task4分类测试和组件状态恢复。
3. minimal仍出现装饰、暗色文字落在透明色混合区、无blur导致内容不可读：Task2/3断言与Task7浏览器审阅。
4. cards最后一项批删、跨页选择或封面新增后action点击目标错位：Task4共享交互回归。
5. motif/业务prompt变化没进入缓存语义，或palette三个来源不一致：Task6 prompt/hash/provider观察链测试。

## Task 1：配置契约与兼容

**Files:** Modify `packages/spec/src/admin-presentation.ts`, `packages/spec/src/admin.ts`, `packages/templates/vue3-admin/src/data/admin-config.ts`; Test `packages/spec/src/__tests__/admin-personalization.test.ts`。
**Interfaces:** appearance='plain'|'soft-glass'|'jelly'；motif?:'spark'|'bloom'|'orbit'|'toolkit'，仅jelly允许，缺省不注入字段、运行时用spark。list.card.coverField?:string，引用collection.model的string字段。

- [ ] 写测试：jelly接受四motif；plain/soft-glass拒绝motif；省略presentation及旧默认不变；cards coverField存在且string通过，number/未知字段拒绝；table仍禁止card；marketing不能携带admin配置。
- [ ] 运行 `pnpm --dir packages/spec exec vitest run src/__tests__/admin-personalization.test.ts`；Expected: 新jelly/coverField契约失败。
- [ ] 实现schema与integrity规则，同步独立模板类型，不改变旧默认。
- [ ] 定向、`pnpm typecheck`、`pnpm test`；Expected: exit0。
- [ ] Commit `feat(spec): define jelly presentation and card covers`。

## Task 2：果冻主题与作用域

**Files:** Modify `packages/codegen/src/admin/theme.ts`, `packages/templates/vue3-admin/src/layouts/AdminLayout.vue`; Create `packages/templates/vue3-admin/src/theme/jelly.css`; Modify `packages/templates/vue3-admin/src/App.vue`; Test `packages/codegen/src/__tests__/admin-theme.test.ts`。
**Interfaces:** `.is-jelly`只对jelly启用；`data-decoration`标识minimal/balanced。CSS变量新增--admin-jelly-panel-radius(16px)、--admin-jelly-card-radius(20px)、--admin-jelly-hero-radius(28px)、--admin-jelly-control-radius(12px)，沿用glow-a/b/c。CSS导入固定底座文件，不改变generated.css外部接口。

- [ ] 写测试：jelly三种主色/明暗有完整变量；on-primary与surface正文对比度>=4.5；旧两种appearance与无presentation不走jelly；layout类只在jelly出现。
- [ ] 运行codegen admin-theme与模板layout定向测试；Expected: jelly变量/类断言失败。
- [ ] 实现jelly局部主题和布局；增加主按钮短阴影、激活菜单与图标底座；禁用危险按钮立体强调；minimal关闭纯装饰；reduced-motion禁用位移，focus-visible不被阴影替代。
- [ ] 定向、typecheck、全仓test exit0。
- [ ] Commit `feat(admin): add scoped jelly theme and navigation`。

## Task 3：受控本地插画与欢迎区

**Files:** Create `packages/templates/vue3-admin/src/components/admin/AdminMotif.vue`; Modify `AdminWelcomePanel.vue`（同目录）, `AdminListPage.vue`, `AdminWorkbenchPage.vue`; Test `packages/templates/vue3-admin/src/__tests__/welcome.test.ts`; Create `packages/templates/vue3-admin/src/__tests__/motif.test.ts`。
**Interfaces:** AdminMotif props `{ motif?: AdminPresentation['motif']; compact?:boolean }`；默认spark，aria-hidden。Welcome props保留原结构，新可选presentation；父页从`../../theme/presentation`导入传递，不能依赖spec包。

- [ ] 写测试：四motif有不同受控SVG且无外链；不接受用户SVG；jelly无图/失败回落motif，有图显示侧车w/h；src改变后重新尝试加载；非jelly无图保留旧行为；minimal无装饰。
- [ ] 定向运行welcome/motif；Expected: motif与回落断言失败。
- [ ] 实现四种原创SVG及颜色token，欢迎区组合；不固定云朵，不引入持续动画；真实图优先，避免装饰遮挡正文。
- [ ] 定向、typecheck、全仓test exit0。
- [ ] Commit `feat(admin): add playful motif and welcome fallbacks`。

## Task 4：有内容的卡片封面

**Files:** Create `packages/templates/vue3-admin/src/data/cover.ts`, `packages/templates/vue3-admin/src/components/admin/AdminCardCover.vue`; Modify `AdminRecordCards.vue`, `AdminListPage.vue`（同目录）; Create `src/__tests__/cover.test.ts`（模板内）；Modify `src/__tests__/list-page.test.ts`。
**Interfaces:** `safeCoverUrl(value:unknown):string|undefined`允许 `./covers/<文件路径>` 或无凭证https URL，返回通过校验的原URL，不将相对路径改成站点根路径。本地路径各段只允许ASCII字母/数字/下划线/短横线/点，拒绝空段、`.`/`..`、百分号编码、查询串和片段；所有输入拒绝空白、控制字符、反斜杠、站点根路径、协议相对、data/javascript/file/http及非字符串。https分支用URL解析并核对协议、hostname及空username/password。Cover props `{src?:unknown;title:string;motif?:AdminPresentation['motif'];decorative?:boolean}`；图片lazy+no-referrer，错误回退且src变化清error，minimal使用无装饰占位。Cards新增可选coverField、presentation，由List传递。文件由使用者放在public/covers，不实现下载/上传/代理，不改server CSP。

- [ ] 写纯函数边界表：`./covers/sample.png`、`./covers/team/sample-1.webp`与无凭证https通过；`/assets/a.png`、`//host/a.png`、`./covers/../a.png`、编码穿越、空段、查询/片段、带凭证https及上述危险形式拒绝。验证同一相对返回值在根文档与 `/preview/test/index.html#/items` 下分别解析为 `/covers/sample.png` 与 `/preview/test/covers/sample.png`。
- [ ] 写组件测试：jelly无coverField显示装饰封面；旧cards无字段不多封面；有字段真实图、失败、换URL恢复；标题恶意HTML仅文本；无图不发网络请求。
- [ ] 增加cards/table参数化回归：筛选分页、详情、编辑、创建、跨页选择、删除最后一项后无选中Tag，action不被封面拦截。
- [ ] 定向运行cover/list-page；Expected: 新封面行为失败（已有CRUD测试应保持绿）。
- [ ] 实现封面组件与URL策略，不改repository，不新增收藏假按钮。
- [ ] 定向、typecheck、全仓test exit0。
- [ ] Commit `feat(admin): render safe image and motif card covers`。

## Task 5：丰富工作台与表单层级

**Files:** Modify `AdminWorkbenchModule.vue`, `AdminWorkbenchPage.vue`, `AdminDetailPage.vue`, `AdminFormPage.vue`, `AdminRecordFields.vue`（模板components/admin）；Modify `src/__tests__/pages.test.ts`, `src/__tests__/workbench.test.ts`, `src/__tests__/record-form.test.ts`。
**Interfaces:** 模块查询结果与数据接口完全不变；新增基于kind的展示class，受`.is-jelly`约束。表单结构、错误id、保存行为不变。

- [ ] 写展示/行为测试：四kind有差异class与真实图标；summary/count和记录一致；number排序含空值置后；focus主records保留；grouped无重复字段，错误聚焦与详情投影保持。
- [ ] 定向运行上述测试；Expected: 新展示class失败，其余回归保持绿。
- [ ] 实现kind层级（数字卡/分类/主记录/快捷链接），aside摘要、分组轻表面；不增无数据支撑的统计或任务。确保CSS只影响jelly。
- [ ] 定向、typecheck、全仓test exit0。
- [ ] Commit `feat(admin): enrich jelly workbench and form hierarchy`。

## Task 6：生成引导与二开入口

**Files:** Modify `packages/providers/src/openai-spec-drafter.ts`, `admin-example.ts`, `packages/codegen/src/admin/readme.ts`; Modify providers `src/__tests__/openai-spec-drafter.test.ts`、codegen `src/__tests__/admin-project.test.ts`、imagegen `src/__tests__/generate.test.ts`。
**Interfaces:** drafter新需求默认推荐jelly/balanced/comfortable；严格需求plain/minimal。示例分别提供合法motif及无外网种子封面。styleBible/asset.prompt仍是唯一图片风格与缓存输入，不增调用阶段。

- [ ] 写测试：system prompt完整枚举plain/soft-glass/jelly，新需求推荐jelly但schema缺省仍soft-glass；三种appearance分别指导，旧全局禁止gradient buttons/big marketing illustrations的原句不再存在，jelly明确允许受控渐变/短阴影/业务插画，同时保留禁止假业务与无关营销。覆盖语义选motif与coverField限制；示例derive→parse→finalize成功。
- [ ] 写README与发射测试：说明public/covers放置方式、`./covers/sample.png`示例、预览CSP阻止第三方https而独立部署由部署策略决定；说明外部请求隐私与不自动下载。示例不编造封面文件路径；配置发射保留motif/coverField与安全转义。
- [ ] 写联合测试：jelly图像语义变化导致hash变化，palette三色进入实际provider观察请求，暖缓存不调用provider；不把motif配置变化本身误当hash变化要求。
- [ ] 定向运行上述三包测试；Expected: 新提示与README断言失败。
- [ ] 实现prompt与文档，仅复用原drafter调用，欢迎图按资产预算选择，不页页要求图。
- [ ] 定向、typecheck、全仓test exit0。
- [ ] Commit `feat(generator): guide playful business-specific admin styling`。

## Task 7：真实工程与视觉验收

**Files:** Create `packages/codegen/src/__tests__/jelly-admin-fixtures.ts`, `jelly-admin.test.ts`; Create `docs/superpowers/verification/2026-10-30-playful-admin.md`。
**Interfaces:** 三fixture独立合法draft，设备维护toolkit/table/grouped/focus，素材目录bloom/cards/aside/overview，报名管理spark/table；另参数化orbit、minimal、旧soft-glass/plain。配色不是统一紫色。测试封面使用本地原创资源，非模型输出。

- [ ] 集成测试走derive→parse→finalize→generate→write。三输出各跑真实vue-tsc/Vite，断言exit0、资产有消费者、无monorepo alias，旧fixtures继续通过。若首次即绿如实记集成覆盖，不能伪称RED。
- [ ] 用run启动新生成工程，不能用原型或平台充当结果。1440/1024/390与light/dark/both、无blur/reduced-motion、minimal实际交互；查看并评价截图，实测主色按钮/正文/辅助文字对比度与长文案。
- [ ] 三场景检查业务个性化差异及B丰富度清单，记录真实图片与本地fallback两条路径。不得以1px占位图作为美观验收。工具不可读图则记录阻塞并请求用户审阅，不虚报完成。
- [ ] 将原创fixture封面放入导出工程public/covers再构建；浏览器验证根部署及实际平台 `/preview/:id/` 下图片naturalWidth大于0，hash路由切换后仍显示。验证不存在文件和第三方https被平台现有CSP阻止时显示占位；使用浏览器拦截隔离外部请求，不访问真实第三方。断言预览响应CSP未放宽，不能只在Vite开发服务验封面。
- [ ] `pnpm test`、`pnpm typecheck`、`pnpm build`、`git diff --check`全部exit0，测试数量用脚本求和。
- [ ] Commit `test(admin): verify jelly exports and visual experience`。
- [ ] 一次独立整支评审，仅本计划基线到HEAD；按实际影响分级，Important/Critical一次TDD修复，Minor落盘；不自动push/merge。

## 自审

- Spec§3→Task2；§4欢迎→Task3、卡片→Task4、工作台/表单→Task5；§5→Task6；兼容安全→Tasks1/4；验收→Task7。
- 不增加第二套数据状态；presentation消费路径从模板theme模块传入子组件。
- 新appearance不改变旧默认，motif不偷偷改变图片hash；真图片失败与URL恢复有覆盖。
- 本计划仍需用户确认；本轮只产设计文档，未改产品代码。
- 2026-10-30独立可实施性检查已返回；两项修订已落盘：Task6消除旧全局风格禁令冲突，Task4/7明确项目相对封面路径与真实预览CSP验收。不放宽服务端CSP、不加入图片代理。此记录是设计修订，不代表相关功能已实现或视觉已验收。
