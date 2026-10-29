export type TaskStage = 'queued' | 'drafting' | 'validation' | 'writing' | 'images' | 'typecheck' | 'vite' | 'ready'
export type EventState = 'started' | 'succeeded' | 'failed' | 'cached'
export interface TaskEvent {
  seq: number
  at: number
  stage: TaskStage
  state: EventState
  message: string
}
export interface RequestInput {
  kind: 'structure' | 'image'
  model: string
  attempt?: number
  assetId?: string
  messages?: { role: string; content: string }[]
  prompt?: string
  parameters?: Record<string, unknown>
}
export interface TaskRequest extends RequestInput {
  id: string
  status: 'pending' | 'succeeded' | 'failed'
  startedAt: number
  finishedAt?: number
  omittedReason?: 'request-too-large'
}
export interface ObservabilitySnapshot {
  revision: number
  events: TaskEvent[]
  requests: TaskRequest[]
  eventsTruncated: boolean
  requestsTruncated: boolean
}
const PARAMETER_KEYS = ['temperature', 'max_tokens', 'response_format', 'size', 'background', 'quality'] as const

/** Task-local, bounded records; never serialize provider headers or responses. */
export class TaskObservability {
  private data: ObservabilitySnapshot = {
    revision: 0, events: [], requests: [], eventsTruncated: false, requestsTruncated: false,
  }
  private seq = 0
  private requestSeq = 0
  constructor(private readonly options: {
    secrets?: string[]
    maxEvents?: number
    maxRequests?: number
    maxRequestChars?: number
    onChange?: () => void
  } = {}) {}

  private redact(value: string): string {
    for (const secret of this.options.secrets ?? []) {
      if (secret) value = value.split(secret).join('[REDACTED]')
    }
    return value
  }

  private changed(): void {
    this.data.revision++
    this.options.onChange?.()
  }

  event(stage: TaskStage, state: EventState, message: string): void {
    this.data.events.push({ seq: ++this.seq, at: Date.now(), stage, state, message: this.redact(message).slice(0, 1000) })
    if (this.data.events.length > (this.options.maxEvents ?? 200)) {
      this.data.events.shift()
      this.data.eventsTruncated = true
    }
    this.changed()
  }

  startRequest(input: RequestInput): string {
    const id = `request-${++this.requestSeq}`
    if (this.data.requests.length >= (this.options.maxRequests ?? 64)) {
      this.data.requestsTruncated = true
      this.changed()
      return id
    }
    const request: TaskRequest = {
      id, kind: input.kind, model: this.redact(input.model).slice(0, 200),
      status: 'pending', startedAt: Date.now(),
    }
    if (input.attempt !== undefined) request.attempt = input.attempt
    if (input.assetId !== undefined) request.assetId = this.redact(input.assetId).slice(0, 200)
    const parameters: Record<string, string | number | boolean> = {}
    for (const key of PARAMETER_KEYS) {
      const value = input.parameters?.[key]
      if (typeof value === 'string') parameters[key] = this.redact(value)
      else if (typeof value === 'number' || typeof value === 'boolean') parameters[key] = value
      else if (key === 'response_format' && value && typeof value === 'object' && 'type' in value && typeof value.type === 'string') {
        parameters[key] = this.redact(value.type)
      }
    }
    const content = {
      parameters,
      ...(input.prompt === undefined ? {} : { prompt: this.redact(input.prompt) }),
      ...(input.messages === undefined ? {} : { messages: input.messages.map(message => ({ role: this.redact(message.role), content: this.redact(message.content) })) }),
    }
    if (JSON.stringify(content).length > (this.options.maxRequestChars ?? 128_000)) {
      request.omittedReason = 'request-too-large'
    } else Object.assign(request, content)
    this.data.requests.push(request)
    this.changed()
    return id
  }

  finishRequest(id: string, status: 'succeeded' | 'failed'): void {
    const request = this.data.requests.find(item => item.id === id)
    if (!request || request.status !== 'pending') return
    request.status = status
    request.finishedAt = Date.now()
    this.changed()
  }

  get revision(): number {
    return this.data.revision
  }

  snapshot(): ObservabilitySnapshot {
    return structuredClone(this.data)
  }
}
