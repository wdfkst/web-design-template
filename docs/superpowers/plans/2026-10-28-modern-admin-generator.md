# 现代后台生成器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成具有现代后台布局、完整本地业务交互、可定制视觉和可扩展模块结构的 Vue 3 工程。

**Architecture:** 显式 admin 走独立后台底座和类型化页面配置，旧 spec 与营销站保持原路径。复用 collections/forms 和插槽派生链，确定性生成模块与导航；后台构建必须执行类型检查。

**Tech Stack:** Vue 3.5.22、Vue Router 4.5.1、Ant Design Vue 4.2.6、TypeScript 5.9.2、Vite 7.3.6、Zod、Vitest；图标使用与 Ant Design Vue 兼容的 @ant-design/icons-vue，实施时核对依赖并锁定精确版本。

**Spec:** `docs/superpowers/specs/2026-10-28-modern-admin-generator-design.md`

## Global Constraints

- 用户明确指定 Ant Design Vue；不使用 Element Plus，不运行时加载 CDN。
- 本轮不做真实 API、认证、RBAC 或持久化；mock 路由间共享，整页刷新重置。
- 旧 spec 缺省 experience 保持原底座；新 admin 不任意拼接旧业务块。
- 几何只来自侧车，模型只填写 prompt/alt；不放宽路径、路由、组件属性安全约束。
- props 仍采用 const + v-bind，不把不可信文本直接拼入模板。
- 构建保持代码 → 图片 → 类型检查 → vite 顺序，保留沙箱限制。
- 五种业务页面均在最终范围内；先列表再扩展是顺序，不是裁剪。
- 主题按需求生成，本轮不增加运行时换肤开关。
- 不提交或推送 Git，除非用户另外明确要求；每任务用 diff 与测试结果作为检查点。
- 超过 200 行文件分段读取，输出超过 100 行重定向日志；每次只执行一个任务。

## Review Focus

- 数字/字符串主键、编辑后跨页进入详情：主键一致且共享修改可见（任务 3、5）。
- 删除/过滤导致页数收缩：合法页码，不残留不可见选择（任务 4）。
- 恶意标题、路径与图标名：只作为数据，不进入代码、路径或任意 HTML（任务 1、5）。
- 后台主题强对比/浅色主色：文本可读、语义色不受主色覆盖（任务 2、7）。
- 脏 spec、旧路径与混合声明：明确校验失败或兼容，不静默丢字段、不切错底座（任务 1、6、8）。

## 文件边界

新增 `packages/spec/src/admin.ts` 管后台声明与跨字段约束；blocks/draft 只负责传递与图片派生。
新增 `packages/templates/vue3-admin/` 是可独立构建的基础项目，不依赖 web 控制台源码。
新增 `packages/codegen/src/admin/`：project.ts 组织产物、page.ts 生成模块、navigation.ts 生成路由/菜单、theme.ts 映射主题。
现有 codegen/write 与 build/pipeline 扩展分支，不把旧 page.ts 重写为通用超级生成器。
测试放在各包现有 `src/__tests__/` 下；后台模板测试放 `packages/templates/vue3-admin/src/__tests__/`。

## Task 1：后台声明与校验

**Files:** Create `packages/spec/src/admin.ts`, `packages/spec/src/__tests__/admin.test.ts`; Modify `packages/spec/src/{page,project-spec,index}.ts`, `packages/templates/blocks/src/draft.ts`, `packages/templates/blocks/src/__tests__/draft.test.ts`。

**Interfaces:** 导出 `AdminPageSchema`、`AdminExperienceSchema`、`AdminPage`、`AdminExperience` 与 `checkAdminIntegrity(spec, ctx): void`。ProjectSpec 与 draft 增加可选 `experience`，Page 增加可选 `admin`。

声明约定：
- experience 是以 kind 区分的 admin/marketing union；admin 包含 `navigation: {id,label,icon?,route?,children?}[]`。只允许一层 children；分组与叶子互斥；icon 为受控语义键。
- admin.mode 为 list/detail/form/workbench/settings。list 引用 collection、可选 form、filters 字段数组、columns `{field,format?:text|currency|date|status}`、actions；detail 引用 collection 和返回列表 route；form/settings 引用 form 与返回 route；workbench 包含 collection 引用及快捷 route。
- action 区分 create/edit/delete/bulk-delete/detail/set-field，set-field 必须含 field/value/label；detail 指向兼容 detail 页面。支持的字段值为字符串/数值/布尔，必须符合 collection.model。
- 修改型列表需要 id；create/edit 必须有同集合 form。表单键、类型和枚举来自既有模型；不新增并行模型。
- admin 页的 blocks 可以为空；旧页面仍必须至少一个 block。新 admin 中仅允许 AuthPanel/EmptyStatePanel 的受控插画用途，拒绝旧业务块及营销块；operations 非空报错。auth 页面无 admin 模式也可用独立 AuthPanel。
- list 对应 list-detail，detail 对应 list-detail，workbench 对应 dashboard，form/settings 对应同名 pageType。新增声明使用 strict schema 拒绝拼错字段。

- [ ] 写失败测试：`parse(oldFixture).experience === undefined`；admin list 无 blocks 合法；旧 page 空 blocks、admin+Hero、未知图标、不存在字段、form 集合不符、悬空菜单、三级菜单、非法 set-field、admin 非空 operations 均失败。
- [ ] 运行 `pnpm --filter @vudt/spec test` 与 `pnpm --filter @vudt/blocks test`，确认新增测试先失败。
- [ ] 实现 schema 与跨引用校验；draft 派生保留新增字段；保持旧 fixture 序列化行为。
- [ ] 重跑两包测试及 typecheck，要求全部通过。
- [ ] 检查 diff 并记录进度，不提交。

## Task 2：可独立运行的 Ant Design Vue 后台底座

**Files:** Create `packages/templates/vue3-admin/package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src/{main.ts,App.vue,router.ts}`, `src/layouts/AdminLayout.vue`, `src/components/admin/{AdminPage,AdminIcon}.vue`, `src/theme/{tokens.ts,base.css}`, `src/navigation.ts`, `src/pages/HomePage.vue`, `src/__tests__/layout.test.ts`; Modify `pnpm-lock.yaml`，如 workspace glob 未覆盖则修改 `pnpm-workspace.yaml`。

**Interfaces:** `AdminLayout` 消费 `navigation` 和 router meta `{title,chrome,parentRoute}`；`AdminPage` 提供 title/description 与默认/actions slots；`AdminIcon` 仅接收任务 1 的 icon key；theme 导出 `adminTheme` 供 `a-config-provider` 使用。

- [ ] 写失败测试：导航与当前路由同步；折叠按钮改变状态；移动菜单可开关；auth chrome=false 隐藏壳；未声明的入口不出现。
- [ ] 运行 `pnpm --filter @vudt/template-vue3-admin test`，最初可因包不存在失败；记录后建立测试脚手架。
- [ ] 建立底座，锁定 Ant Design Vue 4.2.6，复用 Vue/Vite 版本；使用本地打包样式。完成顶部栏、面包屑、侧栏、当前页标识；不添加伪通知或假身份。
- [ ] tokens 映射主色/背景/面板/正文，状态色独立。输入主色不足以承载白字时，选择通过对比检查的按钮文字或调整交互色；测试浅黄主色与暗背景。
- [ ] 执行模板 test/typecheck/build；桌面与窄屏检查导航和容器，无整页横向溢出。
- [ ] 记录结果，不提交。

## Task 3：共享 mock 数据与类型化动作

**Files:** Create `packages/templates/vue3-admin/src/data/{types,mock,repository}.ts`, `src/composables/useAdminCollection.ts`, `src/__tests__/repository.test.ts`; Create `packages/codegen/src/admin/data.ts`, `packages/codegen/src/__tests__/admin-data.test.ts`。

**Interfaces:** `Row = Record<string, unknown> & {id:string|number}`；`getCollection(id): {rows:Ref<Row[]>;get(id):Row|undefined;create(values):Row;update(id,values):void;remove(ids):void;setField(ids,field,value):void}`。`renderAdminData(spec): Record<string,string>` 生成模型、种子数据及模块类型。

- [ ] 写失败测试：两次 getCollection 引用同一状态；数字与字符串 id 查询按规范归一比较；重复 id 拒绝；create 不覆盖旧行；编辑草稿不修改原行；remove 未知 id 不删其他行。
- [ ] 运行模板与 codegen 对应测试，确认失败。
- [ ] 实现应用内单例仓库，整页刷新重置；ID 依据 model.id 类型生成且不复用现存值。不存在 id 的只读集合可使用内部显示键，不写回模型。
- [ ] 生成器沿用现有确定性种子生成算法，规范主键和字段类型；不复制旧的每次调用重新实例化 store 行为。
- [ ] 执行测试/typecheck，要求跨实例更新与类型一致性通过；记录检查点。

## Task 4：完整后台列表页交互

**Files:** Create `packages/templates/vue3-admin/src/components/admin/{AdminListPage,AdminFilterBar,AdminRecordDrawer,AdminRecordFields}.vue`, `src/composables/useAdminList.ts`, `src/__tests__/{list,record-form}.test.ts`。

**Interfaces:** `AdminListPage` 接收任务 1 的 list config 与模型/form 引用解析后的对象；字段渲染复用既有 field type 与 validate。列表状态由 `useAdminList(config)` 返回 filters、rows、selection、pagination、query/reset 和 action handlers。

- [ ] 写失败测试：查询/重置、分页、全选、删除末页最后一行、过滤后清空选择；新增保存后出现；编辑回填、取消无污染、保存更新；批量删除取消不变、确认才删。
- [ ] 运行模板 tests，确认控件/交互未实现时失败。
- [ ] 用 a-table/a-form/a-drawer/a-pagination 实现紧凑布局，日期/金额/状态独立格式化；缺值显示占位，禁止 NaN 与 undefined 泄漏为业务文本。
- [ ] create/edit 使用真实 form 校验；set-field 只执行声明动作；没有声明的操作不显示。抽屉有标题、Esc、焦点恢复；空结果有重置入口。
- [ ] 运行 test/typecheck/build；以原型库存 fixture 手验编辑、筛选、取消，记录截图与检查点。

## Task 5：模块产物、路由与其他页面模式

**Files:** Create `packages/codegen/src/admin/{project,page,navigation}.ts`, `packages/codegen/src/__tests__/admin-project.test.ts`; Create template `src/components/admin/{AdminDetailPage,AdminFormPage,AdminWorkbenchPage,AdminSettingsPage}.vue`, `src/__tests__/pages.test.ts`; Modify `packages/codegen/src/project.ts`。

**Interfaces:** `generateAdminProject(spec): GeneratedProject`；`renderAdminPage(spec,page): string`；`renderAdminNavigation(spec): {router:string;navigation:string}`；显式 admin 从 `generateProject` 分派。输出 `modules/<safe-route-name>/index.vue`、同模块 types/config，布局不引用具体业务名。

- [ ] 写失败测试：模块名规范化碰撞报错；恶意标题/引号以 const 数据输出；路由保持 hash history；detail 使用 query.id 查同一仓库、缺失记录有返回入口；隐藏详情不进入菜单但可从列表到达。
- [ ] 执行 codegen 与模板测试，确认失败。
- [ ] 实现独立生成分支与 lazy route imports，导航叶子与 route meta 同源；详情 parentRoute 用于面包屑。未知路由显示可返回入口，不落到空白页。
- [ ] detail 显示字段分组；form 与列表抽屉共享字段组件；settings 未绑定集合的值保存在独立本地状态并明确演示语义；workbench 从共享集合派生计数、待办和快捷入口，不生成硬编码统计。
- [ ] 验证跨页新增/编辑后详情读取一致；路由刷新使用 seed，缺失新增记录显示“记录不存在”而非崩溃。旧 generateProject fixture 不变。
- [ ] 所有相关测试/typecheck 通过，记录检查点。

## Task 6：模板选择与真实构建链

**Files:** Modify `packages/codegen/src/write.ts`, `packages/build/src/pipeline.ts`, `server/src/runner.ts`, `server/src/main.ts`; Test `packages/codegen/src/__tests__/write.test.ts`, `packages/build/src/__tests__/pipeline.test.ts`；新增 `server/src/__tests__/admin-template.test.ts`（沿用 server 当前测试配置）。

**Interfaces:** 保留 `templateDir` 旧语义，新增可选 `adminTemplateDir` 到写入/构建 options 并由 server 注入；显式 admin 必须存在该目录，否则清晰失败，不回退旧模板。`shouldTypecheck = spec.experience?.kind === 'admin' || options.typecheck === true`。

- [ ] 写失败测试：admin 使用新模板，旧 spec 使用旧模板；缺失 adminTemplateDir 报错；后台 typecheck=false 仍执行 vue-tsc；类型错误导致 failed，不运行 vite；旧项目仍遵循原开关。
- [ ] 执行 write/pipeline/server 定向测试确认失败。
- [ ] 修改白名单拷贝与替换文件列表为模板对应集合，不残留 HomePage；依赖在沙箱运行前按现有可信安装机制可用，不让断网构建临时下载依赖。
- [ ] server 从已有路径配置派生后台模板路径，避免新增 cwd 隐式依赖；沙箱继续无 shell、环境变量白名单与超时。类型检查错误复用现有错误输出与任务状态，不引入新重试状态。
- [ ] 验证带新模板的固定 spec 全链类型检查/build 成功；预览、source/dist ZIP 保持原行为。记录检查点。

## Task 7：生成引导、主题与图片接入

**Files:** Modify `packages/providers/src/openai-spec-drafter.ts`, `packages/providers/src/__tests__/openai-spec-drafter.test.ts`, `packages/templates/blocks/src/{draft,registry}.ts`; Create `packages/codegen/src/admin/theme.ts`, `packages/codegen/src/__tests__/admin-theme.test.ts`；在 `packages/templates/blocks/src/blocks/` 增加实际需要的后台资产侧车及对应模板组件。

**Interfaces:** `renderAdminTheme(spec): string` 输出 ConfigProvider theme 与布局 token。沿用 `deriveSpecInput(draft)`、`derivePageAssets(route,selections)`、`expectedAssets` 合同，图片路径由 contentHash 与侧车派生。

- [ ] 写失败测试：后台提示包含完整 admin JSON 示例、actions/form 引用规则、合法图标键；不再说 landing 无条件切官网壳；明确后台禁止营销块；风格不得固定浅灰蓝。
- [ ] 写图片测试：后台空状态/登录插画的绑定有效且几何仍来自侧车；同 styleBible 前缀一致；normal list 不自动添加大图；无图任务不强制请求图片。
- [ ] 实现列表/详情/工作台的生成指导，后台优先业务结构；插画只走明确允许的位置。功能图标走静态映射，装饰图标/插画走资产派生，不允许模型提供 SVG 代码。
- [ ] 实现主题 token 到 Ant Design Vue 和布局 CSS 的统一映射；状态色、focus、文字可读性测试覆盖浅黄和深色主题；支持列表约束下的不同圆角与间距。
- [ ] 执行 providers/blocks/codegen tests 与 typecheck，通过后记录检查点。

## Task 8：端到端验收与产物说明

**Files:** Create `packages/build/src/__tests__/admin-generation.test.ts`, `packages/build/src/__tests__/fixtures/{inventory-admin,service-admin}.ts`, `packages/codegen/src/admin/readme.ts`, `docs/superpowers/verification/2026-10-28-modern-admin-generator.md`；Modify admin project generator 以输出 README。

**Interfaces:** 固定 fixture 经过真实 draft 派生、校验、代码生成、图片处理 stub、vue-tsc、vite；真实模型手验另记结果，不混淆。

- [ ] 写集成测试：库存管理包含五种模式与状态动作；第二例设备维修后台使用不同字段/主题；旧营销 fixture 不变。每个产物检查依赖本地打包、无库存/青绿色硬编码泄漏。
- [ ] 运行新测试并记录失败，再补齐前序集成连接（不在本任务无测试地加入新功能）。
- [ ] 生成 README：安装/开发/构建、模块/菜单/主题入口、mock 刷新重置说明、后续 API 接入位置；不宣称真实权限或后端功能。
- [ ] 全仓 `pnpm test`、`pnpm typecheck`、`pnpm build` 日志重定向，记录退出码和失败定位；新后台 fixture 必须额外通过 vue-tsc 与 vite。
- [ ] 从平台创建真实任务并预览，凭证不可用则明确未验；用浏览器操作筛选、新增、编辑取消/保存、详情、删除、分页和返回，检查控制台错误。
- [ ] 在桌面与手机宽度检查导航、表格局部滚动、抽屉焦点与空状态；完成 source/dist 导出检查。记录实际通过/未通过/未执行，不凭截图宣称全功能通过。
- [ ] 自查全差异并安排独立终审；未解决问题明确列出。不自动 commit/push。

## 自审结论

设计 1–5 节由任务 1/5/6 覆盖；布局与扩展性由 2/5 覆盖；五种模式与动作由 3/4/5 覆盖；主题/图像由 7 覆盖；验收与导出由 8 覆盖。跨页状态必须采用新仓库，不复用旧每页重置 store。新经验字段同时进入 draft 和 spec，避免 Zod 剥离；新模板路径必须贯通 server/build/write。已把五类边界测试分配到任务，不再额外扩展接口层、RBAC、运行时主题或多标签缓存。
