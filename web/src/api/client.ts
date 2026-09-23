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
  assetsDone?: number
  assetsTotal?: number
  error?: { message: string; detail?: string }
  /** Snapshot taken when the task was created; Task 9 renders it. */
  settings?: EffectiveSettings
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

/**
 * `bodyExcerpt` and `hint` are third-party relay text. The server redacts the
 * literal key out of the excerpt, but it stays untrusted: render as text only,
 * never through v-html.
 */
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
