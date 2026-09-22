# web/ 控制台 — 设计文档

日期：2026-09-20
状态：已与用户逐段确认

## 目标

给「AI 前端模板生成平台」补上人能用的界面。服务端（`server/`）与七个 `packages/*` 已完成并通过 201 个测试，但目前只能用 curl 驱动。本设计覆盖两部分：服务端新增四个端点，以及 `web/`（Vue 3 + Ant Design Vue）控制台。

范围是**完整控制台**：任务列表、提交、阶段进度、dist 预览、spec 结构可视化、资产图逐张预览、失败重试、导出下载。

## 已定决策

| 维度 | 决策 | 理由 |
|---|---|---|
| 组件库 | Ant Design Vue，全量引入 | 用户指定。内部工具，包体积不是约束；省掉 `unplugin-vue-components` 一层配置 |
| spec 投影 | 全量（含每张图的 prompt 与 contentHash） | 内部工具，prompt 是最有用的调试信息——图不对时第一件想看的就是 AI 写了什么 prompt |
| 导出 | 源码 zip + dist zip 两个端点 | 用途不同：源码给人拿回去继续开发，dist 给人直接丢静态托管 |
| 重试语义 | 新建任务、沿用原描述重新 draft | 语义最简单，没有部分状态要管；draft 阶段失败时这是唯一可能的做法 |
| 详情页布局 | 左结构树 + 右大预览（方案 B） | 本平台真正难的是代码侧与图片侧对齐，B 是唯一把「图 ↔ 插槽」对应关系常驻眼前的布局 |
| 实施顺序 | 先补齐服务端端点（含测试），再写 web | 端点契约可用 `app.inject()` 测死；前端面对稳定 API，不必一边猜形状一边调 UI |
| 状态管理 | composable，不上 Pinia | 这个规模上 Pinia 是净负担 |
| 路由 | `vue-router`，`/` 与 `/task/:id` | — |

## 两个省掉工作量的既有事实

**资产图不需要新端点。** codegen 写 `public/assets/<contentHash>.png`，`vite build` 把 `public/` 原样拷进 dist 根，所以图在 `/preview/:id/assets/<contentHash>.png` 就能服出。前端拿 spec 投影里的 `contentHash` 自行拼 URL。

**生成项目用 hash 路由**（`createWebHashHistory` + `base: './'`）。所以结构树点页面跳转只需把 iframe 指向 `/preview/:id/#<route>`，hash 变化不需要服务端路由配合。

## 约束：CSP 决定部署形态

预览响应带 `frame-ancestors 'self'`（见 [server HTTP 层约束] 第 2 条）。因此：

- **开发期**：Vite dev server 代理 `/tasks`、`/preview`、`/health` 到 `127.0.0.1:4300`。浏览器看到的资源源统一是 5173，'self' 成立。
- **生产期**：必须由 Fastify 同源服务 `web/dist`。web 不能单独部署到另一个域名或端口，否则 iframe 会被浏览器直接拦掉。

这不是可选的部署偏好，是 CSP 的硬要求。

## 第一部分：服务端四个新端点

### `GET /tasks/:id/spec`

全量投影 `TaskRecord.spec`。

- 未知 id → 404
- spec 尚未产出（`queued`、或 `drafting` 早期）→ 409
- 投影函数**独立于 `toView()`**：两者白名单不同。`toView` 连 spec 都不给；本端点给全部 spec，但仍不外泄 `distDir` 或任何绝对路径。

### `GET /tasks/:id/export/source`

流式 zip：任务目录下除 `node_modules/` 与 `dist/` 外的全部内容。

- **排除 `node_modules/` 是硬要求**，不是优化。模板预装 `node_modules` 是那条硬链接提速优化的前提，打进包会是几百 MB。
- **`node_modules` 是指向模板的 junction**，所以打包器绝不能跟随符号链接/junction——否则递归遍历会走进模板目录。排除该项即可覆盖，但必须显式关掉 follow，因为 junction 正是朴素递归会跟进去的东西。
- zip 内根目录名用 `spec.meta.name` 的 slug（不是 taskId）——这是人要拿回去开发的包。
- **可下载条件按任务目录是否存在判定，不按 `status === 'ready'`。** `runTask` 失败时只写错误记录、不回收工作区，所以「draft 成功但构建失败」的任务代码仍在盘上，而这份代码正是排查构建失败最需要的东西。规则：
  - 工作区目录存在 → 允许下载（含 `failed` 与 `building` 中途）
  - 目录不存在（`queued`、或 draft 阶段就失败——工作区在 draft 成功后才 allocate）→ 409

### `GET /tasks/:id/export/dist`

流式 zip，只打 `dist/`。仅 `ready` 可下，否则 409。

### `POST /tasks/:id/retry`

读原任务 `description`，走与 `POST /tasks` **完全相同**的创建路径，返回 202 + 新任务视图。原任务记录不动。

实现要点：把 `POST /tasks` 内的创建逻辑抽成共用内部函数，两个路由共同调用。否则描述长度校验与「队列满返 503」的处理会漂移成两份实现。

### 打包依赖

Node 无内置 zip。用 `archiver`：流式，不把整包读进内存。这与「队列满返 503、不缓冲」同源——昂贵资源是机器。

### 测试

全部走 `app.inject()`：

- 导出用例断言 zip 条目清单中**没有** `node_modules/` 开头的项（最容易回退的一条）
- 导出用例断言非 `ready` 任务下载 dist 返 409
- 导出用例断言**构建失败的任务仍能下载源码**（工作区未被回收），这是排查构建失败的主要途径
- 导出用例断言 draft 阶段就失败的任务下载源码返 409（工作区尚未 allocate）
- spec 投影用例断言响应中不含绝对路径
- retry 用例断言队列满时返 503，且不留下孤儿任务记录
- retry 用例断言新任务 id 与原任务不同、描述相同

## 第二部分：`web/` 结构

```
web/
  package.json          vue 3 + vue-router + ant-design-vue + vite
  vite.config.ts        proxy: /tasks /preview /health → 127.0.0.1:4300
  src/
    main.ts             挂载 + 全量引入 antd
    App.vue             AntD Layout 外壳（Sider 导航 + Content）
    router.ts           / → TaskList，/task/:id → TaskDetail
    api/client.ts       fetch 封装，统一抛 ApiError（带 status + message）
    composables/
      useTaskPolling.ts  轮询单个任务，终态停，卸载清 timer
      useTaskList.ts     列表轮询，仅在有活跃任务时轮
    views/
      TaskList.vue       描述输入 + Table 历史
      TaskDetail.vue     布局 B 的壳
    components/
      TaskSteps.vue      阶段进度
      SpecTree.vue       页面 → 区块 → 插槽/资产 树
      AssetPanel.vue     单张资产：图 + prompt + 几何 + contentHash
      ExportButtons.vue  两个导出按钮（源码按钮在 failed 任务上仍可用）
```

### 布局 B 的实现

外层 `a-layout`。详情页内部：`a-layout-sider`（可折叠，窄屏收起）装 `a-tree`，`a-layout-content` 装 iframe。

- 点树上的**页面**节点 → iframe src 换成 `/preview/:id/#<route>`
- 点树上的**资产**节点 → 右侧上方浮出 `AssetPanel`，iframe 下移

**取舍（已确认）**：换 iframe `src` 的 hash 是否触发整页重载在各浏览器间不一致。直接让它重载（`:key` 绑 route），因为 dist 是本地静态文件、重载仅几十毫秒，比去碰 `contentWindow` 稳。

### 轮询

`useTaskPolling` 仅在 `queued`/`drafting`/`building` 时运行，1.5s 一次，命中 `ready`/`failed` 立即停止。组件卸载时清 timer——最易漏的泄漏点，有测试覆盖。

`useTaskList` 仅在列表中存在活跃任务时轮询。

### Steps 的阶段划分

服务端只有五个状态（`queued`/`drafting`/`building`/`ready`/`failed`），其中 `building` 实际覆盖「生成图片」与「跑 vite build」两件事。

**决策（已确认）**：不为多一个进度格去新增状态——那要改 `runner` 与 `store`，而 `providerCalls` 已能在 building 阶段作为副标题显示进度。

Steps 画四格：排队 → draft → 构建 → 完成。失败时当前格标红并展开 `error.detail`。

### 错误处理

`api/client.ts` 统一把非 2xx 转成 `ApiError`（带 `status` 与 `message`）。界面按 status 区分：

- 409（任务未就绪）→ 提示稍候，继续轮询
- 503（队列满）→ `a-alert` 提示稍后重试，不自动重试
- 404 → 跳回列表页并提示任务不存在
- 其余 → `a-result` 展示 message

### 测试

`vitest` + `@vue/test-utils`，与其他七个包一致。重点：

- composable 的轮询终止与卸载清理
- `SpecTree` 能从 spec 投影正确长出树（含多页面、多区块、无资产区块）
- `AssetPanel` 拼出的图片 URL 正确

视图层不做快照测试。

## 交付顺序

1. `archiver` 依赖 + 四个端点 + 端点测试（服务端，可独立验证）
2. `web/` 脚手架（Vite + AntD + 路由 + Layout 壳）
3. `TaskList`：提交 + 历史表格 + 列表轮询
4. `TaskDetail`：Steps + iframe 预览 + 单任务轮询
5. `SpecTree` + `AssetPanel`（布局 B 左侧）
6. `ExportButtons` + 重试按钮
7. Fastify 兜底服务 `web/dist`（生产同源）

## 未纳入本设计

- 工作区 TTL 与磁盘水位清理（独立子任务，dist 目前为供预览无限期保留）
- 鉴权（内部工具，`ownerId` 已在记录上预留但不回显）
- SSE / WebSocket 推送（轮询足够，1.5s 对这个任务时长量级没有体感差别）
