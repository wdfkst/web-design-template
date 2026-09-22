import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import { WorkspaceRoot } from '@vudt/build'
import type { ImageCache, ImageProcessor, ImageProvider } from '@vudt/imagegen'
import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { ServerError } from './errors.js'
import { createDistArchive, createSourceArchive, resolveTaskDir } from './export.js'
import { openPreviewFile } from './preview.js'
import { TaskQueue } from './queue.js'
import { runTask } from './runner.js'
import type { SpecDrafter } from './spec-source.js'
import { toSpecView } from './spec-view.js'
import {
  parseSettingsInput,
  resolveSettings,
  type AppSettings,
  type EffectiveSettings,
  type ResolvedSettings,
} from './settings.js'
import type { ProbeReport } from './settings-probe.js'
import { MemorySettingsStore } from './settings-store.js'
import { TaskStore, type TaskRecord } from './store.js'

/** Structural: both `SettingsStore` and `MemorySettingsStore` satisfy it as-is. */
export interface SettingsLike {
  current(): AppSettings
  resolved(): ResolvedSettings
  save(next: AppSettings): Promise<ResolvedSettings>
}

export interface AppDeps {
  templateDir: string
  workspaceRoot: string
  /** Built per task from that task's settings snapshot, so both paths are identical. */
  drafter: (settings: EffectiveSettings['spec']) => SpecDrafter
  provider: (settings: EffectiveSettings['image']) => ImageProvider
  /** Omitted in tests that do not care; defaults to in-memory empty settings. */
  settingsStore?: SettingsLike
  /**
   * Injected rather than calling `probeSettings` directly: a real probe needs the
   * API keys, and keys must not travel through AppDeps. main.ts passes a closure
   * that already has them; tests pass a stub so no test touches the network.
   */
  probe?: (settings: EffectiveSettings) => Promise<ProbeReport>
  cache?: ImageCache
  processor?: ImageProcessor
  concurrency?: number
  maxPending?: number
  maxAssets?: number
  specAttempts?: number
  buildTimeoutMs?: number
  /** Max characters accepted for a description — the prompt is a cost input. */
  maxDescriptionLength?: number
  /** Built console, served same-origin because previews set frame-ancestors 'self'. */
  webDistDir?: string
  fastify?: FastifyServerOptions
}

const DEFAULT_MAX_DESCRIPTION = 4000

export interface TaskView {
  id: string
  status: TaskRecord['status']
  description: string
  createdAt: number
  finishedAt?: number
  previewUrl?: string
  specAttempts?: number
  providerCalls?: number
  error?: { message: string; detail?: string }
  settings?: EffectiveSettings
}

/** Only fields safe to hand out: no absolute paths, no spec internals. */
function toView(task: TaskRecord): TaskView {
  return {
    id: task.id,
    status: task.status,
    description: task.description,
    createdAt: task.createdAt,
    ...(task.finishedAt === undefined ? {} : { finishedAt: task.finishedAt }),
    ...(task.previewPath === undefined ? {} : { previewUrl: task.previewPath }),
    ...(task.specAttempts === undefined ? {} : { specAttempts: task.specAttempts }),
    ...(task.providerCalls === undefined ? {} : { providerCalls: task.providerCalls }),
    ...(task.error === undefined ? {} : { error: task.error }),
    ...(task.settings === undefined ? {} : { settings: task.settings }),
  }
}

export interface AppContext {
  store: TaskStore
  queue: TaskQueue
  workspaces: WorkspaceRoot
}

export function buildApp(deps: AppDeps): FastifyInstance & { vudt: AppContext } {
  const store = new TaskStore()
  const queue = new TaskQueue({
    ...(deps.concurrency === undefined ? {} : { concurrency: deps.concurrency }),
    ...(deps.maxPending === undefined ? {} : { maxPending: deps.maxPending }),
  })
  const workspaces = new WorkspaceRoot(deps.workspaceRoot)
  const maxDescription = deps.maxDescriptionLength ?? DEFAULT_MAX_DESCRIPTION
  const settingsStore: SettingsLike = deps.settingsStore ?? new MemorySettingsStore()

  const app = Fastify(deps.fastify ?? { logger: false })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ServerError) {
      return reply.code(error.statusCode).send({
        error: error.message,
        ...(error.detail === undefined ? {} : { detail: error.detail }),
      })
    }
    app.log.error(error)
    return reply.code(500).send({ error: 'internal error' })
  })

  app.get('/health', async () => ({
    ok: true,
    queue: { active: queue.active, pending: queue.depth },
  }))

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
    // Snapshot here, not at run time: editing settings must never rewrite what an
    // already-queued task is doing. See `resolveSettings` for why this needs no copy.
    const settings = settingsStore.resolved().settings
    const task = store.create({
      id,
      ownerId,
      status: 'queued',
      description,
      createdAt: Date.now(),
      settings,
    })

    const accepted = queue.enqueue(() =>
      runTask(id, {
        store,
        workspaces,
        drafter: deps.drafter,
        provider: deps.provider,
        settings,
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

  app.get('/tasks', async () => ({ tasks: store.list().map(toView) }))

  app.get('/tasks/:id', async (request) => {
    const { id } = request.params as { id: string }
    const task = store.get(id)
    if (task === undefined) throw new ServerError('unknown task', 404)
    return toView(task)
  })

  // Without this the bare task URL 404s, and `base: './'` makes relative asset
  // hrefs resolve against the directory, so the trailing slash matters.
  app.get('/preview/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.redirect(`/preview/${encodeURIComponent(id)}/`, 302)
  })

  app.get('/preview/:id/*', async (request, reply) => {
    const { id, '*': rest } = request.params as { id: string; '*': string }
    const task = store.get(id)
    if (task === undefined) throw new ServerError('unknown task', 404)
    if (task.status !== 'ready' || task.distDir === undefined) {
      throw new ServerError(`task is ${task.status}, not ready`, 409)
    }

    const file = await openPreviewFile(task.distDir, rest)
    if (file === null) throw new ServerError('not found', 404)

    // Generated markup is untrusted: it is served from the same origin as the
    // API, so the CSP is what keeps a prompt-injected <script> from calling it.
    return reply
      .header('content-type', file.contentType)
      .header('content-length', String(file.size))
      .header('x-content-type-options', 'nosniff')
      .header(
        'content-security-policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'self'",
      )
      .send(file.stream())
  })

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

  app.get('/tasks/:id/spec', async (request) => {
    const { id } = request.params as { id: string }
    const task = store.get(id)
    if (task === undefined) throw new ServerError('unknown task', 404)
    if (task.spec === undefined) {
      throw new ServerError(`task is ${task.status} and has no spec yet`, 409)
    }
    return toSpecView(task.spec)
  })

  /**
   * `resolveSettings` validates env vars with the same `ServerError(..., 400)` it
   * uses for a bad request body, but a typo'd VUDT_*_BASE_URL is operator config,
   * not client input — answering 400 would blame the caller for the server's own
   * misconfiguration. Relabelled to 500 here, the one layer that knows which of the
   * two origins a failure came from. Deliberately NOT a silent fallback to
   * defaults: a broken env var has to stay loud.
   */
  async function resolvingEnv<T>(run: () => T | Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (error) {
      if (error instanceof ServerError && error.statusCode === 400) {
        throw new ServerError(`server settings are misconfigured: ${error.message}`, 500)
      }
      throw error
    }
  }

  app.get('/api/settings', async () => await resolvingEnv(() => settingsStore.resolved()))

  // `parseSettingsInput` throws ServerError(400) for a bad body and the existing
  // setErrorHandler turns that into the 4xx, so the body path needs no try/catch of
  // its own. Only the resolve that follows is wrapped, because only it can fail on
  // env grounds.
  app.put('/api/settings', async (request) => {
    const next = parseSettingsInput(request.body)
    return await resolvingEnv(() => settingsStore.save(next))
  })

  app.post('/api/settings/test', async (request) => {
    // The payload is probed, not the stored settings: the point is to try an
    // address before committing to it.
    const candidate = parseSettingsInput(request.body)
    const { settings } = await resolvingEnv(() => resolveSettings(candidate, process.env))
    if (deps.probe === undefined) {
      throw new ServerError('connectivity testing is not configured', 501)
    }
    return await deps.probe(settings)
  })

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
      // `/api` is in this list for the same reason: a mistyped /api/... must 404 as
      // JSON, because returning the HTML shell makes a broken fetch look like a
      // routing success and hides the bug.
      if (
        path.startsWith('/tasks') ||
        path.startsWith('/preview') ||
        path.startsWith('/health') ||
        path.startsWith('/api')
      ) {
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

  return Object.assign(app, { vudt: { store, queue, workspaces } })
}

/**
 * archiver only starts walking the filesystem once finalize() is called, and it
 * is the stream itself that Fastify sends. Kicking finalize off without awaiting
 * it is intentional: the stream must already be handed to reply.send().
 */
function finalized(archive: import('archiver').Archiver): import('archiver').Archiver {
  void archive.finalize()
  return archive
}
