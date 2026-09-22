# web/ 控制台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给已完成的生成流水线补上服务端四个新端点与一个 Vue 3 + Ant Design Vue 控制台，让人能提交描述、看阶段进度、看 spec 结构与资产图、预览 dist、重试与导出。

**Architecture:** 先把四个端点连测试做死（`app.inject()` 可完整验证，无需浏览器），再写 `web/`。控制台详情页采用「左结构树 + 右大预览」布局：左树常驻「页面 → 区块 → 插槽/资产」，右侧常驻 dist 的 iframe，让「图 ↔ 插槽」的对应关系一直在眼前。

**Tech Stack:** Fastify 5 + archiver（服务端）；Vue 3 + vue-router + Ant Design Vue + Vite（前端）；vitest + @vue/test-utils（测试）。全 TypeScript，ESM。

**Spec:** `docs/superpowers/specs/2026-09-20-web-console-design.md`

## Global Constraints

- **本仓库不是 git 仓库**（`git rev-parse` 报 not a git repository）。因此每个任务的最后一步是「跑全量测试 + typecheck」，而不是 commit。不要执行 git 命令，也不要 `git init`。
- ESM + `"type": "module"`：**所有相对 import 必须带 `.js` 扩展名**，即使源文件是 `.ts`。
- 代码风格：2 空格缩进、单引号、**不写分号**。与现有七个包一致。
- Node >= 20，pnpm 11.20.0。新依赖用 `pnpm add --filter <pkg> <dep>@<exact-version>`，**钉死版本号**，不用 `^`。
- 需要 install 脚本的原生依赖必须在根 `pnpm-workspace.yaml` 的 `allowBuilds` 里显式开（现有：`esbuild: true`、`sharp: true`）。
- 服务端错误统一用 `new ServerError(message, statusCode, detail?)`（`server/src/errors.ts`），不要自己拼 reply。
- **`toView()` 是白名单投影**：绝对路径与 spec 内部不外泄。新端点不得往 `toView()` 里加字段。
- 任务 id 一律当作路径段对待：进 `join()` 之前必须先验证是小写 slug。
- 读文件超过 200 行用 `sed -n 'start,endp'` 或 Read 的 offset/limit 分段读。

---

## File Structure

**服务端（新建）**
- `server/src/export.ts` — 任务目录解析 + zip 打包。一个职责：把任务目录变成一个 zip 流。
- `server/src/spec-view.ts` — spec 投影。独立于 `store.ts` 的 `toView()`，因为白名单不同。
- `server/src/__tests__/export.test.ts`、`spec-view.test.ts` — 单元测试。

**服务端（修改）**
- `server/src/app.ts` — 挂四个新路由；把 `POST /tasks` 的创建逻辑抽成共用内部函数；最后加 web/dist 兜底。
- `server/src/__tests__/app.test.ts` — 端点集成测试。

**前端（新建）** 见 spec 的目录树。每个文件一个职责：`api/client.ts` 只管 HTTP 与错误归一化；两个 composable 各只管一种轮询；`SpecTree.vue` 只管把 spec 投影变成树数据。

---

## Task 1: 任务目录解析 + 源码 zip

**Files:**
- Create: `server/src/export.ts`
- Create: `server/src/__tests__/export.test.ts`
- Modify: `server/package.json`（加 archiver 依赖）

**Interfaces:**
- Consumes: `ServerError` from `./errors.js`
- Produces:
  - `resolveTaskDir(workspaceRoot: string, taskId: string): string` — 验证 slug 后 join，非法 id 抛 `ServerError(…, 400)`
  - `createSourceArchive(taskDir: string): Archiver` — 排除 `node_modules/`、`dist/`，不跟随 junction
  - `createDistArchive(taskDir: string): Archiver`
  - `TASK_ID_PATTERN: RegExp`

- [ ] **Step 1: 装 archiver**

```bash
pnpm add --filter @vudt/server archiver@7.0.1
pnpm add --filter @vudt/server -D @types/archiver@6.0.3
```

archiver 是纯 JS，无 install 脚本，不需要动 `allowBuilds`。

- [ ] **Step 2: 写失败测试**

创建 `server/src/__tests__/export.test.ts`：

```ts
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createDistArchive, createSourceArchive, resolveTaskDir } from '../export.js'

const dirs: string[] = []

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

async function fixtureTaskDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'vudt-export-'))
  dirs.push(root)
  const taskDir = join(root, 'task-1')
  await mkdir(join(taskDir, 'src'), { recursive: true })
  await mkdir(join(taskDir, 'dist'), { recursive: true })
  await mkdir(join(taskDir, 'node_modules', 'vue'), { recursive: true })
  await writeFile(join(taskDir, 'package.json'), '{}')
  await writeFile(join(taskDir, 'src', 'main.ts'), 'export {}')
  await writeFile(join(taskDir, 'dist', 'index.html'), '<html></html>')
  await writeFile(join(taskDir, 'node_modules', 'vue', 'index.js'), 'module.exports={}')
  return taskDir
}

/** Drains an archiver stream and returns the entry paths it emitted. */
async function entriesOf(archive: import('archiver').Archiver): Promise<string[]> {
  const names: string[] = []
  archive.on('entry', (entry) => names.push(entry.name.replace(/\\/g, '/')))
  const sink: Buffer[] = []
  archive.on('data', (chunk: Buffer) => sink.push(chunk))
  await new Promise<void>((resolve, reject) => {
    archive.on('end', () => resolve())
    archive.on('error', reject)
    void archive.finalize()
  })
  return names.sort()
}

describe('resolveTaskDir', () => {
  it('joins a valid lowercase slug id', () => {
    expect(resolveTaskDir('/root', 'a3f9-12bc')).toBe(join('/root', 'a3f9-12bc'))
  })

  it('refuses a traversal attempt', () => {
    expect(() => resolveTaskDir('/root', '../etc')).toThrow(/invalid task id/)
  })

  it('refuses uppercase and path separators', () => {
    expect(() => resolveTaskDir('/root', 'ABC')).toThrow(/invalid task id/)
    expect(() => resolveTaskDir('/root', 'a/b')).toThrow(/invalid task id/)
  })
})

describe('createSourceArchive', () => {
  it('excludes node_modules and dist', async () => {
    const taskDir = await fixtureTaskDir()
    const names = await entriesOf(createSourceArchive(taskDir))

    expect(names).toContain('package.json')
    expect(names).toContain('src/main.ts')
    expect(names.some((name) => name.startsWith('node_modules'))).toBe(false)
    expect(names.some((name) => name.startsWith('dist'))).toBe(false)
  })
})

describe('createDistArchive', () => {
  it('packs only the dist contents at the archive root', async () => {
    const taskDir = await fixtureTaskDir()
    const names = await entriesOf(createDistArchive(taskDir))

    expect(names).toEqual(['index.html'])
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd server && pnpm vitest run src/__tests__/export.test.ts`
Expected: FAIL — `Cannot find module '../export.js'`

- [ ] **Step 4: 写实现**

创建 `server/src/export.ts`：

```ts
import archiver, { type Archiver } from 'archiver'
import { join } from 'node:path'
import { ServerError } from './errors.js'

/** Same shape the build package enforces: the id becomes a path segment. */
export const TASK_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/

/**
 * Turns a task id into its workspace directory. Validation comes first because
 * the id arrives from the URL and lands in a filesystem path; `join` alone would
 * happily resolve `../`.
 */
export function resolveTaskDir(workspaceRoot: string, taskId: string): string {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new ServerError(`invalid task id: ${JSON.stringify(taskId)}`, 400)
  }
  return join(workspaceRoot, taskId)
}

function newArchive(): Archiver {
  // store-only for dist (already-compressed assets dominate) would save CPU, but
  // source trees are mostly text, so deflate earns its keep.
  return archiver('zip', { zlib: { level: 9 } })
}

/**
 * The project source, ready to hand to a developer.
 *
 * `node_modules` is a junction into the shared template, so `followSymlinks`
 * must stay off: a naive recursive walk would descend into the template and
 * produce a multi-hundred-megabyte archive. Excluding the glob is the first
 * line of defence, not following links is the second.
 */
export function createSourceArchive(taskDir: string): Archiver {
  const archive = newArchive()
  archive.glob('**/*', {
    cwd: taskDir,
    dot: true,
    follow: false,
    ignore: ['node_modules/**', 'node_modules', 'dist/**', 'dist'],
  })
  return archive
}

/** The built site, with dist/ itself as the archive root. */
export function createDistArchive(taskDir: string): Archiver {
  const archive = newArchive()
  archive.glob('**/*', { cwd: join(taskDir, 'dist'), dot: true, follow: false })
  return archive
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd server && pnpm vitest run src/__tests__/export.test.ts`
Expected: PASS（6 个用例）

- [ ] **Step 6: 验收**

Run: `cd server && pnpm test && pnpm typecheck`
Expected: 全部通过，typecheck 无输出

---

## Task 2: 导出路由（源码 + dist）

**Files:**
- Modify: `server/src/app.ts`（新增两个路由）
- Modify: `server/src/__tests__/fixture.ts`（新增 `FailingProvider`）
- Modify: `server/src/__tests__/app.test.ts`（新增 describe 块）

**Interfaces:**
- Consumes: `resolveTaskDir`、`createSourceArchive`、`createDistArchive` from `./export.js`（Task 1）
- Produces: `GET /tasks/:id/export/source`、`GET /tasks/:id/export/dist`
- Produces: `class FailingProvider implements ImageProvider`（测试夹具，`generate()` 直接抛错）

**可下载条件**（spec 已定）：按任务目录是否存在判定，**不按 `status === 'ready'`**。`runTask` 失败时不回收工作区，所以构建失败的任务代码仍在盘上，而这正是排查构建失败最需要的东西。dist 导出则仍要求 `ready`（没构建成功就没有 dist）。

- [ ] **Step 1: 加测试夹具 `FailingProvider`**

追加到 `server/src/__tests__/fixture.ts` 末尾：

```ts
/**
 * Fails during image generation, which runs after the workspace is allocated.
 * That is the only way to reach status 'failed' with the task directory still on
 * disk — exactly the state the source-export gate has to allow.
 */
export class FailingProvider implements ImageProvider {
  readonly name = 'failing'

  async generate(): Promise<Uint8Array> {
    throw new Error('image provider is down')
  }
}
```

- [ ] **Step 2: 写失败测试**

追加到 `server/src/__tests__/app.test.ts` 末尾，并在该文件顶部的 fixture import 里补上 `FailingProvider`：

```ts
import { FailingProvider, ScriptedDrafter, StubProvider, landingSpecInput } from './fixture.js'
```

```ts
describe('GET /tasks/:id/export', () => {
  it('serves a source zip for a ready task', async () => {
    const harness = await makeApp()
    track(harness)

    const { id } = (await post(harness, 'a landing page for Acme')).json() as { id: string }
    await harness.app.vudt.queue.drain()

    const response = await harness.app.inject({
      method: 'GET',
      url: '/tasks/' + id + '/export/source',
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('application/zip')
    expect(String(response.headers['content-disposition'])).toContain('.zip')
    // PK zip local file header — proves it is a real archive, not an error page.
    expect(response.rawPayload.subarray(0, 2).toString('latin1')).toBe('PK')
  })

  it('serves a dist zip for a ready task', async () => {
    const harness = await makeApp()
    track(harness)

    const { id } = (await post(harness, 'a landing page for Acme')).json() as { id: string }
    await harness.app.vudt.queue.drain()

    const response = await harness.app.inject({
      method: 'GET',
      url: '/tasks/' + id + '/export/dist',
    })

    expect(response.statusCode).toBe(200)
    expect(response.rawPayload.subarray(0, 2).toString('latin1')).toBe('PK')
  })

  it('refuses a dist export before the build produced one', async () => {
    const harness = await makeApp()
    track(harness)

    const { id } = (await post(harness, 'a landing page for Acme')).json() as { id: string }
    // No drain: the task is still queued, so there is no dist yet.
    const response = await harness.app.inject({
      method: 'GET',
      url: '/tasks/' + id + '/export/dist',
    })

    expect(response.statusCode).toBe(409)
  })

  it('refuses a source export for a task whose workspace was never allocated', async () => {
    const harness = await makeApp()
    track(harness)

    const { id } = (await post(harness, 'a landing page for Acme')).json() as { id: string }
    const response = await harness.app.inject({
      method: 'GET',
      url: '/tasks/' + id + '/export/source',
    })

    expect(response.statusCode).toBe(409)
  })

  it('still exports source for a task whose build failed — the workspace survives', async () => {
    // The spec's headline rule: runTask writes the error record but does NOT
    // dispose the workspace, and that source is how you debug a failed build.
    // FailingProvider fails during image generation, which happens after
    // allocate(), so the directory is on disk while the status is 'failed'.
    const harness = await makeApp({ provider: new FailingProvider() })
    track(harness)

    const { id } = (await post(harness, 'a landing page for Acme')).json() as { id: string }
    await harness.app.vudt.queue.drain()

    const status = (await harness.app.inject({ method: 'GET', url: '/tasks/' + id })).json() as {
      status: string
    }
    expect(status.status).toBe('failed')

    const response = await harness.app.inject({
      method: 'GET',
      url: '/tasks/' + id + '/export/source',
    })

    expect(response.statusCode).toBe(200)
    expect(response.rawPayload.subarray(0, 2).toString('latin1')).toBe('PK')
  })

  it('404s an unknown task', async () => {
    const harness = await makeApp()
    track(harness)

    const response = await harness.app.inject({
      method: 'GET',
      url: '/tasks/00000000-0000-4000-8000-000000000000/export/source',
    })

    expect(response.statusCode).toBe(404)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd server && pnpm vitest run src/__tests__/app.test.ts -t export`
Expected: FAIL — 404（路由不存在）而非预期的 200/409

- [ ] **Step 4: 写实现**

在 `server/src/app.ts` 顶部加 import：

```ts
import { stat } from 'node:fs/promises'
import { createDistArchive, createSourceArchive, resolveTaskDir } from './export.js'
```

在 `GET /preview/:id/*` 路由之后、`return Object.assign(...)` 之前插入：

```ts
  /** Slug for the download filename: the project name, not the opaque task id. */
  function downloadName(task: TaskRecord, suffix: string): string {
    const raw = task.spec?.meta.name ?? 'project'
    const slug = raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    return `${slug === '' ? 'project' : slug}-${suffix}.zip`
  }

  async function directoryExists(path: string): Promise<boolean> {
    try {
      return (await stat(path)).isDirectory()
    } catch {
      return false
    }
  }

  app.get('/tasks/:id/export/source', async (request, reply) => {
    const { id } = request.params as { id: string }
    const task = store.get(id)
    if (task === undefined) throw new ServerError('unknown task', 404)

    const taskDir = resolveTaskDir(workspaces.path, id)
    // Deliberately not gated on 'ready': runTask leaves the workspace in place
    // when a build fails, and that source is the main way to debug the failure.
    if (!(await directoryExists(taskDir))) {
      throw new ServerError(`task ${task.status} has no workspace to export`, 409)
    }

    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${downloadName(task, 'source')}"`)
      .header('x-content-type-options', 'nosniff')
      .send(finalized(createSourceArchive(taskDir)))
  })

  app.get('/tasks/:id/export/dist', async (request, reply) => {
    const { id } = request.params as { id: string }
    const task = store.get(id)
    if (task === undefined) throw new ServerError('unknown task', 404)
    if (task.status !== 'ready' || task.distDir === undefined) {
      throw new ServerError(`task is ${task.status}, not ready`, 409)
    }

    const taskDir = resolveTaskDir(workspaces.path, id)
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${downloadName(task, 'dist')}"`)
      .header('x-content-type-options', 'nosniff')
      .send(finalized(createDistArchive(taskDir)))
  })
```

并在文件顶层（`buildApp` 外）加这个小助手：

```ts
/**
 * archiver only starts walking the filesystem once finalize() is called, and it
 * is the stream itself that Fastify sends. Kicking finalize off without awaiting
 * it is intentional: the stream must already be handed to reply.send().
 */
function finalized(archive: import('archiver').Archiver): import('archiver').Archiver {
  void archive.finalize()
  return archive
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd server && pnpm vitest run src/__tests__/app.test.ts -t export`
Expected: PASS（6 个用例）

- [ ] **Step 6: 验收**

Run: `cd server && pnpm test && pnpm typecheck`
Expected: 全部通过（原 33 个 + 新 6 个）

---

## Task 3: spec 投影端点

**Files:**
- Create: `server/src/spec-view.ts`
- Create: `server/src/__tests__/spec-view.test.ts`
- Modify: `server/src/app.ts`（新增一个路由）
- Modify: `server/src/__tests__/app.test.ts`

**Interfaces:**
- Consumes: `ProjectSpec` from `@vudt/spec`
- Produces: `toSpecView(spec: ProjectSpec): SpecView`、`interface SpecView`

为什么要独立的投影函数而不是直接 `return task.spec`：白名单要显式。`ProjectSpec` 以后若新增带路径的字段（比如某个中间产物的落盘位置），显式投影会把它挡住，`return task.spec` 会直接漏出去。

- [ ] **Step 1: 写失败测试**

创建 `server/src/__tests__/spec-view.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { finalizeSpec } from '@vudt/spec'
import { toSpecView } from '../spec-view.js'
import { landingSpecInput } from './fixture.js'

describe('toSpecView', () => {
  it('projects meta, theme, styleBible, pages and assets', () => {
    const view = toSpecView(finalizeSpec(landingSpecInput()))

    expect(view.meta.targetStack).toBe('vue3')
    expect(view.pages.length).toBeGreaterThan(0)
    expect(view.assets.length).toBeGreaterThan(0)
    expect(view.theme).toBeDefined()
    expect(view.styleBible).toBeDefined()
  })

  it('keeps each asset contentHash so the client can build its image URL', () => {
    const view = toSpecView(finalizeSpec(landingSpecInput()))

    for (const asset of view.assets) {
      expect(asset.contentHash).toMatch(/^[0-9a-f]{16}$/)
    }
  })

  it('keeps the prompt — it is the main debugging signal for a wrong image', () => {
    const view = toSpecView(finalizeSpec(landingSpecInput()))

    expect(view.assets[0]!.prompt.length).toBeGreaterThan(0)
  })

  it('drops unknown extra fields rather than passing them through', () => {
    const spec = finalizeSpec(landingSpecInput()) as Record<string, unknown>
    spec.distDir = 'C:\\secret\\path'

    const view = toSpecView(spec as never) as Record<string, unknown>

    expect(view.distDir).toBeUndefined()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd server && pnpm vitest run src/__tests__/spec-view.test.ts`
Expected: FAIL — `Cannot find module '../spec-view.js'`

- [ ] **Step 3: 写实现**

创建 `server/src/spec-view.ts`：

```ts
import type { ProjectSpec } from '@vudt/spec'

/**
 * What `GET /tasks/:id/spec` hands out. Full spec content by design: this is an
 * internal tool, and the per-asset prompt is the first thing anyone wants when
 * an image comes back wrong.
 *
 * Still an explicit whitelist rather than `return spec`: if ProjectSpec ever
 * grows a field holding a filesystem path, spreading the object would leak it.
 */
export interface SpecView {
  meta: ProjectSpec['meta']
  theme: ProjectSpec['theme']
  styleBible: ProjectSpec['styleBible']
  pages: ProjectSpec['pages']
  assets: ProjectSpec['assets']
}

export function toSpecView(spec: ProjectSpec): SpecView {
  return {
    meta: spec.meta,
    theme: spec.theme,
    styleBible: spec.styleBible,
    pages: spec.pages,
    assets: spec.assets,
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd server && pnpm vitest run src/__tests__/spec-view.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: 挂路由，先写集成测试**

追加到 `server/src/__tests__/app.test.ts`：

```ts
describe('GET /tasks/:id/spec', () => {
  it('returns the projected spec once drafting produced one', async () => {
    const harness = await makeApp()
    track(harness)

    const { id } = (await post(harness, 'a landing page for Acme')).json() as { id: string }
    await harness.app.vudt.queue.drain()

    const response = await harness.app.inject({ method: 'GET', url: '/tasks/' + id + '/spec' })
    expect(response.statusCode).toBe(200)

    const body = response.json() as { pages: unknown[]; assets: { contentHash: string }[] }
    expect(body.pages.length).toBeGreaterThan(0)
    expect(body.assets[0]!.contentHash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('carries no absolute path anywhere in the payload', async () => {
    const harness = await makeApp()
    track(harness)

    const { id } = (await post(harness, 'a landing page for Acme')).json() as { id: string }
    await harness.app.vudt.queue.drain()

    const response = await harness.app.inject({ method: 'GET', url: '/tasks/' + id + '/spec' })

    // The workspace root is a temp dir; no part of it may appear in the response.
    expect(response.body).not.toContain(harness.workspaceRoot)
    expect(response.body).not.toMatch(/[A-Za-z]:\\\\/)
  })

  it('409s while the task has no spec yet', async () => {
    const harness = await makeApp()
    track(harness)

    const { id } = (await post(harness, 'a landing page for Acme')).json() as { id: string }
    const response = await harness.app.inject({ method: 'GET', url: '/tasks/' + id + '/spec' })

    expect(response.statusCode).toBe(409)
  })

  it('404s an unknown task', async () => {
    const harness = await makeApp()
    track(harness)

    const response = await harness.app.inject({
      method: 'GET',
      url: '/tasks/00000000-0000-4000-8000-000000000000/spec',
    })

    expect(response.statusCode).toBe(404)
  })
})
```

- [ ] **Step 6: 跑测试确认失败**

Run: `cd server && pnpm vitest run src/__tests__/app.test.ts -t "tasks/:id/spec"`
Expected: FAIL — 404（路由不存在）

- [ ] **Step 7: 挂路由**

在 `server/src/app.ts` 加 import：

```ts
import { toSpecView } from './spec-view.js'
```

在导出路由之后插入：

```ts
  app.get('/tasks/:id/spec', async (request) => {
    const { id } = request.params as { id: string }
    const task = store.get(id)
    if (task === undefined) throw new ServerError('unknown task', 404)
    if (task.spec === undefined) {
      throw new ServerError(`task is ${task.status} and has no spec yet`, 409)
    }
    return toSpecView(task.spec)
  })
```

- [ ] **Step 8: 跑测试确认通过**

Run: `cd server && pnpm vitest run src/__tests__/app.test.ts -t "tasks/:id/spec"`
Expected: PASS（4 个用例）

- [ ] **Step 9: 验收**

Run: `cd server && pnpm test && pnpm typecheck`
Expected: 全部通过（原 33 + Task 2 的 5 + 本任务 8）

---

## Task 4: 重试端点（含抽取共用创建逻辑）

**Files:**
- Modify: `server/src/app.ts:91-137`（`POST /tasks` 主体抽成内部函数）
- Modify: `server/src/__tests__/app.test.ts`

**Interfaces:**
- Produces: `POST /tasks/:id/retry` → 202 + 新任务的 `TaskView`

**这个任务会改已测过的路由。** 抽取的目的是让两个路由共用同一份描述长度校验与「队列满返 503」处理——否则两份实现必然漂移。原有 10 个 `POST /tasks` 用例是这次重构的回归网，必须保持全绿。

重试语义（spec 已定）：读原任务 `description`，走同一条创建路径，**重新 draft**，返回新任务。原任务记录不动。

- [ ] **Step 1: 写失败测试**

追加到 `server/src/__tests__/app.test.ts`：

```ts
describe('POST /tasks/:id/retry', () => {
  it('creates a new task carrying the original description', async () => {
    const harness = await makeApp({
      drafter: new ScriptedDrafter([landingSpecInput(), landingSpecInput()]),
    })
    track(harness)

    const first = (await post(harness, 'a landing page for Acme')).json() as {
      id: string
      description: string
    }
    await harness.app.vudt.queue.drain()

    const response = await harness.app.inject({
      method: 'POST',
      url: '/tasks/' + first.id + '/retry',
    })

    expect(response.statusCode).toBe(202)
    const retried = response.json() as { id: string; description: string; status: string }
    expect(retried.id).not.toBe(first.id)
    expect(retried.description).toBe(first.description)
    expect(retried.status).toBe('queued')
  })

  it('leaves the original task record untouched', async () => {
    const harness = await makeApp({
      drafter: new ScriptedDrafter([landingSpecInput(), landingSpecInput()]),
    })
    track(harness)

    const first = (await post(harness, 'a landing page for Acme')).json() as { id: string }
    await harness.app.vudt.queue.drain()

    await harness.app.inject({ method: 'POST', url: '/tasks/' + first.id + '/retry' })
    await harness.app.vudt.queue.drain()

    const original = (
      await harness.app.inject({ method: 'GET', url: '/tasks/' + first.id })
    ).json() as { status: string }
    expect(original.status).toBe('ready')
  })

  it('answers 503 when the queue is full and leaves no orphan record', async () => {
    const harness = await makeApp({ concurrency: 1, maxPending: 1 })
    track(harness)

    const first = (await post(harness, 'a landing page for Acme')).json() as { id: string }
    // Fill the queue: one running plus one pending is the configured ceiling.
    await post(harness, 'second description')

    const response = await harness.app.inject({
      method: 'POST',
      url: '/tasks/' + first.id + '/retry',
    })

    expect(response.statusCode).toBe(503)

    const listed = (await harness.app.inject({ method: 'GET', url: '/tasks' })).json() as {
      tasks: { status: string }[]
    }
    // The rejected retry must not leave a record stuck in 'queued' forever.
    expect(listed.tasks.filter((task) => task.status === 'queued')).toHaveLength(0)
  })

  it('404s an unknown task', async () => {
    const harness = await makeApp()
    track(harness)

    const response = await harness.app.inject({
      method: 'POST',
      url: '/tasks/00000000-0000-4000-8000-000000000000/retry',
    })

    expect(response.statusCode).toBe(404)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd server && pnpm vitest run src/__tests__/app.test.ts -t retry`
Expected: FAIL — 404（路由不存在）

- [ ] **Step 3: 抽取共用创建函数**

在 `server/src/app.ts` 里，把 `POST /tasks` 的主体替换成对新内部函数的调用。在 `app.get('/health', …)` 之前插入：

```ts
  interface CreateOutcome {
    task: TaskRecord
    accepted: boolean
  }

  /**
   * The single creation path. Both POST /tasks and POST /tasks/:id/retry go
   * through here so the description ceiling and the queue-full handling cannot
   * drift into two implementations.
   *
   * Caller-supplied descriptions are already trimmed; length is validated here
   * because the prompt is a cost input.
   */
  function createTask(description: string, ownerId: string | null): CreateOutcome {
    if (description === '') {
      throw new ServerError('description is required')
    }
    if (description.length > maxDescription) {
      throw new ServerError(`description exceeds ${maxDescription} characters`, 413)
    }

    // Lowercase slug: the id becomes a workspace directory name and a URL segment.
    const id = randomUUID().toLowerCase()
    const task = store.create({
      id,
      ownerId,
      status: 'queued',
      description,
      createdAt: Date.now(),
    })

    const accepted = queue.enqueue(() =>
      runTask(id, {
        store,
        workspaces,
        drafter: deps.drafter,
        provider: deps.provider,
        templateDir: deps.templateDir,
        maxAssets: deps.maxAssets ?? 24,
        specAttempts: deps.specAttempts ?? 3,
        ...(deps.cache === undefined ? {} : { cache: deps.cache }),
        ...(deps.processor === undefined ? {} : { processor: deps.processor }),
        ...(deps.buildTimeoutMs === undefined
          ? {}
          : { limits: { timeoutMs: deps.buildTimeoutMs } }),
      }),
    )

    if (!accepted) {
      store.update(id, {
        status: 'failed',
        finishedAt: Date.now(),
        error: { message: 'queue is full, retry later' },
      })
    }

    return { task, accepted }
  }
```

- [ ] **Step 4: 让 `POST /tasks` 改用它**

把现有 `app.post('/tasks', …)` 整个替换成：

```ts
  app.post('/tasks', async (request, reply) => {
    const body = request.body as { description?: unknown; ownerId?: unknown } | undefined
    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    const ownerId = typeof body?.ownerId === 'string' && body.ownerId !== '' ? body.ownerId : null

    const { task, accepted } = createTask(description, ownerId)
    if (!accepted) {
      return reply.code(503).send({ error: 'queue is full, retry later' })
    }
    return reply.code(202).send(toView(task))
  })
```

- [ ] **Step 5: 跑原有用例确认重构没破坏东西**

Run: `cd server && pnpm vitest run src/__tests__/app.test.ts -t "POST /tasks"`
Expected: 原有 3 个 `POST /tasks` 用例 PASS，retry 用例仍 FAIL（路由还没挂）

- [ ] **Step 6: 挂 retry 路由**

在 `app.post('/tasks', …)` 之后插入：

```ts
  app.post('/tasks/:id/retry', async (request, reply) => {
    const { id } = request.params as { id: string }
    const original = store.get(id)
    if (original === undefined) throw new ServerError('unknown task', 404)

    // Same description, fresh draft: there is no partial state to resume, and a
    // draft-stage failure leaves nothing to reuse anyway.
    const { task, accepted } = createTask(original.description, original.ownerId)
    if (!accepted) {
      return reply.code(503).send({ error: 'queue is full, retry later' })
    }
    return reply.code(202).send(toView(task))
  })
```

- [ ] **Step 7: 跑测试确认通过**

Run: `cd server && pnpm vitest run src/__tests__/app.test.ts -t retry`
Expected: PASS（4 个用例）

- [ ] **Step 8: 验收 — 重点确认重构无回归**

Run: `cd server && pnpm test && pnpm typecheck`
Expected: 全部通过。服务端累计 33 + 5 + 8 + 4 = 50 个用例。

---

## Task 5: web 脚手架 + API 客户端

**Files:**
- Create: `web/package.json`、`web/tsconfig.json`、`web/vite.config.ts`、`web/index.html`
- Create: `web/src/main.ts`、`web/src/App.vue`、`web/src/router.ts`
- Create: `web/src/api/client.ts`
- Create: `web/src/api/__tests__/client.test.ts`

**Interfaces:**
- Produces（后续所有前端任务都依赖这些）：
  - `class ApiError extends Error { readonly status: number }`
  - `interface TaskView { id, status, description, createdAt, finishedAt?, previewUrl?, specAttempts?, providerCalls?, error? }`
  - `interface SpecView { meta, theme, styleBible, pages, assets }`
  - `listTasks(): Promise<TaskView[]>`
  - `getTask(id: string): Promise<TaskView>`
  - `createTask(description: string): Promise<TaskView>`
  - `getSpec(id: string): Promise<SpecView>`
  - `retryTask(id: string): Promise<TaskView>`
  - `exportUrl(id: string, kind: 'source' | 'dist'): string`
  - `assetImageUrl(taskId: string, contentHash: string): string`
  - `ACTIVE_STATUSES: readonly TaskStatus[]`、`type TaskStatus`

- [ ] **Step 1: 建包并装依赖**

```bash
mkdir -p web/src/api/__tests__ web/src/components web/src/composables web/src/views
pnpm add --filter @vudt/web vue@3.5.13 vue-router@4.5.0 ant-design-vue@4.2.6
pnpm add --filter @vudt/web -D vite@6.0.7 @vitejs/plugin-vue@5.2.1 vue-tsc@2.2.0 typescript@5.9.2 vitest@3.2.4 @vue/test-utils@2.4.6 jsdom@25.0.1
```

`web/package.json`（先手写这个文件，`pnpm add` 才认得这个 workspace 包）：

```json
{
  "name": "@vudt/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "vue-tsc --noEmit"
  }
}
```

注意 `typecheck` 用 `vue-tsc` 而非 `tsc`——`.vue` 文件 `tsc` 认不了。

- [ ] **Step 2: 配置文件**

`web/tsconfig.json`：

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "jsx": "preserve",
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
```

`web/vite.config.ts`：

```ts
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const API_TARGET = 'http://127.0.0.1:4300'

/**
 * The proxy is not just convenience. Preview responses carry
 * `frame-ancestors 'self'`, so the console and the previewed dist must look
 * same-origin to the browser; proxying /preview through the dev server is what
 * makes that true in development.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      '/tasks': API_TARGET,
      '/preview': API_TARGET,
      '/health': API_TARGET,
    },
  },
  test: {
    environment: 'jsdom',
  },
})
```

`web/index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI 前端模板生成平台</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: 写 API 客户端的失败测试**

创建 `web/src/api/__tests__/client.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  assetImageUrl,
  createTask,
  exportUrl,
  getSpec,
  getTask,
  listTasks,
  retryTask,
} from '../client.js'

function mockFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listTasks', () => {
  it('unwraps the tasks array', async () => {
    vi.stubGlobal('fetch', mockFetch({ tasks: [{ id: 'a', status: 'ready' }] }))

    await expect(listTasks()).resolves.toEqual([{ id: 'a', status: 'ready' }])
  })
})

describe('getTask', () => {
  it('requests the task by id', async () => {
    const fetchMock = mockFetch({ id: 'abc', status: 'building' })
    vi.stubGlobal('fetch', fetchMock)

    await getTask('abc')

    expect(fetchMock).toHaveBeenCalledWith('/tasks/abc', expect.anything())
  })
})

describe('createTask', () => {
  it('posts the description as JSON', async () => {
    const fetchMock = mockFetch({ id: 'abc', status: 'queued' }, 202)
    vi.stubGlobal('fetch', fetchMock)

    await createTask('a landing page')

    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      description: 'a landing page',
    })
  })
})

describe('error handling', () => {
  it('throws ApiError carrying the status', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'queue is full, retry later' }, 503))

    await expect(createTask('x')).rejects.toBeInstanceOf(ApiError)
    await expect(createTask('x')).rejects.toMatchObject({
      status: 503,
      message: 'queue is full, retry later',
    })
  })

  it('falls back to a generic message when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('gateway blew up', { status: 502 })) as unknown as typeof fetch,
    )

    await expect(getTask('abc')).rejects.toMatchObject({ status: 502 })
  })
})

describe('url builders', () => {
  it('builds export urls for both kinds', () => {
    expect(exportUrl('abc', 'source')).toBe('/tasks/abc/export/source')
    expect(exportUrl('abc', 'dist')).toBe('/tasks/abc/export/dist')
  })

  it('builds the asset image url from the content hash', () => {
    // codegen writes public/assets/<hash>.png and vite copies public/ into dist,
    // so the image is already served by the preview route — no extra endpoint.
    expect(assetImageUrl('abc', '0123456789abcdef')).toBe(
      '/preview/abc/assets/0123456789abcdef.png',
    )
  })

  it('encodes ids that would otherwise break the path', () => {
    expect(exportUrl('a b', 'dist')).toBe('/tasks/a%20b/export/dist')
  })
})

describe('getSpec and retryTask', () => {
  it('fetches the spec projection', async () => {
    const fetchMock = mockFetch({ meta: {}, theme: {}, styleBible: {}, pages: [], assets: [] })
    vi.stubGlobal('fetch', fetchMock)

    const spec = await getSpec('abc')

    expect(fetchMock).toHaveBeenCalledWith('/tasks/abc/spec', expect.anything())
    expect(spec.assets).toEqual([])
  })

  it('posts a retry and returns the new task', async () => {
    const fetchMock = mockFetch({ id: 'new-id', status: 'queued' }, 202)
    vi.stubGlobal('fetch', fetchMock)

    const task = await retryTask('old-id')

    expect(fetchMock).toHaveBeenCalledWith('/tasks/old-id/retry', expect.anything())
    expect(task.id).toBe('new-id')
  })
})
```

- [ ] **Step 4: 跑测试确认失败**

Run: `cd web && pnpm vitest run`
Expected: FAIL — `Cannot find module '../client.js'`

- [ ] **Step 5: 写实现**

创建 `web/src/api/client.ts`：

```ts
export type TaskStatus = 'queued' | 'drafting' | 'building' | 'ready' | 'failed'

/** Statuses worth polling: everything else is terminal. */
export const ACTIVE_STATUSES: readonly TaskStatus[] = ['queued', 'drafting', 'building']

export interface TaskView {
  id: string
  status: TaskStatus
  description: string
  createdAt: number
  finishedAt?: number
  previewUrl?: string
  specAttempts?: number
  providerCalls?: number
  error?: { message: string; detail?: string }
}

export interface AssetView {
  id: string
  prompt: string
  alt: string
  aspectRatio: string
  renderSize: { w: number; h: number }
  transparent: boolean
  contentHash: string
}

export interface BlockView {
  component: string
  props: Record<string, unknown>
  assetBindings: Record<string, string>
}

export interface PageView {
  route: string
  name: string
  blocks: BlockView[]
}

export interface SpecView {
  meta: { name: string; description: string; targetStack: string }
  theme: Record<string, unknown>
  styleBible: Record<string, unknown>
  pages: PageView[]
  assets: AssetView[]
}

/** Carries the HTTP status so views can tell 409 (wait) from 503 (back off). */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { accept: 'application/json', ...(init.headers ?? {}) },
  })

  if (!response.ok) {
    // The server sends {error} for handled failures, but a proxy or crash can
    // return HTML; never let a parse failure mask the status.
    let message = `request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { error?: string; message?: string }
      message = body.error ?? body.message ?? message
    } catch {
      /* keep the status-based message */
    }
    throw new ApiError(message, response.status)
  }

  return (await response.json()) as T
}

export async function listTasks(): Promise<TaskView[]> {
  const body = await request<{ tasks: TaskView[] }>('/tasks')
  return body.tasks
}

export function getTask(id: string): Promise<TaskView> {
  return request<TaskView>(`/tasks/${encodeURIComponent(id)}`)
}

export function createTask(description: string): Promise<TaskView> {
  return request<TaskView>('/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ description }),
  })
}

export function getSpec(id: string): Promise<SpecView> {
  return request<SpecView>(`/tasks/${encodeURIComponent(id)}/spec`)
}

export function retryTask(id: string): Promise<TaskView> {
  return request<TaskView>(`/tasks/${encodeURIComponent(id)}/retry`, { method: 'POST' })
}

export function exportUrl(id: string, kind: 'source' | 'dist'): string {
  return `/tasks/${encodeURIComponent(id)}/export/${kind}`
}

/**
 * Assets need no dedicated endpoint: codegen writes `public/assets/<hash>.png`
 * and `vite build` copies `public/` to the dist root, so the preview route
 * already serves them.
 */
export function assetImageUrl(taskId: string, contentHash: string): string {
  return `/preview/${encodeURIComponent(taskId)}/assets/${encodeURIComponent(contentHash)}.png`
}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `cd web && pnpm vitest run`
Expected: PASS（10 个用例）

- [ ] **Step 7: 写外壳（App / router / main）**

`web/src/router.ts`：

```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'tasks', component: () => import('./views/TaskList.vue') },
  { path: '/task/:id', name: 'task-detail', component: () => import('./views/TaskDetail.vue') },
]

export const router = createRouter({ history: createWebHistory(), routes })
```

`web/src/App.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const selectedKeys = computed(() => [route.name === 'tasks' ? 'tasks' : 'detail'])
</script>

<template>
  <a-layout style="min-height: 100vh">
    <a-layout-header style="display: flex; align-items: center; gap: 16px">
      <span style="color: #fff; font-weight: 600">AI 前端模板生成平台</span>
      <a-menu
        theme="dark"
        mode="horizontal"
        :selected-keys="selectedKeys"
        style="flex: 1; min-width: 0"
      >
        <a-menu-item key="tasks">
          <router-link to="/">任务</router-link>
        </a-menu-item>
      </a-menu>
    </a-layout-header>
    <a-layout-content style="padding: 24px">
      <router-view />
    </a-layout-content>
  </a-layout>
</template>
```

`web/src/main.ts`：

```ts
import Antd from 'ant-design-vue'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router.js'
import 'ant-design-vue/dist/reset.css'

createApp(App).use(Antd).use(router).mount('#app')
```

注意：`TaskList.vue` 与 `TaskDetail.vue` 在 Task 6/7 才创建，所以此时 `pnpm build` 会失败——这是预期的，router 用的是动态 import，`vitest` 不受影响。

- [ ] **Step 8: 验收**

Run: `cd web && pnpm test`
Expected: PASS（10 个用例）

Run: `cd /d/zw/vue-ui-design-template && pnpm install`
Expected: 成功，`@vudt/web` 出现在 workspace 里（`pnpm-workspace.yaml` 已预留 `web`）

---

## Task 6: 任务列表页（提交 + 历史表格 + 列表轮询）

**Files:**
- Create: `web/src/composables/useTaskList.ts`
- Create: `web/src/composables/__tests__/useTaskList.test.ts`
- Create: `web/src/views/TaskList.vue`

**Interfaces:**
- Consumes: `listTasks`、`createTask`、`ACTIVE_STATUSES`、`TaskView`、`ApiError` from `../api/client.js`（Task 5）
- Produces: `useTaskList(options?: { intervalMs?: number }): { tasks, loading, error, refresh, start, stop, submit }`

- [ ] **Step 1: 写失败测试**

创建 `web/src/composables/__tests__/useTaskList.test.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTaskList } from '../useTaskList.js'
import * as client from '../../api/client.js'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useTaskList', () => {
  it('loads tasks on refresh', async () => {
    vi.spyOn(client, 'listTasks').mockResolvedValue([
      { id: 'a', status: 'ready', description: 'x', createdAt: 1 },
    ])

    const list = useTaskList()
    await list.refresh()

    expect(list.tasks.value).toHaveLength(1)
    expect(list.loading.value).toBe(false)
  })

  it('keeps polling while a task is still active', async () => {
    const listTasks = vi.spyOn(client, 'listTasks').mockResolvedValue([
      { id: 'a', status: 'building', description: 'x', createdAt: 1 },
    ])

    const list = useTaskList({ intervalMs: 1000 })
    list.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(listTasks).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(listTasks).toHaveBeenCalledTimes(2)

    list.stop()
  })

  it('stops polling once every task reached a terminal status', async () => {
    const listTasks = vi.spyOn(client, 'listTasks').mockResolvedValue([
      { id: 'a', status: 'ready', description: 'x', createdAt: 1 },
      { id: 'b', status: 'failed', description: 'y', createdAt: 2 },
    ])

    const list = useTaskList({ intervalMs: 1000 })
    list.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(listTasks).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    // No active task left, so no further requests.
    expect(listTasks).toHaveBeenCalledTimes(1)
  })

  it('stop() clears the timer so nothing fires afterwards', async () => {
    const listTasks = vi.spyOn(client, 'listTasks').mockResolvedValue([
      { id: 'a', status: 'building', description: 'x', createdAt: 1 },
    ])

    const list = useTaskList({ intervalMs: 1000 })
    list.start()
    await vi.advanceTimersByTimeAsync(0)
    list.stop()

    await vi.advanceTimersByTimeAsync(10000)
    expect(listTasks).toHaveBeenCalledTimes(1)
  })

  it('surfaces an ApiError message instead of throwing', async () => {
    vi.spyOn(client, 'listTasks').mockRejectedValue(new client.ApiError('boom', 500))

    const list = useTaskList()
    await list.refresh()

    expect(list.error.value).toBe('boom')
  })

  it('submit() creates a task and refreshes the list', async () => {
    const createTask = vi.spyOn(client, 'createTask').mockResolvedValue({
      id: 'new',
      status: 'queued',
      description: 'a landing page',
      createdAt: 3,
    })
    vi.spyOn(client, 'listTasks').mockResolvedValue([])

    const list = useTaskList()
    const created = await list.submit('a landing page')

    expect(createTask).toHaveBeenCalledWith('a landing page')
    expect(created?.id).toBe('new')
  })

  it('submit() reports a full queue without throwing', async () => {
    vi.spyOn(client, 'createTask').mockRejectedValue(
      new client.ApiError('queue is full, retry later', 503),
    )
    vi.spyOn(client, 'listTasks').mockResolvedValue([])

    const list = useTaskList()
    const created = await list.submit('x')

    expect(created).toBeUndefined()
    expect(list.error.value).toContain('queue is full')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && pnpm vitest run src/composables`
Expected: FAIL — `Cannot find module '../useTaskList.js'`

- [ ] **Step 3: 写实现**

创建 `web/src/composables/useTaskList.ts`：

```ts
import { onUnmounted, ref, type Ref } from 'vue'
import {
  ACTIVE_STATUSES,
  ApiError,
  createTask as createTaskRequest,
  listTasks,
  type TaskView,
} from '../api/client.js'

const DEFAULT_INTERVAL_MS = 1500

export interface UseTaskList {
  tasks: Ref<TaskView[]>
  loading: Ref<boolean>
  error: Ref<string | undefined>
  refresh: () => Promise<void>
  start: () => void
  stop: () => void
  submit: (description: string) => Promise<TaskView | undefined>
}

function hasActive(tasks: readonly TaskView[]): boolean {
  return tasks.some((task) => ACTIVE_STATUSES.includes(task.status))
}

/**
 * Polls the task list, but only while something is actually in flight: an
 * all-terminal list cannot change on its own, so polling it would be pure noise.
 */
export function useTaskList(options: { intervalMs?: number } = {}): UseTaskList {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  const tasks = ref<TaskView[]>([])
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  function stop(): void {
    stopped = true
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function describe(cause: unknown): string {
    return cause instanceof ApiError ? cause.message : '请求失败'
  }

  async function refresh(): Promise<void> {
    loading.value = true
    try {
      tasks.value = await listTasks()
      error.value = undefined
    } catch (cause) {
      error.value = describe(cause)
    } finally {
      loading.value = false
    }
  }

  function scheduleNext(): void {
    if (stopped || !hasActive(tasks.value)) return
    timer = setTimeout(tick, intervalMs)
  }

  async function tick(): Promise<void> {
    await refresh()
    scheduleNext()
  }

  function start(): void {
    stopped = false
    void tick()
  }

  async function submit(description: string): Promise<TaskView | undefined> {
    try {
      const created = await createTaskRequest(description)
      error.value = undefined
      await refresh()
      // A brand-new task is active, so resume polling even if the list had gone quiet.
      start()
      return created
    } catch (cause) {
      error.value = describe(cause)
      return undefined
    }
  }

  // Timers outlive components unless cleared; this is the leak this guards.
  onUnmounted(stop)

  return { tasks, loading, error, refresh, start, stop, submit }
}
```

注意 `onUnmounted` 在组件外调用会发警告但不报错，测试里直接调 composable 是可接受的用法。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web && pnpm vitest run src/composables`
Expected: PASS（7 个用例）

- [ ] **Step 5: 写列表视图**

创建 `web/src/views/TaskList.vue`：

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskList } from '../composables/useTaskList.js'
import type { TaskStatus } from '../api/client.js'

const router = useRouter()
const { tasks, loading, error, start, submit } = useTaskList()
const description = ref('')
const submitting = ref(false)

onMounted(start)

const STATUS_COLOR: Record<TaskStatus, string> = {
  queued: 'default',
  drafting: 'processing',
  building: 'processing',
  ready: 'success',
  failed: 'error',
}

const columns = [
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '图片调用', dataIndex: 'providerCalls', key: 'providerCalls', width: 100 },
  { title: '', key: 'actions', width: 100 },
]

const canSubmit = computed(() => description.value.trim() !== '' && !submitting.value)

async function onSubmit(): Promise<void> {
  submitting.value = true
  try {
    const created = await submit(description.value.trim())
    if (created !== undefined) description.value = ''
  } finally {
    submitting.value = false
  }
}

function formatTime(value: number): string {
  return new Date(value).toLocaleString()
}
</script>

<template>
  <a-space direction="vertical" size="large" style="width: 100%">
    <a-card title="新建任务">
      <a-space direction="vertical" style="width: 100%">
        <a-textarea
          v-model:value="description"
          :rows="4"
          :maxlength="4000"
          show-count
          placeholder="用自然语言描述要生成的前端项目，例如：一个 SaaS 产品落地页，含英雄区、三栏特性、价格表和页脚"
        />
        <a-button type="primary" :disabled="!canSubmit" :loading="submitting" @click="onSubmit">
          生成
        </a-button>
      </a-space>
    </a-card>

    <a-alert v-if="error !== undefined" type="error" show-icon :message="error" />

    <a-card title="历史任务">
      <a-table
        :columns="columns"
        :data-source="tasks"
        :loading="loading"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="STATUS_COLOR[record.status]">{{ record.status }}</a-tag>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatTime(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'actions'">
            <a @click="router.push(`/task/${record.id}`)">查看</a>
          </template>
        </template>
      </a-table>
    </a-card>
  </a-space>
</template>
```

- [ ] **Step 6: 验收**

Run: `cd web && pnpm test && pnpm typecheck`
Expected: 测试 17 个通过（10 + 7），typecheck 无输出

---

## Task 7: 详情页骨架（单任务轮询 + Steps + iframe 预览）

**Files:**
- Create: `web/src/composables/useTaskPolling.ts`
- Create: `web/src/composables/__tests__/useTaskPolling.test.ts`
- Create: `web/src/components/TaskSteps.vue`
- Create: `web/src/views/TaskDetail.vue`

**Interfaces:**
- Consumes: `getTask`、`ACTIVE_STATUSES`、`ApiError`、`TaskView` from `../api/client.js`（Task 5）
- Produces:
  - `useTaskPolling(taskId: string, options?: { intervalMs?: number }): { task, error, notFound, start, stop }`
  - `TaskSteps.vue` — props: `{ task: TaskView }`

Steps 只画四格（排队 → draft → 构建 → 完成），不为「生成图片」单开一格：服务端只有五个状态，`building` 同时覆盖生成图片与 `vite build`，而 `providerCalls` 已能在该阶段当副标题显示进度。新增状态要改 `runner` 与 `store`，不值得。

- [ ] **Step 1: 写轮询的失败测试**

创建 `web/src/composables/__tests__/useTaskPolling.test.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTaskPolling } from '../useTaskPolling.js'
import * as client from '../../api/client.js'

function taskAt(status: client.TaskStatus): client.TaskView {
  return { id: 'abc', status, description: 'x', createdAt: 1 }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useTaskPolling', () => {
  it('fetches the task immediately on start', async () => {
    const getTask = vi.spyOn(client, 'getTask').mockResolvedValue(taskAt('ready'))

    const polling = useTaskPolling('abc')
    polling.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(getTask).toHaveBeenCalledWith('abc')
    expect(polling.task.value?.status).toBe('ready')
  })

  it('keeps polling while the task is active', async () => {
    const getTask = vi.spyOn(client, 'getTask').mockResolvedValue(taskAt('building'))

    const polling = useTaskPolling('abc', { intervalMs: 1000 })
    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(getTask).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(getTask).toHaveBeenCalledTimes(2)

    polling.stop()
  })

  it('stops as soon as the task reaches ready', async () => {
    const getTask = vi.spyOn(client, 'getTask').mockResolvedValue(taskAt('ready'))

    const polling = useTaskPolling('abc', { intervalMs: 1000 })
    polling.start()
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(10000)
    expect(getTask).toHaveBeenCalledTimes(1)
  })

  it('stops as soon as the task reaches failed', async () => {
    const getTask = vi.spyOn(client, 'getTask').mockResolvedValue(taskAt('failed'))

    const polling = useTaskPolling('abc', { intervalMs: 1000 })
    polling.start()
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(10000)
    expect(getTask).toHaveBeenCalledTimes(1)
  })

  it('stop() clears the pending timer', async () => {
    const getTask = vi.spyOn(client, 'getTask').mockResolvedValue(taskAt('queued'))

    const polling = useTaskPolling('abc', { intervalMs: 1000 })
    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    polling.stop()

    await vi.advanceTimersByTimeAsync(10000)
    expect(getTask).toHaveBeenCalledTimes(1)
  })

  it('flags a 404 separately so the view can redirect', async () => {
    vi.spyOn(client, 'getTask').mockRejectedValue(new client.ApiError('unknown task', 404))

    const polling = useTaskPolling('abc')
    polling.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(polling.notFound.value).toBe(true)
  })

  it('keeps polling through a transient error', async () => {
    const getTask = vi
      .spyOn(client, 'getTask')
      .mockRejectedValueOnce(new client.ApiError('boom', 500))
      .mockResolvedValue(taskAt('ready'))

    const polling = useTaskPolling('abc', { intervalMs: 1000 })
    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(polling.error.value).toBe('boom')

    // A 500 may be transient; giving up on the first one would strand the view.
    await vi.advanceTimersByTimeAsync(1000)
    expect(getTask).toHaveBeenCalledTimes(2)
    expect(polling.error.value).toBeUndefined()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && pnpm vitest run src/composables/__tests__/useTaskPolling.test.ts`
Expected: FAIL — `Cannot find module '../useTaskPolling.js'`

- [ ] **Step 3: 写实现**

创建 `web/src/composables/useTaskPolling.ts`：

```ts
import { onUnmounted, ref, type Ref } from 'vue'
import { ACTIVE_STATUSES, ApiError, getTask, type TaskView } from '../api/client.js'

const DEFAULT_INTERVAL_MS = 1500

export interface UseTaskPolling {
  task: Ref<TaskView | undefined>
  error: Ref<string | undefined>
  notFound: Ref<boolean>
  start: () => void
  stop: () => void
}

/**
 * Polls one task until it reaches a terminal status, then stops on its own.
 *
 * A 404 is kept separate from other errors: it means the task is gone (the store
 * is in-memory and does not survive a restart), which the view answers by going
 * back to the list rather than by retrying.
 */
export function useTaskPolling(
  taskId: string,
  options: { intervalMs?: number } = {},
): UseTaskPolling {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  const task = ref<TaskView | undefined>(undefined)
  const error = ref<string | undefined>(undefined)
  const notFound = ref(false)

  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  function stop(): void {
    stopped = true
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function isActive(): boolean {
    const current = task.value
    return current === undefined || ACTIVE_STATUSES.includes(current.status)
  }

  async function tick(): Promise<void> {
    try {
      task.value = await getTask(taskId)
      error.value = undefined
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        notFound.value = true
        stop()
        return
      }
      // Transient failures must not end the watch: the task is still running.
      error.value = cause instanceof ApiError ? cause.message : '请求失败'
    }

    if (stopped || !isActive()) return
    timer = setTimeout(tick, intervalMs)
  }

  function start(): void {
    stopped = false
    void tick()
  }

  onUnmounted(stop)

  return { task, error, notFound, start, stop }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web && pnpm vitest run src/composables/__tests__/useTaskPolling.test.ts`
Expected: PASS（7 个用例）

- [ ] **Step 5: 写 TaskSteps.vue**

创建 `web/src/components/TaskSteps.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { TaskView } from '../api/client.js'

const props = defineProps<{ task: TaskView }>()

/**
 * Four steps against five server statuses: 'building' covers both image
 * generation and the vite build. providerCalls carries the sub-progress, which
 * beats inventing a status the runner would have to maintain.
 */
const currentStep = computed(() => {
  switch (props.task.status) {
    case 'queued':
      return 0
    case 'drafting':
      return 1
    case 'building':
      return 2
    default:
      return 3
  }
})

const status = computed(() => (props.task.status === 'failed' ? 'error' : 'process'))

const buildDescription = computed(() =>
  props.task.providerCalls === undefined ? '生成图片 + vite build' : `已生成 ${props.task.providerCalls} 张图`,
)

const draftDescription = computed(() =>
  props.task.specAttempts === undefined ? 'LLM 产出 spec' : `第 ${props.task.specAttempts} 次尝试通过`,
)

const elapsed = computed(() => {
  const { createdAt, finishedAt } = props.task
  if (finishedAt === undefined) return undefined
  return `${((finishedAt - createdAt) / 1000).toFixed(1)}s`
})
</script>

<template>
  <a-space direction="vertical" size="middle" style="width: 100%">
    <a-steps :current="currentStep" :status="status" size="small">
      <a-step title="排队" />
      <a-step title="draft spec" :description="draftDescription" />
      <a-step title="构建" :description="buildDescription" />
      <a-step title="完成" :description="elapsed" />
    </a-steps>

    <a-alert
      v-if="task.error !== undefined"
      type="error"
      show-icon
      :message="task.error.message"
      :description="task.error.detail"
    />
  </a-space>
</template>
```

- [ ] **Step 6: 写 TaskDetail.vue（本任务先只放 Steps + iframe，左树在 Task 8 接入）**

创建 `web/src/views/TaskDetail.vue`：

```vue
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TaskSteps from '../components/TaskSteps.vue'
import { useTaskPolling } from '../composables/useTaskPolling.js'

const route = useRoute()
const router = useRouter()
const taskId = String(route.params.id)

const { task, error, notFound, start } = useTaskPolling(taskId)

onMounted(start)

const previewSrc = computed(() =>
  task.value?.status === 'ready' ? `/preview/${taskId}/` : undefined,
)
</script>

<template>
  <a-space direction="vertical" size="large" style="width: 100%">
    <a-page-header title="任务详情" :sub-title="taskId" @back="router.push('/')" />

    <a-result
      v-if="notFound"
      status="404"
      title="任务不存在"
      sub-title="任务表是内存态，服务重启后历史任务不会保留。"
    >
      <template #extra>
        <a-button type="primary" @click="router.push('/')">回到列表</a-button>
      </template>
    </a-result>

    <template v-else-if="task !== undefined">
      <a-card>
        <TaskSteps :task="task" />
      </a-card>

      <a-alert v-if="error !== undefined" type="warning" show-icon :message="error" />

      <a-card title="预览" :body-style="{ padding: 0 }">
        <iframe
          v-if="previewSrc !== undefined"
          :src="previewSrc"
          title="生成站点预览"
          style="width: 100%; height: 600px; border: 0; display: block"
        />
        <a-empty v-else description="构建完成后这里显示预览" style="padding: 48px" />
      </a-card>
    </template>

    <a-skeleton v-else active />
  </a-space>
</template>
```

- [ ] **Step 7: 验收**

Run: `cd web && pnpm test && pnpm typecheck`
Expected: 测试 24 个通过（10 + 7 + 7），typecheck 无输出

Run: `cd web && pnpm build`
Expected: 构建成功（两个视图都已存在了）

---

## Task 8: 结构树 + 资产面板（布局 B 的左侧）

**Files:**
- Create: `web/src/components/SpecTree.vue`
- Create: `web/src/components/__tests__/specTree.test.ts`
- Create: `web/src/components/AssetPanel.vue`
- Modify: `web/src/views/TaskDetail.vue`（改成左树右预览的 Sider 布局）

**Interfaces:**
- Consumes: `SpecView`、`AssetView`、`PageView`、`assetImageUrl`、`getSpec` from `../api/client.js`（Task 5）
- Produces:
  - `buildTreeData(spec: SpecView): TreeNode[]`（从 `SpecTree.vue` 旁的 `specTree.ts` 导出，便于单测）
  - `interface TreeNode { key: string; title: string; children?: TreeNode[]; kind: 'page' | 'block' | 'asset'; route?: string; assetId?: string }`
  - `SpecTree.vue` — props `{ spec: SpecView }`，emits `select-page(route: string)`、`select-asset(assetId: string)`
  - `AssetPanel.vue` — props `{ taskId: string; asset: AssetView }`

树的构建逻辑抽到单独的 `.ts` 里，因为纯函数比挂载组件好测得多。

- [ ] **Step 1: 写树构建的失败测试**

创建 `web/src/components/__tests__/specTree.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { buildTreeData } from '../specTree.js'
import type { SpecView } from '../../api/client.js'

function specWith(pages: SpecView['pages'], assets: SpecView['assets'] = []): SpecView {
  return {
    meta: { name: 'Acme', description: 'd', targetStack: 'vue3' },
    theme: {},
    styleBible: {},
    pages,
    assets,
  }
}

describe('buildTreeData', () => {
  it('makes one node per page, keyed by route', () => {
    const tree = buildTreeData(
      specWith([
        { route: '/', name: 'Home', blocks: [] },
        { route: '/about', name: 'About', blocks: [] },
      ]),
    )

    expect(tree).toHaveLength(2)
    expect(tree[0]!.kind).toBe('page')
    expect(tree[0]!.route).toBe('/')
    expect(tree[1]!.route).toBe('/about')
  })

  it('nests blocks under their page', () => {
    const tree = buildTreeData(
      specWith([
        {
          route: '/',
          name: 'Home',
          blocks: [
            { component: 'HeroBlock', props: {}, assetBindings: {} },
            { component: 'FeatureGrid', props: {}, assetBindings: {} },
          ],
        },
      ]),
    )

    expect(tree[0]!.children).toHaveLength(2)
    expect(tree[0]!.children![0]!.kind).toBe('block')
    expect(tree[0]!.children![0]!.title).toContain('HeroBlock')
  })

  it('nests bound assets under their block and labels the slot', () => {
    const tree = buildTreeData(
      specWith(
        [
          {
            route: '/',
            name: 'Home',
            blocks: [
              { component: 'HeroBlock', props: {}, assetBindings: { image: 'hero-art' } },
            ],
          },
        ],
        [
          {
            id: 'hero-art',
            prompt: 'a robot',
            alt: 'robot',
            aspectRatio: '16:9',
            renderSize: { w: 1280, h: 720 },
            transparent: false,
            contentHash: '0123456789abcdef',
          },
        ],
      ),
    )

    const assetNode = tree[0]!.children![0]!.children![0]!
    expect(assetNode.kind).toBe('asset')
    expect(assetNode.assetId).toBe('hero-art')
    // The slot name is the whole point of this view: it shows where the image lands.
    expect(assetNode.title).toContain('image')
    expect(assetNode.title).toContain('hero-art')
  })

  it('leaves a block with no bindings childless rather than empty-parented', () => {
    const tree = buildTreeData(
      specWith([
        { route: '/', name: 'Home', blocks: [{ component: 'TextBlock', props: {}, assetBindings: {} }] },
      ]),
    )

    expect(tree[0]!.children![0]!.children).toBeUndefined()
  })

  it('produces unique keys across pages that reuse the same component', () => {
    const tree = buildTreeData(
      specWith([
        { route: '/', name: 'Home', blocks: [{ component: 'HeroBlock', props: {}, assetBindings: {} }] },
        { route: '/b', name: 'B', blocks: [{ component: 'HeroBlock', props: {}, assetBindings: {} }] },
      ]),
    )

    const keys = [tree[0]!.children![0]!.key, tree[1]!.children![0]!.key]
    expect(new Set(keys).size).toBe(2)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && pnpm vitest run src/components`
Expected: FAIL — `Cannot find module '../specTree.js'`

- [ ] **Step 3: 写树构建实现**

创建 `web/src/components/specTree.ts`：

```ts
import type { SpecView } from '../api/client.js'

export interface TreeNode {
  key: string
  title: string
  kind: 'page' | 'block' | 'asset'
  children?: TreeNode[]
  route?: string
  assetId?: string
}

/**
 * Turns the spec projection into the tree that makes this console worth having:
 * page → block → the slot each asset is bound to. Seeing the slot name next to
 * the asset is how a wrong binding becomes visible at a glance.
 */
export function buildTreeData(spec: SpecView): TreeNode[] {
  return spec.pages.map((page, pageIndex) => {
    const blocks: TreeNode[] = page.blocks.map((block, blockIndex) => {
      const bindings = Object.entries(block.assetBindings)
      const assets: TreeNode[] = bindings.map(([slot, assetId]) => ({
        key: `p${pageIndex}-b${blockIndex}-${slot}`,
        title: `${slot} → ${assetId}`,
        kind: 'asset' as const,
        assetId,
      }))

      return {
        key: `p${pageIndex}-b${blockIndex}`,
        title: block.component,
        kind: 'block' as const,
        // Omit the array entirely when empty: a-tree renders an expander for [].
        ...(assets.length === 0 ? {} : { children: assets }),
      }
    })

    return {
      key: `p${pageIndex}`,
      title: `${page.route}  ${page.name}`,
      kind: 'page' as const,
      route: page.route,
      ...(blocks.length === 0 ? {} : { children: blocks }),
    }
  })
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web && pnpm vitest run src/components`
Expected: PASS（5 个用例）

- [ ] **Step 5: 写 SpecTree.vue**

创建 `web/src/components/SpecTree.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { SpecView } from '../api/client.js'
import { buildTreeData, type TreeNode } from './specTree.js'

const props = defineProps<{ spec: SpecView }>()
const emit = defineEmits<{
  'select-page': [route: string]
  'select-asset': [assetId: string]
}>()

const treeData = computed(() => buildTreeData(props.spec))

function onSelect(_keys: unknown, info: { node: TreeNode }): void {
  const node = info.node
  if (node.kind === 'page' && node.route !== undefined) emit('select-page', node.route)
  if (node.kind === 'asset' && node.assetId !== undefined) emit('select-asset', node.assetId)
}
</script>

<template>
  <a-tree
    :tree-data="treeData"
    default-expand-all
    :show-line="true"
    block-node
    @select="onSelect"
  />
</template>
```

- [ ] **Step 6: 写 AssetPanel.vue**

创建 `web/src/components/AssetPanel.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { assetImageUrl, type AssetView } from '../api/client.js'

const props = defineProps<{ taskId: string; asset: AssetView }>()

const src = computed(() => assetImageUrl(props.taskId, props.asset.contentHash))
</script>

<template>
  <a-card :title="`资产 ${asset.id}`" size="small">
    <a-row :gutter="16">
      <a-col :xs="24" :md="10">
        <a-image :src="src" :alt="asset.alt" style="max-width: 100%" />
      </a-col>
      <a-col :xs="24" :md="14">
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="几何">
            {{ asset.aspectRatio }} · {{ asset.renderSize.w }}×{{ asset.renderSize.h }}
          </a-descriptions-item>
          <a-descriptions-item label="透明底">
            {{ asset.transparent ? '是' : '否' }}
          </a-descriptions-item>
          <a-descriptions-item label="alt">{{ asset.alt }}</a-descriptions-item>
          <a-descriptions-item label="contentHash">
            <a-typography-text code copyable>{{ asset.contentHash }}</a-typography-text>
          </a-descriptions-item>
          <a-descriptions-item label="prompt">
            <a-typography-paragraph :copyable="{ text: asset.prompt }" style="margin: 0">
              {{ asset.prompt }}
            </a-typography-paragraph>
          </a-descriptions-item>
        </a-descriptions>
      </a-col>
    </a-row>
  </a-card>
</template>
```

- [ ] **Step 7: 改 TaskDetail.vue 成布局 B**

整体替换 `web/src/views/TaskDetail.vue`：

```vue
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AssetPanel from '../components/AssetPanel.vue'
import SpecTree from '../components/SpecTree.vue'
import TaskSteps from '../components/TaskSteps.vue'
import { useTaskPolling } from '../composables/useTaskPolling.js'
import { ApiError, getSpec, type SpecView } from '../api/client.js'

const route = useRoute()
const router = useRouter()
const taskId = String(route.params.id)

const { task, error, notFound, start } = useTaskPolling(taskId)
const spec = ref<SpecView | undefined>(undefined)
const selectedRoute = ref('/')
const selectedAssetId = ref<string | undefined>(undefined)
const collapsed = ref(false)

onMounted(start)

/**
 * The spec appears partway through the run, so fetch it on the first status that
 * can have one. 409 simply means "not yet" — keep the previous value and let the
 * next status change try again.
 */
watch(
  () => task.value?.status,
  async (status) => {
    if (status === undefined || spec.value !== undefined) return
    if (status === 'queued') return
    try {
      spec.value = await getSpec(taskId)
    } catch (cause) {
      if (!(cause instanceof ApiError) || cause.status !== 409) throw cause
    }
  },
  { immediate: true },
)

const previewSrc = computed(() => {
  if (task.value?.status !== 'ready') return undefined
  // Generated projects use hash history with base './', so the route is a hash.
  return `/preview/${taskId}/#${selectedRoute.value}`
})

const selectedAsset = computed(() =>
  spec.value?.assets.find((asset) => asset.id === selectedAssetId.value),
)

function onSelectPage(nextRoute: string): void {
  selectedRoute.value = nextRoute
  selectedAssetId.value = undefined
}
</script>

<template>
  <a-space direction="vertical" size="large" style="width: 100%">
    <a-page-header title="任务详情" :sub-title="taskId" @back="router.push('/')" />

    <a-result
      v-if="notFound"
      status="404"
      title="任务不存在"
      sub-title="任务表是内存态，服务重启后历史任务不会保留。"
    >
      <template #extra>
        <a-button type="primary" @click="router.push('/')">回到列表</a-button>
      </template>
    </a-result>

    <template v-else-if="task !== undefined">
      <a-card>
        <TaskSteps :task="task" />
      </a-card>

      <a-alert v-if="error !== undefined" type="warning" show-icon :message="error" />

      <a-layout style="background: transparent">
        <a-layout-sider
          v-model:collapsed="collapsed"
          :width="280"
          collapsible
          breakpoint="lg"
          theme="light"
          style="border-radius: 8px; margin-right: 16px"
        >
          <div v-show="!collapsed" style="padding: 12px">
            <SpecTree
              v-if="spec !== undefined"
              :spec="spec"
              @select-page="onSelectPage"
              @select-asset="selectedAssetId = $event"
            />
            <a-empty v-else description="spec 产出后显示结构" />
          </div>
        </a-layout-sider>

        <a-layout-content>
          <a-space direction="vertical" size="middle" style="width: 100%">
            <AssetPanel
              v-if="selectedAsset !== undefined"
              :task-id="taskId"
              :asset="selectedAsset"
            />

            <a-card title="预览" :body-style="{ padding: 0 }">
              <template #extra>
                <a-typography-text type="secondary">{{ selectedRoute }}</a-typography-text>
              </template>
              <!--
                Keyed on the route so switching pages remounts the iframe. Whether
                changing only the hash reloads is inconsistent across browsers, and
                dist is local static files, so a reload costs tens of milliseconds.
              -->
              <iframe
                v-if="previewSrc !== undefined"
                :key="previewSrc"
                :src="previewSrc"
                title="生成站点预览"
                style="width: 100%; height: 600px; border: 0; display: block"
              />
              <a-empty v-else description="构建完成后这里显示预览" style="padding: 48px" />
            </a-card>
          </a-space>
        </a-layout-content>
      </a-layout>
    </template>

    <a-skeleton v-else active />
  </a-space>
</template>
```

- [ ] **Step 8: 验收**

Run: `cd web && pnpm test && pnpm typecheck && pnpm build`
Expected: 测试 29 个通过（10 + 7 + 7 + 5），typecheck 与 build 均成功

---

## Task 9: 导出按钮 + 重试按钮

**Files:**
- Create: `web/src/components/ExportButtons.vue`
- Create: `web/src/components/__tests__/exportButtons.test.ts`
- Modify: `web/src/views/TaskDetail.vue`（把按钮放进 PageHeader 的 extra）

**Interfaces:**
- Consumes: `exportUrl`、`retryTask`、`TaskView` from `../api/client.js`（Task 5）
- Produces: `ExportButtons.vue` — props `{ task: TaskView }`，emits `retried(newTaskId: string)`
- Produces: `canExportSource(task: TaskView): boolean`、`canExportDist(task: TaskView): boolean`（从 `exportRules.ts` 导出）

可下载条件要与服务端一致：**源码在 `failed` 时仍可下**（工作区未回收，这是排查构建失败的主要途径），但 `queued` 不行（工作区在 draft 成功后才 allocate）；dist 仅 `ready` 可下。

- [ ] **Step 1: 写规则的失败测试**

创建 `web/src/components/__tests__/exportButtons.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { canExportDist, canExportSource } from '../exportRules.js'
import type { TaskStatus, TaskView } from '../../api/client.js'

function taskAt(status: TaskStatus): TaskView {
  return { id: 'abc', status, description: 'x', createdAt: 1 }
}

describe('canExportSource', () => {
  it('allows a ready task', () => {
    expect(canExportSource(taskAt('ready'))).toBe(true)
  })

  it('allows a failed task — the workspace survives and is how you debug it', () => {
    expect(canExportSource(taskAt('failed'))).toBe(true)
  })

  it('allows a task mid-build', () => {
    expect(canExportSource(taskAt('building'))).toBe(true)
  })

  it('refuses a queued task, whose workspace is not allocated yet', () => {
    expect(canExportSource(taskAt('queued'))).toBe(false)
  })

  it('refuses a task still drafting', () => {
    // allocate() runs only after drafting succeeds.
    expect(canExportSource(taskAt('drafting'))).toBe(false)
  })
})

describe('canExportDist', () => {
  it('allows only a ready task', () => {
    expect(canExportDist(taskAt('ready'))).toBe(true)
    expect(canExportDist(taskAt('failed'))).toBe(false)
    expect(canExportDist(taskAt('building'))).toBe(false)
    expect(canExportDist(taskAt('queued'))).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && pnpm vitest run src/components/__tests__/exportButtons.test.ts`
Expected: FAIL — `Cannot find module '../exportRules.js'`

- [ ] **Step 3: 写规则实现**

创建 `web/src/components/exportRules.ts`：

```ts
import type { TaskView } from '../api/client.js'

/**
 * Mirrors the server's gate, which checks whether the workspace directory exists
 * rather than whether the task succeeded. `runTask` leaves the workspace in place
 * on failure, and that source is the main way to debug a failed build. The
 * workspace is allocated only after drafting succeeds, so the earlier statuses
 * have nothing to export.
 */
export function canExportSource(task: TaskView): boolean {
  return task.status === 'building' || task.status === 'ready' || task.status === 'failed'
}

/** dist exists only when the build finished. */
export function canExportDist(task: TaskView): boolean {
  return task.status === 'ready'
}
```

注意 `failed` 也返回 true 会有一个已知的松散边界：draft 阶段就失败的任务同样是 `failed`，但工作区没分配，服务端会回 409。前端无法从 `TaskView` 区分两种 `failed`（`status` 一样），所以这里选择让按钮可点、由服务端的 409 兜底——而不是为此在 `toView()` 里加字段（那会动白名单）。

**这条边界的代价要说清**：导出用的是原生 `<a download>`，浏览器对 409 的反应是跳去显示那段 JSON，而不是触发下载——按钮点下去没有任何前端提示。两种 `failed` 里只有 draft 阶段失败那种会撞上，这是最少见的一种，所以这里接受它，不为此把下载改成 `fetch` + `Blob`（那要自己管内存与 revokeObjectURL，而导出包可能有几十 MB）。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web && pnpm vitest run src/components/__tests__/exportButtons.test.ts`
Expected: PASS（6 个用例）

- [ ] **Step 5: 写 ExportButtons.vue**

创建 `web/src/components/ExportButtons.vue`：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ApiError, exportUrl, retryTask, type TaskView } from '../api/client.js'
import { canExportDist, canExportSource } from './exportRules.js'

const props = defineProps<{ task: TaskView }>()
const emit = defineEmits<{ retried: [newTaskId: string] }>()

const retrying = ref(false)

const sourceHref = computed(() => exportUrl(props.task.id, 'source'))
const distHref = computed(() => exportUrl(props.task.id, 'dist'))
const sourceEnabled = computed(() => canExportSource(props.task))
const distEnabled = computed(() => canExportDist(props.task))

async function onRetry(): Promise<void> {
  retrying.value = true
  try {
    const created = await retryTask(props.task.id)
    message.success('已新建重试任务')
    emit('retried', created.id)
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 503) {
      message.warning('队列已满，稍后再试')
    } else {
      message.error(cause instanceof ApiError ? cause.message : '重试失败')
    }
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <a-space>
    <a-button :disabled="!sourceEnabled" :href="sourceEnabled ? sourceHref : undefined" download>
      导出源码
    </a-button>
    <a-button :disabled="!distEnabled" :href="distEnabled ? distHref : undefined" download>
      导出 dist
    </a-button>
    <a-button type="primary" :loading="retrying" @click="onRetry">重试</a-button>
  </a-space>
</template>
```

- [ ] **Step 6: 接进 TaskDetail.vue**

在 `web/src/views/TaskDetail.vue` 的 script 里加 import：

```ts
import ExportButtons from '../components/ExportButtons.vue'
```

把模板里的 `a-page-header` 替换成带 extra 的版本：

```vue
      <a-page-header title="任务详情" :sub-title="taskId" @back="router.push('/')">
        <template #extra>
          <ExportButtons
            v-if="task !== undefined"
            :task="task"
            @retried="router.push(`/task/${$event}`)"
          />
        </template>
      </a-page-header>
```

注意：这个 `a-page-header` 现在要移到 `v-else-if="task !== undefined"` 的 template 内部，或者在 extra 上保留 `v-if`——按上面写法保留 `v-if` 即可，`notFound` 时 `task` 为 undefined，按钮不渲染。

- [ ] **Step 7: 验收**

Run: `cd web && pnpm test && pnpm typecheck && pnpm build`
Expected: 测试 35 个通过（29 + 6），typecheck 与 build 均成功

---

## Task 10: 生产同源服务 web/dist

**Files:**
- Modify: `server/src/app.ts`（新增兜底静态路由 + `AppDeps.webDistDir`）
- Modify: `server/src/main.ts`（传入 web dist 路径）
- Modify: `server/src/config.ts`（新增 `webDistDir`）
- Modify: `server/src/__tests__/app.test.ts`

**Interfaces:**
- Consumes: `openPreviewFile` from `./preview.js`（已有）
- Produces: `AppDeps.webDistDir?: string`；`ServerConfig.webDistDir: string`

**为什么必须同源**：预览响应带 `frame-ancestors 'self'`。若控制台部署在别的域名或端口，iframe 会被浏览器直接拦掉。这不是部署偏好，是 CSP 的硬要求。

兜底路由必须放在**所有** API 路由之后，且不能吃掉 `/preview/*`、`/tasks/*`、`/health`。

- [ ] **Step 1: 写失败测试**

追加到 `server/src/__tests__/app.test.ts`：

```ts
describe('web console hosting', () => {
  it('serves the console index at the root when a dist is configured', async () => {
    const webDistDir = await mkdtemp(join(tmpdir(), 'vudt-web-'))
    cleanups.push(async () => {
      await rm(webDistDir, { recursive: true, force: true })
    })
    await writeFile(join(webDistDir, 'index.html'), '<!doctype html><title>console</title>')

    const harness = await makeApp({ webDistDir })
    track(harness)

    const response = await harness.app.inject({ method: 'GET', url: '/' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8')
    expect(response.body).toContain('console')
  })

  it('falls back to index.html for a client route so deep links work', async () => {
    const webDistDir = await mkdtemp(join(tmpdir(), 'vudt-web-'))
    cleanups.push(async () => {
      await rm(webDistDir, { recursive: true, force: true })
    })
    await writeFile(join(webDistDir, 'index.html'), '<!doctype html><title>console</title>')

    const harness = await makeApp({ webDistDir })
    track(harness)

    // history mode: /tasks/<id> is a client route, but /tasks IS an API path, so
    // this asserts the fallback does not shadow the API.
    const api = await harness.app.inject({ method: 'GET', url: '/tasks' })
    expect(api.statusCode).toBe(200)
    expect(api.json()).toHaveProperty('tasks')
  })

  it('does not shadow the preview route', async () => {
    const webDistDir = await mkdtemp(join(tmpdir(), 'vudt-web-'))
    cleanups.push(async () => {
      await rm(webDistDir, { recursive: true, force: true })
    })
    await writeFile(join(webDistDir, 'index.html'), '<!doctype html><title>console</title>')

    const harness = await makeApp({ webDistDir })
    track(harness)

    const response = await harness.app.inject({
      method: 'GET',
      url: '/preview/00000000-0000-4000-8000-000000000000/',
    })
    // 404 from the preview handler, not the console index.
    expect(response.statusCode).toBe(404)
    expect(response.body).not.toContain('console')
  })

  it('404s the root when no dist is configured', async () => {
    const harness = await makeApp()
    track(harness)

    const response = await harness.app.inject({ method: 'GET', url: '/' })

    expect(response.statusCode).toBe(404)
  })
})
```

在该测试文件顶部的 import 里补上 `writeFile`：

```ts
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd server && pnpm vitest run src/__tests__/app.test.ts -t "web console"`
Expected: FAIL — 根路径返回 404 而非 200

- [ ] **Step 3: 加 `webDistDir` 到 AppDeps**

在 `server/src/app.ts` 的 `AppDeps` 接口里加：

```ts
  /** Built console, served same-origin because previews set frame-ancestors 'self'. */
  webDistDir?: string
```

- [ ] **Step 4: 挂兜底路由**

在 `server/src/app.ts` 中，**所有其他路由之后**、`return Object.assign(...)` 之前插入：

```ts
  const webDistDir = deps.webDistDir
  if (webDistDir !== undefined) {
    /**
     * Console hosting. Registered last so every API path above wins, and scoped
     * to a setNotFoundHandler rather than a catch-all GET so it cannot shadow
     * /tasks, /preview or /health.
     */
    app.setNotFoundHandler(async (request, reply) => {
      if (request.method !== 'GET') {
        return reply.code(404).send({ error: 'not found' })
      }

      // Anything that belongs to the API surface must 404 as the API, not as the
      // console shell — otherwise a typo'd endpoint returns HTML and hides the bug.
      // Note the console's detail route is singular (/task/:id) precisely so it does
      // not collide with this /tasks prefix and can reach the shell on a hard reload.
      const path = request.url.split('?')[0] ?? '/'
      if (path.startsWith('/tasks') || path.startsWith('/preview') || path.startsWith('/health')) {
        return reply.code(404).send({ error: 'not found' })
      }

      const asset = await openPreviewFile(webDistDir, path === '/' ? 'index.html' : path.slice(1))
      const file = asset ?? (await openPreviewFile(webDistDir, 'index.html'))
      if (file === null) return reply.code(404).send({ error: 'not found' })

      return reply
        .header('content-type', file.contentType)
        .header('content-length', String(file.size))
        .header('x-content-type-options', 'nosniff')
        .send(file.stream())
    })
  }
```

`openPreviewFile` 已带路径穿越防护（`resolve` 之后校验前缀），所以这里复用它而不是自己拼路径。

- [ ] **Step 5: 跑测试确认通过**

Run: `cd server && pnpm vitest run src/__tests__/app.test.ts -t "web console"`
Expected: PASS（4 个用例）

- [ ] **Step 6: 接进 config 与 main**

`server/src/config.ts` — 在 `ServerConfig` 接口加：

```ts
  /** Built console. Must be same-origin with the API (preview CSP requirement). */
  webDistDir: string
```

在 `loadConfig` 的返回对象里加：

```ts
    webDistDir: resolve(cwd, env.VUDT_WEB_DIST_DIR ?? 'web/dist'),
```

`server/src/main.ts` — 在 `buildApp({...})` 的参数里加：

```ts
    webDistDir: config.webDistDir,
```

- [ ] **Step 7: 验收全仓**

Run: `cd /d/zw/vue-ui-design-template && pnpm -r test`
Expected: 全绿。累计：spec 13、blocks 28、codegen 37、imagegen 29、providers 36、build 25、server 55、web 35 = 258 个用例。

Run: `cd /d/zw/vue-ui-design-template && pnpm -r typecheck`
Expected: 无错误输出

- [ ] **Step 8: 端到端手动验证**

```bash
# 终端 1
cd web && pnpm build
cd .. && VUDT_SPEC_API_KEY=<key> VUDT_IMAGE_API_KEY=<key> node --experimental-strip-types server/src/main.ts
```

浏览器开 `http://127.0.0.1:4300/`，确认：
1. 提交描述后列表出现 queued 任务，状态自动推进（轮询生效）
2. 详情页 Steps 走到「完成」，iframe 显示生成的站点
3. 左树点不同页面，右侧 iframe 跟着跳（hash 变化）
4. 左树点资产，上方浮出该图 + prompt
5. 两个导出按钮都能下到 zip，源码包里**没有** `node_modules`
6. 重试按钮建出新任务并跳转过去

---

## 完成标准

- 服务端 55 个用例、web 35 个用例、全仓 258 个用例全绿
- `pnpm -r typecheck` 无错误
- 上面第 8 步的六项手动验证全部通过
- 源码导出包内不含 `node_modules/`（自动化已覆盖，手动再确认一次体积）
