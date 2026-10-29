import type { RequestObserver } from '@vudt/providers'

export function redactRequestObserver(observer: RequestObserver | undefined, secrets: string[]): RequestObserver | undefined {
  if (!observer) return undefined
  const redact = (value: unknown): unknown => {
    if (typeof value === 'string') return secrets.filter(Boolean).reduce((text, secret) => text.split(secret).join('[REDACTED]'), value)
    if (Array.isArray(value)) return value.map(redact)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redact(entry)]))
    return value
  }
  return request => observer(redact(request) as Parameters<RequestObserver>[0])
}
