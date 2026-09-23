import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryImageCache } from '@vudt/imagegen'
import type { ImageProvider } from '@vudt/imagegen'
import { buildApp } from '../app.js'
import { MemorySettingsStore } from '../settings-store.js'
import type { SpecDrafter } from '../spec-source.js'
import {
  FailingProvider,
  GatedDrafter,
  GatedProvider,
  ScriptedDrafter,
  StubProvider,
  landingDraft,
} from './fixture.js'

const here = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = resolve(here, '../../../packages/templates/vue3-base')

type BuildArgs = Parameters<typeof buildApp>[0]

/**
 * Overrides still take provider *instances*: makeApp wraps them in factories, so
 * `harness.drafter` stays the very object a test asserts on (GatedDrafter opens
 * its gate through that identity).
 */
/**
 * Mutually exclusive on purpose: passing both used to silently ignore `drafter`,
 * and a test that passed `drafterFactory` while asserting on `harness.drafter`
 * would have read a fresh instance the app never called. Now it is a type error.
 */
type DrafterOverride<D extends SpecDrafter> =
  | { drafter?: D; drafterFactory?: never }
  /** For the rare test that needs to observe the factory argument itself. */
  | { drafter?: never; drafterFactory: BuildArgs['drafter'] }

type Overrides<D extends SpecDrafter, P extends ImageProvider> = Omit<
  Partial<BuildArgs>,
  'drafter' | 'provider'
> & { provider?: P } & DrafterOverride<D>

/**
 * Generic in the two doubles so `harness.drafter` keeps its concrete type — the
 * default case still exposes `ScriptedDrafter.requests`.
 */
async function makeApp<D extends SpecDrafter = ScriptedDrafter, P extends ImageProvider = StubProvider>(
  overrides: Overrides<D, P> = {},
) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'vudt-server-'))
  const { drafter: drafterOverride, provider: providerOverride, drafterFactory, ...rest } = overrides
  const drafter = drafterOverride ?? new ScriptedDrafter([landingDraft()])
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

type Harness = Awaited<ReturnType<typeof makeApp>>

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup()
})

function track(harness: Harness): void {
  cleanups.push(async () => {
    // Drain first: a test that deliberately leaves a task mid-flight still has
    // a build writing into the workspace, and rm would race it.
    await harness.app.vudt.queue.drain()
    await harness.app.close()
    await rm(harness.workspaceRoot, { recursive: true, force: true })
  })
}

async function post(harness: Harness, description: string, ownerId?: string) {
  return harness.app.inject({
    method: 'POST',
    url: '/tasks',
    payload: ownerId === undefined ? { description } : { description, ownerId },
  })
}

type DraftBlock = { component: string; props: Record<string, unknown>; content?: Record<string, unknown> }
type DraftPage = { route: string; blocks: DraftBlock[] }

/**
 * 共享草稿加一个带图区块，好让测试卡在**第二**张图上、观察到一个非零的计数器。
 * 形状对不上就抛错：一份悄悄只剩一张图的草稿会让 `parkAt: 2` 永远等不到，
 * 测试会挂死而不是失败。
 */
function twoImageDraft(): unknown {
  const draft = landingDraft() as { pages: DraftPage[] }
  const pricing = draft.pages.find((page) => page.route === '/pricing')
  const hero = pricing?.blocks.find((block) => block.component === 'HeroCentered')
  if (hero === undefined) throw new Error('fixture changed: /pricing no longer has a HeroCentered block')
  hero.content = { backdrop: { prompt: 'a pricing dashboard', alt: 'Pricing dashboard' } }
  return draft
}

describe('POST /tasks', () => {
  it('accepts a description and reports a queued task', async () => {
    const harness = await makeApp()
    track(harness)

    const response = await post(harness, 'a landing page for Acme')
    expect(response.statusCode).toBe(202)

    const body = response.json() as { id: string; status: string }
    expect(body.status).toBe('queued')
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('rejects a blank description', async () => {
    const harness = await makeApp()
    track(harness)

    const response = await post(harness, '   ')
    expect(response.statusCode).toBe(400)
    expect(harness.drafter.requests).toHaveLength(0)
  })

  it('rejects an oversized description before it reaches the model', async () => {
    const harness = await makeApp({ maxDescriptionLength: 20 })
    track(harness)

    const response = await post(harness, 'x'.repeat(21))
    expect(response.statusCode).toBe(413)
    expect(harness.drafter.requests).toHaveLength(0)
  })

  it('answers 503 when the queue is full instead of buffering', async () => {
    const harness = await makeApp({ maxPending: 1, concurrency: 1 })
    track(harness)

    const codes: number[] = []
    for (let i = 0; i < 4; i += 1) {
      codes.push((await post(harness, 'page ' + i)).statusCode)
    }
    expect(codes).toContain(503)
  })

  it('keeps ownerId on the record but out of the response', async () => {
    const harness = await makeApp()
    track(harness)

    const response = await post(harness, 'a page', 'owner-1')
    const body = response.json() as Record<string, unknown>
    expect(body.ownerId).toBeUndefined()
    expect(harness.app.vudt.store.get(body.id as string)?.ownerId).toBe('owner-1')
  })

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
    const drafter = new ScriptedDrafter([landingDraft()])
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

  /**
   * The reason the snapshot is taken in createTask() and not in runTask(): a task
   * already in the queue must keep running on the settings it was created with.
   *
   * The gate plus concurrency 1 is what makes this a real guard. Without them the
   * second task would start drafting before save() lands, and reading settings at
   * run time would pass too. Here the second factory call happens strictly after
   * save(), so a run-time read would observe 'new-model'.
   */
  it('keeps a queued task on the settings it was created with', async () => {
    const settingsStore = new MemorySettingsStore({ spec: { model: 'old-model' }, image: {} })
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const gated = new GatedDrafter(gate, landingDraft())
    const seen: string[] = []

    const harness = await makeApp({
      settingsStore,
      concurrency: 1,
      drafterFactory: (settings) => {
        seen.push(settings.model)
        return gated
      },
    })
    track(harness)

    // First task takes the only slot and parks on the gate.
    await post(harness, 'the first page')
    // Second task is queued but cannot start while the slot is held.
    const second = (await post(harness, 'the second page')).json() as { id: string }

    await settingsStore.save({ spec: { model: 'new-model' }, image: {} })
    expect(settingsStore.resolved().settings.spec.model).toBe('new-model')

    release()
    await harness.app.vudt.queue.drain()

    expect(seen).toEqual(['old-model', 'old-model'])
    expect(harness.app.vudt.store.get(second.id)?.settings?.spec.model).toBe('old-model')
  })
})
describe('GET /tasks/:id', () => {
  it('404s an unknown id', async () => {
    const harness = await makeApp()
    track(harness)

    const response = await harness.app.inject({ method: 'GET', url: '/tasks/nope' })
    expect(response.statusCode).toBe(404)
  })

  /**
   * 本次修复的核心回归测试。改动之前，drafting 期间的响应体在 130 秒里逐字节
   * 不变 —— 前端是清白的，字段压根没写。队列在 enqueue 时同步泵动，所以
   * `post` 返回时 runTask 已经同步跑到 `await drafter.draft()` 并停在闸门上。
   */
  it('shows the drafting attempt while the model is still working', async () => {
    let fail = (): void => {}
    const gate = new Promise<void>((_resolve, reject) => {
      fail = () => reject(new Error('drafter is down'))
    })
    const harness = await makeApp({ drafter: new GatedDrafter(gate, landingDraft()) })
    track(harness)

    const { id } = (await post(harness, 'a landing page')).json() as { id: string }

    const body = (await harness.app.inject({ method: 'GET', url: `/tasks/${id}` })).json() as {
      status: string
      specAttempts?: number
    }
    expect(body.status).toBe('drafting')
    expect(body.specAttempts).toBe(1)

    // Reject rather than release: this test is about the drafting window, and
    // releasing would pay for a whole real vite build it does not need.
    fail()
    await harness.app.vudt.queue.drain()
  })

  it('shows image progress while building and keeps it after a failure', async () => {
    let fail = (): void => {}
    const gate = new Promise<void>((_resolve, reject) => {
      fail = () => reject(new Error('image provider is down'))
    })
    const provider = new GatedProvider(gate, 2)

    const harness = await makeApp({
      drafter: new ScriptedDrafter([twoImageDraft()]),
      provider,
      concurrency: 1,
    })
    track(harness)

    const { id } = (await post(harness, 'a landing page')).json() as { id: string }

    // Second image is parked; the first one has already landed and reported.
    await provider.reached
    expect(provider.requests).toHaveLength(2)

    const running = (await harness.app.inject({ method: 'GET', url: `/tasks/${id}` })).json() as {
      status: string
      assetsDone?: number
      assetsTotal?: number
    }
    expect(running.status).toBe('building')
    expect(running.assetsDone).toBe(1)
    expect(running.assetsTotal).toBe(2)

    fail()
    await harness.app.vudt.queue.drain()

    // Decision 5: a failure keeps what the record had already learned.
    const failed = (await harness.app.inject({ method: 'GET', url: `/tasks/${id}` })).json() as {
      status: string
      assetsDone?: number
      assetsTotal?: number
    }
    expect(failed.status).toBe('failed')
    expect(failed.assetsDone).toBe(1)
    expect(failed.assetsTotal).toBe(2)
  })

  it('reports a failure with validator feedback when the model will not comply', async () => {
    const harness = await makeApp({
      drafter: new ScriptedDrafter([{ garbage: true }]),
      specAttempts: 1,
    })
    track(harness)

    const { id } = (await post(harness, 'a page')).json() as { id: string }
    await harness.app.vudt.queue.drain()

    const body = (await harness.app.inject({ method: 'GET', url: '/tasks/' + id })).json() as {
      status: string
      specAttempts?: number
      error?: { detail?: string }
    }
    expect(body.status).toBe('failed')
    expect(body.error?.detail).toBeTruthy()
    // 渐进写意味着一次 drafting 失败会把 specAttempts 留在记录上 —— 这正是
    // draftDescription() 必须有中性 'failed' 分支的全部理由。
    expect(body.specAttempts).toBe(1)
  })
})

describe('GET /preview', () => {
  it('refuses to serve a task that is not ready', async () => {
    const harness = await makeApp()
    track(harness)

    const { id } = (await post(harness, 'a page')).json() as { id: string }
    const response = await harness.app.inject({ method: 'GET', url: '/preview/' + id + '/' })
    expect(response.statusCode).not.toBe(200)
  })

  it('redirects the bare task URL to the directory form', async () => {
    const harness = await makeApp()
    track(harness)

    const { id } = (await post(harness, 'a page')).json() as { id: string }
    const response = await harness.app.inject({ method: 'GET', url: '/preview/' + id })
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/preview/' + id + '/')
  })
})
describe('end to end', () => {
  it('runs a description through every stage and serves the dist', async () => {
    const harness = await makeApp()
    track(harness)

    const { id } = (await post(harness, 'a landing page for Acme')).json() as { id: string }
    await harness.app.vudt.queue.drain()

    const body = (await harness.app.inject({ method: 'GET', url: '/tasks/' + id })).json() as {
      status: string
      previewUrl?: string
      error?: { message: string; detail?: string }
    }
    expect(body.error).toBeUndefined()
    expect(body.status).toBe('ready')
    expect(body.previewUrl).toBe('/preview/' + id + '/')

    const page = await harness.app.inject({ method: 'GET', url: '/preview/' + id + '/' })
    expect(page.statusCode).toBe(200)
    expect(page.headers['content-type']).toBe('text/html; charset=utf-8')
    expect(page.body).toContain('<script')
    // Generated markup is untrusted and served same-origin with the API.
    expect(page.headers['content-security-policy']).toContain("connect-src 'none'")
    expect(page.headers['x-content-type-options']).toBe('nosniff')

    // Every image the manifest declared must really be servable: a dead href
    // builds successfully, which is exactly what the manifest exists to catch.
    const spec = harness.app.vudt.store.get(id)?.spec
    expect(spec?.assets.length).toBeGreaterThan(0)
    for (const asset of spec?.assets ?? []) {
      const image = await harness.app.inject({
        method: 'GET',
        url: '/preview/' + id + '/assets/' + asset.contentHash + '.png',
      })
      expect(image.statusCode).toBe(200)
      expect(image.headers['content-type']).toBe('image/png')
      expect(Number(image.headers['content-length'])).toBeGreaterThan(0)
    }

    const escape = await harness.app.inject({
      method: 'GET',
      url: '/preview/' + id + '/..%2f..%2fpackage.json',
    })
    expect(escape.statusCode).not.toBe(200)
  }, 300_000)
})

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
    // The queue pumps synchronously on enqueue, so a drafter that resolves in a
    // microtask has already stored a spec by the next inject. Gating the draft is
    // the only way to observe the pre-spec window deterministically.
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const harness = await makeApp({ drafter: new GatedDrafter(gate, landingDraft()) })
    track(harness)

    const { id } = (await post(harness, 'a landing page for Acme')).json() as { id: string }
    const response = await harness.app.inject({ method: 'GET', url: '/tasks/' + id + '/spec' })

    expect(response.statusCode).toBe(409)

    // Let the task finish so teardown's drain() does not hang on the gate.
    release()
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

describe('POST /tasks/:id/retry', () => {
  it('creates a new task carrying the original description', async () => {
    const harness = await makeApp({
      drafter: new ScriptedDrafter([landingDraft(), landingDraft()]),
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
      drafter: new ScriptedDrafter([landingDraft(), landingDraft()]),
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
      tasks: { id: string; status: string; description: string }[]
    }
    // The rejected retry must not leave a record stuck in 'queued' forever. The
    // one task that IS still queued is the filler enqueued above, which the
    // queue legitimately accepted — so assert on identity, not on the count.
    const stuck = listed.tasks.filter(
      (task) => task.status === 'queued' && task.description !== 'second description',
    )
    expect(stuck).toEqual([])

    // The retry's own record exists and is marked failed with the queue reason.
    const retried = listed.tasks.filter(
      (task) => task.id !== first.id && task.description === 'a landing page for Acme',
    )
    expect(retried).toHaveLength(1)
    expect(retried[0]!.status).toBe('failed')
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

describe('web console hosting', () => {
  async function makeWebDist(): Promise<string> {
    const webDistDir = await mkdtemp(join(tmpdir(), 'vudt-web-'))
    cleanups.push(async () => {
      await rm(webDistDir, { recursive: true, force: true })
    })
    await writeFile(join(webDistDir, 'index.html'), '<!doctype html><title>console</title>')
    return webDistDir
  }

  it('serves the console index at the root when a dist is configured', async () => {
    const webDistDir = await makeWebDist()
    const harness = await makeApp({ webDistDir })
    track(harness)

    const response = await harness.app.inject({ method: 'GET', url: '/' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8')
    expect(response.body).toContain('console')
  })

  it('falls back to index.html for a client route so deep links work', async () => {
    const webDistDir = await makeWebDist()
    const harness = await makeApp({ webDistDir })
    track(harness)

    const deep = await harness.app.inject({ method: 'GET', url: '/task/abc' })
    expect(deep.statusCode).toBe(200)
    expect(deep.body).toContain('console')

    // /tasks IS an API path, so this asserts the fallback does not shadow it.
    const api = await harness.app.inject({ method: 'GET', url: '/tasks' })
    expect(api.statusCode).toBe(200)
    expect(api.json()).toHaveProperty('tasks')
  })

  it('does not shadow the preview route', async () => {
    const webDistDir = await makeWebDist()
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

describe('settings api', () => {
  /**
   * The /api 404 guard only exists inside setNotFoundHandler, which is only
   * registered when a webDistDir is configured. Without one, Fastify's stock
   * JSON 404 would make the guard test pass whether or not the prefix is listed.
   */
  async function makeWebDist(): Promise<string> {
    const webDistDir = await mkdtemp(join(tmpdir(), 'vudt-web-'))
    cleanups.push(async () => {
      await rm(webDistDir, { recursive: true, force: true })
    })
    await writeFile(join(webDistDir, 'index.html'), '<!doctype html><title>console</title>')
    return webDistDir
  }

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

  /**
   * A typo'd VUDT_*_BASE_URL is operator config, not client input, so the same
   * ServerError that means "your body is wrong" (400) must not be reported as the
   * caller's fault here. It stays loud — no silent fallback to defaults.
   */
  it('reports an env-sourced validation failure as a 500, not a 400', async () => {
    const harness = await makeApp({
      settingsStore: new MemorySettingsStore(undefined, { VUDT_SPEC_BASE_URL: 'not a url' }),
    })
    track(harness)

    const response = await harness.app.inject({ method: 'GET', url: '/api/settings' })

    expect(response.statusCode).toBe(500)
  })

  it('still reports a body-sourced validation failure as a 400 when the env is broken', async () => {
    const harness = await makeApp({
      settingsStore: new MemorySettingsStore(undefined, { VUDT_SPEC_BASE_URL: 'not a url' }),
    })
    track(harness)

    const response = await harness.app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { spec: { baseUrl: 'also not a url' } },
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

  it('501s the probe endpoint when no probe is configured', async () => {
    const harness = await makeApp({ settingsStore: new MemorySettingsStore() })
    track(harness)

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/settings/test',
      payload: { spec: {}, image: {} },
    })

    expect(response.statusCode).toBe(501)
  })

  it('404s an unknown /api path as json, not as the console shell', async () => {
    const webDistDir = await makeWebDist()
    const harness = await makeApp({ settingsStore: new MemorySettingsStore(), webDistDir })
    track(harness)

    const response = await harness.app.inject({ method: 'GET', url: '/api/nope' })

    expect(response.statusCode).toBe(404)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.body).not.toContain('console')
  })
})
