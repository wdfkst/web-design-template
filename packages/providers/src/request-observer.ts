export interface ProviderRequestSnapshot {
  kind: 'structure' | 'image'
  model: string
  attempt?: number
  assetId?: string
  messages?: { role: string; content: string }[]
  prompt?: string
  parameters?: Record<string, unknown>
}
export type RequestObserver = (request: ProviderRequestSnapshot) => (status: 'succeeded' | 'failed') => void

export function observeRequest(observer: RequestObserver | undefined, request: ProviderRequestSnapshot, secret: string) {
  if (!observer) return undefined
  const redact = (text: string) => secret ? text.split(secret).join('[REDACTED]') : text
  return observer({
    ...request,
    model: redact(request.model),
    parameters: Object.fromEntries(['temperature', 'max_tokens', 'response_format', 'size', 'background', 'quality'].flatMap(key => {
      const value = request.parameters?.[key]
      return value === undefined ? [] : [[key, typeof value === 'string' ? redact(value) : value]]
    })),
    ...(request.prompt === undefined ? {} : { prompt: redact(request.prompt) }),
    ...(request.messages === undefined ? {} : { messages: request.messages.map(message => ({ role: message.role, content: redact(message.content) })) }),
  })
}
