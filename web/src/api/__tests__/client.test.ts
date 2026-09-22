import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  assetImageUrl,
  createTask,
  exportUrl,
  getSpec,
  getTask,
  listTasks,
  retryTask,
} from '../client.js'

function mockFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listTasks', () => {
  it('unwraps the tasks array', async () => {
    vi.stubGlobal('fetch', mockFetch({ tasks: [{ id: 'a', status: 'ready' }] }))

    await expect(listTasks()).resolves.toEqual([{ id: 'a', status: 'ready' }])
  })
})

describe('getTask', () => {
  it('requests the task by id', async () => {
    const fetchMock = mockFetch({ id: 'abc', status: 'building' })
    vi.stubGlobal('fetch', fetchMock)

    await getTask('abc')

    expect(fetchMock).toHaveBeenCalledWith('/tasks/abc', expect.anything())
  })
})

describe('createTask', () => {
  it('posts the description as JSON', async () => {
    const fetchMock = mockFetch({ id: 'abc', status: 'queued' }, 202)
    vi.stubGlobal('fetch', fetchMock)

    await createTask('a landing page')

    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      description: 'a landing page',
    })
  })
})

describe('error handling', () => {
  it('throws ApiError carrying the status', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'queue is full, retry later' }, 503))

    await expect(createTask('x')).rejects.toBeInstanceOf(ApiError)
    await expect(createTask('x')).rejects.toMatchObject({
      status: 503,
      message: 'queue is full, retry later',
    })
  })

  it('falls back to a generic message when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('gateway blew up', { status: 502 })) as unknown as typeof fetch,
    )

    await expect(getTask('abc')).rejects.toMatchObject({ status: 502 })
  })
})

describe('url builders', () => {
  it('builds export urls for both kinds', () => {
    expect(exportUrl('abc', 'source')).toBe('/tasks/abc/export/source')
    expect(exportUrl('abc', 'dist')).toBe('/tasks/abc/export/dist')
  })

  it('builds the asset image url from the content hash', () => {
    // codegen writes public/assets/<hash>.png and vite copies public/ into dist,
    // so the image is already served by the preview route — no extra endpoint.
    expect(assetImageUrl('abc', '0123456789abcdef')).toBe(
      '/preview/abc/assets/0123456789abcdef.png',
    )
  })

  it('encodes ids that would otherwise break the path', () => {
    expect(exportUrl('a b', 'dist')).toBe('/tasks/a%20b/export/dist')
  })
})

describe('getSpec and retryTask', () => {
  it('fetches the spec projection', async () => {
    const fetchMock = mockFetch({ meta: {}, theme: {}, styleBible: {}, pages: [], assets: [] })
    vi.stubGlobal('fetch', fetchMock)

    const spec = await getSpec('abc')

    expect(fetchMock).toHaveBeenCalledWith('/tasks/abc/spec', expect.anything())
    expect(spec.assets).toEqual([])
  })

  it('posts a retry and returns the new task', async () => {
    const fetchMock = mockFetch({ id: 'new-id', status: 'queued' }, 202)
    vi.stubGlobal('fetch', fetchMock)

    const task = await retryTask('old-id')

    expect(fetchMock).toHaveBeenCalledWith('/tasks/old-id/retry', expect.anything())
    expect(task.id).toBe('new-id')
  })
})
