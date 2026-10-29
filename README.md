# 构想工坊 · AI Vue 3 项目生成平台

**当前产品版本：1.0**

用中文描述页面与业务需求，生成可运行、可继续开发的 Vue 3 项目，并提供图片生成、构建检查、在线预览及源码 / dist 导出。

支持现代后台管理界面和官网、多页展示站点。后台项目采用 **Vue 3 + TypeScript + Ant Design Vue** 底座；平台控制台采用三栏工作台，展示真实生成阶段及结构模型、图片模型的实际请求提示词。

> 1.0 面向本地、可信环境使用。生成结果是前端工程，不是已经接入真实后端、权限系统与生产数据库的完整业务系统。示例数据与页面交互需要根据项目继续联调。不要将未加访问控制的平台直接暴露到公网。

## 目录

- [1. 安装与启动](#1-安装与启动)
- [2. 模型与配置](#2-模型与配置)
- [3. 使用流程](#3-使用流程)
- [4. 导出与二次开发](#4-导出与二次开发)
- [5. 环境变量参考](#5-环境变量参考)
- [6. 常见问题](#6-常见问题)
- [7. 开发与架构](#7-开发与架构)
- [8. 10-版本边界](#8-10-版本边界)

## 1. 安装与启动

### 环境准备

- 推荐 **Node.js 22 LTS（22.12 或更高）**，避免较旧 Node 与工具链不兼容。
- **pnpm 11.20.0**，与根目录 `packageManager` 一致。
- Git。
- 可访问的 OpenAI 兼容接口：结构模型使用 `/chat/completions`，图片模型使用 `/images/generations`。
- 两类模型的有效 API key 与调用额度；平台不会代为提供模型服务。

```bash
npm install -g pnpm@11.20.0
git clone https://github.com/wdfkst/web-design-template.git
cd web-design-template
# 当前 1.0 实现发布在此分支；主分支尚未合并时需切换
git switch worktree-modern-admin-generator
pnpm install --frozen-lockfile
```

### 创建凭证文件

在仓库中手动新建 `server/.env`，将占位内容替换为服务商提供的真实值：

```dotenv
VUDT_SPEC_API_KEY=replace-with-your-structure-api-key
VUDT_IMAGE_API_KEY=replace-with-your-image-api-key
VUDT_SPEC_BASE_URL=https://your-relay.example.com/v1
VUDT_IMAGE_BASE_URL=https://your-relay.example.com/v1
VUDT_SPEC_MODEL=your-structure-model-id
VUDT_IMAGE_MODEL=your-image-model-id
VUDT_PORT=4300
```

两类服务可以使用不同中转站和不同 key；若服务商支持，也可以使用同一 key。模型 ID 必须使用服务商实际支持的名称，不能照抄不存在的示例名称。

**不要提交或分享 `server/.env`。** 此文件受 Git 忽略；key 不在网页配置页填写。修改 key 后需要重启后端。已有进程环境变量会优先于 Node `--env-file` 中的同名变量。

### 推荐：构建后单服务启动

以下命令全部在**仓库根目录**执行，Windows PowerShell、Git Bash 等均可使用：

```bash
pnpm build
node --env-file=server/.env --import ./server/node_modules/tsx/dist/loader.mjs server/src/main.ts
```

打开 **http://127.0.0.1:4300**。后端同时托管构建后的控制台、API 和项目预览，不需要另开前端服务。终端保持运行，按 `Ctrl+C` 停止。

如需换端口，在 `server/.env` 中将 `VUDT_PORT` 改为 `4302`，重启后访问 `http://127.0.0.1:4302`。不要同时启动多个占用同一端口的实例。

> **必须从仓库根启动后端。** 模板、工作区、图片缓存、控制台 dist 和设置文件均依赖当前工作目录。不要先进入 `server/`，也不要使用会改变 cwd 的包级 dev 命令替代上述启动方式。

### 开发模式：两个终端

后端使用上述 `node` 命令，并保持端口为 **4300**。另开一个终端，在仓库根执行：

```bash
pnpm --dir web exec vite
```

打开 Vite 输出的地址（通常为 `http://localhost:5173`）。前端代理 `/tasks`、`/api`、`/preview`、`/health` 到 `127.0.0.1:4300`。

如果改变后端端口，也要同步修改 `web/vite.config.ts` 中的 `API_TARGET` 并重启 Vite。开发时从 Vite 地址访问，避免跨源 iframe 被预览安全策略拦截。

## 2. 模型与配置

进入左侧 **模型与配置** 页面。

| 配置项 | 作用 | 填写方式 |
|---|---|---|
| 结构模型 baseUrl | 生成页面结构、文字、数据及图片主体描述 | API 根地址，通常以 `/v1` 结尾 |
| 结构模型 model | 结构生成使用的模型 | 服务商支持的精确模型 ID |
| 结构模型 sendResponseFormat | 是否发送 JSON 输出格式参数 | 服务商支持时开启；不兼容时关闭 |
| 图片模型 baseUrl | 生成插画与其他图片资产 | 图片服务的 API 根地址 |
| 图片模型 model | 图片生成模型 | 必须支持 images generations 接口 |

**baseUrl 不要填写完整端点**，例如不要带 `/chat/completions` 或 `/images/generations`，平台会自动追加。不要在 URL 中嵌入密钥。

推荐配置顺序：

1. 填写两类模型的地址和名称。
2. 使用「测试连通性」检查当前表单值；探测不等于完整生成验收，服务商也可能对探测计费。
3. 保存设置。
4. 回到工作台提交一个小任务，检查实际生成结果。

### 配置优先级与存储

```text
网页保存的配置文件 > 环境变量 > 内置默认值
```

从根目录启动时，设置读写的是同一个文件：**`<仓库根>/.vudt/settings.json`**。页面会展示设置来源 `file`、`env` 或 `default`。修改 `.env` 后发现模型没有变化，先检查是否已有文件配置覆盖。

任务创建时保存当时的模型设置快照。之后修改设置不会改变已经排队或运行中的任务；任务详情的设置页签用于查看历史快照。重试会创建新任务，使用新任务创建时的配置。

## 3. 使用流程

### 第一步：描述目标

在「项目工作台」输入需求，说明业务领域、页面、交互、风格和插画用途。不要只写“生成一个后台”，也不要把密码、客户资料等敏感内容放进需求。

后台示例：

```text
生成一个现代库存管理后台，使用冷银与钴蓝配色。
包含概览、商品列表和系统设置页面，侧边导航可以切换。
商品列表需要关键词搜索、状态筛选、新建和编辑表单，展示库存与价格。
使用示例数据，保留后续接后端的扩展空间。
列表空状态使用独特的仓储主题插画，布局紧凑、文字清晰，不要做成营销官网。
```

站点示例：

```text
生成一个设计工作室多页网站，包含首页、服务介绍和联系我们。
使用简洁的蓝白配色，首页包含品牌插画和服务介绍，导航能切换页面。
```

模型输出仍受平台支持的组件、页面类型及数据结构约束，并非任意需求都能一次生成成功。

### 第二步：查看真实进度

创建成功后自动进入任务详情，界面分为三栏：

- **左侧**：工作台与配置导航。
- **中间**：需求、真实阶段、事件记录、项目预览、结构与资产、设置快照。
- **右侧**：实际请求检查器，切换结构模型和图片模型。

任务总状态为 `queued → drafting → building → ready`，失败则进入 `failed`。细阶段包括生成结构、结构校验、生成代码、生成图片、类型检查和 Vite 构建。

进度约每 **1.5 秒**轮询，不是 token 流，也不提供虚构百分比。图片数量全部完成不代表项目构建完成；缓存命中或同任务图片复用会显示事件，但不会新增模型请求。

### 第三步：查看提示词

右侧可按结构请求尝试次数或图片资产选择记录，查看模型、请求状态、时间、保存的参数和提示词，并复制文本。

- **结构请求**：实际发送的 system / user 消息，以及重试时的校验反馈。
- **图片请求**：实际最终 prompt，包含风格、主体、构图等拼装内容，以及适用时追加的 Avoid 指令。
- 请求开始发送即记录为等待状态，不必等模型返回后再查看。
- 资产面板中的「图片主体描述」只是 prompt 的一部分，**不等于最终图片请求**。
- 快照不包含认证头；两类已知 API key 会被脱敏。这不是任意敏感信息识别器，需求和提示词仍可能包含用户自行输入的敏感文本。

### 第四步：预览或处理失败

成功后在预览区选择页面，检查布局与交互；结构页签可查看页面组成和图片资产。

失败时查看错误信息、事件记录和失败请求，先区分结构校验、模型服务、出图或构建问题。修正配置后点击重试，会创建新任务，不会覆盖旧任务。重试可能再次产生模型费用。

## 4. 导出与二次开发

- **源码导出**：下载生成工程 zip，不包含 `node_modules` 和 `dist`。只要任务工作区已建立，即使后续构建失败也可能导出源码。
- **dist 导出**：成功后下载静态构建产物。

解压源码，在包含 `package.json` 的目录执行：

```bash
pnpm install
pnpm dev
pnpm build
```

具体脚本以导出工程的 `package.json` 为准。使用 HTTP 静态服务器部署 dist，不建议双击 HTML 以 `file://` 打开。生成项目采用 hash 路由与相对资源路径。

导出的前端项目需要自行实现真实 API 接入、身份认证、权限校验和数据持久化。将模拟数据替换为业务接口前，应检查生成代码、表单校验及交互逻辑，不应直接视为生产验收通过。

## 5. 环境变量参考

所有相对路径均以启动后端时的 cwd 为基准。

| 变量 | 默认值 / 要求 | 用途 |
|---|---|---|
| `VUDT_SPEC_API_KEY` | 必填 | 结构模型密钥 |
| `VUDT_IMAGE_API_KEY` | 必填 | 图片模型密钥 |
| `VUDT_SPEC_BASE_URL` | `https://api.openai.com/v1` | 结构服务地址 |
| `VUDT_IMAGE_BASE_URL` | `https://api.openai.com/v1` | 图片服务地址 |
| `VUDT_SPEC_MODEL` | `gpt-4o-mini` | 默认结构模型；请按实际服务修改 |
| `VUDT_IMAGE_MODEL` | `gpt-image-1` | 默认图片模型；请按实际服务修改 |
| `VUDT_HOST` | `127.0.0.1` | 监听地址，建议保持本机访问 |
| `VUDT_PORT` | `4300` | 监听端口 |
| `VUDT_WORKSPACE_ROOT` | `.vudt/tasks` | 生成工程目录 |
| `VUDT_TEMPLATE_DIR` | `packages/templates/vue3-base` | 基础站点模板 |
| `VUDT_ADMIN_TEMPLATE_DIR` | 默认基础模板目录的同级 `vue3-admin` | 后台模板 |
| `VUDT_IMAGE_CACHE_DIR` | `.vudt/image-cache` | 图片缓存 |
| `VUDT_WEB_DIST_DIR` | `web/dist` | 已构建控制台目录 |
| `VUDT_CONCURRENCY` | `1` | 并行任务数 |
| `VUDT_MAX_PENDING` | `32` | 待处理队列上限 |
| `VUDT_MAX_ASSETS` | `24` | 单任务资产数上限，出图前检查；结构模型可能已调用 |
| `VUDT_SPEC_ATTEMPTS` | `3` | 结构生成最大尝试次数 |
| `VUDT_BUILD_TIMEOUT_MS` | `180000` | 构建工具超时时间，不是整个任务的总超时 |
| `VUDT_IMAGE_QUALITY` | 不传 | 图片质量参数，取值需符合服务商要求 |
| `VUDT_DISABLE_IMAGE_PROCESSOR` | 不设 | 设为 `1` 禁用图片后处理，不推荐，可能不满足插槽尺寸 |

## 6. 常见问题

| 现象 | 排查与处理 |
|---|---|
| 启动提示 API key 缺失 | 检查 `server/.env` 是否存在、key 是否为空，启动命令是否带 `--env-file` |
| 模板 ENOENT / 配置像丢失 | 确认从仓库根启动；不同 cwd 会读取不同 `.vudt/settings.json` |
| 改 `.env` 后模型没变 | 重启后端，并查看网页设置来源是否为优先级更高的 `file` |
| 中转站 404 | 检查 baseUrl 是否重复拼接端点，以及模型 ID 是否有效 |
| 中转站 400 / 403 | 检查权限、额度、请求参数；若服务商拒绝 `response_format`，在配置页关闭后保存并重试；不是所有 403 都由此导致 |
| 中转站 503 | 检查服务状态与模型支持情况，不要仅凭状态码认定是平台问题 |
| 端口已占用 / 页面不是新版本 | 停止确认属于本项目的旧进程，或更换端口；代码更新后重建 web 并重启后端 |
| 开发模式 API 请求失败 | 检查后端是否为 4300，是否与 Vite 的 `API_TARGET` 一致 |
| iframe 预览被拦截 | 控制台、API 和预览必须同源；使用单服务模式或 Vite 代理 |
| 队列满返回 503 | 等已有任务完成，或谨慎调整 `VUDT_MAX_PENDING`；增加并发可能增加费用与资源占用 |
| 重启后任务列表空了 | 1.0 任务索引、事件和请求快照仅保存在内存中；不自动恢复 |
| 图片长时间等待 | 查看实际请求状态；模型响应速度由服务商决定，缓存命中才可跳过对应请求 |

重启不会主动删除已经写入磁盘的工作区和图片缓存，但失去内存索引后旧任务不再通过任务 API 恢复。重要结果请在重启前导出；磁盘目录需自行管理。

## 7. 开发与架构

```text
需求 → 结构模型草稿 → schema 校验与图片插槽几何派生
     → 选择模板并生成代码 → 图片生成 / 缓存 → 类型检查 / Vite → 预览与导出
```

| 目录 | 职责 |
|---|---|
| `web` | Vue 3 控制台、阶段时间线与请求检查器 |
| `server` | Fastify API、队列、设置、任务记录、静态预览与导出 |
| `packages/spec` | 结构定义与校验 |
| `packages/templates/blocks` | 区块目录、属性约束与图片插槽侧车 |
| `packages/templates/vue3-base` | 基础站点模板 |
| `packages/templates/vue3-admin` | Ant Design Vue 后台模板 |
| `packages/codegen` | 页面、路由、主题与数据代码生成 |
| `packages/imagegen` | prompt 编排、尺寸、缓存与图片处理 |
| `packages/providers` | OpenAI 兼容模型调用与 sharp 后处理 |
| `packages/build` | 工程写入与构建管线 |

图片几何由侧车声明，不由模型自由生成；生成器基于模板写覆盖层，而不是任意执行模型输出的整个工程。构建采用受限环境与超时控制，但不等于完整安全隔离。

```bash
pnpm test
pnpm typecheck
pnpm build
# 运行单个测试文件
pnpm --filter @vudt/server exec vitest run src/__tests__/app.test.ts
```

**build 不能替代 typecheck**，提交前应分别运行。1.0 工作台代码最近一次全仓回归为 714 例通过；这不是对任意真实模型输出的保证。

主要接口：

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/health` | 健康检查 |
| POST | `/tasks` | 新建任务，JSON `{ "description": "需求" }` |
| GET | `/tasks`、`/tasks/:id` | 任务列表与详情 |
| GET | `/tasks/:id/observability` | 真实事件与请求快照 |
| GET | `/tasks/:id/spec` | 结构与图片资产信息 |
| POST | `/tasks/:id/retry` | 创建重试任务 |
| GET | `/preview/:id/` | 生成项目预览 |
| GET | `/tasks/:id/export/source` | 源码 zip |
| GET | `/tasks/:id/export/dist` | dist zip |
| GET / PUT | `/api/settings` | 读取 / 保存模型设置 |
| POST | `/api/settings/test` | 探测提交的设置 |

## 8. 1.0 版本边界

- 本地单机工具，不提供生产级多租户、账号权限或公网部署防护。
- 任务、事件和请求快照是内存态，服务重启后不恢复。
- 请求记录有容量限制：默认最多 64 条请求、200 条事件；单条请求内容上限为 128000 字符，超限会标记省略或截断。
- 阶段日志可能包含重复结束事件；排队没有独立事件记录；请求参数面板不是完整 HTTP 请求转储。
- 已进行自动化测试与 HTTP 检查；本轮桌面 / 移动 / 明暗视觉验收和新的真实付费模型端到端验收尚未完成。
- 1.0 是产品使用手册中的版本标识，不代表所有内部 workspace 包都同步改成 `1.0.0`。

详细验证记录见 [生成工作台验证记录](docs/superpowers/verification/2026-10-29-generation-workspace.md)。设计与实施资料位于 `docs/superpowers/`。
