# 个性化后台生成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已认可的柔光质感、业务图标与插画、差异化业务页面和数据工作台接入后台生成链路，保留现有 CRUD 与旧配置行为。

**Architecture:** 在现有 admin schema 上增加可选 presentation、页面变体与工作台模块；沿用 Vue 3 / Ant Design Vue 底座、配置发射和共享 repository。图片从侧车派生，先统一有效色板再计算哈希，codegen 按区块类型消费资产；不复制 HTML 原型到生产。

**Tech Stack:** Vue 3.5.22、Ant Design Vue 4.2.6、Zod、TypeScript、Vitest、vue-tsc、Vite、pnpm workspace。不添加图表库或新的运行时依赖。

**Spec:** `docs/superpowers/specs/2026-10-29-personalized-admin-design.md`（2026-10-29 用户已批准）。

## Global Constraints

- 业务场景不受行业模板限制；原型中的品牌、文件夹和紫色不是固定输出。
- 仅改生成结果，不重新设计平台控制台，不增加真实后端、权限认证、工作流或平台持久化。
- 无 presentation 的旧输入保持原行为；新能力不得改变现有 typed actions 与集合存储语义。
- 图片几何、宽高、透明背景和构图只来自侧车；LLM 仅填写内容 prompt/alt。
- 每页模块 1–8 个、records 每块 1–10 条；稳定模块 id 页内唯一。
- 正文对比度目标 4.5:1；1440/1024/390 宽度无页面级横向溢出，表格容器可滚动。
- 不增加额外规划模型调用、不提高单任务资产上限；不调用付费模型作为本计划自动验收。
- 拷模板并发射 const 配置、v-bind props；不能改成全量代码生成或手拼属性实体。
- 当前 worktree 根执行命令，不切回原仓库，不读取或打印 .env/settings 凭证。长输出重定向到本计划 ledger 目录；读取不超过 100 行，文件超过 200 行分段读。
- 每任务 RED→GREEN→全仓测试→提交；提交仅列本任务文件，末行 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。不自动 push/merge，不提交 studio-home.png、原型或产物。

## Review Focus

- 新旧工作台字段同时出现必须拒绝，旧默认值不能掩盖新分支错误；Task 1 契约测试。
- cards 筛选后页码失效、跨页批选和删除最后一项不能遗留错误选择；Task 3 交互测试。
- 可选日期/数值为空、相同排序值、修改聚合字段时，工作台顺序稳定且即时重算；Task 5 纯函数和组件测试。
- both 运行时切换、无 matchMedia/backdrop-filter 时仍可读；重复挂载不累积监听；Task 2 测试与 Task 8 手验。
- 区块顺序颠倒、色板改变或图片缓存命中，不得交换欢迎/空态图或显示旧色图片；Task 6 联合测试。

## 文件与职责

`packages/spec/src/admin.ts` 保留组装与现有校验；新 `admin-presentation.ts`、`admin-workbench.ts` 分别管理视觉参数和模块定义/校验。`packages/templates/vue3-admin/src/data/admin-config.ts` 保存独立导出工程需要的配置类型（不得运行时依赖 @vudt/spec），通过 codegen 类型验收防漂移。主题生成位于 `packages/codegen/src/admin/theme.ts`，运行时切换位于模板 `theme/useAdminTheme.ts`。页面共用现有 collection/list/form 逻辑，不新增第二套 CRUD。工作台查询纯函数与 Vue 响应层分离。欢迎区块登记位于 `packages/templates/blocks`；色板规范化位于 spec，图片 prompt 不重复派生。最终 fixtures 验证从 draft 到导出工程的整条链路。

任务依赖：1 → 2/3/4/5；1 → 6；2–6 → 7 → 8。按下列顺序串行执行，每项独立验收；不要平行修改共享 schema/types。

## 计划级接口约定（执行者决定）

- `presentation?: { appearance?: 'plain'|'soft-glass'; decoration?: 'minimal'|'balanced'; density?: 'compact'|'comfortable'; shell?: 'sidebar'|'topbar' }`。对象存在时 appearance/decoration/shell 缺省 soft-glass/balanced/sidebar；density 缺省不填，继承 theme.spacing。对象不存在不注入默认对象。
- list 增加 `variant?: 'table'|'cards'`、`card?: { titleField: string; summaryFields: string[] }`；cards 必须带 card，其余分支禁止 card。标题字段须 string/enum，摘要字段存在且不重复。不提供图片字段映射，本轮卡片使用受控图标和文本。
- detail 增加 `variant?: 'sections'|'aside'`、`groups?: { id:string; title:string; fields:string[] }[]`、`asideFields?: string[]`；aside 必须有 asideFields，其余禁止。主分组不重复字段；侧摘要可投影主分组字段。无 groups 时按模型顺序展示全字段。
- form 增加 `variant?: 'single'|'grouped'`、`groups?: { id:string; title:string; fields:string[] }[]`；grouped 必须把 form.fields 每个 key 恰好分配一次，single/缺省禁止 groups。settings 保持旧契约。列表编辑抽屉保持现有表单，不新增第二份分组配置。
- 新工作台 `{mode:'workbench', modules: WorkbenchModule[], variant?:'overview'|'focus', primaryModuleId?:string}`，与旧 `{mode:'workbench',collections,shortcuts}` 互斥。focus 主模块必须是 records，overview 禁止 primaryModuleId。页面原有 mode discriminatedUnion 的 workbench 分支采用单 object + 精确 refinement 实现互斥，避免同 mode 的嵌套 union 问题。
- `ModuleFilter = {field:string,value:string|boolean}`，仅 enum/boolean 等值；每模块至多一个 filter。所有模块公共 `{id,title}`，id 使用现有小写 kebab 规则。
- `WorkbenchModule` 四类：summary `{kind,collection,metric:'count'|'sum',field?:string,filter?:ModuleFilter}`（sum 必须 numeric field，count 禁止 field）；breakdown `{kind,collection,field}`（enum/boolean）；records `{kind,collection,fields:string[],limit:number,sort?:{field:string,direction:'asc'|'desc'},filter?:ModuleFilter,detailRoute?:string}`；shortcuts `{kind,routes:string[]}`（非空、唯一、合法且非 auth）。records.fields 非空且唯一，detailRoute 必须同集合详情且源集合有 string/number id。
- 日期按已支持的 Date.parse 语义排序；缺失/非法值始终置后，相同值保持仓库顺序。sum 忽略缺失值，遇非有限结果显示“数值超出范围”，不显示 NaN/Infinity；无有效值返回 0。breakdown 按枚举声明顺序或 false/true，缺失值为“未填写”，零项保留。无 sort 保留仓库顺序。

### Task 1: 扩展配置契约与完整性校验

**Files:** Modify `packages/spec/src/admin.ts`, `packages/spec/src/index.ts`; Create `packages/spec/src/admin-presentation.ts`, `packages/spec/src/admin-workbench.ts`, `packages/spec/src/__tests__/admin-personalization.test.ts`, `packages/templates/vue3-admin/src/data/admin-config.ts`。

**Interfaces:** 产生 `AdminPresentationSchema`/`AdminPresentation`、`WorkbenchModuleSchema`/`WorkbenchModule`，从 spec index 导出；扩充 `AdminPage`/`AdminExperience`。新 helper `checkWorkbenchIntegrity(config, collections, pages, ctx, path): void` 参数类型沿用 admin.ts Checked 中对应元素，path 为 `(string|number)[]`；新类型显式命名导出，不使用 any。模板配置类型包含相同字段但仅 TypeScript、无 Zod。

- [ ] **Step 1 — 写契约测试。** `admin-personalization.test.ts` 使用现有 admin fixture：`expect(parse(old).ok).toBe(true)`；无 presentation 解析后仍 undefined；cards 缺 card/未知字段、grouped 漏字段/重复字段、aside 越界、混用工作台新旧字段均 `ok === false`；8/9 模块分别 true/false，records 10/11 分别 true/false；非法 sum、filter 枚举、auth shortcut、异集合 detail、重复 id、非 records 主模块逐项拒绝。合法各变体与 marketing/auth 旧 fixture 通过。
- [ ] **Step 2 — RED。** `pnpm --dir packages/spec exec vitest run src/__tests__/admin-personalization.test.ts`；Expected: 新合法配置被旧 schema 拒绝，或新导出缺失；不得因 fixture 本身非法而失败。
- [ ] **Step 3 — 实现。** 按接口约定创建严格 schema 和路径准确的完整性错误；旧 workbench 保留原有 shortcuts 缺省，不能将旧字段缺省注入 modules 分支。新图像白名单留给 Task 6，不提前放宽。
- [ ] **Step 4 — GREEN。** 上述测试、`pnpm typecheck`、`pnpm test`；Expected: 全部 exit 0，记录实际计数和警告。
- [ ] **Step 5 — 提交。** 仅提交 Files 列表，消息 `feat(spec): define personalized admin configuration`，附 attribution。

### Task 2: 柔光主题、明暗同步与双导航壳

**Files:** Modify `packages/codegen/src/admin/theme.ts`, `packages/templates/vue3-admin/src/{App.vue,theme/tokens.ts,theme/base.css,layouts/AdminLayout.vue,components/admin/AdminIcon.vue}`；Create `packages/templates/vue3-admin/src/theme/useAdminTheme.ts`；Modify `packages/spec/src/admin.ts`（图标枚举）；Test `packages/codegen/src/__tests__/admin-theme.test.ts`, `packages/templates/vue3-admin/src/__tests__/{theme,layout,icon}.test.ts`。

**Interfaces:** `renderAdminTheme(spec): Record<string,string>` 签名不变，新增发射 `src/theme/presentation.ts`（底座也新增同名默认文件，导出 undefined）；tokens 保留旧 `adminTheme`，新增可选 `adminThemeModes:{light:ThemeConfig,dark:ThemeConfig}|undefined` 与 `adminThemeMode:'light'|'dark'|'both'`。`useAdminTheme(): {theme:ComputedRef<ThemeConfig>, mode:ComputedRef<'light'|'dark'>}` 管理新路径监听；旧路径不改变 DOM 主题。新图标 key 为 calendar/task/media/document，静态映射 Ant 图标，不动态导入。

- [ ] **Step 1 — 写测试。** old spec 输出旧 tokens/CSS 不变；新 density 优先、缺省继承 relaxed；both 的 matchMedia false→true 使 ConfigProvider 算法和根 data-admin-mode 同步；卸载 `removeEventListener` 一次；无 matchMedia 默认 light。sidebar/topbar 均可点击分组子项，mobile 菜单开合保留路径；未知 icon 无动态执行。浅/深正文与实底对比度 `>=4.5`。
- [ ] **Step 2 — RED。** `pnpm --dir packages/codegen exec vitest run src/__tests__/admin-theme.test.ts` 及模板 `pnpm --dir packages/templates/vue3-admin exec vitest run src/__tests__/theme.test.ts src/__tests__/layout.test.ts src/__tests__/icon.test.ts`；Expected: 新主题/导航断言失败。
- [ ] **Step 3 — 实现。** 主题 tokens 派生材质、实底、文字、边界和焦点；差对比色板调整前景而非接受不可读组合。仅背景、导航、欢迎容器 blur；CSS @supports 提供实色回退。presentation shell 通过 App 传 AdminLayout；topbar 使用同导航树、Ant 下拉/抽屉与键盘操作。不得全局改变旧选择器行为；新路径带独立根类。加载 frontend-design 技能后按已认可原型实施，不重新决定视觉风格。
- [ ] **Step 4 — GREEN。** 两组定向测试、`pnpm typecheck`、`pnpm test`；Expected: exit 0。新底座默认文件保证独立模板也能 typecheck。
- [ ] **Step 5 — 提交。** `feat(admin): add soft glass theme and adaptive navigation`。

### Task 3: 卡片列表与共用 CRUD

**Files:** Modify `packages/templates/vue3-admin/src/components/admin/AdminListPage.vue`, `packages/templates/vue3-admin/src/composables/useAdminList.ts`（仅必要的页码/选择修正）；Create `packages/templates/vue3-admin/src/components/admin/AdminRecordCards.vue`；Test `packages/templates/vue3-admin/src/__tests__/list-page.test.ts`。

**Interfaces:** cards 仅展示组件，props `{rows:Row[], titleField:string, summaryFields:string[], selectedIds:(string|number)[]}`，emit `toggle(id)`、`action({id,actionIndex})`；另传经现有 formatter 格式化所需的 model/actions，不在子组件创建 store。AdminListPage.config 使用 Task 1 模板类型。

- [ ] **Step 1 — 写交互测试。** 同一 fixture table/cards 均能筛选、分页、新增、编辑、详情、删除、set-field、bulk-delete；断言保存后同一 repository 数据变化。筛选从末页回到有效页、删除末项页码有效、取消/完成批删清选择；字段含 `<script>` 以文本显示。长字段、无匹配结果有清空筛选入口。
- [ ] **Step 2 — RED。** `pnpm --dir packages/templates/vue3-admin exec vitest run src/__tests__/list-page.test.ts`；Expected: cards DOM/交互断言失败。
- [ ] **Step 3 — 实现。** 筛选分页选择与动作由父页面统一管理；cards 使用同一动作处理器、drawer、确认框和路由，表格路径保持原样。增加可键盘操作的复选及图标配文字；无字段图片不造图片，不引入第二套数据源。
- [ ] **Step 4 — GREEN。** 定向测试、`pnpm typecheck`、`pnpm test`；Expected: exit 0。
- [ ] **Step 5 — 提交。** `feat(admin): add cards view with shared record actions`。

### Task 4: 分区详情与分组表单

**Files:** Modify `packages/templates/vue3-admin/src/components/admin/{AdminDetailPage,AdminFormPage,AdminRecordFields}.vue`；Test `packages/templates/vue3-admin/src/__tests__/{pages,record-form}.test.ts`。

**Interfaces:** AdminDetailPage/AdminFormPage.config 使用 Task 1 类型；AdminRecordFields 增加可选 `groups`，不改变原 fields/modelValue/事件接口。无 groups 的 drawer/settings 继续旧布局。

- [ ] **Step 1 — 写测试。** aside 显示同一记录投影、编辑后详情同步；unknown ID 有明确未找到和返回入口；sections 不重复主字段。grouped 每字段恰好一个控件，必填/格式校验未弱化，提交一次更新 repository，保存/返回行为不变；settings/drawer 缺省回归。
- [ ] **Step 2 — RED。** `pnpm --dir packages/templates/vue3-admin exec vitest run src/__tests__/pages.test.ts src/__tests__/record-form.test.ts`；Expected: 分组与侧栏断言失败。
- [ ] **Step 3 — 实现。** 分组改变呈现不改变值与校验；标题分级、错误定位、长值换行。aside 宽屏两栏、窄屏在主内容后；保留现有返回和未知记录处理，不编造时间线。
- [ ] **Step 4 — GREEN。** 定向测试、`pnpm typecheck`、`pnpm test`；Expected: exit 0。
- [ ] **Step 5 — 提交。** `feat(admin): add grouped forms and detail variants`。

### Task 5: 数据驱动的工作台模块

**Files:** Create `packages/templates/vue3-admin/src/data/workbench.ts`, `packages/templates/vue3-admin/src/components/admin/AdminWorkbenchModule.vue`, `packages/templates/vue3-admin/src/__tests__/workbench.test.ts`；Modify `packages/templates/vue3-admin/src/components/admin/AdminWorkbenchPage.vue`；Extend `src/__tests__/pages.test.ts`（同模板目录）。

**Interfaces:** `evaluateWorkbenchModule(module:WorkbenchModule, rows:readonly Row[], model:Record<string,FieldModel>): WorkbenchResult`，Result 为 `{kind:'summary',value:number|null}`（null=溢出）、`{kind:'breakdown',items:{label:string,count:number}[]}`、`{kind:'records',rows:Row[]}`、`{kind:'shortcuts',routes:string[]}` 的 union。模块组件只渲染结果，父组件 computed 调用已有 useAdminCollection，旧分支继续原代码。

- [ ] **Step 1 — 写测试。** 数量/过滤 sum/枚举分布准确；空 sum=0、溢出=null；日期空值置后、同值稳定，不对 store.rows 原地 sort。新增、修改枚举/金额、删除后组件值立即变化。records 最多 limit 条，仅合法 detailRoute 生成详情跳转；focus 主 records 首位，其余辅助；旧工作台计数及快捷入口回归。
- [ ] **Step 2 — RED。** `pnpm --dir packages/templates/vue3-admin exec vitest run src/__tests__/workbench.test.ts src/__tests__/pages.test.ts`；Expected: evaluator 缺失/新模块断言失败。
- [ ] **Step 3 — 实现。** 按约定实现纯函数、computed 与 overview/focus 布局；加载 dataviz 技能后实现摘要和带标签分布列表，不新增图表库、不制造趋势。缺失值和空集合明确显示；非颜色独占编码，模拟数据声明保留。
- [ ] **Step 4 — GREEN。** 定向测试、`pnpm typecheck`、`pnpm test`；Expected: exit 0。
- [ ] **Step 5 — 提交。** `feat(admin): render data driven workbench modules`。

### Task 6: 欢迎插画、侧车与有效色板全链路

**Files:** Create `packages/templates/blocks/src/blocks/admin-welcome-panel.slots.ts`, `packages/templates/vue3-base/src/blocks/AdminWelcomePanel.vue`, `packages/templates/vue3-admin/src/components/admin/AdminWelcomePanel.vue`, `packages/spec/src/effective-style.ts`；Modify `packages/templates/blocks/src/{registry,index}.ts`, `packages/spec/src/{admin,hash,index}.ts`, `packages/codegen/src/admin/page.ts`, 模板 `AdminListPage.vue`/`AdminWorkbenchPage.vue`；Tests: blocks `src/__tests__/derive.test.ts`、spec `src/__tests__/{hash,admin-personalization}.test.ts`、codegen `src/__tests__/admin-project.test.ts`、imagegen `src/__tests__/generate.test.ts`、providers `src/__tests__/request-observer.test.ts`，以及新模板 `src/__tests__/welcome.test.ts`。

**Interfaces:** `effectiveStyleBible(input:ProjectSpecInput):StyleBible` 返回新对象，新 admin presentation 路径 palette 固定 `[primary,secondary,accent]`（顺序固定，重复色不删，满足最少两项）；旧输入原样。`finalizeSpec` 先规范化 bible 再 hash 并返回该 bible，后续 prompt/observer 消费同一值。欢迎区块 component=`AdminWelcomePanel`，props=`headline/body`，slot=`illustration`，purpose=`empty-state`（复用合法通用插画用途，不扩资产枚举），1:1、512×512、transparent=true、centered；两端 Vue 都使用 props.assets.illustration 的侧车 w/h，不硬编码独立几何。

- [ ] **Step 1 — 写链路测试。** derive 产生指定几何与绑定；未知 slot/几何覆盖继续拒绝。list/workbench 欢迎+空态通过、重复欢迎/第三块/detail欢迎/auth欢迎/minimal欢迎拒绝。颠倒 blocks 顺序后 adminPageProps.welcomePanel/emptyPanel 仍正确。改变 primary 后 hash 与实际发送 prompt 都改变；旧 marketing hash 不变，缓存命中不伪造请求；observer 最终 prompt 包含同 palette 和负面约束。
- [ ] **Step 2 — RED。** 对上述每个包运行 `pnpm --dir <包目录> exec vitest run <上述测试相对路径>`；Expected: 新组件未登记、新校验或色板断言失败，记录每项 RED，不把旧断言失败当目标 RED。
- [ ] **Step 3 — 实现。** 注册并导出区块（registry 维持既有排序）；admin.ts 按批准的页面白名单校验。adminPageProps 按 component 分类，不用 blocks[0] 猜用途；auth 仍 panel。欢迎在非空列表/工作台也显示，缺资产时不渲染 img，保留标题布局；无资产与生成失败严格区分，后者不替换为假成功。新增欢迎块仅 admin 允许，marketing 路径拒绝，防止扩大范围。侧栏仅复用已有资产或静态受控图标，不多生成图片。
- [ ] **Step 4 — GREEN。** 上述定向测试、`pnpm typecheck`、`pnpm test`；Expected: exit 0，缓存、几何和请求观察回归通过。
- [ ] **Step 5 — 提交。** `feat(admin): integrate welcome illustrations and coherent palette`。

### Task 7: Drafter 引导、配置发射与二开文档

**Files:** Modify `packages/providers/src/{openai-spec-drafter,admin-example}.ts`, `packages/codegen/src/admin/{readme,project}.ts`；Test `packages/providers/src/__tests__/openai-spec-drafter.test.ts`, `packages/codegen/src/__tests__/admin-project.test.ts`；Create `packages/codegen/src/__tests__/personalized-admin-fixtures.ts`。

**Interfaces:** `renderAdminReadme(spec:ProjectSpec):string` 替换原无参版本，同步 project.ts 调用。fixtures 导出三个合法 draft：设备维护（table/grouped/focus）、素材目录（cards/aside/overview）、报名管理（plain/minimal/table）；仅测试场景，不写成行业枚举或固定产品模板。

- [ ] **Step 1 — 写测试。** 捕获 drafter system prompt，断言合法参数、模块上限、字段引用、旧/新 workbench 互斥、模拟数据声明、禁止伪造能力规则存在；新 admin-example 可 derive→parse→finalize。三 fixture 的生成 config 保留差异，README 包含其实际路由对应模块路径、主题位置、form id、数据替换入口及刷新重置说明。用户文案含引号/换行/`</script>` 不破坏发射。
- [ ] **Step 2 — RED。** providers 与 codegen 各运行上述测试；Expected: 新提示契约、README 实际入口断言失败。
- [ ] **Step 3 — 实现。** 提示指导先业务页面/数据后材质选择，新草稿默认 soft-glass/balanced/comfortable/sidebar，明确克制需求则 plain/minimal。不另发模型规划请求，复用原失败反馈；欢迎资产按预算选择，不要求页页有图。更新 README，仅宣称已有能力，保持 const+v-bind 发射路径。
- [ ] **Step 4 — GREEN。** 两包定向测试、`pnpm typecheck`、`pnpm test`；Expected: exit 0。
- [ ] **Step 5 — 提交。** `feat(generator): guide personalized admin output and customization`。

### Task 8: 导出工程与视觉交互验收

**Files:** Create `packages/codegen/src/__tests__/personalized-admin.test.ts`, `docs/superpowers/verification/2026-10-29-personalized-admin.md`；必要失败修复限定本计划文件。不得用更新快照掩盖旧行为回退。

**Interfaces:** 使用 Task 7 三 fixture 与现有 writeProject/构建沙箱测试入口，生成隔离临时工程，拷底座、写配置和本地测试资产（明确标为 fixture，非模型图片）。生成工程只依赖其自身 package.json，不引入 monorepo 路径别名。

- [ ] **Step 1 — 写验收测试。** 三 fixture 完成 derive→parse→finalize→generate→write，检查 expectedAssets 每项有实际消费者、资产存在；保持旧 admin/marketing/auth fixture。对每个实际生成工程运行 vue-tsc 与 Vite，不能用仓库 typecheck 或 Vite 单独替代。把编译命令 exitCode 断言为 0，并检查没有丢失 modules/variant 配置。
- [ ] **Step 2 — RED/覆盖检查。** 运行 `pnpm --dir packages/codegen exec vitest run src/__tests__/personalized-admin.test.ts`；若已全部通过，如实记录这是集成验证，不能伪称 RED；新发现缺陷必须另加最小复现 RED 后修复。
- [ ] **Step 3 — 浏览器验收。** 加载 run 技能，从本 worktree 启动生成工程的本地预览，不能误看4302上的平台；1440/1024/390 各截图并实际查看。逐项执行 cards/table 筛选→详情→编辑→保存、创建/批删、聚合实时变化、topbar 分组、窄屏菜单；深浅模式及 both 系统切换、长文案、unknown id、错误焦点、无 backdrop-filter、reduced motion。记实测与未测，不以 HTTP200 代替视觉验证，不调用付费模型。
- [ ] **Step 4 — 全仓验收。** `pnpm test`、`pnpm typecheck`、`pnpm build`、`git diff --check`，全日志存 ledger，Expected: 均 exit 0；记录测试数量/警告。人工截图与操作证据写 verification 文档。
- [ ] **Step 5 — 提交并整支评审。** `test(admin): verify personalized exported projects`；按执行技能做一次独立整支评审，审查本计划基线到 HEAD（不要含1.0历史）。阻塞修复必须 RED→GREEN，Minor 逐项记录；不自动推送。

## 自审与执行交接

- 覆盖：设计 §3→Task 2，§4→Tasks 1/3/4，§5→Tasks 1/5，§6→Task 6，§7→Task 7，§8–9→Task 8；§10 技术取舍已落实接口和测试。
- 接口：Task 1 schema 与模板独立类型通过 Task 8 真实导出 vue-tsc 校验；Task 6 finalize 返回有效 bible，hash/prompt/request 不分别派生；Task 7 README 调用方同步更新。
- 默认判定：保留旧 both 行为，仅新 presentation 开启自动同步；密度不填则继承；图像只生成一套，不随系统明暗再次调用模型。
- 计划只完成设计与任务分解，不宣称代码测试已运行；执行阶段需记录自己的新证据。
- 推荐 Native/Inline：8 个任务有连续 schema/types 接口，单执行者可减少重复读取和接口漂移，最后保留一次独立整支评审。开始前仍需用户审阅计划并确定执行方式。
