import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { assetFilePath } from '@vudt/codegen'
import type { Asset, ProjectSpec } from '@vudt/spec'
import { NO_CACHE, type ImageCache } from './cache.js'
import { ImagegenError } from './errors.js'
import { buildPrompt } from './prompt.js'
import type { AssetJob, ImageProcessor, ImageProvider } from './provider.js'
import { DEFAULT_SIZE_TIERS, pickSizeTier, type SizeTier } from './size.js'

export interface GenerateAssetsOptions {
  provider: ImageProvider
  /** Project root the generated files land in — same directory codegen wrote. */
  outDir: string
  cache?: ImageCache
  processor?: ImageProcessor
  tiers?: readonly SizeTier[]
}

export interface GeneratedAsset {
  assetId: string
  contentHash: string
  /** Project-relative, matching `generateProject().expectedAssets[].path`. */
  path: string
  bytes: number
  cached: boolean
}

export interface GenerateAssetsResult {
  assets: GeneratedAsset[]
  /** Distinct model calls actually made — the number the cache is there to shrink. */
  providerCalls: number
}

/**
 * Pure planning step: spec -> one job per asset with its prompt and sizes
 * resolved. Split out from the IO so prompt assembly and tier selection stay
 * testable without a provider or a filesystem.
 */
export function planAssetJobs(
  spec: ProjectSpec,
  tiers: readonly SizeTier[] = DEFAULT_SIZE_TIERS,
): AssetJob[] {
  return spec.assets.map((asset: Asset) => {
    const built = buildPrompt(asset, spec.styleBible)
    return {
      asset,
      renderSize: { w: asset.renderSize.w, h: asset.renderSize.h },
      request: {
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        seed: built.seed,
        size: pickSizeTier(asset.aspectRatio, tiers),
        transparent: asset.transparent,
        assetId: asset.id,
      },
    }
  })
}

function safeJoin(root: string, relative: string): string {
  const full = resolve(join(root, relative))
  if (full !== root && !full.startsWith(root + sep)) {
    throw new ImagegenError(`asset path escapes out dir: ${relative}`)
  }
  return full
}

/**
 * Produces every image the manifest declares and writes it where codegen's
 * markup already points. Assets are keyed by contentHash, so two assets that
 * hashed identically are generated once and written once — the href in the
 * markup is the same file by construction.
 */
export async function generateAssets(
  spec: ProjectSpec,
  options: GenerateAssetsOptions,
): Promise<GenerateAssetsResult> {
  const { provider, processor } = options
  const cache = options.cache ?? NO_CACHE
  const outDir = resolve(options.outDir)
  const jobs = planAssetJobs(spec, options.tiers ?? DEFAULT_SIZE_TIERS)

  const produced = new Map<string, Uint8Array>()
  const assets: GeneratedAsset[] = []
  let providerCalls = 0

  for (const job of jobs) {
    const hash = job.asset.contentHash
    let png = produced.get(hash)
    let cached = png !== undefined

    if (png === undefined) {
      const hit = await cache.get(hash)
      if (hit !== null) {
        png = hit
        cached = true
      } else {
        png = await provider.generate(job.request)
        providerCalls += 1
        if (png.length === 0) {
          throw new ImagegenError(
            `provider ${provider.name} returned an empty image for asset ${job.asset.id}`,
          )
        }
        png = await postProcess(png, job, processor)
        await cache.set(hash, png)
      }
      produced.set(hash, png)
    }

    const relative = assetFilePath(hash)
    const target = safeJoin(outDir, relative)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, png)

    assets.push({
      assetId: job.asset.id,
      contentHash: hash,
      path: relative,
      bytes: png.length,
      cached,
    })
  }

  return { assets, providerCalls }
}

/**
 * Runs before the cache write, not after: the cache key covers the prompt and
 * the render geometry, so storing the finished bytes means a later hit needs no
 * reprocessing.
 */
async function postProcess(
  png: Uint8Array,
  job: AssetJob,
  processor: ImageProcessor | undefined,
): Promise<Uint8Array> {
  if (processor === undefined) return png

  let out = png
  if (job.asset.transparent && processor.ensureTransparent !== undefined) {
    out = await processor.ensureTransparent(out)
  }
  const { w, h } = job.renderSize
  if (w !== job.request.size.w || h !== job.request.size.h) {
    out = await processor.resize(out, { w, h })
  }
  return out
}
