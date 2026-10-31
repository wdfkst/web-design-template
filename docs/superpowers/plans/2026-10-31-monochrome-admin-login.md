# 黑白拟态登录与联动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让共用后台模板生成黑白拟态登录页，并提供明确标注的演示登录、后台拦截与退出闭环。

**Architecture:** 模板保留 UI 与演示会话逻辑，生成器从实际页面派生登录入口与可返回路由。新增 auth 配置由 navigation 导出并经 App 传入布局；router 安装可测试守卫。无 auth 页时不启用守卫。

**Tech Stack:** Vue 3、Vue Router 4、Ant Design Vue 4.2.6、@ant-design/icons-vue 7.0.1、TypeScript、Vitest；不新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-31-monochrome-admin-login-design.md`

## Global Constraints

- 当前工作目录必须是 `.claude/worktrees/modern-admin-generator`，不可从默认 main 新建实现分支。
- 每次只完成一个子任务，完成后落盘总结并由用户 /clear；不自动提交、推送或合并。
- 黑白银灰只作用于登录页；后台主题与侧栏保持不变。
- 图标使用组件库组件，不手写 SVG、不使用 Unicode 字符代替功能图标。
- 不发送、不保存密码；演示账号 `demo`、密码 `demo123`；不是安全认证边界。
- 插画几何来自现有侧车；生成 SFC props 仍通过 script const + v-bind，保留现有注入/路由校验。
- 不调用付费模型，不覆盖已有生成产物。原型作为布局参考，不把原型脚本直接塞进模板。
- 文件分段读取不超过200行；长命令输出重定向到 `.superpowers` 日志，再检索摘要。

## Review Focus

1. 自定义登录地址、多 auth 页、无 auth 页、auth-only 不出现硬编码路径或重定向循环（Task 2）。
2. 外部/协议相对/未知返回地址和已登录访问 auth 页不能绕过合法目标选择（Task 2）。
3. sessionStorage 不可用、损坏、刷新和多项目路径隔离，不崩溃或串用会话（Task 1）。
4. 插画缺失/加载失败、不同 fields 配置及窄屏仍有可操作且可访问的登录表单（Task 3）。
5. 退出后浏览器返回、登录校验失败和重复提交不能留下错误状态或意外通行（Task 4）。

---

### Task 1: 独立演示会话模块

**Files:**
- Create: `packages/templates/vue3-admin/src/auth/demo-session.ts`
- Create: `packages/templates/vue3-admin/src/__tests__/demo-session.test.ts`

**Interfaces:**
- Produces: `DemoAuthConfig = { loginRoute: string; homeRoute: string | null; protectedRoutes: string[]; authRoutes: string[] }`。
- Produces: `createDemoSession(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined, scope: string): DemoSession`。
- `DemoSession` 暴露 `isAuthenticated(): boolean`、`signIn(account: string, password: string): boolean`、`signOut(): void`。仅存版本化演示布尔标记；不存输入字符串。
- `getDemoSession(): DemoSession` 惰性创建运行时单例，以 `location.pathname` 作为 scope；获取 sessionStorage 本身也捕获异常。测试通过工厂隔离，不依赖跨测试单例。

- [ ] **Step 1: 写失败测试**：正确凭证返回 true、错误凭证返回 false；错误输入不创建会话；成功后的新实例恢复会话；退出清除；损坏 JSON 当未登录；storage getter/read/write/remove 抛错时内存登录退出仍正常；两个 scope 不共享；存储字符串不含 `demo123`。对已有会话错误登录不自动清除，明确测试这一约定。
- [ ] **Step 2: 验 RED**：`pnpm --filter @vudt/template-vue3-admin exec vitest run src/__tests__/demo-session.test.ts`，预期缺少模块或行为失败。
- [ ] **Step 3: 实现上述工厂与惰性单例**，存储 key 前缀 `vudt:demo-auth:v1:` 加 scope；持久化失败只影响刷新恢复，不阻塞当前会话。
- [ ] **Step 4: 验 GREEN 与类型**：上述测试以及 `pnpm --filter @vudt/template-vue3-admin typecheck` 均退出0。
- [ ] **Step 5: 记录变更和红绿日志**，不自行提交；完成本子任务后停下交接。

### Task 2: 生成 auth 配置与安全路由联动

**Files:**
- Modify: `packages/codegen/src/admin/navigation.ts`
- Modify: `packages/templates/vue3-admin/src/navigation.ts`
- Create: `packages/templates/vue3-admin/src/auth/demo-router.ts`
- Create: `packages/templates/vue3-admin/src/__tests__/demo-router.test.ts`
- Modify: `packages/codegen/src/__tests__/admin-project.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `DemoAuthConfig`、`DemoSession`、`getDemoSession()`。
- Produces: navigation 导出 `auth: DemoAuthConfig | null`；模板占位默认 null。
- Produces: `resolveDemoTarget(router: Router, config: DemoAuthConfig, candidate: unknown): string | null`，只接受路由解析后 path 位于 protectedRoutes 的项目内部目标，保留合法 query/hash；拒绝非字符串、`//`、协议、反斜杠和 auth 目标，回退 homeRoute。
- Produces: `installDemoGuard(router: Router, config: DemoAuthConfig, session: DemoSession): void`。

- [ ] **Step 1: 写失败测试**：memory router 覆盖 `/signin` 而非 `/login`、后台首页不为 `/`；未登录拦截并携带内部 returnTo；认证后访问 auth 跳转；未知路径保留404；恶意返回地址回退；多个 auth 页不会作为目标；auth-only homeRoute 为 null且无循环；无 auth 页无守卫且 auth=null。
- [ ] **Step 2: 验 RED**：模板单测 `demo-router.test.ts` 和 codegen `admin-project.test.ts` 必须因缺少行为失败。
- [ ] **Step 3: 实现 guard 与导航生成**：首个 auth 页为 loginRoute，首个非 auth 页为 homeRoute；枚举真实后台与 auth 路由。不修改 legacy `packages/codegen/src/router.ts`。仅存在 auth 时在生成 router 中导入并调用安装守卫函数。使用 navigation 的 auth 配置，不产生 router/navigation 循环导入。
- [ ] **Step 4: 验 GREEN**：两个定向测试和模板/codegen typecheck 退出0。
- [ ] **Step 5: 记录结果和边界裁定**，不提交；完成本子任务后交接。

### Task 3: 黑白拟态登录组件与插画回退

**Files:**
- Modify: `packages/templates/vue3-admin/src/components/admin/AdminAuthPage.vue`
- Create: `packages/templates/vue3-admin/src/components/admin/AdminAuthArtwork.vue`
- Create: `packages/templates/vue3-admin/src/theme/auth.css`
- Modify: `packages/templates/vue3-admin/src/components/admin/AdminIcon.vue`
- Modify: `packages/templates/vue3-admin/src/__tests__/auth.test.ts`
- Modify: `packages/templates/vue3-admin/src/__tests__/icon.test.ts`

**Interfaces:**
- Consumes: navigation.auth、Task 1 session、Task 2 resolveDemoTarget、useRouter/useRoute。
- 保留现有 `{ title, panel }` props 形状与插槽 Asset `{src,alt,w,h}`。
- Artwork props: `{ asset?: {src:string;alt:string;w:number;h:number}; passwordFocused?: boolean }`。
- 图标新增语义名 `user`、`lock`、`logout`、`arrow-right`、`eye`、`eye-invisible`，映射现有依赖的组件；如已有同义名则复用并同步测试。

- [ ] **Step 1: 写失败测试**：输入绑定、只允许 demo/demo123、填充演示账号不自动登录、密码显隐、错误状态、成功 replace 到合法 returnTo/homeRoute；无后台显示说明而非跳转；缺失 fields 仍提供账号密码，多个生成字段不能误收集真实凭据；不强制 email 类型以便 demo 可输入；图片保留 w/h/alt、缺失和 error 回退；键盘按钮语义正确。
- [ ] **Step 2: 验 RED**：`pnpm --filter @vudt/template-vue3-admin exec vitest run src/__tests__/auth.test.ts src/__tests__/icon.test.ts`。
- [ ] **Step 3: 实现页面**：固定两个演示凭证控件，panel heading/subheading/submitLabel 与插画沿用，任意生成 fields 不扩展认证表单。在界面明显处写“演示登录，不连接认证服务，请勿输入真实凭证。”，展示公开账号；不加虚假的找回密码链接或未实现的记住账号选项。成功登录后导航，不增加人为网络等待；重复提交用 submitting 标记保护并 finally 复位。
- [ ] **Step 4: 实现独立 Artwork 与 CSS**：复用图片，失败/无图片时用 CSS 立体机器人，不写 SVG/字符功能图标；按原型黑白双栏，控件由 Ant Design Vue 与图标组件实现。样式限定 auth 命名空间，mobile <=680px 堆叠、焦点可见、reduced-motion 移除装饰运动。
- [ ] **Step 5: 验 GREEN**：定向测试及模板 typecheck 通过。记录尚需浏览器验证的视觉项目，不声称截图不可见时已视觉验收。
- [ ] **Step 6: 记录结果**，不提交；完成本子任务后交接。

### Task 4: 顶栏退出与完整导出验收

**Files:**
- Modify: `packages/templates/vue3-admin/src/App.vue`
- Modify: `packages/templates/vue3-admin/src/layouts/AdminLayout.vue`
- Modify: `packages/templates/vue3-admin/src/__tests__/layout.test.ts`
- Modify: `packages/codegen/src/admin/readme.ts`
- Create: `packages/codegen/src/__tests__/admin-auth.test.ts`
- Create: `docs/superpowers/verification/2026-10-31-monochrome-admin-login.md`

**Interfaces:**
- App 从 navigation 导入 auth，向布局传 `auth?: DemoAuthConfig | null`（默认 null 以兼容现有挂载测试）。
- 布局退出调用 getDemoSession().signOut() 后 router.replace(auth.loginRoute)，只在后台 chrome 且 auth 存在时显示“演示用户”及退出按钮，不调整侧栏结构/CSS。

- [ ] **Step 1: 写失败测试**：有 auth 显示演示用户/退出，退出清除会话并回真实登录路由；无 auth 无入口；auth 页面仍无后台 chrome；退出后返回受保护页仍拦截；重复点击和导航失败不会恢复会话。
- [ ] **Step 2: 验 RED**：模板 layout.test.ts 与新 admin-auth.test.ts。
- [ ] **Step 3: 实现 App/布局连接与 README**：说明公开凭证、标签页会话、路径隔离、刷新与退出行为、演示不等于安全边界、真实认证接入点，以及旧生成产物不自动更新。
- [ ] **Step 4: 独立导出测试**：复用仓库现有 derive/finalize fixture 与导出构建方式，不手写插槽几何。覆盖带 `/signin`、无 auth、auth-only 三种，实际执行 vue-tsc 与 Vite；确认图标依赖已在模板，无新增依赖。
- [ ] **Step 5: 全仓验证**：`pnpm test`、`pnpm typecheck`、`git diff --check` 输出存 `.superpowers` 日志，检查退出码和摘要。
- [ ] **Step 6: 真浏览器验收**：使用独立新导出而非覆盖用户任务，无付费生成；桌面1440、平板1024、手机390；测试登录/退出/刷新/深链/返回、图片回退、密码显隐、键盘、reduced-motion、无横向溢出。截图供用户确认黑白原型还原，不用DOM冒充审美。
- [ ] **Step 7: 写验收与交接**，如有服务启动记录本会话进程与地址；不关闭用户已有平台、不推送/合并。

## 当前进度

2026-10-31：用户已批准 Native 执行。Task 1 complete：新增 demo-session.ts 与15项测试，缺少模块 RED→15项 GREEN；全仓 pnpm test、pnpm typecheck、git diff --check 均退出0，既有 jsdom/stub 警告仍在。未提交，文件在当前工作树，不能凭 HEAD 未变化重做。证据与 Ruling 在 `.superpowers/sdd/2026-10-31-monochrome-admin-login/progress.md` 和 task-1-*.log。

2026-10-31：Task 2 complete，未提交：navigation 派生 auth，生成 router 仅有 auth 时安装守卫；demo-router 覆盖自定义入口、返回目标与 auth-only。定向测试23+12通过，全仓82文件790测试通过，pnpm typecheck 和 git diff --check 退出0（既有 jsdom/stub 与 LF/CRLF 提示）。守卫按匹配记录保护大小写/尾斜杠等价地址；返回白名单仍严格匹配，变体回退首页。证据与裁定在同一 progress.md 与 task-2-*.log。

2026-10-31：Task 3 complete，未提交：黑白双栏登录组件、CSS 机器人插画回退、密码显隐与焦点反馈、固定演示凭证表单、合法 returnTo 导航及失败重试。定向 RED 19失败6通过→GREEN 25/25；全仓82文件808测试、pnpm typecheck、git diff --check 均通过，既有警告仍在。日志 task-3-*.log 与同一 progress.md。

2026-10-31：Task 4 功能实现与自动验收完成，未提交：App传auth、顶栏演示用户/退出、失败提示重试及README说明；layout RED 3失败7通过→GREEN 10/10，三种独立导出vue-tsc/Vite通过，全仓83文件815测试与typecheck/diff检查通过。浏览器登录/退出/刷新/深链/返回、错误输入、显隐、键盘、存储不可用、三形态及1440/1024/390溢出检查已执行。新导出在 `.superpowers/auth-browser-6l3QMd/`，服务58131/58132/58133保留，未动已有平台。截图工具仍无可见图像；用户已确认预览“没问题”，独立评审已通过（Yes，无Critical/Important，3项非阻断建议暂缓，详见验收记录）。Task 1–4全部完成，未提交，等待用户后续指示。详情见 `docs/superpowers/verification/2026-10-31-monochrome-admin-login.md`。

存储故障边界：删除失败会尝试写未登录标记；删除和写入同时被拒绝只能保证当前实例退出，刷新可能读到旧演示标记。不是安全认证。
