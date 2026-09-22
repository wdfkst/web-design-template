import { createHash } from 'node:crypto'
import type { Asset, AssetInput } from './asset.js'
import type { StyleBible } from './style-bible.js'
import type { ProjectSpec, ProjectSpecInput } from './project-spec.js'

/**
 * Hashes every input that changes the rendered pixels, including the style
 * bible — editing the art style must invalidate cached images, otherwise a
 * restyled project would silently reuse the old illustrations.
 */
export function assetContentHash(asset: AssetInput, styleBible: StyleBible): string {
  const payload = JSON.stringify([
    asset.purpose,
    asset.aspectRatio,
    asset.transparent,
    asset.composition,
    asset.prompt,
    styleBible.artStyle,
    styleBible.lineWeight,
    styleBible.shading,
    styleBible.perspective,
    styleBible.palette,
    styleBible.backgroundTreatment,
    styleBible.negativePrompt,
    styleBible.seed,
  ])
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}

/** Fills in the derived hashes the model does not supply. */
export function finalizeSpec(input: ProjectSpecInput): ProjectSpec {
  const assets: Asset[] = input.assets.map((asset) => ({
    ...asset,
    contentHash: assetContentHash(asset, input.styleBible),
  }))
  return { ...input, assets }
}
