import { buildTask, WorkspaceRoot, type BuildLimits } from '@vudt/build'
import type { ImageCache, ImageProcessor, ImageProvider } from '@vudt/imagegen'
import { ServerError } from './errors.js'
import type { EffectiveSettings } from './settings.js'
import { draftSpec, type SpecDrafter } from './spec-source.js'
import type { TaskStore } from './store.js'
import type { RequestObserver } from '@vudt/providers'
import { TaskObservability, type TaskStage } from './task-observability.js'

export interface RunnerDeps {
  store: TaskStore
  workspaces: WorkspaceRoot
  drafter: (settings: EffectiveSettings['spec'], onRequest?: RequestObserver) => SpecDrafter
  provider: (settings: EffectiveSettings['image'], onRequest?: RequestObserver) => ImageProvider
  /** Fallback for a record written before snapshots existed. */
  settings: EffectiveSettings
  cache?: ImageCache
  processor?: ImageProcessor
  templateDir: string
  adminTemplateDir?: string
  maxAssets: number
  specAttempts: number
  limits?: BuildLimits
  /** Keeps the dist around for preview; disposal is the caller's business. */
  keepWorkspace?: boolean
}

function describeError(error: unknown): { message: string; detail?: string } {
  if (error instanceof ServerError) {
    return error.detail === undefined
      ? { message: error.message }
      : { message: error.message, detail: error.detail }
  }
  if (error instanceof Error) {
    const detail = (error as { detail?: unknown }).detail
    if (typeof detail === 'string') return { message: error.message, detail }
    return { message: error.message }
  }
  return { message: String(error) }
}

/**
 * One task, end to end: draft a spec, then run the build pipeline.
 *
 * Never throws — the queue has no caller to report to, so every outcome is
 * written onto the task record and read back through `GET /tasks/:id`.
 */
export async function runTask(taskId: string, deps: RunnerDeps): Promise<void> {
  const { store } = deps
  const task = store.get(taskId)
  if (task === undefined) return

  const trace = new TaskObservability()
  let stage: TaskStage = 'queued'
  const phase = (next: TaskStage) => {
    if (stage !== 'queued' && stage !== 'validation') trace.event(stage, 'succeeded', '阶段完成')
    stage = next
    store.update(taskId, { stage, stageStartedAt: Date.now() })
    trace.event(stage, 'started', '开始执行')
  }
  const onRequest: RequestObserver = request => {
    const id = trace.startRequest(request)
    trace.event(stage, 'started', request.kind === 'structure' ? '等待结构模型响应' : `等待图片模型响应：${request.assetId ?? ''}`)
    return status => {
      trace.finishRequest(id, status)
      trace.event(stage, status, status === 'failed' ? '模型请求失败' : '模型请求完成')
    }
  }
  store.update(taskId, { status: 'drafting', startedAt: Date.now(), observability: trace })
  const settings = task.settings ?? deps.settings

  try {
    const { spec, attempts } = await draftSpec(deps.drafter(settings.spec, onRequest), task.description, {
      maxAttempts: deps.specAttempts,
      onValidation: state => {
        if (state === 'started') phase('validation')
        else trace.event('validation', state, state === 'failed' ? '校验未通过，将反馈给下一次请求' : '结构校验通过')
      },
      // 回调是同步的，store.update 也是同步的：写入顺序与循环顺序严格一致，
      // 所以 specAttempts 单调不减，前端可以直接渲染。
      onAttempt: (attempt) => {
        phase('drafting')
        store.update(taskId, { specAttempts: attempt })
      },
    })
    store.update(taskId, { status: 'building', spec, specAttempts: attempts })

    const workspace = await deps.workspaces.allocate(taskId)
    const result = await buildTask(spec, {
      workspace,
      templateDir: deps.templateDir,
      ...(deps.adminTemplateDir ? { adminTemplateDir: deps.adminTemplateDir } : {}),
      provider: deps.provider(settings.image, onRequest),
      onPhase: phase,
      onAsset: (assetId, source) => {
        trace.event('images', source === 'provider' ? 'started' : 'cached', `${source === 'cache' ? '命中图片缓存' : source === 'dedup' ? '复用相同图片' : '准备图片请求'}：${assetId}`)
      },
      maxAssets: deps.maxAssets,
      onProgress: ({ done, total }) => {
        store.update(taskId, { assetsDone: done, assetsTotal: total })
      },
      // node_modules is a junction into the template; a task must never install.
      ...(deps.cache === undefined ? {} : { cache: deps.cache }),
      ...(deps.processor === undefined ? {} : { processor: deps.processor }),
      ...(deps.limits === undefined ? {} : { limits: deps.limits }),
    })

    phase('ready')
    store.update(taskId, {
      status: 'ready',
      finishedAt: Date.now(),
      distDir: result.distDir,
      previewPath: `/preview/${taskId}/`,
      providerCalls: result.images.providerCalls,
    })
  } catch (error) {
    trace.event(stage, 'failed', '任务在此阶段失败，请查看错误详情')
    store.update(taskId, {
      status: 'failed',
      finishedAt: Date.now(),
      error: describeError(error),
    })
  }
}
