import { describe, expect, test } from 'vitest'
import type { ImageRequest } from '@vudt/imagegen'
import { createOpenAIImageProvider } from '../openai-image-provider.js'

interface Capture {
  url: string
  init: RequestInit
  body: {
    model: string
    prompt: string
    size: string
    background?: string
    quality?: string
    n: number
  }
}

function recordingFetch(responseBody: unknown, status = 200) {
  const calls: Capture[] = []
  const fetchImpl = async (url: string | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(url), init: init ?? {}, body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }
  return { calls, fetchImpl }
}

function imagesReply(bytes: Uint8Array): unknown {
  return { data: [{ b64_json: Buffer.from(bytes).toString('base64') }] }
}

function providerWith(responseBody: unknown, status = 200, quality?: string) {
  const { calls, fetchImpl } = recordingFetch(responseBody, status)
  const provider = createOpenAIImageProvider({
    apiKey: 'sk-test',
    model: 'gpt-image-test',
    baseUrl: 'https://example.invalid/v1',
    fetch: fetchImpl as unknown as typeof fetch,
    ...(quality === undefined ? {} : { quality }),
  })
  return { calls, provider }
}

function request(overrides: Partial<ImageRequest> = {}): ImageRequest {
  return {
    prompt: 'flat illustration of a friendly robot, teal palette',
    negativePrompt: 'text, watermark',
    seed: 7,
    size: { w: 1024, h: 768 },
    transparent: false,
    assetId: 'hero-art',
    ...overrides,
  }
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * Tolerates a bodyless call, unlike `recordingFetch`: the second hop that pulls
 * the image down is a GET with no body to parse.
 */
function urlReplyFetch(url: string, bytes: Uint8Array) {
  const calls: { url: string; method: string; headers: Record<string, string> }[] = []
  const fetchImpl = async (target: string | URL, init?: RequestInit): Promise<Response> => {
    const href = String(target)
    calls.push({
      url: href,
      method: init?.method ?? 'GET',
      headers: (init?.headers as Record<string, string> | undefined) ?? {},
    })
    if (href.endsWith('/images/generations')) {
      return new Response(JSON.stringify({ data: [{ url }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(bytes, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })
  }
  return { calls, fetchImpl }
}

describe('createOpenAIImageProvider', () => {
  test('rejects empty credentials and model up front', () => {
    expect(() => createOpenAIImageProvider({ apiKey: '  ', model: 'm' })).toThrow(/apiKey/)
    expect(() => createOpenAIImageProvider({ apiKey: 'sk', model: '' })).toThrow(/model/)
  })

  test('returns the decoded PNG bytes', async () => {
    const { provider } = providerWith(imagesReply(PNG_BYTES))
    await expect(provider.generate(request())).resolves.toEqual(PNG_BYTES)
  })

  test('posts to /images/generations with the tier size verbatim', async () => {
    const { calls, provider } = providerWith(imagesReply(PNG_BYTES))
    await provider.generate(request({ size: { w: 1792, h: 1024 } }))

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://example.invalid/v1/images/generations')
    expect(calls[0]!.init.method).toBe('POST')
    expect(calls[0]!.body.size).toBe('1792x1024')
    expect(calls[0]!.body.n).toBe(1)
    expect(calls[0]!.body.model).toBe('gpt-image-test')
  })

  test('sends the api key as a bearer token', async () => {
    const { calls, provider } = providerWith(imagesReply(PNG_BYTES))
    await provider.generate(request())
    const headers = calls[0]!.init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer sk-test')
  })

  test('appends the negative prompt as an avoid clause', async () => {
    const { calls, provider } = providerWith(imagesReply(PNG_BYTES))
    await provider.generate(request())
    expect(calls[0]!.body.prompt).toContain('friendly robot')
    expect(calls[0]!.body.prompt).toContain('Avoid: text, watermark')
  })

  test('omits the avoid clause when there is no negative prompt', async () => {
    const { calls, provider } = providerWith(imagesReply(PNG_BYTES))
    await provider.generate(request({ negativePrompt: '   ' }))
    expect(calls[0]!.body.prompt).not.toContain('Avoid:')
  })

  test('requests a transparent background only when the asset asked for one', async () => {
    const opaque = providerWith(imagesReply(PNG_BYTES))
    await opaque.provider.generate(request({ transparent: false }))
    expect(opaque.calls[0]!.body.background).toBeUndefined()

    const cutout = providerWith(imagesReply(PNG_BYTES))
    await cutout.provider.generate(request({ transparent: true }))
    expect(cutout.calls[0]!.body.background).toBe('transparent')
  })

  test('passes quality through when configured', async () => {
    const { calls, provider } = providerWith(imagesReply(PNG_BYTES), 200, 'high')
    await provider.generate(request())
    expect(calls[0]!.body.quality).toBe('high')
  })

  test('throws the status without leaking the key or the prompt', async () => {
    const { provider } = providerWith({ error: { message: 'bad key sk-test' } }, 401)
    await expect(provider.generate(request())).rejects.toThrow(/status 401/)
    await expect(provider.generate(request())).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('sk-test') }) as Error,
    )
  })

  test('throws when the reply carries no inline image data', async () => {
    const empty = providerWith({ data: [] })
    await expect(empty.provider.generate(request())).rejects.toThrow(/no inline image data/)

    // A url-only reply is no longer an error: it is now the relay path, covered
    // by 'fetches the image when the relay returns a url instead of b64_json'.
    const blankUrl = providerWith({ data: [{ url: '   ' }] })
    await expect(blankUrl.provider.generate(request())).rejects.toThrow(/hero-art/)
  })

  test('throws on a zero-length image rather than returning a blank buffer', async () => {
    const { provider } = providerWith({ data: [{ b64_json: '' }] })
    await expect(provider.generate(request())).rejects.toThrow(/no inline image data/)
  })

  test('trailing slashes in the base url do not double up', async () => {
    const { calls, fetchImpl } = recordingFetch(imagesReply(PNG_BYTES))
    const provider = createOpenAIImageProvider({
      apiKey: 'sk-test',
      model: 'm',
      baseUrl: 'https://example.invalid/v1///',
      fetch: fetchImpl as unknown as typeof fetch,
    })
    await provider.generate(request())
    expect(calls[0]!.url).toBe('https://example.invalid/v1/images/generations')
  })

  test('fetches the image when the relay returns a url instead of b64_json', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
    const { calls, fetchImpl } = urlReplyFetch('https://cdn.invalid/out.png', bytes)
    const provider = createOpenAIImageProvider({
      apiKey: 'sk-test',
      model: 'gpt-image-test',
      baseUrl: 'https://example.invalid/v1',
      fetch: fetchImpl as unknown as typeof fetch,
    })

    const result = await provider.generate(request())

    expect(Array.from(result)).toEqual(Array.from(bytes))
    expect(calls[1]!.url).toBe('https://cdn.invalid/out.png')
  })

  test('does not send the api key to the image host', async () => {
    const { calls, fetchImpl } = urlReplyFetch('https://cdn.invalid/out.png', PNG_BYTES)
    const provider = createOpenAIImageProvider({
      apiKey: 'sk-test',
      model: 'gpt-image-test',
      baseUrl: 'https://example.invalid/v1',
      fetch: fetchImpl as unknown as typeof fetch,
    })

    await provider.generate(request())

    const headerNames = Object.keys(calls[1]!.headers).map((name) => name.toLowerCase())
    expect(headerNames).not.toContain('authorization')
    expect(JSON.stringify(calls[1]!.headers)).not.toContain('sk-test')
  })

  test('throws when the url fetch fails', async () => {
    const fetchImpl = async (target: string | URL): Promise<Response> => {
      if (String(target).endsWith('/images/generations')) {
        return new Response(JSON.stringify({ data: [{ url: 'https://cdn.invalid/out.png' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('nope', { status: 404 })
    }
    const provider = createOpenAIImageProvider({
      apiKey: 'sk-test',
      model: 'gpt-image-test',
      baseUrl: 'https://example.invalid/v1',
      fetch: fetchImpl as unknown as typeof fetch,
    })

    await expect(provider.generate(request())).rejects.toThrow(/status 404/)
  })
})
