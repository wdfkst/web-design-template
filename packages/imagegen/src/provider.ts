import type { Asset } from '@vudt/spec'
import type { SizeTier } from './size.js'

export interface ImageRequest {
  prompt: string
  negativePrompt: string
  seed: number
  size: SizeTier
  transparent: boolean
  /** Diagnostic only — providers must not let it change the pixels. */
  assetId: string
}

/**
 * The seam between the pipeline and whichever model is configured. Kept this
 * narrow on purpose: every provider-specific concern (auth, retries, polling an
 * async job, model-specific transparency flags) lives behind this call, so the
 * cache and manifest logic never learns which vendor is in use.
 */
export interface ImageProvider {
  readonly name: string
  generate(request: ImageRequest): Promise<Uint8Array>
}

/**
 * Post-processing seam. Downscaling to `renderSize` and enforcing a real alpha
 * channel need a raster library, which is a native dependency we do not want
 * imagegen to hard-require — the server picks an implementation, tests pass a
 * stub. `null` from either method means "leave the bytes alone".
 */
export interface ImageProcessor {
  readonly name: string
  resize(png: Uint8Array, target: SizeTier): Promise<Uint8Array>
  /** Cuts a flat backdrop when the model ignored the transparency request. */
  ensureTransparent?(png: Uint8Array): Promise<Uint8Array>
}

export interface AssetJob {
  asset: Asset
  request: ImageRequest
  /** Container size from the sidecar; the post-processor resizes down to this. */
  renderSize: SizeTier
}
