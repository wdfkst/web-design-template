import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { MemoryImageCache, type ImageProvider, type ImageRequest } from '@vudt/imagegen'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { BuildError } from '../errors.js'
import { buildTask } from '../pipeline.js'
import { WorkspaceRoot } from '../workspace.js'
import { landingSpec } from './fixture.js'

const TEMPLATE_DIR = resolve(__dirname, '../../../templates/vue3-base')

/** Smallest valid PNG: a 1x1 transparent pixel, so vite has real bytes to copy. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAABzenr0AAAADUlEQVR42mNkYGD4DwABBAEAX+XkhQAAAABJRU5ErkJggg==',
  'base64',
)

class PngProvider implements ImageProvider {
  readonly name = 'png-stub'
  readonly requests: ImageRequest[] = []
  async generate(request: ImageRequest): Promise<Uint8Array> {
    this.requests.push(request)
    return new Uint8Array(PNG_1X1)
  }
}

let root: WorkspaceRoot
let rootDir: string

beforeAll(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'vudt-tasks-'))
  root = new WorkspaceRoot(rootDir)
})

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true })
})

describe('buildTask', () => {
  it('runs code -> images -> build and produces a servable dist', async () => {
    const ws = await root.allocate('task-happy')
    const provider = new PngProvider()

    const result = await buildTask(landingSpec(), {
      workspace: ws,
      templateDir: TEMPLATE_DIR,
      provider,
    })

    expect(result.build.code).toBe(0)
    const dist = await readdir(result.distDir)
    expect(dist).toContain('index.html')
    expect(dist).toContain('assets')

    // Every manifest image reached the dist, which is the join the whole
    // contract exists to guarantee.
    for (const asset of result.write.expectedAssets) {
      const inDist = join(result.distDir, asset.path.replace(/^public\//, ''))
      expect((await stat(inDist)).size).toBeGreaterThan(0)
    }

    const html = await readFile(join(result.distDir, 'index.html'), 'utf8')
    expect(html).toContain('<div id="app">')
    expect(provider.requests.length).toBeGreaterThan(0)
  }, 300_000)

  it('reuses cached images across two tasks with the same spec', async () => {
    const cache = new MemoryImageCache()
    const spec = landingSpec()

    const first = new PngProvider()
    await buildTask(spec, {
      workspace: await root.allocate('task-cache-a'),
      templateDir: TEMPLATE_DIR,
      provider: first,
      cache,
    })
    expect(first.requests.length).toBeGreaterThan(0)

    const second = new PngProvider()
    const result = await buildTask(spec, {
      workspace: await root.allocate('task-cache-b'),
      templateDir: TEMPLATE_DIR,
      provider: second,
      cache,
    })

    expect(second.requests).toHaveLength(0)
    expect(result.images.providerCalls).toBe(0)
  }, 300_000)

  it('refuses a spec above the per-task asset ceiling before calling the model', async () => {
    const provider = new PngProvider()
    await expect(
      buildTask(landingSpec(), {
        workspace: await root.allocate('task-too-many'),
        templateDir: TEMPLATE_DIR,
        provider,
        maxAssets: 0,
      }),
    ).rejects.toThrow(BuildError)
    expect(provider.requests).toHaveLength(0)
  })

  it('fails loudly when the provider writes nothing usable', async () => {
    const emptyProvider: ImageProvider = {
      name: 'empty',
      async generate() {
        return new Uint8Array()
      },
    }
    await expect(
      buildTask(landingSpec(), {
        workspace: await root.allocate('task-empty'),
        templateDir: TEMPLATE_DIR,
        provider: emptyProvider,
      }),
    ).rejects.toThrow(/empty image/)
  }, 60_000)

  it('surfaces a build failure with the log tail attached', async () => {
    const spec = landingSpec()
    const ws = await root.allocate('task-broken')
    // A tiny timeout is the cheapest way to make the real build fail without
    // corrupting the template.
    const error = await buildTask(spec, {
      workspace: ws,
      templateDir: TEMPLATE_DIR,
      provider: new PngProvider(),
      limits: { timeoutMs: 400 },
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(BuildError)
    expect((error as BuildError).message).toMatch(/killed|failed/)
  }, 60_000)
})
