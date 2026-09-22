import { describe, expect, it } from 'vitest'
import { EXCERPT_LIMIT, REDACTION_PLACEHOLDER, probeSettings } from '../settings-probe.js'
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

  it('redacts an echoed key from the excerpt on both sides', async () => {
    const { fetchImpl } = fetchStub((url) =>
      url.endsWith('/chat/completions')
        ? new Response('rejected token sk-spec and again sk-spec', { status: 401 })
        : new Response('bad credential sk-image', { status: 401 }),
    )

    const report = await probeSettings(SETTINGS, KEYS, fetchImpl)

    expect(report.spec.bodyExcerpt).not.toContain('sk-spec')
    expect(report.spec.bodyExcerpt).toContain(REDACTION_PLACEHOLDER)
    expect(report.image.bodyExcerpt).not.toContain('sk-image')
    expect(report.image.bodyExcerpt).toContain(REDACTION_PLACEHOLDER)
  })

  it('redacts an echoed key from a transport failure message', async () => {
    const fetchImpl = (async () => {
      throw new Error('connect failed while sending authorization Bearer sk-spec')
    }) as unknown as typeof fetch

    const report = await probeSettings(SETTINGS, KEYS, fetchImpl)

    expect(report.spec.bodyExcerpt).not.toContain('sk-spec')
    expect(report.spec.bodyExcerpt).toContain(REDACTION_PLACEHOLDER)
  })

  it('redacts before truncating, so a key straddling the limit cannot leak a fragment', async () => {
    const body = `${'x'.repeat(495)}sk-spec`
    const { fetchImpl } = fetchStub(() => new Response(body, { status: 500 }))

    const report = await probeSettings(SETTINGS, KEYS, fetchImpl)

    expect(report.spec.bodyExcerpt!.length).toBeLessThanOrEqual(EXCERPT_LIMIT)
    expect(report.spec.bodyExcerpt).not.toContain('sk')
  })

  it('leaves the body alone when a key is empty', async () => {
    const { fetchImpl } = fetchStub(() => new Response('plain failure', { status: 500 }))

    const report = await probeSettings(SETTINGS, { specApiKey: '', imageApiKey: '' }, fetchImpl)

    expect(report.spec.bodyExcerpt).toBe('plain failure')
    expect(report.image.bodyExcerpt).toBe('plain failure')
  })

  it('strips a trailing slash from both base urls', async () => {
    const { calls, fetchImpl } = fetchStub(() => ok({ data: [] }))
    const settings: EffectiveSettings = {
      spec: { baseUrl: 'https://relay.invalid/v1/', model: 'glm-4', sendResponseFormat: true },
      image: { baseUrl: 'https://relay.invalid/v1//', model: 'flux' },
    }

    await probeSettings(settings, KEYS, fetchImpl)

    expect(calls.map((call) => call.url)).toEqual([
      'https://relay.invalid/v1/chat/completions',
      'https://relay.invalid/v1/models',
    ])
  })
})
