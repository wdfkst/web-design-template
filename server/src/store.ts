import type { ProjectSpec } from '@vudt/spec'
import type { EffectiveSettings } from './settings.js'

export type TaskStatus = 'queued' | 'drafting' | 'building' | 'ready' | 'failed'

export interface TaskRecord {
  id: string
  /** Reserved for multi-tenant use; unused while this is an internal tool. */
  ownerId: string | null
  status: TaskStatus
  description: string
  createdAt: number
  startedAt?: number
  finishedAt?: number
  spec?: ProjectSpec
  /** Present once status is 'ready'. */
  previewPath?: string
  distDir?: string
  error?: { message: string; detail?: string }
  providerCalls?: number
  /** 已落盘的 manifest 条目数；building 期间由 runner 逐步写。 */
  assetsDone?: number
  /** 本次任务的条目总数（= spec.assets.length）；同上。 */
  assetsTotal?: number
  specAttempts?: number
  /**
   * The settings this task was created with. Copied at creation so changing
   * settings never rewrites what a queued or running task is doing.
   */
  settings?: EffectiveSettings
}

/**
 * In-memory task table. Deliberately not a database: task output lives in a
 * workspace directory that does not survive a restart either, so persisting the
 * index alone would hand out preview URLs pointing at nothing.
 */
export class TaskStore {
  private readonly tasks = new Map<string, TaskRecord>()

  create(record: TaskRecord): TaskRecord {
    this.tasks.set(record.id, record)
    return record
  }

  get(id: string): TaskRecord | undefined {
    return this.tasks.get(id)
  }

  update(id: string, patch: Partial<TaskRecord>): TaskRecord {
    const current = this.tasks.get(id)
    if (current === undefined) throw new Error(`unknown task: ${id}`)
    const next = { ...current, ...patch }
    this.tasks.set(id, next)
    return next
  }

  list(): TaskRecord[] {
    return [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt)
  }
}
