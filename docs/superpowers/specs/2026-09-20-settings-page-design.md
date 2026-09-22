# 配置页设计：中转站与模型设置

## 背景

用户实际使用的是**中转站的 OpenAI 兼容 API**，不是官方端点。因此「可配置响应格式」这类诉求本质是**兼容性问题**，不是使用偏好。目前 `baseUrl` 与 `model` 只能通过环境变量设置，没有界面；且有三处写死的行为会让中转站直接失败。

本设计新增一个配置页，并连带修掉这三处兼容性问题。

## 范围

**做**：五个可配字段的读写界面与持久化、连通性测试端点、`response_format` 可关、图片认 URL 响应、任务级设置快照。

**不做**：
- API key 的界面管理。key 仍只从 `VUDT_SPEC_API_KEY` / `VUDT_IMAGE_API_KEY` 读，启动时必需，由工厂闭包捕获。设置文件无 key 字段。
- `temperature`、`quality`：YAGNI。
- 图片输出格式（`.png`）：写死在 provider、`packages/codegen/src/naming.ts:34,39` 与缓存签名三处，且 jpeg 无 alpha 会破坏透明底图逻辑。
- `size`：永远不可配，来自区块侧车几何。

## 第 1 段：数据形状与持久化

### 字段

```ts
interface ModelSettings {
  baseUrl?: string
  model?: string
}
interface AppSettings {
  spec: ModelSettings & { sendResponseFormat?: boolean }
  image: ModelSettings
}
```

`sendResponseFormat` 是 boolean 而非枚举：`json_schema` 需连带构造 schema 对象，属于另一个功能。

### 优先级

设置文件 > 环境变量 > 代码默认值。现有 `VUDT_SPEC_MODEL` 等不失效，只是降级为默认值。启动时读一次进内存，不是每个任务读盘。

### 持久化

`.vudt/settings.json`（该目录已在 `.gitignore` 第 14 行，中转站地址不进 git）。写入用 write-then-rename，**照抄 `packages/imagegen/src/cache.ts:53-57`** 的 `.{pid}.{ts}.tmp` + `rename` 写法。

### 任务快照

`TaskRecord` 加 `settings` 字段，`createTask()` 时深拷贝，`TaskView` 投影出去，详情页可见「这个任务用的哪个中转站/模型」。

改设置**不影响已排队任务**——快照在 `createTask()` 时取，而非开跑时取。

### 依赖注入：方案 A（`AppDeps` 收工厂函数）

```ts
interface AppDeps {
  drafter: (s: AppSettings['spec']) => SpecDrafter
  imageProvider: (s: AppSettings['image']) => ImageProvider
  // ...其余不变
}
```

选它的理由：生产与测试走**同一条路**（测试传 `() => new ScriptedDrafter([...])`），不留未被测试覆盖的生产路径——留了会复现「绿测试但服务起不来」的同类缺陷。且「快照」变成工厂入参的自然结果，不需要额外机制。

否掉的方案：可变 provider（共享可变状态，且会改到跑一半的任务，与快照决策冲突）。

**改动量实测**：`buildApp({...})` 全仓只有两个构造点——`server/src/main.ts:60` 和 `server/src/__tests__/app.test.ts:25` 的 `makeApp`。五处测试覆写（`app.test.ts:124 276 347 375 399`）全走 `makeApp` 的 `Overrides` 展开。所以是**一个测试文件里 7 处机械改动**（各包一层 `() =>`）。

## 第 2 段：端点与校验、连通性测试

沿用现有 HTTP 层风格：手写 `typeof` 校验（见 `app.ts:155-157`），4xx 统一抛 `ServerError(message, statusCode, detail)`，**不引 zod 到端点层**。

### 三个端点

- `GET /api/settings` → `{ settings, sources }`。`sources` 标记每个字段的来源（`'file' | 'env' | 'default'`），页面据此显示「继承自环境变量」。不给的话用户无法分辨空值是「没配」还是「配了同值」。
- `PUT /api/settings` → 全量替换，返回落盘后的 `{ settings, sources }`。不做 PATCH：五个字段一屏填完，合并语义反而要额外定义「null 表示清除还是不动」。清除某字段 = 传空串，落盘时**删键**，于是自动降级回 env/默认。
- `POST /api/settings/test` → 连通性测试。**body 传待测的设置而非读已存的**，用户能在保存前先试。返回 `{ spec: Result, image: Result }`，两侧独立跑、独立报错。

### 校验规则

| 字段 | 规则 |
|---|---|
| `baseUrl` | 非空时必须 `new URL()` 解析得过，协议限 `http:`/`https:`；存盘前 strip 一次尾斜杠 |
| `model` | 非空字符串，trim；**不校白名单**（中转站模型名千奇百怪，白名单只会挡合法用法） |
| `sendResponseFormat` | 严格 `typeof === 'boolean'`；缺失视为 `true` 保持现状 |

多余字段忽略而非报错。`baseUrl` 在入口统一 strip 之后，`sources` 显示的值与实际请求的值才一致（provider 侧也 strip）。

### 连通性测试

key 仍只从环境变量取，**永不出现在请求体或响应体里**。

- **spec 侧**：发一个最小真请求（一句 `ping`，`max_tokens` 极小）。
- **image 侧**：不发真图（要钱且慢），改为 `GET {baseUrl}/models`，足够验证地址与鉴权。

返回 `{ ok: boolean, status?: number, bodyExcerpt?: string, hint?: string }`。

`bodyExcerpt` 是上游响应体截断到 500 字符——这是绕开「诊断黑洞」的核心。两个 provider 的错误刻意只带状态码不带响应体（`openai-image-provider.ts:65-68`、`openai-spec-drafter.ts:127-130`），因为异常路径上有 prompt 和 key；而这里请求是合成的（无用户 prompt、key 只在 header），回显响应体不泄露新东西。

`hint` 做一次模式识别：400 且响应体含 `response_format` → 提示「试试关掉 JSON 响应格式」；401/403 → 提示「检查环境变量里的 key」。

**已声明的取舍**：测试按钮会真花 spec 侧一次极小 token 开销。免费替代是两侧都只打 `/models`，但那验不出 `model` 名对不对——而「模型名中转站不认」恰好是最常见的失败。故选花钱那版。

## 第 3 段：前端页面与测试策略

### 路由与深链

加 `{ path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') }`，与现有两条一样懒加载。

**深链冲突已解决：API 用 `/api/settings` 前缀，控制台页面占 `/settings`。**

fallback 的实现方式决定了这事没法靠顺序解决。`app.ts:290` 用的是 `setNotFoundHandler` 而非 catch-all GET，所以**已注册的 API 路由永远先赢**——handler 根本看不到 `GET /settings`。若把端点注册成 `/settings`，浏览器深链也会被这条 API 路由接走拿到 JSON，控制台外壳永远到不了；要救就得在路由里做 Accept 协商，那是这个仓库没有的模式。

`app.ts:297` 的注释给了先例：控制台详情页故意用单数 `/task/:id`，就为了不撞 `/tasks` 前缀。既有约定是**让路径错开**，不是协商。故沿用：API 挪到 `/api` 前缀下。

连带改动：`app.ts:300` 那条 404 守卫的前缀列表要加 `/api`，否则打错的 `/api/xxx` 会返回 HTML 外壳、掩盖 bug。

### 页面结构

单文件 `SettingsView.vue`，一屏，不做分步向导。

两个分组 `spec` / `image`，各自 baseUrl + model 两个输入框，spec 组多一个 `sendResponseFormat` 开关。每个输入框占位符显示继承来的值，旁边小字标 `sources` 给的来源。底部三个动作：测试连通性、保存、重置为继承值。

测试结果**就地展开**在对应分组下方：绿勾或红字 + `bodyExcerpt` 折叠区 + `hint`。不弹 toast——诊断信息需要停留阅读，toast 会消失。

`client.ts` 加 `getSettings` / `putSettings` / `testSettings`，沿用现有 fetch 封装与错误转换。不引状态管理库，页面本地 `ref` 够用（只有一份全局设置，无跨页共享需求）。

### 详情页

`TaskDetail.vue` 展示 `TaskView.settings` 快照，否则快照存了没人看得见。

### 测试策略

**server 侧**（补在 `app.test.ts`）：
- `GET` 三种来源的投影正确
- `PUT` 校验四类坏输入：坏 URL、非 http 协议、空 model、非 boolean
- `PUT` 后 `GET` 读回一致
- 写盘走 tmp+rename，断言临时文件不残留
- `POST /api/settings/test` 在 provider 工厂被替换成 stub 时，两侧独立成功/失败
- 路由分离生效：浏览器直访 `/settings` 拿到 HTML 外壳；`GET /api/settings` 拿到 JSON；`GET /api/unknown` 以 JSON 404 而非 HTML 外壳（守卫前缀加 `/api` 的回归测试）

方案 A 的工厂改造让以上全部可注入，**不需要真打网络**。

**web 侧**（按现有习惯测逻辑不测样式）：
- `sources` 到显示文案的映射
- 表单到请求体的组装（空串 → 删键）
- 测试结果渲染的三个分支

页面本身不做快照测试。

## 连带修掉的兼容性问题

1. **`response_format` 写死**：`packages/providers/src/openai-spec-drafter.ts:122` 的 `{ type: 'json_object' }` 改为受 `sendResponseFormat` 控制。解析侧已宽容（`:140-144` JSON.parse 失败返回原文），关掉不会连带崩解析。
2. **图片只读 `b64_json`**：`openai-image-provider.ts:71` 拿不到就抛「returned no inline image data」。类型 `ImagesReply` 已声明 `url?: string | null`（`:15`），中转站转发 `gpt-image-1` 常回 URL，这类现在完全不可用——补上 URL 分支（取回后转 buffer，接入既有后处理与缓存）。
3. **诊断黑洞**：由 `POST /api/settings/test` 的 `bodyExcerpt` 绕开，provider 自身的错误处理**不改**（异常路径确实有 prompt 与 key）。
