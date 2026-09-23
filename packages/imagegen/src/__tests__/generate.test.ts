import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateProject } from '@vudt/codegen'
import { finalizeSpec } from '@vudt/spec'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryImageCache } from '../cache.js'
import { ImagegenError } from '../errors.js'
import { generateAssets, planAssetJobs, type AssetsProgress } from '../generate.js'
import { landingSpec } from './fixture.js'
import { StubProcessor, StubProvider } from './stub-provider.js'

const dirs: string[] = []

async function tempOut(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'vudt-imagegen-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('planAssetJobs', () => {
  it('produces one job per manifest asset', () => {
    const spec = landingSpec()
    expect(planAssetJobs(spec)).toHaveLength(spec.assets.length)
  })

  it('carries the sidecar render size separately from the requested tier', () => {
    const spec = landingSpec()
    const job = planAssetJobs(spec)[0]!
    expect(job.renderSize).toEqual(job.asset.renderSize)
    expect(job.request.size.w).toBeGreaterThanOrEqual(job.renderSize.w)
  })
})

describe('generateAssets', () => {
  it('writes every file at the path codegen expects', async () => {
    const spec = landingSpec()
    const outDir = await tempOut()
    const provider = new StubProvider()

    const result = await generateAssets(spec, { provider, outDir })

    const expected = generateProject(spec).expectedAssets.map((a) => a.path).sort()
    expect(result.assets.map((a) => a.path).sort()).toEqual(expected)
    for (const path of expected) {
      expect((await stat(join(outDir, path))).isFile()).toBe(true)
    }
  })

  it('calls the provider once per distinct content hash', async () => {
    const spec = landingSpec()
    const provider = new StubProvider()
    const result = await generateAssets(spec, { provider, outDir: await tempOut() })
    const distinct = new Set(spec.assets.map((a) => a.contentHash)).size
    expect(result.providerCalls).toBe(distinct)
    expect(provider.requests).toHaveLength(distinct)
  })

  it('makes no provider call on a second run against a warm cache', async () => {
    const spec = landingSpec()
    const cache = new MemoryImageCache()
    const first = new StubProvider()
    await generateAssets(spec, { provider: first, outDir: await tempOut(), cache })
    expect(first.requests.length).toBeGreaterThan(0)

    const second = new StubProvider()
    const result = await generateAssets(spec, { provider: second, outDir: await tempOut(), cache })

    expect(second.requests).toHaveLength(0)
    expect(result.providerCalls).toBe(0)
    expect(result.assets.every((a) => a.cached)).toBe(true)
  })

  it('still writes the files when everything came from cache', async () => {
    const spec = landingSpec()
    const cache = new MemoryImageCache()
    await generateAssets(spec, { provider: new StubProvider(), outDir: await tempOut(), cache })

    const outDir = await tempOut()
    await generateAssets(spec, { provider: new StubProvider(), outDir, cache })

    for (const asset of generateProject(spec).expectedAssets) {
      expect((await readFile(join(outDir, asset.path))).length).toBeGreaterThan(0)
    }
  })

  it('regenerates when the style bible changes', async () => {
    const spec = landingSpec()
    const cache = new MemoryImageCache()
    await generateAssets(spec, { provider: new StubProvider(), outDir: await tempOut(), cache })

    const restyled = finalizeSpec({
      ...spec,
      styleBible: { ...spec.styleBible, artStyle: 'isometric' },
    })
    const provider = new StubProvider()
    const result = await generateAssets(restyled, { provider, outDir: await tempOut(), cache })

    expect(result.providerCalls).toBeGreaterThan(0)
    expect(provider.requests[0]!.prompt).toContain('isometric illustration')
  })

  it('runs the processor to reach the sidecar render size', async () => {
    const spec = landingSpec()
    const processor = new StubProcessor()
    await generateAssets(spec, {
      provider: new StubProvider(),
      outDir: await tempOut(),
      processor,
    })
    expect(processor.resizes.length).toBeGreaterThan(0)
    const first = planAssetJobs(spec)[0]!
    expect(processor.resizes[0]).toEqual(first.renderSize)
  })

  it('caches the post-processed bytes, not the raw provider output', async () => {
    const spec = landingSpec()
    const cache = new MemoryImageCache()
    const processor = new StubProcessor()
    const first = await generateAssets(spec, {
      provider: new StubProvider(),
      outDir: await tempOut(),
      cache,
      processor,
    })

    const reprocessor = new StubProcessor()
    const second = await generateAssets(spec, {
      provider: new StubProvider(),
      outDir: await tempOut(),
      cache,
      processor: reprocessor,
    })

    expect(reprocessor.resizes).toHaveLength(0)
    expect(second.assets.map((a) => a.bytes)).toEqual(first.assets.map((a) => a.bytes))
  })

  it('rejects an empty provider response instead of writing a broken file', async () => {
    const spec = landingSpec()
    const provider = new StubProvider(() => new Uint8Array())
    await expect(
      generateAssets(spec, { provider, outDir: await tempOut() }),
    ).rejects.toThrow(ImagegenError)
  })

  it('reports progress before and after every asset', async () => {
    const spec = landingSpec()
    const seen: AssetsProgress[] = []

    const result = await generateAssets(spec, {
      provider: new StubProvider(),
      outDir: await tempOut(),
      onProgress: (progress) => seen.push(progress),
    })

    expect(seen[0]).toEqual({ done: 0, total: spec.assets.length })
    expect(seen.at(-1)).toEqual({ done: spec.assets.length, total: spec.assets.length })
    expect(seen).toHaveLength(spec.assets.length + 1)
    // Strictly one step per entry: the counter never stalls and never skips.
    expect(seen.map((progress) => progress.done)).toEqual(
      Array.from({ length: spec.assets.length + 1 }, (_, index) => index),
    )
    expect(result.assets).toHaveLength(spec.assets.length)
  })

  it('counts a cache hit as progress even though it makes no provider call', async () => {
    const spec = landingSpec()
    const cache = new MemoryImageCache()
    // Warm the cache with a throwaway provider, then measure a run that must hit it.
    await generateAssets(spec, { provider: new StubProvider(), outDir: await tempOut(), cache })

    const seen: AssetsProgress[] = []
    const provider = new StubProvider()
    const result = await generateAssets(spec, {
      provider,
      outDir: await tempOut(),
      cache,
      onProgress: (progress) => seen.push(progress),
    })

    expect(provider.requests).toHaveLength(0)
    expect(result.providerCalls).toBe(0)
    expect(seen.at(-1)).toEqual({ done: spec.assets.length, total: spec.assets.length })
  })
})
