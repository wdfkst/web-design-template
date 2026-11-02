# 后台风格库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在平台选择五套后台风格，并让选择确定性约束预览、生成项目、布局、组件及插画。

**Architecture:** spec 提供版本化数据契约与纯函数；server 在模型输出后、资产派生前应用选择；模板共享业务组件而分离布局；预览使用同一生成链与本地 fixture，不调用模型。

**Tech Stack:** TypeScript、Zod、Vue 3、Ant Design Vue、Vite、Vitest、现有 pnpm workspace。

**Spec:** `docs/superpowers/specs/2026-11-02-admin-style-library-design.md`

## Global Constraints

- AdminStyleId 为 soft/warm/mist/porcelain/aurora；v1 发布后不可原地修改。
- 用户选择不得由 LLM 覆盖；缺省保留旧路径，非法显式输入返回400。
- 非后台模型输出进入校验反馈重试；未知版本在任何模型调用前失败。
- 风格不修改业务 pages/collections/forms/navigation，不允许模型写资产几何。
- soft/warm/mist/porcelain 固定浅色，aurora 固定深色；旧项目保留原切换。
- material 缺省时旧 hash 输入逐项不变；新增材质必须改变图片缓存键。
- 本期无新增付费调用、任务持久化、全局配置改动；科技插画标明示意。
- 不自动提交。每任务的提交检查点须获得用户针对本轮的明确授权，否则只记录已完成文件。获授权后提交附 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。
- 超过200行的文件分段读取；长日志重定向后定位读取，不输出完整日志。

## Review Focus

1. 显式 null/未知ID、历史未知版本不能降级或触发付费：任务1、3。
2. 合法营销 draft 可以通过旧校验，因此必须显式阻止带风格的非admin结果：任务2、4。
3. 新 material 不能导致旧缓存全部失效，受控 seed 不能每次验证变化：任务2、5。
4. 模型伪造风格引用、导出丢字段、布局缺少模块不能绕过约束：任务2、6。
5. iframe opaque origin、子路径资源和无存储环境可能破坏预览：任务7、8、9。

## 文件职责与接口约定

新建 `packages/spec/src/admin-style.ts`：ID/reference/schema/注册表/解析；`packages/spec/src/admin-style-apply.ts`：纯风格应用，禁止依赖server。新建 `scripts/admin-style-previews/`：fixture、素材、构建和验证。新建 web 风格选择器及预览弹层。模板新增命名风格主题文件与布局组件，保留旧布局分支。

统一引用 `AdminStyleReference = {id: AdminStyleId; version: number}`。仅服务端可以从当前注册表选择版本；schema 校验正整数，resolver 检查具体版本是否受支持。`resolveAdminStyle(ref): AdminStyleDefinition | undefined` 不抛 HTTP 错误。未知版本的 HTTP/任务错误由调用层转换。

`applyAdminStyle(raw: unknown, ref: AdminStyleReference, seed: number): {ok:true; value:unknown} | {ok:false; feedback:string}`：对象结构错误或非admin时返回失败；失败不会进入 derive。无用户选择时完全不调用它。注册表解析失败不在这里消费重试预算，由runner预检。

## Task 1：版本化注册表与完整确定参数

**Files:** 新建 `packages/spec/src/admin-style.ts`、`packages/spec/src/__tests__/admin-style.test.ts`；修改 `packages/spec/src/index.ts`。
**Interfaces:** 产生 AdminStyleIdSchema、AdminStyleReferenceSchema、AdminStyleDefinition、ADMIN_STYLE_IDS、getCurrentAdminStyleReference(id)、resolveAdminStyle(ref)。Definition 使用现有 Theme、AdminPresentation、Omit<StyleBible,'seed'|'palette'>，另有 material、shellVariant、workbenchLayout、skin；不重复手写缩窄现有类型。

- [ ] 写失败测试：五ID恰好存在；未知ID/版本resolver返回undefined；注册表各项通过现有theme/presentation校验；v1引用解析稳定；对同一对象修改不会改变后续解析结果（冻结常量或返回不可变副本）。
- [ ] 运行 `pnpm exec vitest run packages/spec/src/__tests__/admin-style.test.ts`，确认失败来自新模块/导出缺失。
- [ ] 实现完整v1定义。颜色按 primary/secondary/accent/background/surface/foreground/muted 顺序：soft=`#7550B5/#9C6A36/#D19643/#F8F4FF/#FFFFFF/#282135/#706779`；warm=`#6A7353/#9A6247/#A4783D/#F7F3E9/#FFFCF5/#302E26/#716C60`；mist=`#526998/#77719C/#487E83/#F1F5FA/#FFFFFF/#253247/#637086`；porcelain=`#356B9B/#66798D/#40868B/#F3F7FB/#FFFFFF/#253341/#617385`；aurora=`#A7C6FF/#C3ACFA/#83D5CE/#141B2D/#202A40/#EEF3FC/#ACB8CE`。这些是助手给出的初始实现值，若对比度测试不通过，记录并修正相应前景色，不降低门槛。
- [ ] 全套字体 heading/body 均使用本地系统栈 `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`，不依赖外网字体。radius soft=lg、其余md；spacing全normal；density全comfortable、decoration全balanced、motif全部缺省。appearance soft=jelly、warm=plain、其他soft-glass；shell soft/warm/porcelain=sidebar，其余topbar。命名风格skin控制实际组件细节，不沿用旧jelly默认装饰。
- [ ] shellVariant按 soft=icon-sidebar、warm=expanded-sidebar、mist=top-nav、porcelain=wide-sidebar、aurora=top-nav-context；workbenchLayout依次 welcome-grid、main-aside、sectioned、staggered、main-context；skin等于ID。artStyle/material按设计配对；lineWeight warm=thin其他none，shading全soft-gradient，perspective全three-quarter，backgroundTreatment全subtle-gradient，negativePrompt固定`text, watermark, user interface screenshot`。palette不存注册表，使用既有派生逻辑。
- [ ] 再运行上述测试及 `pnpm -F @vudt/spec typecheck`；提交检查点遵守全局授权规则。

## Task 2：Spec 契约、派生透传与纯风格应用

**Files:** 修改 `packages/spec/src/project-spec.ts`、`packages/spec/src/style-bible.ts`、`packages/spec/src/index.ts`、`packages/templates/blocks/src/derive.ts`；新建 `packages/spec/src/admin-style-apply.ts`、`packages/spec/src/__tests__/admin-style-apply.test.ts`，在 blocks 既有 derive 测试中补字段保留断言。
**Interfaces:** 消费任务1；产生 applyAdminStyle；ProjectSpecInput/ProjectSpec 可选 adminStyle；StyleBible 可选 material 五值枚举。

- [ ] 写失败测试：受控theme/presentation/styleBible被完整替换；pages/collections/forms/navigation和asset主题保持深相等；原对象不变；非admin包括合法marketing返回明确feedback；字符串/null/数组不能被修成对象；合法非负seed保留，缺失/非法时使用显式seed参数。
- [ ] 运行 `pnpm exec vitest run packages/spec/src/__tests__/admin-style-apply.test.ts`，确认预期失败。
- [ ] 实现纯函数，成功输出带可信adminStyle引用。保留experience除presentation外的业务字段；styleBible palette用有效主题派生，seed按上步约定。不要覆盖业务数据。验证最终spec中有adminStyle时 experience必须admin且受控字段与版本定义一致，拒绝伪造不一致引用；无ref旧schema行为保持。
- [ ] 修改derive的输入schema/对象构造中必要透传点，不能因strict/strip丢adminStyle/material；无选择时剥离模型自称的adminStyle，避免模型冒充用户选择，但不删除旧theme/presentation。该剥离在任务4编排入口完成。
- [ ] 加入完整链断言：apply→derive→parse→finalize后引用/材质仍存在、几何不变；先观察新断言失败再改透传。
- [ ] 运行 `pnpm -F @vudt/spec test` 与 `pnpm -F @vudt/blocks test`；按授权提交或记录检查点。

## Task 3：API 校验、任务快照与重试

**Files:** 修改 `server/src/app.ts`、`server/src/store.ts`、`server/src/runner.ts`；新建 `server/src/__tests__/admin-style-request.test.ts`。任务响应序列化沿app现有路径补同名字段。
**Interfaces:** POST /tasks 新增可选adminStyleId；TaskRecord/TaskView新增可选adminStyle；重试复制原引用。

- [ ] 写失败测试表：缺省旧行为；五合法ID生成v1快照；null/空串/未知/数字/数组/对象返回400且不入队；伪造客户端version不能改变服务端v1；重试复制原ref；未知历史版本模型spy调用0次并明确失败；队列满仍503。
- [ ] 运行 `pnpm exec vitest run server/src/__tests__/admin-style-request.test.ts` 确认新行为失败。
- [ ] 在共享创建任务入口验证，不只HTTP路由一处；有字段但非法不等同缺省。存储引用副本；任务响应只返回安全ref，不返回注册表/凭证。runner在drafting模型调用前检查版本；内部错误用现有ServerError/任务错误格式，不让spec依赖server。
- [ ] retry沿现有设置语义，仅新增保留原adminStyle；从注册表不存在的版本不得升级重试。
- [ ] 运行新增测试和 `pnpm -F @vudt/server test`；按授权提交或记录检查点。

## Task 4：Drafter 上下文及派生前强制约束

**Files:** 修改 `server/src/spec-source.ts`、`server/src/runner.ts`、`packages/providers/src/openai-spec-drafter.ts`；新建 `server/src/__tests__/admin-style-drafting.test.ts`；扩展 `packages/providers/src/__tests__/openai-spec-drafter.test.ts`。
**Interfaces:** SpecDraftRequest、DraftSpecOptions添加可选adminStyle引用；DraftSpecOptions添加可选adminStyleSeed，仅当风格存在时使用，整个任务重试共用同一个seed。

- [ ] 写失败测试：fake drafter连续返回合法marketing→合法admin，第一次必须产生feedback且不被接受；冲突主题覆盖；坏JSON原文仍进入原反馈路径；无风格不应用注册表且不接受模型自称adminStyle；三次尝试保持ref和seed；未知版本在调用前失败。
- [ ] 运行 `pnpm exec vitest run server/src/__tests__/admin-style-drafting.test.ts` 确认失败。
- [ ] 更新真实provider请求类型与prompt，仅传注册表的安全风格摘要，要求admin并规划现有业务内容；不让模型生成几何，不要求省略仍被draft schema要求的字段。坏JSON仍返回原文。
- [ ] draftSpec中顺序为raw→风格基本检查/apply→derive→parse→finalize。apply失败与derive失败共用onValidation failed、feedback与次数；不能“返回raw继续旧校验”，因为合法marketing可能被接受。无ref只剥模型伪造引用，其他旧行为保持。
- [ ] 跑上述测试、`pnpm -F @vudt/providers test`、`pnpm -F @vudt/server typecheck`；按授权提交或记录检查点。

## Task 5：材质提示词与缓存兼容

**Files:** 修改 `packages/spec/src/hash.ts`、`packages/imagegen/src/prompt.ts`；扩展 `packages/spec/src/__tests__/hash.test.ts` 和 imagegen 既有prompt测试文件（实施前定位其准确路径，不新造同名测试）。
**Interfaces:** material是StyleBible可选字段；既有buildPrompt和assetContentHash签名不变。

- [ ] 先记录旧fixture完整hash为固定golden；新增测试断言无material严格等于golden，各material与缺省hash不同、同参稳定、主题配色改变失效。prompt缺省完整字符串不变，新材质位于风格前缀后与主题前。
- [ ] 运行 `pnpm -F @vudt/spec test`、`pnpm -F @vudt/imagegen test` 确认新增材质断言失败。
- [ ] 只在material存在时向既有hash字段序列末尾追加域标签`material`和材质值；无material不追加空串/undefined。提示词用固定map：soft-clay柔软哑光黏土；natural-paper温润自然纸感手绘；frosted-glass磨砂半透明柔光；porcelain-metal白釉陶瓷与磨砂金属；aurora-optical半透明光学物体与克制极光。现有构图、背景及负面约束顺序不动。
- [ ] 重跑两包测试和typecheck；不发真实图片请求；按授权提交或记录检查点。

## Task 6：Codegen 与五套真实模板布局

**Files:** 修改 `packages/codegen/src/admin/theme.ts`、`packages/codegen/src/admin/project.ts`；修改 `packages/templates/vue3-admin/src/layouts/AdminLayout.vue` 及现有工作台/登录组件；新建 `packages/templates/vue3-admin/src/components/admin/AdminStyleWorkbench.vue`、`packages/templates/vue3-admin/src/theme/admin-styles.css`、`packages/templates/vue3-admin/src/__tests__/admin-styles.test.ts`、`packages/codegen/src/__tests__/admin-styles.test.ts`。
**Interfaces:** 生成的presentation.ts新增export adminStyle（ref或null）及styleLayout（shellVariant/workbenchLayout/skin或null）。模板底座提供相同默认导出；业务组件不能运行时依赖spec包。

- [ ] 写失败测试：生成输出保留ref、布局配置和固定mode；缺省导出null走旧分支。模板检查实际nav/main/aside区域、模块DOM顺序，而非仅data属性。
- [ ] 运行 `pnpm exec vitest run packages/codegen/src/__tests__/admin-styles.test.ts packages/templates/vue3-admin/src/__tests__/admin-styles.test.ts` 确认失败。
- [ ] codegen解析注册表，发射受信任常量与CSS令牌；按原const+v-bind发射约束，不插入用户CSS。命名风格隐藏明暗切换；旧输出保持既有行为。
- [ ] 实现导航壳分支和AdminStyleWorkbench布局：soft欢迎区后网格；warm主体+现有次级模块侧区；mist顶部导航后分区；porcelain宽侧栏与交错主次网格；aurora顶部导航/主区+上下文侧区。模块分配保持输入顺序：首模块主区，其余依次分配；没有次级模块则隐藏aside。不创建业务日程或假指标。
- [ ] 实现五skin的卡片、按钮、表格、筛选、分页、输入、错误状态、空状态与auth视觉；装饰不截获点击，必要动画遵守reduced-motion。业务组件与登录逻辑复用，页面在390px折叠而表格自身可横滚。
- [ ] 对比度测试在测试文件内定义sRGB线性化/WCAG对比度辅助函数，不引入未定义calculateContrast。检查实际文本/背景、按钮文字/填充，普通文字至少4.5:1；焦点不能只检查存在class。
- [ ] 运行 `pnpm -F @vudt/template-vue3-admin test`、`pnpm -F @vudt/codegen test` 及两包typecheck；按授权提交或记录检查点。

## Task 7：真实模板预览制品

**Files:** 新建 `scripts/admin-style-previews/fixture.ts`、`build.ts`、`manifest.ts`、`assets/README.md`、`__tests__/preview.test.ts`；修改根 `package.json` 和 `web/package.json`；复制授权样例素材到本目录assets（不能发布.vudt整个目录）。
**Interfaces:** createCoffeePreviewDraft()返回同一合法draft；buildAdminStylePreviews(outputDir:string):Promise<void>；validatePreviewManifest(dir:string):Promise<void>。manifest包含schemaVersion、模板输入SHA256、五项{id,version,entry,assetKind}。

- [ ] 写失败测试：fixture引用完整且包含workbench/list/edit及必要详情；五项manifest齐全；缺文件/错版本/错模板指纹失败；构建失败不替换旧成功制品；入口拒绝绝对路径与`..`。
- [ ] 运行 `pnpm exec vitest run scripts/admin-style-previews/__tests__/preview.test.ts` 确认失败。
- [ ] fixture采用schema现有合法组件、collection/form绑定，与现有build集成测试相同接口生成；各风格只更换可信ref。preview使用本地素材provider并在测试断言网络请求0次。soft/warm/mist复用已批准图，porcelain/aurora新建本地示意SVG并显式标注。README记录素材来源、AI或示意，不含配置。
- [ ] 串行按apply→derive→parse→finalize→现有buildTask构建五项目，显式执行生成项目vue-tsc及vite，不能把build成功等同类型通过。不臆造buildTask返回值，以实际公开接口封装脚本。base设为相对路径供嵌套静态入口；每项同项目可切三页。
- [ ] 指纹由相对路径排序后的注册表/模板/codegen/fixture/素材文件内容计算，不含绝对路径/mtime。全部成功才更新 `web/public/admin-style-previews/`，通过staging+备份恢复保护旧产物；目录加入适当ignore，不能删除其他web资源。
- [ ] 根增加build:admin-previews与check:admin-previews；明确调用本仓可解析tsx入口，必要将tsx添加根devDependency而非依赖全局。web正式build先调用预览构建和校验再vite；dev不调用生成脚本。避免递归调用根build。缺制品时开发UI提示构建命令。
- [ ] 运行新增测试与 `pnpm build:admin-previews`、`pnpm check:admin-previews`，确认五项目类型/构建均通过且零付费调用；按授权提交或记录检查点。

## Task 8：平台风格选择、预览与任务详情

**Files:** 修改 `web/src/api/client.ts`、`web/src/views/TaskList.vue`、`web/src/views/TaskDetail.vue`、`web/package.json`；新建 `web/src/components/AdminStylePicker.vue`、`AdminStylePreview.vue`、`web/src/__tests__/admin-style-picker.test.ts`。
**Interfaces:** createTask(description:string, adminStyleId?:AdminStyleId)保留现有调用兼容；TaskView可选adminStyle。选择器v-model值AdminStyleId|undefined；没有启用则不传字段。添加@vudt/spec workspace依赖，页面只取安全目录元数据。

- [ ] 写失败测试：初始不选；启用后台选择后未选不能提交；五卡片选择只传ID；关闭选择区恢复旧请求；TaskDetail显示名称版本；未知历史名称显示原ID不崩溃。
- [ ] 运行 `pnpm exec vitest run web/src/__tests__/admin-style-picker.test.ts` 确认失败。
- [ ] 实现卡片/预览三页切换、manifest校验与错误重试；浏览仅加载静态资源，禁止调用/tasks。iframe固定白名单本地入口、sandbox仅allow-scripts，禁止allow-same-origin。示意标注显示在外层UI，不能被图片加载错误隐藏。
- [ ] 键盘测试：Tab可聚焦、Enter选择、Escape关闭、关闭后焦点回原按钮；弹层焦点限制、可读label、加载与失败状态可播报。提交期间沿现有禁用和错误处理，不丢失选择。
- [ ] 运行 `pnpm -F @vudt/web test` 和 `pnpm -F @vudt/web typecheck`；按授权提交或记录检查点。

## Task 9：跨链路导出、浏览器与回归验收

**Files:** 新建 `server/src/__tests__/admin-style-integration.test.ts`、`docs/superpowers/verification/2026-11-02-admin-style-library.md`；按需要补现有build测试，不增加付费测试。
**Interfaces:** 消费任务1–8所有正式接口；不引入额外用户功能。

- [ ] 写集成失败场景断言：fake drafter输出不同风格和营销类型，最终风格匹配请求且业务数据未变；retry引用不漂移；缓存material变化失效；选风格→生成→导出保留布局。运行 `pnpm exec vitest run server/src/__tests__/admin-style-integration.test.ts`，修集成遗漏直到通过。
- [ ] 执行 `pnpm test`、`pnpm typecheck`、`pnpm build:admin-previews`、`pnpm -F @vudt/web build`、`git diff --check`；日志重定向，记录实际退出码与测试数量，不沿用旧815数字。
- [ ] 用浏览器检查五风格×工作台/列表/编辑15组合，在1440和390宽度检查图片实际加载、模块实际顺序、DOM区域、筛选/分页、编辑校验及保存提示。表格自身滚动允许，页面无横向溢出。逐组合截图实际查看，不以DOM断言冒充视觉验收。
- [ ] 在正式嵌套URL和sandbox=allow-scripts下检查静态资源、模块脚本、路由切换和拒绝storage时的行为；不能因沙箱问题增加allow-same-origin绕过。失败时改预览fixture/资源部署而非放宽隔离。
- [ ] 检查键盘焦点、Escape返回、reduced-motion、固定明暗；执行旧登录、退出、路由守卫、auth-only/no-auth回归。登录页按五风格各看一次；不把预览业务编辑当真实业务写入。
- [ ] 验收文档记录命令、结果、截图路径、素材类别和任何未验项；无新增付费请求。请用户检查实际生成模板效果后再宣称视觉完成。
- [ ] 根据本轮明确授权决定提交/推送；没有授权只交付变更清单，不自动提交。

## 自审记录

- 主线程重写，未沿用子代理的跨层ServerError、非admin原样放行、占位注册表或错误路径。
- 九任务覆盖已批准设计；任务2/4显式处理合法marketing绕过问题；任务5保护旧hash；任务7/9覆盖隔离预览与真实构建。
- 本文件是实施指令，不表示测试已运行、功能已实现或视觉已验收。执行前审阅并选择Native或Subagent方式。
