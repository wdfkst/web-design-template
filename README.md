# vue-ui-design-template · AI 前端模板生成平台

给一句中文需求，产出一个**可直接运行的 Vue 3 站点**：源码 + 构建产物 `dist`，配图由 AI 生成并按代码里预留的插槽尺寸裁好。

内部工具，单机运行。后端 Fastify + 任务队列，前端 Vue 3 控制台，生成与构建全在本地沙箱里跑。

```
提交描述 → draft(LLM 选块/写文字) → 派生几何 → 生成 Vue 工程 → 出图 → 类型检查 → vite build → 预览/导出
```

---

## 目录

- [架构总览](#架构总览)
- [模块职责](#模块职责)
- [一次任务的全过程](#一次任务的全过程)
- [上手：从克隆到第一条结果](#上手从克隆到第一条结果)
- [控制台三页](#控制台三页)
- [HTTP 端点](#http-端点)
- [环境变量](#环境变量)
- [配置优先级](#配置优先级)
- [常用命令](#常用命令)
- [已知陷阱](#已知陷阱)
- [开发约定](#开发约定)

---

## 架构总览

```
        浏览器
          │
   ┌──────▼──────────────────────────────────────────┐
   │ web/  控制台 (Vue 3 + Ant Design Vue, :5173)     │
   │   任务列表  ·  详情页(结构树+iframe 预览)  ·  配置页  │
   └──────┬──────────────────────────────────────────┘
          │  /tasks   /api   /preview      (dev 下由 vite 代理)
   ┌──────▼──────────────────────────────────────────┐
   │ server/  Fastify (:4300)                        │
   │   任务队列(并发 1 / 待处理上限 32)  +  内存任务表       │
   └──────┬──────────────────────────────────────────┘
          │
   ① drafting ── @vudt/blocks   draft 形状 + deriveSpecInput(几何派生)
          │        ← LLM 只做两件事：选块、写主体文字
          │        → @vudt/spec 两道 schema 闸 → ProjectSpec
          │
   ② building ── @vudt/build  构建管线
          │        ├ @vudt/codegen   生成 pages / router / tokens 覆盖层
          │        ├ @vudt/imagegen  出图编排（prompt 拼装·尺寸档·缓存）
          │        │     └ @vudt/providers  真实模型调用 + sharp 后处理
          │        ├ vue-tsc --noEmit
          │        └ vite build      （沙箱：env 白名单·无 shell·断网·超时杀进程树）
          │
   ③ ready ─────► dist 由 /preview/:id/ 静态托管；源码与 dist 均可打 zip 下载
```

**两条贯穿全局的设计约束**，读代码时最先要建立的认知：

1. **几何只来自侧车（sidecar）。** 每个区块组件旁边有一个 `.slots.ts` 文件，人工声明它的图片插槽尺寸、宽高比、是否透明、构图。模型只能填 `prompt` 与 `alt`（画什么），**永远不能决定形状**（多大、什么比例）。代码侧与图片侧因此不可能对不上。
2. **生成器只写覆盖层，底座整体拷贝。** `packages/templates/vue3-base` 是一个完整可跑的 Vue 3 + Vite 工程；codegen 只覆写 `src/pages/*.vue`、`src/router.ts`、`src/styles/tokens.css` 三类文件。

---

## 模块职责

| 包 | 负责什么 | 关键入口 |
|---|---|---|
| `packages/spec` | **唯一的 schema 与校验源**（zod）。顶层 `meta / theme / styleBible / pages / assets`；跨字段校验：路由不重复、资产 id 不重复、slot 绑定必须指向已声明的资产、`renderSize` 必须匹配 `aspectRatio` | `src/project-spec.ts`、`src/parse.ts` |
| `packages/templates/blocks` | **区块注册表 + 侧车**。13 个区块各自声明合法的 slot 名、几何、允许的 props、默认 prompt/alt。`derive.ts` 从侧车派生几何与 asset id；`draft.ts` 定义「模型能写的那个更小的形状」 | `src/registry.ts`、`src/derive.ts`、`src/draft.ts` |
| `packages/templates/vue3-base` | **生成项目的底座**：完整的 Vue 3 + Vite 工程、13 个区块的 SFC、基础样式 | 整目录拷贝 |
| `packages/codegen` | spec → 文件覆盖层。纯函数，不碰文件系统（写入由 build 包负责） | `src/project.ts`、`src/page.ts` |
| `packages/imagegen` | 出图编排：prompt 拼装、尺寸档选择、内容哈希缓存、后处理接口 | `src/generate.ts`、`src/prompt.ts`、`src/size.ts` |
| `packages/providers` | **真实模型实现**：spec drafter（chat completions）、图片 provider（images generations）、sharp 后处理器 | `src/openai-*.ts`、`src/sharp-image-processor.ts` |
| `packages/build` | 构建管线与沙箱：工作区分配、环境变量白名单、无 shell 地跑 node 工具、超时杀整个进程树 | `src/pipeline.ts`、`src/sandbox.ts` |
| `server` | HTTP 层：路由、任务队列、内存任务表、设置存储与连通性探测、预览托管、zip 导出 | `src/app.ts`、`src/runner.ts`、`src/spec-source.ts` |
| `web` | 控制台 | `src/views/*.vue`、`src/composables/*` |

### 十三个内置区块

| 组件 | 适用页面类型 | 图片插槽 |
|---|---|---|
| `NavBarSimple` | 全部 | — |
| `HeroSplit` | landing | `illustration` |
| `HeroCentered` | landing, auth | `backdrop` |
| `FeatureTriad` | landing | `featureOne` / `featureTwo` / `featureThree` |
| `CtaBanner` | landing | `decoration` |
| `FooterSimple` | 全部 | — |
| `EmptyStatePanel` | dashboard, list-detail | `illustration` |
| `StatsBand` | landing | — |
| `LogoStrip` | landing | — |
| `PricingCard` | landing | — |
| `TestimonialRow` | landing | — |
| `FAQAccordion` | landing, form | — |
| `AuthPanel` | auth | — |

后面 6 个（`StatsBand` 起）是 props-only 区块：`slots: []`，构建阶段不发任何图片请求。

页面类型枚举：`landing` / `dashboard` / `form` / `list-detail` / `auth` / `settings`。

资产用途枚举：`hero-illustration` / `feature-illustration` / `empty-state` / `error-state` / `avatar` / `logo-mark` / `section-decoration` / `background`。

---

## 一次任务的全过程

任务有五个状态：`queued → drafting → building → ready`，任一步失败进 `failed`。

### ① drafting：模型只选块、只写文字

1. 把用户描述、**区块目录**（每个组件的名字、允许的 props、合法 slot 名）、以及 draft 的 JSON 形状说明一起发给模型。
2. 模型返回一个 **draft**：`meta / theme / styleBible / pages[].blocks[]`，其中块上带的是 `content`（各 slot 的 `prompt` 与 `alt`），**不是**几何。
3. **闸 1 —— `deriveSpecInput()`**：校验 draft 形状，然后逐页调用 `derivePageAssets()`：几何逐字段从侧车抄，asset id 按位置派生。
4. **闸 2 —— `parseProjectSpecInput()`**：spec 全量校验（含重复路由这类派生不看的问题）。
5. 任一闸失败，就把校验反馈文本作为新一轮的 user turn 追加回去重试，默认最多 3 次（`VUDT_SPEC_ATTEMPTS`）。3 次都不行 → 任务 `failed`，`error.detail` 里带着最后一轮的反馈。

> 反馈是**逐字回传**的。schema 是平台对抗结构漂移的唯一防线，所以草稿被拒时的正确修法是改 prompt，永远不是放宽 schema。

### ② building：代码 → 图片 → 构建，只有这个顺序可行

1. **成本闸**：资产数超过 `VUDT_MAX_ASSETS`（默认 24）直接失败，一个模型调用都不发出。
2. **`writeProject`**：拷贝底座，覆写页面 / 路由 / 主题变量；`node_modules` 以链接方式指回模板，省掉每次重装。
3. **`generateAssets`**：每张图一个 job。prompt = 风格前缀 + 主体描述 + 构图指令 + 背景指令（**风格在前**，因为 provider 对靠前的 token 权重更高，跨图一致性靠它压住）。尺寸先取最接近的比例档生成，再由 sharp 缩到侧车要求的 `renderSize`——**先大后缩**，反了会糊。缓存键是内容哈希，同图跨任务复用。
4. **`assertExpectedAssetsExist`**：图片必须真的落盘，否则 vite 会静默产出一个引用死链的 dist。
5. **`vue-tsc --noEmit`**：类型闸。
6. **`vite build`**：产出 `dist`，随后校验 dist 结构是否正常。

### ③ ready / failed

- `ready`：`previewPath` 与 `distDir` 回写任务记录，`/preview/:id/` 可看，两个导出按钮可用。
- `failed`：**工作区不回收**。所以「draft 成功但构建失败」的任务，源码仍在盘上、仍能下载——这正是排查构建失败最需要的东西。这也是源码导出**不按 `status === 'ready'` 判定、而按工作区目录是否存在**判定的原因。

---

## 上手：从克隆到第一条结果

### 1. 前置

- Node ≥ 20（`--env-file` 需要 20.6+）
- pnpm 11：`corepack enable` 或 `npm i -g pnpm@11`

### 2. 装依赖

```bash
pnpm install          # 在仓库根执行
```

### 3. 建 `server/.env`

**这个文件被 `.gitignore` 排除，克隆后不存在，必须自己建。** 缺 key 服务会直接起不来。

```ini
VUDT_SPEC_API_KEY=sk-...
VUDT_IMAGE_API_KEY=sk-...
VUDT_SPEC_BASE_URL=https://your-relay.example.com/v1
VUDT_IMAGE_BASE_URL=https://your-relay.example.com/v1
VUDT_SPEC_MODEL=claude-opus-5
VUDT_IMAGE_MODEL=gpt-image-2
```

> **`baseUrl` 只填到 `/v1` 为止。** provider 自己会拼 `/chat/completions` 与 `/images/generations`；填到完整端点会拼成双份、404。

### 4. 起服务（两个终端）

**后端必须从仓库根启动**——`templateDir` 等四个路径与设置文件都按 cwd 解析，从 `server/` 里起会让模板路径变成 `server/packages/...`，任务一开跑就 ENOENT。

```bash
# 终端 1 —— 后端（从仓库根，不是从 server/）
./server/node_modules/.bin/tsx --env-file=server/.env server/src/main.ts
# → http://127.0.0.1:4300

# 终端 2 —— 前端
cd web && npx vite
# → http://localhost:5173   （端口被占会自动退到 5174）
```

> 不要用 `pnpm --filter @vudt/server dev`：它把 cwd 切到 `server/`，正好踩上面那个坑。

### 5. 提交第一条描述

打开 <http://localhost:5173>，在输入框里写，例如：

```
做一个 SaaS 产品的落地页，包含首屏、三个功能点、一个行动号召和页脚
```

提交后进详情页，能看到阶段进度、结构树、预览与配图。首次生成通常一到几分钟（图片模型是主要耗时）。

---

## 控制台三页

| 路由 | 页面 | 要点 |
|---|---|---|
| `/` | 任务列表 | 描述输入框 + 历史表格。仅当列表里存在活跃任务时才轮询（1.5s 一次） |
| `/task/:id` | 任务详情 | **左侧结构树 + 右侧 iframe 预览**。点页面节点 → iframe 切到 `#<route>`；点资产节点 → 浮出资产面板（图 + prompt + 几何 + contentHash）。顶部步骤条「排队 → draft → 构建 → 完成」，失败时当前格标红并展开 `error.detail`。右下角：导出源码 / 导出 dist / 重试 |
| `/settings` | 配置页 | 中转站与模型两组（spec / image），各自 `baseUrl` + `model`；spec 多一个 `sendResponseFormat` 开关（部分中转站不接受 `response_format`，报 400 时关掉）。每个值显示来源：`file`（配置页存的）/ `env`（环境变量）/ `default`（内置默认）。可先「测试连通性」再保存 |

**为什么必须「左树 + 右预览」**：这个平台真正难的是代码侧与图片侧的对齐，只有把「图 ↔ 插槽」的对应关系常驻眼前才看得见问题。

**轮询**：单任务与列表都是 1.5s，命中终态立即停止，组件卸载时清 timer。没有 SSE / WebSocket——对这个任务时长量级，轮询没有体感差别。

---

## HTTP 端点

| 方法 | 路径 | 说明 | 关键状态码 |
|---|---|---|---|
| GET | `/health` | 健康检查，附带队列深度 | — |
| POST | `/tasks` | 提交任务，body `{ description, ownerId? }`（描述上限 4000 字） | `202` / 描述为空 `400` / 描述过长 `413` / 队列满 `503` |
| POST | `/tasks/:id/retry` | 沿用原描述**新建**一个任务（原记录不动） | `202` / 未知 `404` / 队列满 `503` |
| GET | `/tasks` | 全部任务视图 | — |
| GET | `/tasks/:id` | 单个任务视图 | 未知 `404` |
| GET | `/tasks/:id/spec` | **全量** spec 投影（含每张图的 prompt 与 contentHash，不含任何绝对路径） | spec 尚未产出 `409` |
| GET | `/preview/:id` | 302 跳到带尾斜杠的地址 | — |
| GET | `/preview/:id/*` | 托管该任务的 `dist`（**带 CSP**，见陷阱 5） | 非 ready `409` |
| GET | `/tasks/:id/export/source` | 流式 zip：工作区里除 `node_modules/` 与 `dist/` 外的一切 | 工作区不存在 `409` |
| GET | `/tasks/:id/export/dist` | 流式 zip：只打 `dist/` | 非 ready `409` |
| GET | `/api/settings` | 生效设置 + 每个值的来源 | 环境变量配坏 `500` |
| PUT | `/api/settings` | 保存设置 | 字段非法 `400` / 环境变量配坏 `500` |
| POST | `/api/settings/test` | 用**请求体**（不是已存值）探测中转站连通性 | 未配置探测 `501` |

**重试的语义**：新建任务、沿用原描述重新 draft。没有部分状态可恢复，而 draft 阶段失败本来也没东西可复用。

---

## 环境变量

服务端全部配置项。路径类的都**按 cwd 解析**，所以默认值的写法隐含了「从仓库根启动」这个前提。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `VUDT_HOST` | `127.0.0.1` | 监听地址 |
| `VUDT_PORT` | `4300` | 监听端口 |
| `VUDT_WORKSPACE_ROOT` | `.vudt/tasks` | 每个任务一个子目录 |
| `VUDT_TEMPLATE_DIR` | `packages/templates/vue3-base` | 生成项目的底座 |
| `VUDT_IMAGE_CACHE_DIR` | `.vudt/image-cache` | 跨任务共享，键是内容哈希 |
| `VUDT_CONCURRENCY` | `1` | 同时构建的任务数 |
| `VUDT_MAX_PENDING` | `32` | 待处理上限，超出返 503（不缓冲） |
| `VUDT_MAX_ASSETS` | `24` | 单任务资产数上限，**在任何模型调用之前**拦截 |
| `VUDT_SPEC_ATTEMPTS` | `3` | draft 重试次数 |
| `VUDT_BUILD_TIMEOUT_MS` | `180000` | 构建超时，到期杀掉整个进程树 |
| `VUDT_WEB_DIST_DIR` | `web/dist` | 生产环境下由 Fastify 同源托管 |
| `VUDT_SPEC_API_KEY` | **必填** | 缺了服务起不来 |
| `VUDT_IMAGE_API_KEY` | **必填** | 同上 |
| `VUDT_SPEC_BASE_URL` | `https://api.openai.com/v1` | 只填到 `/v1` |
| `VUDT_IMAGE_BASE_URL` | `https://api.openai.com/v1` | 只填到 `/v1` |
| `VUDT_SPEC_MODEL` | `gpt-4o-mini` | 写 draft 的模型 |
| `VUDT_IMAGE_MODEL` | `gpt-image-1` | 出图的模型 |
| `VUDT_IMAGE_QUALITY` | （不传） | 透传给图片 provider |
| `VUDT_DISABLE_IMAGE_PROCESSOR` | （不设） | 设 `1` 关掉 sharp 后处理。**关掉意味着发出尺寸不对的图**，这是显式退出而非静默降级 |

---

## 配置优先级

```
配置文件 (.vudt/settings.json)  >  环境变量  >  内置默认
```

配置文件由配置页写入。**任务创建时会快照当时的设置**，所以改配置不会影响已经在排队或正在跑的任务。

**注意配置文件的路径也是 cwd 相对的**：`server/src/main.ts` 里读的是 `<cwd>/.vudt/settings.json`。从仓库根启动时 cwd 是仓库根，读的就是 `<仓库根>/.vudt/settings.json`，而配置页写到的是 `server/.vudt/settings.json`——两者不是一个文件。**这就是陷阱 1**，务必读一下。

---

## 常用命令

```bash
pnpm install
pnpm -r test                    # 全部测试（374 例）
pnpm -r typecheck               # 全部类型检查
pnpm -r build

# 单个包
pnpm --filter @vudt/server test
pnpm --filter @vudt/server typecheck

# 单个测试文件
pnpm --filter @vudt/server exec vitest run src/__tests__/app.test.ts
```

> `pnpm --filter <pkg> test -- <path>` **传不进去**：包的 test 脚本是 `vitest run`，`--` 之后的参数被 pnpm 吃掉，实际跑的是全量。用上面的 `exec vitest run <path>`。

---

## 已知陷阱

按「新人撞上的概率」排序。

### 1. 启动目录：必须从仓库根起，但配置文件又在 `server/` 下

两个方向都会出问题：

- **从 `server/` 里起** → `config.ts` 的四个路径（`workspaceRoot` / `templateDir` / `imageCacheDir` / `webDistDir`）全部相对 cwd 解析，`templateDir` 会变成 `server/packages/templates/vue3-base` → 任务一开跑就 ENOENT。
- **从仓库根起** → 上面四个路径对了，但 `SettingsStore` 读的是 `<仓库根>/.vudt/settings.json`，而配置页真正写的是 `server/.vudt/settings.json`，**读不到** → 两个模型静默跌回内置默认（`gpt-4o-mini` / `gpt-image-1`）→ 中转站对不认识的模型回 **503**，现象看起来完全像「中转站抽风」。

**唯一的线索**是 `GET /api/settings` 里 `sources` 字段：如果 `model` 显示 `"default"` 而不是 `"file"`，就是踩了这条。

**当前稳妥做法**（也是本机在用的）：把 `VUDT_SPEC_MODEL` / `VUDT_IMAGE_MODEL` / `VUDT_*_BASE_URL` 写进 `server/.env`，用环境变量兜住——环境变量优先于内置默认，就不怕配置文件读不到。

```bash
curl -s http://127.0.0.1:4300/api/settings   # 看 sources
```

### 2. `baseUrl` 只能填到 `/v1`

provider 自己拼端点路径（`/chat/completions`、`/images/generations`）。填成完整端点会拼成双份 → 404。

### 3. 4300 上可能是**你自己的旧进程**

旧进程同样实现 `/health`，所以「服务在跑」不等于「新代码在跑」。

```bash
netstat -ano | grep LISTENING | grep ':4300'      # 找 PID
curl -s http://127.0.0.1:4300/api/settings        # 确认真后端
powershell "(Get-Process -Id <PID>).StartTime"    # 与源码 mtime 比一比
taskkill //PID <PID> //F                          # 进程比源码旧就杀掉它
```

> 杀后台 shell **不会**连带杀掉 node 子进程，端口照样被占。要用 `taskkill`，必要时加 `//T` 杀进程树。

### 4. 生成的项目用 hash 路由

`createWebHashHistory` + `base: './'`，所以预览里点结构树切页面只需改 `#<route>`，不需要服务端配合。

### 5. CSP 决定了部署形态（不是可选的偏好）

预览响应带 `frame-ancestors 'self'`。因此：

- **开发期**：vite dev server 代理 `/tasks` `/api` `/preview` `/health` 到 `127.0.0.1:4300`，浏览器看到的资源源统一是 5173，`'self'` 成立。
- **生产期**：**必须由 Fastify 同源托管 `web/dist`**（`VUDT_WEB_DIST_DIR`）。控制台不能单独部署到别的域名或端口，否则 iframe 会被浏览器直接拦掉。

预览响应同时带一条完整 CSP（`connect-src 'none'` 等），因为生成出来的 markup 是不可信内容。

### 6. 状态不持久化

任务表在内存里，**重启即清空**；工作区在 `.vudt/tasks/`，也在 `.gitignore` 里。这是刻意的——任务产物本来就不跨重启存活，单独持久化索引只会给出指向空目录的预览 URL。

---

## 开发约定

- **门槛**：改动后 `pnpm -r test` 与 `pnpm -r typecheck` 必须全绿。
- **改 schema 前先读** `docs/superpowers/specs/2026-09-21-spec-derivation-design.md`：draft 形状、两道闸、以及「几何只来自侧车」这条不变量的由来都在那里。
- **不变量改动要同步测试**：几何只来自侧车、props 走 `const` + `v-bind`、`w/h` 只来自侧车、沙箱用 env 白名单且不走 shell。
- 设计文档在 `docs/superpowers/specs/`，实施计划在 `docs/superpowers/plans/`。
- 上下文管理规则见 [`CLAUDE.md`](./CLAUDE.md)。

### 测试分布

| 包 | 用例数 |
|---|---|
| `@vudt/spec` | 13 |
| `@vudt/blocks` | 64 |
| `@vudt/codegen` | 37 |
| `@vudt/imagegen` | 29 |
| `@vudt/providers` | 47 |
| `@vudt/build` | 25 |
| `@vudt/server` | 111 |
| `@vudt/web` | 48 |
| **合计** | **374** |
