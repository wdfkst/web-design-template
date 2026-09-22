# 配置页（中转站与模型设置）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给控制台加一个配置页，让用户能改中转站地址与模型名、关掉 `response_format`，并顺带修掉两处让中转站直接不可用的写死行为。

**Architecture:** 设置以 `.vudt/settings.json` 持久化（write-then-rename），启动读一次进内存；`AppDeps` 的 `drafter`/`provider` 从实例改为**工厂函数**，于是每个任务用自己那份设置快照构造 provider，生产与测试走同一条路。API 挂在 `/api` 前缀下以避开控制台深链。

**Tech Stack:** TypeScript（ESM，NodeNext）、Fastify、Vue 3 + vue-router、Vitest、pnpm workspace。

**Spec:** `docs/superpowers/specs/2026-09-20-settings-page-design.md`

## Global Constraints

- **仓库不是 git 仓库**（`git rev-parse --is-inside-work-tree` 报 fatal）。因此**所有任务的 "Commit" 步骤都跳过**，改为「跑一遍全仓测试确认绿」。不要 `git init`。
- API key 只从 `VUDT_SPEC_API_KEY` / `VUDT_IMAGE_API_KEY` 读，**绝不进 `ServerConfig`、不进 `TaskRecord`、不进任何响应体**（`server/src/main.ts:13-16` 的注释说明了原因）。
- `AppDeps` 的图片侧字段名是 **`provider`**（`server/src/app.ts:19`），不是 spec 里写的 `imageProvider`；沿用 `provider`。
- 端点前缀 `/api`，控制台页面占 `/settings`。`app.ts:300` 的 404 守卫前缀列表要加 `/api`。
- 不引 zod 到端点层，手写 `typeof` 校验，4xx 抛 `ServerError(message, statusCode, detail)`（`server/src/errors.ts`）。
- 不引状态管理库。
- 测试命令：全仓 `pnpm -r test`，单包 `pnpm --filter @vudt/<pkg> test`，单文件加 `-- <path>`。
- 读文件超过 200 行必须分段（`sed -n 'a,bp'`），命令输出加 `| head -n 100`。

---

## File Structure

**新建**

| 文件 | 职责 |
|---|---|
| `server/src/settings.ts` | `AppSettings` 类型、校验、三层合并（file > env > default）、`sources` 计算。纯函数，不碰磁盘。 |
| `server/src/settings-store.ts` | 磁盘读写：启动读一次、`save()` 走 write-then-rename。持有内存里的当前值。 |
| `server/src/settings-probe.ts` | 连通性测试：两侧各发一次请求，返回 `{ ok, status?, bodyExcerpt?, hint? }`。 |
| `server/src/__tests__/settings.test.ts` | 校验与合并的单元测试（不碰磁盘、不碰 HTTP）。 |
| `server/src/__tests__/settings-store.test.ts` | 读写与 tmp 残留的测试。 |
| `web/src/views/SettingsView.vue` | 配置页。 |
| `web/src/views/settingsForm.ts` | 表单 ↔ 请求体的纯函数（空串→删键）、`sources`→文案映射。抽出来才好测。 |
| `web/src/views/__tests__/settingsForm.test.ts` | 上面那个的测试。 |

拆成 `settings.ts`（纯）+ `settings-store.ts`（IO）+ `settings-probe.ts`（网络）是因为三者测试手段完全不同：纯函数直接断言、IO 要临时目录、网络要注入 `fetch`。混在一个文件里每个测试都得准备全套替身。

**修改**

| 文件 | 改什么 |
|---|---|
| `server/src/app.ts:15-32` | `AppDeps.drafter`/`provider` 改工厂函数；加 `settingsStore?` |
| `server/src/app.ts:154-178` | `createTask()` 存设置快照 |
| `server/src/app.ts:36-67` | `TaskView` 加 `settings` |
| `server/src/app.ts:290-313` | 404 守卫前缀加 `/api` |
| `server/src/app.ts` 新增 | 三个 `/api/settings*` 端点 |
| `server/src/store.ts:5-21` | `TaskRecord` 加 `settings` |
| `server/src/runner.ts:10-11,50,59` | 用工厂 + 任务快照构造 provider |
| `server/src/main.ts:26-40,53-75` | 建 store、把 `buildDrafter`/`buildImageProvider` 变成收设置的工厂 |
| `server/src/__tests__/app.test.ts:21-33` | `makeApp` 包工厂；5 处覆写同步 |
| `packages/providers/src/openai-spec-drafter.ts:19-25,122` | 加 `sendResponseFormat` 选项 |
| `packages/providers/src/openai-image-provider.ts:70-78` | 认 `url` 响应 |
| `web/src/router.ts:3-6` | 加 `/settings` 路由 |
| `web/src/api/client.ts` | 三个函数 + `SettingsPayload` 等类型 |
| `web/src/views/TaskDetail.vue` | 展示快照 |

## Task 顺序理由

先做叶子（providers、settings 纯函数），再做 store/IO，再做 `AppDeps` 工厂化这个牵一发动全身的改动，最后端点与前端。这样每个任务落地时它依赖的东西都已经存在且测过了。

---

### Task 1: spec drafter 的 `response_format` 可关

**Files:**
- Modify: `packages/providers/src/openai-spec-drafter.ts:19-25`（选项）、`:122`（请求体）
- Test: `packages/providers/src/__tests__/openai-spec-drafter.test.ts`

**Interfaces:**
- Consumes: 无（叶子任务）
- Produces: `OpenAISpecDrafterOptions.sendResponseFormat?: boolean`，缺省 `true`。Task 5 的 `buildDrafter` 会传它。

现有测试里有 `recordingFetch`（`:14-28`）与 `drafterWith(responseBody, status)`（`:34-41`）两个 helper。`drafterWith` 现在不接受额外选项，本任务要加第三个参数。

- [ ] **Step 1: 写失败的测试**

改 `drafterWith` 签名，加一个可选的 drafter 选项参数（放在 `packages/providers/src/__tests__/openai-spec-drafter.test.ts`，替换现有的 `drafterWith`）：

```ts
function drafterWith(
  responseBody: unknown,
  status = 200,
  extra: { sendResponseFormat?: boolean } = {},
) {
  const { calls, fetchImpl } = recordingFetch(responseBody, status)
  const drafter = createOpenAISpecDrafter({
    apiKey: 'sk-test',
    model: 'gpt-test',
    baseUrl: 'https://example.invalid/v1',
    fetch: fetchImpl as unknown as typeof fetch,
    ...extra,
  })
  return { calls, drafter }
}
```

追加两个测试：

```ts
test('omits response_format when sendResponseFormat is false', async () => {
  const { calls, drafter } = drafterWith(chatReply('{"ok":true}'), 200, {
    sendResponseFormat: false,
  })
  await drafter.draft({ description: 'a landing page', attempt: 1 })
  expect(calls[0]!.body.response_format).toBeUndefined()
})

test('sends response_format by default', async () => {
  const { calls, drafter } = drafterWith(chatReply('{"ok":true}'))
  await drafter.draft({ description: 'a landing page', attempt: 1 })
  expect(calls[0]!.body.response_format).toEqual({ type: 'json_object' })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @vudt/providers test -- openai-spec-drafter`
Expected: 第一个测试 FAIL（`response_format` 仍被发出，收到 `{ type: 'json_object' }` 而非 `undefined`）。第二个应当已经 PASS——它锁的是现有行为。

- [ ] **Step 3: 最小实现**

`openai-spec-drafter.ts` 的 `OpenAISpecDrafterOptions` 加一个字段：

```ts
  /**
   * Some OpenAI-compatible relays reject `response_format` with a 400. Turning it
   * off is safe: the reply is parsed leniently and falls back to the raw string.
   */
  sendResponseFormat?: boolean
```

请求体里把写死的那行改成条件展开（`:122` 附近）：

```ts
        body: JSON.stringify({
          model,
          messages,
          ...(options.sendResponseFormat === false ? {} : { response_format: { type: 'json_object' } }),
          temperature: options.temperature ?? 0.4,
        }),
```

用 `=== false` 而不是 `?? true` 取反，是为了让 `undefined` 明确地走「照旧发」那条路。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @vudt/providers test -- openai-spec-drafter`
Expected: 全部 PASS。

- [ ] **Step 5: 确认无回归**

Run: `pnpm --filter @vudt/providers test`
Expected: 全绿。（仓库非 git，不提交。）

---

### Task 2: image provider 认 URL 响应

**Files:**
- Modify: `packages/providers/src/openai-image-provider.ts:70-78`
- Test: `packages/providers/src/__tests__/openai-image-provider.test.ts`

**Interfaces:**
- Consumes: 无（叶子任务）
- Produces: 行为变化，无新签名。`ImagesReply.data[0].url` 存在且无 `b64_json` 时，provider 取回该 URL 的字节。

**陷阱**：现有 helper `recordingFetch`（`:17-27`）对每次调用都做 `JSON.parse(String(init?.body))`。取图那次是 GET、无 body，`String(undefined)` → `"undefined"` → `JSON.parse` 抛错。所以本任务必须另写一个容忍无 body 的 helper，不要复用 `recordingFetch`。

- [ ] **Step 1: 写失败的测试**

在 `openai-image-provider.test.ts` 追加：

```ts
function urlReplyFetch(url: string, bytes: Uint8Array) {
  const calls: { url: string; method: string }[] = []
  const fetchImpl = async (target: string | URL, init?: RequestInit): Promise<Response> => {
    const href = String(target)
    calls.push({ url: href, method: init?.method ?? 'GET' })
    if (href.endsWith('/images/generations')) {
      return new Response(JSON.stringify({ data: [{ url }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(bytes, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })
  }
  return { calls, fetchImpl }
}

function imageRequest(): ImageRequest {
  return {
    assetId: 'hero',
    prompt: 'a calm gradient',
    size: { w: 1024, h: 1024 },
    transparent: false,
  }
}

test('fetches the image when the relay returns a url instead of b64_json', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
  const { calls, fetchImpl } = urlReplyFetch('https://cdn.invalid/out.png', bytes)
  const provider = createOpenAIImageProvider({
    apiKey: 'sk-test',
    model: 'gpt-image-test',
    baseUrl: 'https://example.invalid/v1',
    fetch: fetchImpl as unknown as typeof fetch,
  })

  const result = await provider.generate(imageRequest())

  expect(Array.from(result)).toEqual(Array.from(bytes))
  expect(calls[1]!.url).toBe('https://cdn.invalid/out.png')
})

test('throws when the url fetch fails', async () => {
  const fetchImpl = async (target: string | URL): Promise<Response> => {
    if (String(target).endsWith('/images/generations')) {
      return new Response(JSON.stringify({ data: [{ url: 'https://cdn.invalid/out.png' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response('nope', { status: 404 })
  }
  const provider = createOpenAIImageProvider({
    apiKey: 'sk-test',
    model: 'gpt-image-test',
    baseUrl: 'https://example.invalid/v1',
    fetch: fetchImpl as unknown as typeof fetch,
  })

  await expect(provider.generate(imageRequest())).rejects.toThrow(/status 404/)
})
```

`imageRequest()` 如果该文件里已有等价 helper，用现成的，别重复定义——先 `grep -n "ImageRequest" packages/providers/src/__tests__/openai-image-provider.test.ts` 看一眼。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @vudt/providers test -- openai-image-provider`
Expected: 两个新测试都 FAIL，报 `returned no inline image data for asset hero`——正是现在中转站不可用的那条路径。

- [ ] **Step 3: 最小实现**

`openai-image-provider.ts` 把取字节那段（`:70-78`）改成先试 base64、再试 URL：

```ts
      const reply = (await response.json()) as ImagesReply
      const encoded = reply.data?.[0]?.b64_json
      const href = reply.data?.[0]?.url

      let bytes: Uint8Array
      if (typeof encoded === 'string' && encoded.trim() !== '') {
        bytes = decodeBase64(encoded)
      } else if (typeof href === 'string' && href.trim() !== '') {
        // Relays forwarding gpt-image-1 commonly answer with a URL rather than
        // inline base64. Status only in the error, same reason as above.
        const image = await fetchImpl(href)
        if (!image.ok) {
          throw new Error(
            `image provider url fetch failed with status ${image.status} for asset ${request.assetId}`,
          )
        }
        bytes = new Uint8Array(await image.arrayBuffer())
      } else {
        throw new Error(
          `image provider returned no inline image data for asset ${request.assetId}`,
        )
      }

      if (bytes.byteLength === 0) {
        throw new Error(`image provider returned an empty image for asset ${request.assetId}`)
      }
      return bytes
```

取图那次**不带 `authorization` 头**：URL 通常是带签名的对象存储链接，把 key 发给第三方主机是在扩大 key 的暴露面。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @vudt/providers test -- openai-image-provider`
Expected: 全部 PASS。

- [ ] **Step 5: 确认无回归**

Run: `pnpm --filter @vudt/providers test`
Expected: 全绿。

---

### Task 3: settings 纯函数（类型、校验、三层合并）

**Files:**
- Create: `server/src/settings.ts`
- Test: `server/src/__tests__/settings.test.ts`

**Interfaces:**
- Consumes: `ServerError`（`server/src/errors.ts`）
- Produces（后续任务全靠这些名字）：
  - `ModelSettings { baseUrl?: string; model?: string }`
  - `SpecSettings extends ModelSettings { sendResponseFormat?: boolean }`
  - `AppSettings { spec: SpecSettings; image: ModelSettings }`
  - `SettingSource = 'file' | 'env' | 'default'`
  - `SettingsSources` — 每字段一个 `SettingSource`
  - `EffectiveSettings` — 合并后的有效值，字段全必填
  - `ResolvedSettings { settings: EffectiveSettings; sources: SettingsSources }`
  - `parseSettingsInput(body: unknown): AppSettings` — 坏输入抛 `ServerError(msg, 400)`
  - `resolveSettings(file: AppSettings, env: NodeJS.ProcessEnv): ResolvedSettings`
  - `EMPTY_SETTINGS: AppSettings`

这个文件**不碰磁盘、不碰网络**，测试直接断言返回值。

- [ ] **Step 1: 写失败的测试**

创建 `server/src/__tests__/settings.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { EMPTY_SETTINGS, parseSettingsInput, resolveSettings } from '../settings.js'

describe('parseSettingsInput', () => {
  it('accepts and normalizes a full payload', () => {
    const parsed = parseSettingsInput({
      spec: { baseUrl: 'https://relay.invalid/v1/', model: '  glm-4  ', sendResponseFormat: false },
      image: { baseUrl: 'http://127.0.0.1:8080/v1', model: 'flux' },
    })
    expect(parsed).toEqual({
      spec: { baseUrl: 'https://relay.invalid/v1', model: 'glm-4', sendResponseFormat: false },
      image: { baseUrl: 'http://127.0.0.1:8080/v1', model: 'flux' },
    })
  })

  it('drops empty strings so the value falls back to env or default', () => {
    expect(parseSettingsInput({ spec: { baseUrl: '', model: '   ' }, image: {} })).toEqual({
      spec: {},
      image: {},
    })
  })

  it('treats a missing body as empty rather than failing', () => {
    expect(parseSettingsInput(undefined)).toEqual(EMPTY_SETTINGS)
    expect(parseSettingsInput({})).toEqual(EMPTY_SETTINGS)
  })

  it('ignores unknown fields', () => {
    const parsed = parseSettingsInput({ spec: { model: 'x', apiKey: 'sk-leak' }, nope: 1 })
    expect(parsed).toEqual({ spec: { model: 'x' }, image: {} })
    expect(JSON.stringify(parsed)).not.toContain('sk-leak')
  })

  it('rejects a malformed baseUrl', () => {
    expect(() => parseSettingsInput({ spec: { baseUrl: 'not a url' } })).toThrow(/baseUrl/)
  })

  it('rejects a non-http protocol', () => {
    expect(() => parseSettingsInput({ image: { baseUrl: 'ftp://relay.invalid/v1' } })).toThrow(/http/)
  })

  it('rejects a non-boolean sendResponseFormat', () => {
    expect(() => parseSettingsInput({ spec: { sendResponseFormat: 'yes' } })).toThrow(
      /sendResponseFormat/,
    )
  })

  it('rejects a non-string model', () => {
    expect(() => parseSettingsInput({ spec: { model: 42 } })).toThrow(/model/)
  })
})

describe('resolveSettings', () => {
  const env = {
    VUDT_SPEC_MODEL: 'env-spec-model',
    VUDT_SPEC_BASE_URL: 'https://env.invalid/v1',
    VUDT_IMAGE_MODEL: 'env-image-model',
  } as unknown as NodeJS.ProcessEnv

  it('prefers the file over env, and env over defaults', () => {
    const { settings, sources } = resolveSettings({ spec: { model: 'file-model' }, image: {} }, env)

    expect(settings.spec.model).toBe('file-model')
    expect(sources.spec.model).toBe('file')
    expect(settings.spec.baseUrl).toBe('https://env.invalid/v1')
    expect(sources.spec.baseUrl).toBe('env')
    expect(settings.image.baseUrl).toBe('https://api.openai.com/v1')
    expect(sources.image.baseUrl).toBe('default')
  })

  it('defaults sendResponseFormat to true', () => {
    const { settings, sources } = resolveSettings(EMPTY_SETTINGS, {} as NodeJS.ProcessEnv)
    expect(settings.spec.sendResponseFormat).toBe(true)
    expect(sources.spec.sendResponseFormat).toBe('default')
  })

  it('reports a false sendResponseFormat as file-sourced', () => {
    const { settings, sources } = resolveSettings(
      { spec: { sendResponseFormat: false }, image: {} },
      {} as NodeJS.ProcessEnv,
    )
    expect(settings.spec.sendResponseFormat).toBe(false)
    expect(sources.spec.sendResponseFormat).toBe('file')
  })

  it('strips a trailing slash coming from env', () => {
    const { settings } = resolveSettings(EMPTY_SETTINGS, {
      VUDT_IMAGE_BASE_URL: 'https://env.invalid/v1/',
    } as unknown as NodeJS.ProcessEnv)
    expect(settings.image.baseUrl).toBe('https://env.invalid/v1')
  })
})
```

`sendResponseFormat: false` 单独测，因为 `false` 最容易被 `??` 或 truthy 判断吃掉——而它恰好是本功能存在的理由。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @vudt/server test -- settings.test`
Expected: FAIL，模块 `../settings.js` 不存在。

- [ ] **Step 3: 最小实现**

创建 `server/src/settings.ts`：

```ts
import { ServerError } from './errors.js'

export interface ModelSettings {
  baseUrl?: string
  model?: string
}

export interface SpecSettings extends ModelSettings {
  /** Off when the relay rejects `response_format`; see the providers package. */
  sendResponseFormat?: boolean
}

export interface AppSettings {
  spec: SpecSettings
  image: ModelSettings
}

export type SettingSource = 'file' | 'env' | 'default'

export interface SettingsSources {
  spec: { baseUrl: SettingSource; model: SettingSource; sendResponseFormat: SettingSource }
  image: { baseUrl: SettingSource; model: SettingSource }
}

export interface EffectiveSettings {
  spec: { baseUrl: string; model: string; sendResponseFormat: boolean }
  image: { baseUrl: string; model: string }
}

export interface ResolvedSettings {
  settings: EffectiveSettings
  sources: SettingsSources
}

export const EMPTY_SETTINGS: AppSettings = { spec: {}, image: {} }

const DEFAULTS = {
  baseUrl: 'https://api.openai.com/v1',
  specModel: 'gpt-4o-mini',
  imageModel: 'gpt-image-1',
} as const

/** Trailing slashes are stripped here so `sources` shows what is actually sent. */
function normalizeBaseUrl(raw: string, field: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new ServerError(`${field} must be a valid URL`, 400)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ServerError(`${field} must use http or https`, 400)
  }
  return trimmed
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/** An empty string means "clear it": the key is dropped and lookup falls through. */
function parseModel(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'string') throw new ServerError(`${field} must be a string`, 400)
  const trimmed = raw.trim()
  return trimmed === '' ? undefined : trimmed
}

function parseBaseUrl(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'string') throw new ServerError(`${field} must be a string`, 400)
  if (raw.trim() === '') return undefined
  return normalizeBaseUrl(raw, field)
}

export function parseSettingsInput(body: unknown): AppSettings {
  const root = asRecord(body)
  const specIn = asRecord(root.spec)
  const imageIn = asRecord(root.image)

  const spec: SpecSettings = {}
  const specBaseUrl = parseBaseUrl(specIn.baseUrl, 'spec.baseUrl')
  if (specBaseUrl !== undefined) spec.baseUrl = specBaseUrl
  const specModel = parseModel(specIn.model, 'spec.model')
  if (specModel !== undefined) spec.model = specModel
  if (specIn.sendResponseFormat !== undefined && specIn.sendResponseFormat !== null) {
    if (typeof specIn.sendResponseFormat !== 'boolean') {
      throw new ServerError('spec.sendResponseFormat must be a boolean', 400)
    }
    spec.sendResponseFormat = specIn.sendResponseFormat
  }

  const image: ModelSettings = {}
  const imageBaseUrl = parseBaseUrl(imageIn.baseUrl, 'image.baseUrl')
  if (imageBaseUrl !== undefined) image.baseUrl = imageBaseUrl
  const imageModel = parseModel(imageIn.model, 'image.model')
  if (imageModel !== undefined) image.model = imageModel

  return { spec, image }
}

function pick<T>(
  fromFile: T | undefined,
  fromEnv: T | undefined,
  fallback: T,
): { value: T; source: SettingSource } {
  if (fromFile !== undefined) return { value: fromFile, source: 'file' }
  if (fromEnv !== undefined) return { value: fromEnv, source: 'env' }
  return { value: fallback, source: 'default' }
}

/** Env values are normalized too: an address pasted into a shell keeps its slash. */
function envUrl(raw: string | undefined, field: string): string | undefined {
  if (raw === undefined || raw.trim() === '') return undefined
  return normalizeBaseUrl(raw, field)
}

function envText(raw: string | undefined): string | undefined {
  if (raw === undefined || raw.trim() === '') return undefined
  return raw.trim()
}

export function resolveSettings(file: AppSettings, env: NodeJS.ProcessEnv): ResolvedSettings {
  const specBaseUrl = pick(
    file.spec.baseUrl,
    envUrl(env.VUDT_SPEC_BASE_URL, 'VUDT_SPEC_BASE_URL'),
    DEFAULTS.baseUrl,
  )
  const specModel = pick(file.spec.model, envText(env.VUDT_SPEC_MODEL), DEFAULTS.specModel)
  const sendResponseFormat = pick<boolean>(file.spec.sendResponseFormat, undefined, true)
  const imageBaseUrl = pick(
    file.image.baseUrl,
    envUrl(env.VUDT_IMAGE_BASE_URL, 'VUDT_IMAGE_BASE_URL'),
    DEFAULTS.baseUrl,
  )
  const imageModel = pick(file.image.model, envText(env.VUDT_IMAGE_MODEL), DEFAULTS.imageModel)

  return {
    settings: {
      spec: {
        baseUrl: specBaseUrl.value,
        model: specModel.value,
        sendResponseFormat: sendResponseFormat.value,
      },
      image: { baseUrl: imageBaseUrl.value, model: imageModel.value },
    },
    sources: {
      spec: {
        baseUrl: specBaseUrl.source,
        model: specModel.source,
        sendResponseFormat: sendResponseFormat.source,
      },
      image: { baseUrl: imageBaseUrl.source, model: imageModel.source },
    },
  }
}
```

`sendResponseFormat` 没有 env 通道（`pick` 第二参传 `undefined`）是有意的：新开关，不给它造历史包袱。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @vudt/server test -- settings.test`
Expected: 全部 PASS。

- [ ] **Step 5: 类型检查 + 无回归**

Run: `pnpm --filter @vudt/server test`
Expected: 全绿。（仓库非 git，不提交。）

---



### Task 4: settings-store（磁盘读写）

**Files:**
- Create: `server/src/settings-store.ts`
- Test: `server/src/__tests__/settings-store.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `AppSettings`、`EMPTY_SETTINGS`、`ResolvedSettings`、`resolveSettings`
- Produces:
  - `class SettingsStore`
    - `constructor(file: string, env?: NodeJS.ProcessEnv)`
    - `load(): Promise<void>` — 读一次进内存；文件不存在按空设置处理
    - `current(): AppSettings` — 文件层的原始值（不含 env/默认）
    - `resolved(): ResolvedSettings` — 合并后的值 + 来源
    - `save(next: AppSettings): Promise<ResolvedSettings>` — write-then-rename，更新内存
  - `class MemorySettingsStore` — 测试替身，接口同上但不碰磁盘

写盘**照抄 `packages/imagegen/src/cache.ts:53-57`** 的 `.{pid}.{ts}.tmp` + `rename`。两个 store 类都放这个文件：它们是同一个契约的两种实现，分开反而要多一个文件只为一个 5 行的类。

- [ ] **Step 1: 写失败的测试**

创建 `server/src/__tests__/settings-store.test.ts`：

```ts
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SettingsStore } from '../settings-store.js'

const dirs: string[] = []

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

async function tempFile(): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'vudt-settings-'))
  dirs.push(dir)
  return { dir, file: join(dir, 'settings.json') }
}

describe('SettingsStore', () => {
  it('treats a missing file as empty settings', async () => {
    const { file } = await tempFile()
    const store = new SettingsStore(file, {} as NodeJS.ProcessEnv)
    await store.load()

    expect(store.current()).toEqual({ spec: {}, image: {} })
    expect(store.resolved().settings.spec.model).toBe('gpt-4o-mini')
    expect(store.resolved().sources.spec.model).toBe('default')
  })

  it('saves, then reads back the same values from a fresh store', async () => {
    const { file } = await tempFile()
    const store = new SettingsStore(file, {} as NodeJS.ProcessEnv)
    await store.load()

    await store.save({ spec: { model: 'glm-4', sendResponseFormat: false }, image: {} })

    const reopened = new SettingsStore(file, {} as NodeJS.ProcessEnv)
    await reopened.load()
    expect(reopened.current()).toEqual({ spec: { model: 'glm-4', sendResponseFormat: false }, image: {} })
    expect(reopened.resolved().sources.spec.model).toBe('file')
  })

  it('leaves no temp file behind', async () => {
    const { dir, file } = await tempFile()
    const store = new SettingsStore(file, {} as NodeJS.ProcessEnv)
    await store.load()

    await store.save({ spec: { model: 'glm-4' }, image: {} })

    const entries = await readdir(dir)
    expect(entries).toEqual(['settings.json'])
  })

  it('writes json a human can read', async () => {
    const { file } = await tempFile()
    const store = new SettingsStore(file, {} as NodeJS.ProcessEnv)
    await store.load()

    await store.save({ spec: { model: 'glm-4' }, image: {} })

    const raw = await readFile(file, 'utf8')
    expect(raw).toContain('\n')
    expect(JSON.parse(raw)).toEqual({ spec: { model: 'glm-4' }, image: {} })
  })

  it('ignores a corrupt file rather than refusing to start', async () => {
    const { file } = await tempFile()
    await writeFile(file, '{ not json', 'utf8')
    const store = new SettingsStore(file, {} as NodeJS.ProcessEnv)

    await store.load()

    expect(store.current()).toEqual({ spec: {}, image: {} })
  })

  it('validates the file contents, dropping junk values', async () => {
    const { file } = await tempFile()
    await writeFile(file, JSON.stringify({ spec: { model: 42, apiKey: 'sk-leak' } }), 'utf8')
    const store = new SettingsStore(file, {} as NodeJS.ProcessEnv)

    await store.load()

    expect(store.current()).toEqual({ spec: {}, image: {} })
  })

  it('save returns the resolved view so the caller need not re-read', async () => {
    const { file } = await tempFile()
    const store = new SettingsStore(file, {
      VUDT_IMAGE_MODEL: 'env-image',
    } as unknown as NodeJS.ProcessEnv)
    await store.load()

    const resolved = await store.save({ spec: { model: 'glm-4' }, image: {} })

    expect(resolved.settings.spec.model).toBe('glm-4')
    expect(resolved.settings.image.model).toBe('env-image')
    expect(resolved.sources.image.model).toBe('env')
  })
})
```

两条「坏文件」测试是重点：设置文件是用户手编过的东西，语法错或类型错都不能让服务起不来——这正是 [[web-console-defects]] 那类「测试绿但服务起不来」的同源风险。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @vudt/server test -- settings-store`
Expected: FAIL，模块 `../settings-store.js` 不存在。

- [ ] **Step 3: 最小实现**

创建 `server/src/settings-store.ts`：

```ts
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  EMPTY_SETTINGS,
  parseSettingsInput,
  resolveSettings,
  type AppSettings,
  type ResolvedSettings,
} from './settings.js'

/**
 * The settings file is hand-editable, so neither bad JSON nor bad values may
 * stop the server: both degrade to "no file", which is a working configuration.
 */
export class SettingsStore {
  private readonly file: string
  private readonly env: NodeJS.ProcessEnv
  private settings: AppSettings = EMPTY_SETTINGS

  constructor(file: string, env: NodeJS.ProcessEnv = process.env) {
    this.file = file
    this.env = env
  }

  async load(): Promise<void> {
    let raw: string
    try {
      raw = await readFile(this.file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.settings = EMPTY_SETTINGS
        return
      }
      throw error
    }

    try {
      this.settings = parseSettingsInput(JSON.parse(raw))
    } catch {
      this.settings = EMPTY_SETTINGS
    }
  }

  current(): AppSettings {
    return this.settings
  }

  resolved(): ResolvedSettings {
    return resolveSettings(this.settings, this.env)
  }

  async save(next: AppSettings): Promise<ResolvedSettings> {
    await mkdir(dirname(this.file), { recursive: true })
    // Write-then-rename, same reason as the image cache: a reader must never
    // observe a half-written file.
    const staging = `${this.file}.${process.pid}.${Date.now()}.tmp`
    await writeFile(staging, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    await rename(staging, this.file)
    this.settings = next
    return this.resolved()
  }
}

/** Test double: same contract, no disk. */
export class MemorySettingsStore {
  private settings: AppSettings
  private readonly env: NodeJS.ProcessEnv

  constructor(initial: AppSettings = EMPTY_SETTINGS, env: NodeJS.ProcessEnv = {}) {
    this.settings = initial
    this.env = env
  }

  async load(): Promise<void> {}

  current(): AppSettings {
    return this.settings
  }

  resolved(): ResolvedSettings {
    return resolveSettings(this.settings, this.env)
  }

  async save(next: AppSettings): Promise<ResolvedSettings> {
    this.settings = next
    return this.resolved()
  }
}
```

`load()` 里 ENOENT 之外的错误**照抛**（权限问题之类），只有「没有文件」和「文件内容坏」才降级。区分这两者是有意的：磁盘坏了应该响，用户编错了不该响。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @vudt/server test -- settings-store`
Expected: 全部 PASS。

- [ ] **Step 5: 无回归**

Run: `pnpm --filter @vudt/server test`
Expected: 全绿。

---


### Task 5: `AppDeps` 工厂化 + 任务设置快照

**Files:**
- Modify: `server/src/app.ts:15-32`（`AppDeps`）、`:36-67`（`TaskView`/`toView`）、`:69-76`（`buildApp` 开头）、`:100-152`（`createTask`）
- Modify: `server/src/store.ts:5-21`（`TaskRecord`）
- Modify: `server/src/runner.ts:10-11`、`:50`、`:59`
- Modify: `server/src/main.ts:26-40`、`:53-75`
- Modify: `server/src/__tests__/app.test.ts:21-33`（`makeApp`）、`:124`、`:276`、`:347`、`:375`、`:399`（五处覆写）
- Test: `server/src/__tests__/app.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `EffectiveSettings`、`AppSettings`；Task 4 的 `SettingsStore`/`MemorySettingsStore`
- Produces:
  - `AppDeps.drafter: (settings: EffectiveSettings['spec']) => SpecDrafter`
  - `AppDeps.provider: (settings: EffectiveSettings['image']) => ImageProvider`
  - `AppDeps.settingsStore?: SettingsLike`（结构类型，`SettingsStore` 与 `MemorySettingsStore` 都满足）
  - `TaskRecord.settings?: EffectiveSettings`
  - `TaskView.settings?: EffectiveSettings`

**为什么这两件事不能拆开**：工厂要有入参，而那个入参就是快照。先做工厂就得先造一个假入参，先做快照就没有消费者——拆开任何一半都落不了地。

**改动量已实测**：`buildApp({...})` 全仓只有两个构造点（`main.ts:60`、`app.test.ts:25`），五处测试覆写全走 `makeApp` 的 `Overrides` 展开，所以测试侧是**一个文件里 7 处机械改动**（各包一层 `() =>`）。

**修正 spec 里的一个估计**：spec 说测试侧是「7 处机械改动」。实际读了那五处覆写（`app.test.ts:124 276 347 375 399`）后，更好的做法是**让 `makeApp` 自己包工厂**，于是那五处**一个字都不用改**，并且 `harness.drafter` 仍指向测试断言用的那个真实例（`GatedDrafter` 尤其依赖实例同一性——它靠外部 promise 放闸）。只改 `makeApp` 与 `Overrides` 类型两处。

- [ ] **Step 1: 写失败的测试**

在 `server/src/__tests__/app.test.ts` 的 `describe('POST /tasks')` 里追加（`post` 与 `track` 是该文件已有 helper）：

```ts
it('snapshots the effective settings onto the task', async () => {
  const harness = await makeApp()
  track(harness)

  const created = (await post(harness, 'a landing page for Acme')).json() as {
    settings?: { spec: { model: string; sendResponseFormat: boolean }; image: { model: string } }
  }

  expect(created.settings?.spec.model).toBe('gpt-4o-mini')
  expect(created.settings?.spec.sendResponseFormat).toBe(true)
  expect(created.settings?.image.model).toBe('gpt-image-1')
})

it('hands the snapshot to the drafter factory', async () => {
  const seen: { model: string; sendResponseFormat: boolean }[] = []
  const drafter = new ScriptedDrafter([landingSpecInput()])
  const harness = await makeApp({
    drafterFactory: (settings) => {
      seen.push({ model: settings.model, sendResponseFormat: settings.sendResponseFormat })
      return drafter
    },
  })
  track(harness)

  await post(harness, 'a landing page for Acme')
  await harness.app.vudt.queue.drain()

  expect(seen).toEqual([{ model: 'gpt-4o-mini', sendResponseFormat: true }])
})
```

等任务跑完用该文件的既有写法 `await harness.app.vudt.queue.drain()`（见 `app.test.ts:48` 等十余处）。不要新造 helper。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @vudt/server test -- app.test`
Expected: 两个新测试 FAIL——第一个因为响应里没有 `settings`，第二个因为 `makeApp` 不认 `drafterFactory`（TS 报错或运行时被忽略）。

- [ ] **Step 3: 改 `TaskRecord`**

`server/src/store.ts` 在 `TaskRecord`（`:5-21`）里加一个字段：

```ts
  /**
   * The settings this task was created with. Copied at creation so changing
   * settings never rewrites what a queued or running task is doing.
   */
  settings?: EffectiveSettings
```

文件顶部加 `import type { EffectiveSettings } from './settings.js'`。

- [ ] **Step 4: 改 `AppDeps` 与 `buildApp`**

`server/src/app.ts` 顶部加 import：

```ts
import { EMPTY_SETTINGS, type AppSettings, type EffectiveSettings, type ResolvedSettings } from './settings.js'
```

`AppDeps`（`:15-32`）里把两个字段换成工厂，并加 store：

```ts
  /** Built per task from that task's settings snapshot, so both paths are identical. */
  drafter: (settings: EffectiveSettings['spec']) => SpecDrafter
  provider: (settings: EffectiveSettings['image']) => ImageProvider
  /** Omitted in tests that do not care; defaults to in-memory empty settings. */
  settingsStore?: SettingsLike
```

在 `AppDeps` 上方加这个结构类型（`SettingsStore` 与 `MemorySettingsStore` 都天然满足，不需要 implements）：

```ts
export interface SettingsLike {
  current(): AppSettings
  resolved(): ResolvedSettings
  save(next: AppSettings): Promise<ResolvedSettings>
}
```

`buildApp` 开头（`:70-76` 附近）取一个 store，缺省用内存空设置：

```ts
  const settingsStore: SettingsLike = deps.settingsStore ?? new MemorySettingsStore()
```

并 `import { MemorySettingsStore } from './settings-store.js'`。

- [ ] **Step 5: `createTask` 存快照、`TaskView` 投影**

`createTask`（`:100-152`）里建记录时带上快照。取值用 `settingsStore.resolved().settings`，**在 `createTask` 里取而不是在 runner 里取**——这正是「改设置不影响已排队任务」那条决策的落点：

```ts
    const settings = settingsStore.resolved().settings
```

把 `settings` 一并写进 `store.create(...)` 的记录里（照该处现有的字段写法加一个 `settings`）。

`TaskView`（`:36-45`）加：

```ts
  settings?: EffectiveSettings
```

`toView`（`:47-67` 附近）里照现有可选字段的展开写法补一条：

```ts
    ...(task.settings === undefined ? {} : { settings: task.settings }),
```

- [ ] **Step 6: runner 用工厂**

`server/src/runner.ts` 的 `RunnerDeps`（`:10-11`）改成与 `AppDeps` 一致的工厂签名：

```ts
  drafter: (settings: EffectiveSettings['spec']) => SpecDrafter
  provider: (settings: EffectiveSettings['image']) => ImageProvider
  /** Fallback for a record written before snapshots existed. */
  settings: EffectiveSettings
```

加 `import type { EffectiveSettings } from './settings.js'`。

`runTask` 在 `:42` 处已经有记录了（`const task = store.get(taskId)`，紧接着 `:43` 的 undefined 早返回），所以两个用点都能直接读 `task.settings`，不需要再查 store。在 `:45` 的 `store.update` 之后加一行：

```ts
  const settings = task.settings ?? deps.settings
```

`:50` 处 `draftSpec(deps.drafter, ...)` 改为：

```ts
    const { spec, attempts } = await draftSpec(deps.drafter(settings.spec), task.description, {
```

`:59` 处 `provider: deps.provider` 改为：

```ts
      provider: deps.provider(settings.image),
```

`deps.settings` 兜底是为了旧记录与直接塞记录的测试：快照是可选字段，取不到时用启动时解析的值，而不是崩在 `undefined.spec` 上。`buildApp` 构造 runner deps 时传 `settingsStore.resolved().settings`。

- [ ] **Step 7: 改 `makeApp`，五处覆写不动**

`server/src/__tests__/app.test.ts:21-33`。`Overrides` 改成「drafter/provider 收实例，其余照旧」，再加一个 `drafterFactory` 逃生口给 Step 1 的第二个测试：

```ts
type BuildArgs = Parameters<typeof buildApp>[0]

type Overrides = Omit<Partial<BuildArgs>, 'drafter' | 'provider'> & {
  drafter?: SpecDrafter
  provider?: ImageProvider
  /** For the rare test that needs to observe the factory argument itself. */
  drafterFactory?: BuildArgs['drafter']
}

async function makeApp(overrides: Overrides = {}) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'vudt-server-'))
  const { drafter: drafterOverride, provider: providerOverride, drafterFactory, ...rest } = overrides
  const drafter = drafterOverride ?? new ScriptedDrafter([landingSpecInput()])
  const provider = providerOverride ?? new StubProvider()
  const app = buildApp({
    templateDir: TEMPLATE_DIR,
    workspaceRoot,
    drafter: drafterFactory ?? (() => drafter),
    provider: () => provider,
    cache: new MemoryImageCache(),
    ...rest,
  })
  return { app, drafter, provider, workspaceRoot }
}
```

需要 `import type { SpecDrafter } from '../spec-source.js'` 与 `import type { ImageProvider } from '@vudt/imagegen'`。

**`:124 276 347 375 399` 五处一个字都不改** —— 它们传的仍是实例，由 `makeApp` 包装；`harness.drafter` 仍是那个实例，所以 `GatedDrafter` 的放闸逻辑照旧。

- [ ] **Step 8: 改 `main.ts`**

`server/src/main.ts`：两个 build 函数从「读 env」改为「收设置、key 仍读 env」。key 由闭包捕获，**不进设置、不进记录**：

```ts
function buildDrafter(env: NodeJS.ProcessEnv): (s: EffectiveSettings['spec']) => SpecDrafter {
  const apiKey = required(env, 'VUDT_SPEC_API_KEY')
  return (settings) =>
    createOpenAISpecDrafter({
      apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl,
      sendResponseFormat: settings.sendResponseFormat,
    })
}

function buildImageProvider(env: NodeJS.ProcessEnv): (s: EffectiveSettings['image']) => ImageProvider {
  const apiKey = required(env, 'VUDT_IMAGE_API_KEY')
  return (settings) =>
    createOpenAIImageProvider({
      apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl,
      ...(env.VUDT_IMAGE_QUALITY === undefined ? {} : { quality: env.VUDT_IMAGE_QUALITY }),
    })
}
```

`required()` 在返回工厂**之前**调用，这样缺 key 仍然是启动就报错，不是等第一个任务才报。

`main()` 里建 store 并传进去（`.vudt/settings.json`，与 `workspaceRoot` 同属 `.vudt`，该目录已在 `.gitignore:14`）：

```ts
  const settingsStore = new SettingsStore(resolve(process.cwd(), '.vudt/settings.json'))
  await settingsStore.load()
```

`buildApp({...})` 的 `drafter`/`provider` 值不变（现在它们是工厂），另加 `settingsStore,`。需要 `import { resolve } from 'node:path'` 与 `import { SettingsStore } from './settings-store.js'`。

- [ ] **Step 9: 跑测试确认通过**

Run: `pnpm --filter @vudt/server test -- app.test`
Expected: 新增两个 PASS，原有全部仍 PASS。

- [ ] **Step 10: 全仓回归 + 服务真能起来**

Run: `pnpm -r test 2>&1 | tail -n 30`
Expected: 全绿。

再验一次**服务真的能启动**——这是 [[web-console-defects]] 的教训，绿测试不代表进程起得来：

```bash
VUDT_SPEC_API_KEY=sk-x VUDT_IMAGE_API_KEY=sk-x VUDT_PORT=4399 \
  pnpm --filter @vudt/server exec node dist/main.js 2>&1 | head -n 20 &
sleep 4 && curl -s localhost:4399/health && kill %1
```

若 server 包没有预编译产物，用它现有的 dev 入口（`grep -n '"dev"\|"start"' server/package.json`）。Expected: `/health` 返回 JSON。

---


### Task 6: 连通性测试（settings-probe）

**Files:**
- Create: `server/src/settings-probe.ts`
- Test: `server/src/__tests__/settings-probe.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `EffectiveSettings`
- Produces:
  - `ProbeResult { ok: boolean; status?: number; bodyExcerpt?: string; hint?: string }`
  - `ProbeReport { spec: ProbeResult; image: ProbeResult }`
  - `probeSettings(settings: EffectiveSettings, keys: ProbeKeys, fetchImpl?: typeof fetch): Promise<ProbeReport>`
  - `ProbeKeys { specApiKey: string; imageApiKey: string }`
  - `EXCERPT_LIMIT = 500`

`fetchImpl` 可注入，所以测试**不打真网络**。两侧独立 try/catch：一边挂不能吞掉另一边的诊断。

- [ ] **Step 1: 写失败的测试**

创建 `server/src/__tests__/settings-probe.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { EXCERPT_LIMIT, probeSettings } from '../settings-probe.js'
import type { EffectiveSettings } from '../settings.js'

const SETTINGS: EffectiveSettings = {
  spec: { baseUrl: 'https://relay.invalid/v1', model: 'glm-4', sendResponseFormat: true },
  image: { baseUrl: 'https://relay.invalid/v1', model: 'flux' },
}

const KEYS = { specApiKey: 'sk-spec', imageApiKey: 'sk-image' }

function fetchStub(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): { calls: { url: string; method: string; body?: string }[]; fetchImpl: typeof fetch } {
  const calls: { url: string; method: string; body?: string }[] = []
  const fetchImpl = async (target: string | URL, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: String(target),
      method: init?.method ?? 'GET',
      ...(init?.body === undefined ? {} : { body: String(init.body) }),
    })
    return handler(String(target), init)
  }
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch }
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('probeSettings', () => {
  it('reports both sides ok, and never sends a key in the body', async () => {
    const { calls, fetchImpl } = fetchStub(() => ok({ choices: [{ message: { content: 'hi' } }] }))

    const report = await probeSettings(SETTINGS, KEYS, fetchImpl)

    expect(report.spec.ok).toBe(true)
    expect(report.image.ok).toBe(true)
    for (const call of calls) {
      expect(call.body ?? '').not.toContain('sk-spec')
      expect(call.body ?? '').not.toContain('sk-image')
    }
  })

  it('posts a tiny chat completion for the spec side and gets the model from settings', async () => {
    const { calls, fetchImpl } = fetchStub(() => ok({ choices: [{ message: { content: 'hi' } }] }))

    await probeSettings(SETTINGS, KEYS, fetchImpl)

    const chat = calls.find((call) => call.url.endsWith('/chat/completions'))
    expect(chat?.method).toBe('POST')
    expect(JSON.parse(chat!.body!).model).toBe('glm-4')
  })

  it('only lists models for the image side, never generating one', async () => {
    const { calls, fetchImpl } = fetchStub(() => ok({ data: [] }))

    await probeSettings(SETTINGS, KEYS, fetchImpl)

    expect(calls.some((call) => call.url.includes('/images/generations'))).toBe(false)
    const models = calls.find((call) => call.url.endsWith('/models'))
    expect(models?.method).toBe('GET')
  })

  it('surfaces the upstream status and body excerpt on failure', async () => {
    const { fetchImpl } = fetchStub((url) =>
      url.endsWith('/chat/completions')
        ? new Response('response_format is not supported', { status: 400 })
        : ok({ data: [] }),
    )

    const report = await probeSettings(SETTINGS, KEYS, fetchImpl)

    expect(report.spec.ok).toBe(false)
    expect(report.spec.status).toBe(400)
    expect(report.spec.bodyExcerpt).toContain('response_format')
    expect(report.image.ok).toBe(true)
  })

  it('hints at the response_format switch when that is what the relay rejected', async () => {
    const { fetchImpl } = fetchStub((url) =>
      url.endsWith('/chat/completions')
        ? new Response('unknown parameter: response_format', { status: 400 })
        : ok({ data: [] }),
    )

    const report = await probeSettings(SETTINGS, KEYS, fetchImpl)

    expect(report.spec.hint).toMatch(/response_format|JSON/i)
  })

  it('hints at the key when the relay rejects the credentials', async () => {
    const { fetchImpl } = fetchStub(() => new Response('invalid api key', { status: 401 }))

    const report = await probeSettings(SETTINGS, KEYS, fetchImpl)

    expect(report.spec.hint).toMatch(/key/i)
    expect(report.image.hint).toMatch(/key/i)
  })

  it('truncates a long body', async () => {
    const { fetchImpl } = fetchStub(() => new Response('x'.repeat(5000), { status: 500 }))

    const report = await probeSettings(SETTINGS, KEYS, fetchImpl)

    expect(report.spec.bodyExcerpt!.length).toBeLessThanOrEqual(EXCERPT_LIMIT)
  })

  it('reports a transport failure without throwing', async () => {
    const fetchImpl = (async () => {
      throw new Error('getaddrinfo ENOTFOUND relay.invalid')
    }) as unknown as typeof fetch

    const report = await probeSettings(SETTINGS, KEYS, fetchImpl)

    expect(report.spec.ok).toBe(false)
    expect(report.spec.status).toBeUndefined()
    expect(report.spec.bodyExcerpt).toContain('ENOTFOUND')
  })

  it('keeps a failure on one side from hiding the other side result', async () => {
    const { fetchImpl } = fetchStub((url) =>
      url.endsWith('/models') ? new Response('nope', { status: 404 }) : ok({ choices: [] }),
    )

    const report = await probeSettings(SETTINGS, KEYS, fetchImpl)

    expect(report.spec.ok).toBe(true)
    expect(report.image.ok).toBe(false)
    expect(report.image.status).toBe(404)
  })
})
```

那条「key 不进 body」的断言是本任务的安全底线，不是装饰：这个端点是整个功能里唯一会把上游响应体回显给浏览器的地方。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @vudt/server test -- settings-probe`
Expected: FAIL，模块 `../settings-probe.js` 不存在。

- [ ] **Step 3: 最小实现**

创建 `server/src/settings-probe.ts`：

```ts
import type { EffectiveSettings } from './settings.js'

export const EXCERPT_LIMIT = 500

export interface ProbeResult {
  ok: boolean
  status?: number
  bodyExcerpt?: string
  hint?: string
}

export interface ProbeReport {
  spec: ProbeResult
  image: ProbeResult
}

export interface ProbeKeys {
  specApiKey: string
  imageApiKey: string
}

function excerpt(raw: string): string {
  const collapsed = raw.trim()
  return collapsed.length > EXCERPT_LIMIT ? collapsed.slice(0, EXCERPT_LIMIT) : collapsed
}

/**
 * Both providers deliberately throw status-only errors, because their error paths
 * carry a prompt and a key. This probe may echo the body instead: the request it
 * sends is synthetic, and the key travels in a header that is never reflected.
 */
function hintFor(status: number, body: string): string | undefined {
  if (status === 401 || status === 403) {
    return 'The relay rejected the credentials. Check VUDT_SPEC_API_KEY / VUDT_IMAGE_API_KEY.'
  }
  if (status === 404) {
    return 'Endpoint not found. Check the base URL includes the version path, e.g. /v1.'
  }
  if (status === 400 && /response_format/i.test(body)) {
    return 'This relay rejects response_format. Turn off the JSON response format switch.'
  }
  if (status === 400 && /model/i.test(body)) {
    return 'The relay did not accept this model name. Check the exact spelling it expects.'
  }
  return undefined
}

async function attempt(run: () => Promise<Response>): Promise<ProbeResult> {
  let response: Response
  try {
    response = await run()
  } catch (error) {
    // A transport failure has no status; the message is the only diagnostic, and
    // it cannot contain the key because the key only ever sits in a header.
    return { ok: false, bodyExcerpt: excerpt(error instanceof Error ? error.message : String(error)) }
  }

  if (response.ok) return { ok: true, status: response.status }

  const body = excerpt(await response.text().catch(() => ''))
  const hint = hintFor(response.status, body)
  return {
    ok: false,
    status: response.status,
    ...(body === '' ? {} : { bodyExcerpt: body }),
    ...(hint === undefined ? {} : { hint }),
  }
}

export async function probeSettings(
  settings: EffectiveSettings,
  keys: ProbeKeys,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeReport> {
  // Each side is awaited independently so one failure cannot mask the other.
  const spec = await attempt(() =>
    fetchImpl(`${settings.spec.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${keys.specApiKey}`,
      },
      body: JSON.stringify({
        model: settings.spec.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        ...(settings.spec.sendResponseFormat ? { response_format: { type: 'json_object' } } : {}),
      }),
    }),
  )

  // Listing models rather than generating one: an image costs money and seconds,
  // and the address plus credentials are what this button exists to verify.
  const image = await attempt(() =>
    fetchImpl(`${settings.image.baseUrl}/models`, {
      headers: { authorization: `Bearer ${keys.imageApiKey}` },
    }),
  )

  return { spec, image }
}
```

spec 侧探针**带上 `response_format`**（当设置是开着的），这样「关掉它就能用」这个结论能被测试按钮本身验证出来，而不是让用户自己猜。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @vudt/server test -- settings-probe`
Expected: 全部 PASS。

- [ ] **Step 5: 无回归**

Run: `pnpm --filter @vudt/server test`
Expected: 全绿。

---


### Task 7: 三个 `/api/settings` 端点 + 404 守卫加前缀

**Files:**
- Modify: `server/src/app.ts`（新增三个端点，挂在 `/tasks` 那批之后、`setNotFoundHandler` 之前）
- Modify: `server/src/app.ts:300`（404 守卫前缀列表加 `/api`）
- Modify: `server/src/app.ts:15-32`（`AppDeps` 加 `probe?`）
- Test: `server/src/__tests__/app.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `parseSettingsInput`；Task 4 的 `SettingsLike`；Task 6 的 `probeSettings`、`ProbeReport`
- Produces:
  - `GET /api/settings` → `{ settings: EffectiveSettings, sources: SettingsSources }`
  - `PUT /api/settings` → 同上（落盘后的值）
  - `POST /api/settings/test` → `ProbeReport`
  - `AppDeps.probe?: (settings: EffectiveSettings) => Promise<ProbeReport>` — 注入点，测试不打网络

`probe` 做成 `AppDeps` 上的可选工厂而非直接调 `probeSettings`，是因为真探针要 key，而 key 只有 `main.ts` 有（`AppDeps` 里放 key 会违反「凭证不进 config」那条）。于是 `main.ts` 传一个已捕获 key 的闭包，测试传一个 stub。

- [ ] **Step 1: 写失败的测试**

在 `server/src/__tests__/app.test.ts` 末尾追加一个新 describe。`makeApp` 现在要能收 `settingsStore` 与 `probe`（两者都在 `Overrides` 的 `...rest` 里，Task 5 的 `Omit` 只摘掉了 `drafter`/`provider`，所以不用再改 `makeApp`）：

```ts
describe('settings api', () => {
  it('reports the effective settings and their sources', async () => {
    const harness = await makeApp({ settingsStore: new MemorySettingsStore() })
    track(harness)

    const response = await harness.app.inject({ method: 'GET', url: '/api/settings' })

    expect(response.statusCode).toBe(200)
    const body = response.json() as {
      settings: { spec: { model: string; sendResponseFormat: boolean } }
      sources: { spec: { model: string } }
    }
    expect(body.settings.spec.model).toBe('gpt-4o-mini')
    expect(body.settings.spec.sendResponseFormat).toBe(true)
    expect(body.sources.spec.model).toBe('default')
  })

  it('saves settings and reads them back as file-sourced', async () => {
    const harness = await makeApp({ settingsStore: new MemorySettingsStore() })
    track(harness)

    const put = await harness.app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { spec: { baseUrl: 'https://relay.invalid/v1/', sendResponseFormat: false }, image: {} },
    })

    expect(put.statusCode).toBe(200)
    const saved = put.json() as { settings: { spec: { baseUrl: string } }; sources: { spec: { baseUrl: string } } }
    expect(saved.settings.spec.baseUrl).toBe('https://relay.invalid/v1')
    expect(saved.sources.spec.baseUrl).toBe('file')

    const again = await harness.app.inject({ method: 'GET', url: '/api/settings' })
    expect((again.json() as { settings: { spec: { sendResponseFormat: boolean } } }).settings.spec.sendResponseFormat).toBe(false)
  })

  it('rejects a malformed baseUrl with a 400', async () => {
    const harness = await makeApp({ settingsStore: new MemorySettingsStore() })
    track(harness)

    const response = await harness.app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { spec: { baseUrl: 'not a url' } },
    })

    expect(response.statusCode).toBe(400)
    expect((response.json() as { error: string }).error).toMatch(/baseUrl/)
  })

  it('rejects a non-boolean sendResponseFormat with a 400', async () => {
    const harness = await makeApp({ settingsStore: new MemorySettingsStore() })
    track(harness)

    const response = await harness.app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { spec: { sendResponseFormat: 'yes' } },
    })

    expect(response.statusCode).toBe(400)
  })

  it('runs the probe against the payload, not the stored settings', async () => {
    const seen: string[] = []
    const harness = await makeApp({
      settingsStore: new MemorySettingsStore(),
      probe: async (settings) => {
        seen.push(settings.spec.model)
        return { spec: { ok: true, status: 200 }, image: { ok: false, status: 404 } }
      },
    })
    track(harness)

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/settings/test',
      payload: { spec: { model: 'unsaved-model' }, image: {} },
    })

    expect(response.statusCode).toBe(200)
    expect(seen).toEqual(['unsaved-model'])
    const report = response.json() as { spec: { ok: boolean }; image: { ok: boolean; status: number } }
    expect(report.spec.ok).toBe(true)
    expect(report.image.status).toBe(404)

    // Probing must not persist anything.
    const after = await harness.app.inject({ method: 'GET', url: '/api/settings' })
    expect((after.json() as { sources: { spec: { model: string } } }).sources.spec.model).toBe('default')
  })

  it('validates the probe payload too', async () => {
    const harness = await makeApp({ settingsStore: new MemorySettingsStore() })
    track(harness)

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/settings/test',
      payload: { spec: { baseUrl: 'ftp://relay.invalid' } },
    })

    expect(response.statusCode).toBe(400)
  })

  it('404s an unknown /api path as json, not as the console shell', async () => {
    const harness = await makeApp({ settingsStore: new MemorySettingsStore() })
    track(harness)

    const response = await harness.app.inject({ method: 'GET', url: '/api/nope' })

    expect(response.statusCode).toBe(404)
    expect(response.headers['content-type']).toMatch(/application\/json/)
  })
})
```

需要 `import { MemorySettingsStore } from '../settings-store.js'`。

最后那条测试是 spec 里「守卫前缀加 `/api`」那条的回归锁：没有它，打错的 `/api/xxx` 会静默返回 HTML 外壳、把 bug 藏起来。**注意**：`webDistDir` 未配时 `setNotFoundHandler` 那整块可能不注册（`app.ts:285` 外层有条件），若该测试因此拿到的不是 JSON 404，就给它加 `webDistDir` 覆写指向一个含 `index.html` 的临时目录——该文件已有类似做法，先 `grep -n "webDistDir" server/src/__tests__/app.test.ts` 看现成写法。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @vudt/server test -- app.test`
Expected: 新 describe 全 FAIL（端点不存在，`GET /api/settings` 落到 404 或外壳）。

- [ ] **Step 3: `AppDeps` 加 `probe`**

`server/src/app.ts` 的 `AppDeps` 里加：

```ts
  /**
   * Injected rather than called directly: a real probe needs the API keys, and
   * keys must not travel through AppDeps. main.ts passes a closure that has them.
   */
  probe?: (settings: EffectiveSettings) => Promise<ProbeReport>
```

加 `import type { ProbeReport } from './settings-probe.js'`。

- [ ] **Step 4: 写三个端点**

`server/src/app.ts`，放在 `app.get('/tasks/:id/spec', ...)` 之后、控制台托管那块（`:285` 起）之前。`parseSettingsInput` 抛的是 `ServerError`，已有的 `setErrorHandler`（`:80`）会转成 4xx，所以这里不写 try/catch：

```ts
  app.get('/api/settings', async () => settingsStore.resolved())

  app.put('/api/settings', async (request) => {
    const next = parseSettingsInput(request.body)
    return await settingsStore.save(next)
  })

  app.post('/api/settings/test', async (request) => {
    // The payload is probed, not the stored settings: the point is to try an
    // address before committing to it.
    const candidate = parseSettingsInput(request.body)
    const { settings } = resolveSettings(candidate, process.env)
    if (deps.probe === undefined) {
      throw new ServerError('connectivity testing is not configured', 501)
    }
    return await deps.probe(settings)
  })
```

加 import：`parseSettingsInput`、`resolveSettings` 来自 `./settings.js`（Task 5 已经引了一部分，合并到同一条 import 里）。

- [ ] **Step 5: 404 守卫前缀加 `/api`**

`server/src/app.ts:300` 那行前缀判断加一个 `/api`：

```ts
      if (
        path.startsWith('/tasks') ||
        path.startsWith('/preview') ||
        path.startsWith('/health') ||
        path.startsWith('/api')
      ) {
        return reply.code(404).send({ error: 'not found' })
      }
```

顺手把该处注释补一句，说明 `/api` 在列表里的原因（API 打错必须以 API 的方式 404，否则返回 HTML 会掩盖 bug），与既有注释风格一致。

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm --filter @vudt/server test -- app.test`
Expected: 全部 PASS。

- [ ] **Step 7: main.ts 接真探针**

`server/src/main.ts` 的 `buildApp({...})` 加一个 `probe`，key 由闭包捕获（与 `buildDrafter` 同样的理由）：

```ts
  const specApiKey = required(process.env, 'VUDT_SPEC_API_KEY')
  const imageApiKey = required(process.env, 'VUDT_IMAGE_API_KEY')
```

这两行其实 Task 5 的两个工厂里已各自 `required` 过一次；**不要重复调用三遍**——把 key 提到 `main()` 里读一次，传给两个 build 函数和 probe。改法：`buildDrafter(apiKey, ...)` / `buildImageProvider(apiKey, ...)` 收 key 而不是收 env。然后：

```ts
    probe: (settings) => probeSettings(settings, { specApiKey, imageApiKey }),
```

加 `import { probeSettings } from './settings-probe.js'`。

- [ ] **Step 8: 全仓回归 + 服务真能起来**

Run: `pnpm -r test 2>&1 | tail -n 30`
Expected: 全绿。

再确认进程起得来并且新端点真的响应（`/health` 绿不代表新路由注册对了）：

```bash
VUDT_SPEC_API_KEY=sk-x VUDT_IMAGE_API_KEY=sk-x VUDT_PORT=4399 \
  pnpm --filter @vudt/server exec node dist/main.js 2>&1 | head -n 20 &
sleep 4 && curl -s localhost:4399/api/settings && echo && curl -s -o /dev/null -w '%{http_code}\n' localhost:4399/api/nope && kill %1
```

Expected: 第一条返回含 `settings`/`sources` 的 JSON，第二条打印 `404`。

---


### Task 8: web 客户端 + 表单纯函数 + 配置页

**Files:**
- Modify: `web/src/api/client.ts`（类型 + 三个函数）
- Create: `web/src/views/settingsForm.ts`
- Create: `web/src/views/__tests__/settingsForm.test.ts`
- Create: `web/src/views/SettingsView.vue`
- Modify: `web/src/router.ts:3-6`
- Modify: `web/src/App.vue:6`（`selectedKeys`）、`:18-20`（菜单项）

**Interfaces:**
- Consumes: Task 7 的三个端点
- Produces:
  - `client.ts`: `SettingSource`、`SettingsSources`、`EffectiveSettings`、`SettingsPayload`、`ProbeResult`、`ProbeReport`、`SettingsEnvelope`
  - `client.ts`: `getSettings()`、`putSettings(payload)`、`testSettings(payload)`
  - `settingsForm.ts`: `FormState`、`emptyForm()`、`formFromEnvelope(envelope)`、`payloadFromForm(form)`、`sourceLabel(source)`

`web/src/**/__tests__` 里的测试**只测纯 ts 模块、不挂载组件**（见 `web/src/components/__tests__/exportButtons.test.ts` 测的是 `exportRules.ts`）。所以表单逻辑必须抽进 `settingsForm.ts` 才测得到，`.vue` 里只留绑定。

- [ ] **Step 1: 写失败的测试**

创建 `web/src/views/__tests__/settingsForm.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { emptyForm, formFromEnvelope, payloadFromForm, sourceLabel } from '../settingsForm.js'
import type { SettingsEnvelope } from '../../api/client.js'

function envelope(): SettingsEnvelope {
  return {
    settings: {
      spec: { baseUrl: 'https://relay.invalid/v1', model: 'glm-4', sendResponseFormat: false },
      image: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-1' },
    },
    sources: {
      spec: { baseUrl: 'file', model: 'env', sendResponseFormat: 'file' },
      image: { baseUrl: 'default', model: 'default' },
    },
  }
}

describe('formFromEnvelope', () => {
  it('fills inputs only from file-sourced values, leaving inherited ones blank', () => {
    const form = formFromEnvelope(envelope())

    expect(form.spec.baseUrl).toBe('https://relay.invalid/v1')
    expect(form.spec.model).toBe('')
    expect(form.image.baseUrl).toBe('')
    expect(form.image.model).toBe('')
  })

  it('carries the effective values as placeholders', () => {
    const form = formFromEnvelope(envelope())

    expect(form.placeholders.spec.model).toBe('glm-4')
    expect(form.placeholders.image.baseUrl).toBe('https://api.openai.com/v1')
  })

  it('keeps a false sendResponseFormat rather than defaulting it back to true', () => {
    expect(formFromEnvelope(envelope()).spec.sendResponseFormat).toBe(false)
  })
})

describe('payloadFromForm', () => {
  it('drops blank inputs so the value falls back to env or default', () => {
    const form = emptyForm()
    form.spec.model = '  glm-4  '
    form.image.baseUrl = '   '

    expect(payloadFromForm(form)).toEqual({
      spec: { model: 'glm-4', sendResponseFormat: true },
      image: {},
    })
  })

  it('always sends sendResponseFormat, because false must survive the round trip', () => {
    const form = emptyForm()
    form.spec.sendResponseFormat = false

    expect(payloadFromForm(form).spec.sendResponseFormat).toBe(false)
  })

  it('round-trips an envelope through the form unchanged', () => {
    const payload = payloadFromForm(formFromEnvelope(envelope()))

    expect(payload).toEqual({
      spec: { baseUrl: 'https://relay.invalid/v1', sendResponseFormat: false },
      image: {},
    })
  })
})

describe('sourceLabel', () => {
  it('names each source in the console language', () => {
    expect(sourceLabel('file')).toContain('配置')
    expect(sourceLabel('env')).toContain('环境变量')
    expect(sourceLabel('default')).toContain('默认')
  })
})
```

`formFromEnvelope` 只把 **file 来源**的值填进输入框，是这里唯一有分量的决定：env/默认来的值当占位符显示。否则用户一打开页面、一按保存，继承来的值就被固化成文件里的值，之后改环境变量再也不生效——这是个静默的坑。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @vudt/web test -- settingsForm`
Expected: FAIL，模块 `../settingsForm.js` 不存在。（若 filter 名不是 `@vudt/web`，`grep -n '"name"' web/package.json` 确认。）

- [ ] **Step 3: client.ts 加类型与三个函数**

`web/src/api/client.ts` 末尾加。类型与 server 的形状一一对应，手写一份而不是跨包 import——这个文件现有的 `TaskView` 等类型也是这么做的：

```ts
export type SettingSource = 'file' | 'env' | 'default'

export interface EffectiveSettings {
  spec: { baseUrl: string; model: string; sendResponseFormat: boolean }
  image: { baseUrl: string; model: string }
}

export interface SettingsSources {
  spec: { baseUrl: SettingSource; model: SettingSource; sendResponseFormat: SettingSource }
  image: { baseUrl: SettingSource; model: SettingSource }
}

export interface SettingsEnvelope {
  settings: EffectiveSettings
  sources: SettingsSources
}

/** What the form sends: every field optional, a missing one means "inherit". */
export interface SettingsPayload {
  spec: { baseUrl?: string; model?: string; sendResponseFormat?: boolean }
  image: { baseUrl?: string; model?: string }
}

export interface ProbeResult {
  ok: boolean
  status?: number
  bodyExcerpt?: string
  hint?: string
}

export interface ProbeReport {
  spec: ProbeResult
  image: ProbeResult
}

export function getSettings(): Promise<SettingsEnvelope> {
  return request<SettingsEnvelope>('/api/settings')
}

export function putSettings(payload: SettingsPayload): Promise<SettingsEnvelope> {
  return request<SettingsEnvelope>('/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function testSettings(payload: SettingsPayload): Promise<ProbeReport> {
  return request<ProbeReport>('/api/settings/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
```

`TaskView` 里也加一条 `settings?: EffectiveSettings`（Task 9 要用）。

- [ ] **Step 4: 写 settingsForm.ts**

创建 `web/src/views/settingsForm.ts`：

```ts
import type { SettingsEnvelope, SettingsPayload, SettingSource } from '../api/client.js'

export interface FormState {
  spec: { baseUrl: string; model: string; sendResponseFormat: boolean }
  image: { baseUrl: string; model: string }
  /** Effective values, shown as input placeholders when the field is inherited. */
  placeholders: {
    spec: { baseUrl: string; model: string }
    image: { baseUrl: string; model: string }
  }
  sources: SettingsEnvelope['sources']
}

const BLANK_SOURCES: SettingsEnvelope['sources'] = {
  spec: { baseUrl: 'default', model: 'default', sendResponseFormat: 'default' },
  image: { baseUrl: 'default', model: 'default' },
}

export function emptyForm(): FormState {
  return {
    spec: { baseUrl: '', model: '', sendResponseFormat: true },
    image: { baseUrl: '', model: '' },
    placeholders: { spec: { baseUrl: '', model: '' }, image: { baseUrl: '', model: '' } },
    sources: BLANK_SOURCES,
  }
}

/**
 * Only file-sourced values land in the inputs. An inherited value shown as text
 * would be saved back as an override on the next submit, silently pinning what
 * the environment was still free to change.
 */
function own(value: string, source: SettingSource): string {
  return source === 'file' ? value : ''
}

export function formFromEnvelope(envelope: SettingsEnvelope): FormState {
  const { settings, sources } = envelope
  return {
    spec: {
      baseUrl: own(settings.spec.baseUrl, sources.spec.baseUrl),
      model: own(settings.spec.model, sources.spec.model),
      sendResponseFormat: settings.spec.sendResponseFormat,
    },
    image: {
      baseUrl: own(settings.image.baseUrl, sources.image.baseUrl),
      model: own(settings.image.model, sources.image.model),
    },
    placeholders: {
      spec: { baseUrl: settings.spec.baseUrl, model: settings.spec.model },
      image: { baseUrl: settings.image.baseUrl, model: settings.image.model },
    },
    sources,
  }
}

/** A blank input means "clear it": the key is omitted so the server falls through. */
function text(raw: string): string | undefined {
  const trimmed = raw.trim()
  return trimmed === '' ? undefined : trimmed
}

export function payloadFromForm(form: FormState): SettingsPayload {
  const spec: SettingsPayload['spec'] = { sendResponseFormat: form.spec.sendResponseFormat }
  const specBaseUrl = text(form.spec.baseUrl)
  if (specBaseUrl !== undefined) spec.baseUrl = specBaseUrl
  const specModel = text(form.spec.model)
  if (specModel !== undefined) spec.model = specModel

  const image: SettingsPayload['image'] = {}
  const imageBaseUrl = text(form.image.baseUrl)
  if (imageBaseUrl !== undefined) image.baseUrl = imageBaseUrl
  const imageModel = text(form.image.model)
  if (imageModel !== undefined) image.model = imageModel

  return { spec, image }
}

export function sourceLabel(source: SettingSource): string {
  if (source === 'file') return '来自本页配置'
  if (source === 'env') return '继承自环境变量'
  return '默认值'
}
```

`payloadFromForm` **总是**发 `sendResponseFormat`，因为 `false` 若被当成空值省掉，服务端就会按默认 `true` 处理，开关等于按不下去。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @vudt/web test -- settingsForm`
Expected: 全部 PASS。

- [ ] **Step 6: 写 SettingsView.vue**

创建 `web/src/views/SettingsView.vue`。用 Ant Design Vue，中文文案，与 `App.vue`/`TaskList.vue` 一致：

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSettings, putSettings, testSettings, type ProbeReport } from '../api/client.js'
import { emptyForm, formFromEnvelope, payloadFromForm, sourceLabel } from './settingsForm.js'

const form = ref(emptyForm())
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const report = ref<ProbeReport | null>(null)
const error = ref<string | null>(null)
const saved = ref(false)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    form.value = formFromEnvelope(await getSettings())
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  saving.value = true
  error.value = null
  saved.value = false
  try {
    form.value = formFromEnvelope(await putSettings(payloadFromForm(form.value)))
    saved.value = true
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    saving.value = false
  }
}

async function probe(): Promise<void> {
  testing.value = true
  error.value = null
  report.value = null
  try {
    report.value = await testSettings(payloadFromForm(form.value))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    testing.value = false
  }
}

onMounted(load)
</script>

<template>
  <a-spin :spinning="loading">
    <a-alert v-if="error" type="error" :message="error" show-icon style="margin-bottom: 16px" />
    <a-alert
      v-if="saved"
      type="success"
      message="已保存。新设置只影响之后创建的任务。"
      show-icon
      style="margin-bottom: 16px"
    />

    <a-card title="文案模型（spec）" style="margin-bottom: 16px">
      <a-form layout="vertical">
        <a-form-item label="接口地址">
          <a-input v-model:value="form.spec.baseUrl" :placeholder="form.placeholders.spec.baseUrl" />
          <small>{{ sourceLabel(form.sources.spec.baseUrl) }}</small>
        </a-form-item>
        <a-form-item label="模型名">
          <a-input v-model:value="form.spec.model" :placeholder="form.placeholders.spec.model" />
          <small>{{ sourceLabel(form.sources.spec.model) }}</small>
        </a-form-item>
        <a-form-item label="发送 JSON 响应格式">
          <a-switch v-model:checked="form.spec.sendResponseFormat" />
          <small style="display: block">
            部分中转站不认 response_format 参数，会返回 400。关掉它仍能正常解析。
          </small>
        </a-form-item>
      </a-form>
      <a-alert
        v-if="report"
        :type="report.spec.ok ? 'success' : 'error'"
        :message="report.spec.ok ? '连接正常' : `连接失败${report.spec.status ? '（' + report.spec.status + '）' : ''}`"
        :description="report.spec.hint ?? report.spec.bodyExcerpt"
        show-icon
      />
    </a-card>

    <a-card title="图片模型（image）" style="margin-bottom: 16px">
      <a-form layout="vertical">
        <a-form-item label="接口地址">
          <a-input v-model:value="form.image.baseUrl" :placeholder="form.placeholders.image.baseUrl" />
          <small>{{ sourceLabel(form.sources.image.baseUrl) }}</small>
        </a-form-item>
        <a-form-item label="模型名">
          <a-input v-model:value="form.image.model" :placeholder="form.placeholders.image.model" />
          <small>{{ sourceLabel(form.sources.image.model) }}</small>
        </a-form-item>
      </a-form>
      <a-alert
        v-if="report"
        :type="report.image.ok ? 'success' : 'error'"
        :message="report.image.ok ? '连接正常' : `连接失败${report.image.status ? '（' + report.image.status + '）' : ''}`"
        :description="report.image.hint ?? report.image.bodyExcerpt"
        show-icon
      />
    </a-card>

    <a-space>
      <a-button type="primary" :loading="saving" @click="save">保存</a-button>
      <a-button :loading="testing" @click="probe">测试连通性</a-button>
      <a-button @click="load">重置</a-button>
    </a-space>
    <p style="margin-top: 12px; color: rgba(0, 0, 0, 0.45)">
      API key 不在这里配置，仍由环境变量提供。测试按钮会真实调用一次文案模型，产生极小的用量。
    </p>
  </a-spin>
</template>
```

测试结果用 `a-alert` 就地展开、不用 `message.success` 之类的 toast：诊断信息要能停下来读。

- [ ] **Step 7: 挂路由与菜单**

`web/src/router.ts` 的 `routes` 加一条：

```ts
  { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
```

`web/src/App.vue:6` 的 `selectedKeys` 现在把「非 tasks」一律算成 `detail`，加了菜单项后 `/settings` 会高亮错的那个。改成显式三分：

```ts
const selectedKeys = computed(() => {
  if (route.name === 'tasks') return ['tasks']
  if (route.name === 'settings') return ['settings']
  return ['detail']
})
```

菜单里加一项，紧跟现有的「任务」：

```vue
        <a-menu-item key="settings">
          <router-link to="/settings">配置</router-link>
        </a-menu-item>
```

- [ ] **Step 8: 跑测试 + 构建**

Run: `pnpm --filter @vudt/web test`
Expected: 全绿。

Run: `pnpm --filter @vudt/web build 2>&1 | tail -n 20`
Expected: 构建成功。构建是这一步真正的验证——页面本身没有挂载测试，`.vue` 里的类型错与模板错只有 `vue-tsc`/构建能抓到。

---


### Task 9: 详情页展示设置快照

**Files:**
- Modify: `web/src/views/TaskDetail.vue`（在 `TaskSteps` 那张 `a-card` 之后插一张新卡片，约 `:81-83`）

**Interfaces:**
- Consumes: Task 8 在 `client.ts` 的 `TaskView.settings?: EffectiveSettings`（Task 8 Step 3 已加）
- Produces: 无新接口，纯展示

没有这一步，Task 5 存下来的快照就是死数据——存了没人看得见。

- [ ] **Step 1: 插入快照卡片**

`web/src/views/TaskDetail.vue`，在 `<a-card><TaskSteps :task="task" /></a-card>`（`:81-83`）之后加：

```vue
      <a-card v-if="task.settings !== undefined" title="本任务使用的模型配置" size="small">
        <a-descriptions :column="2" size="small">
          <a-descriptions-item label="文案接口">
            {{ task.settings.spec.baseUrl }}
          </a-descriptions-item>
          <a-descriptions-item label="文案模型">
            {{ task.settings.spec.model }}
          </a-descriptions-item>
          <a-descriptions-item label="JSON 响应格式">
            {{ task.settings.spec.sendResponseFormat ? '开' : '关' }}
          </a-descriptions-item>
          <a-descriptions-item label="图片接口">
            {{ task.settings.image.baseUrl }}
          </a-descriptions-item>
          <a-descriptions-item label="图片模型">
            {{ task.settings.image.model }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
```

`v-if` 是必需的：`settings` 是可选字段，服务重启前创建的任务没有它。

- [ ] **Step 2: 构建验证**

Run: `pnpm --filter @vudt/web build 2>&1 | tail -n 20`
Expected: 构建成功。模板里的类型错只有构建能抓到——`task.settings` 在 `v-if` 里的窄化尤其要靠 `vue-tsc` 确认。

- [ ] **Step 3: 全仓回归**

Run: `pnpm -r test 2>&1 | tail -n 30`
Expected: 全绿。

---

## 收尾验证（全部任务完成后）

- [ ] **全仓测试与构建**

```bash
pnpm -r test 2>&1 | tail -n 30
pnpm -r build 2>&1 | tail -n 20
```

- [ ] **端到端手验（需要真 key，最后一步）**

起服务，在浏览器里走一遍：打开 `/settings` → 填中转站地址与模型 → 点「测试连通性」看两侧结果 → 保存 → 回列表建一个任务 → 进详情页确认「本任务使用的模型配置」显示的是刚存的值。

这一步无法自动化（要真 key、真中转站），但它是唯一能证明整条链路通的验证。

- [ ] **确认 `.vudt/settings.json` 真的落盘且不进版本控制**

```bash
cat .vudt/settings.json
grep -n '.vudt' .gitignore
```

Expected: 文件存在且是保存的值；`.gitignore` 第 14 行覆盖 `.vudt`。
