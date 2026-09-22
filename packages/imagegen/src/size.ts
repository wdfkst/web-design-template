import { aspectRatioValue, type AspectRatio } from '@vudt/spec'
import { ImagegenError } from './errors.js'

/** One size a provider can actually render. */
export interface SizeTier {
  w: number
  h: number
}

/**
 * Image models render a fixed set of dimensions, so `renderSize` (the CSS box
 * the sidecar dictates) is almost never requestable directly. We pick the
 * closest tier by aspect ratio, then downscale to renderSize afterwards.
 * Generating above the container size and shrinking keeps the image crisp on
 * retina displays; the reverse would upscale and blur.
 */
export const DEFAULT_SIZE_TIERS: readonly SizeTier[] = [
  { w: 1024, h: 1024 },
  { w: 1024, h: 768 },
  { w: 768, h: 1024 },
  { w: 1024, h: 683 },
  { w: 683, h: 1024 },
  { w: 1792, h: 1024 },
  { w: 1024, h: 1792 },
]

/**
 * Closest tier by ratio, breaking ties toward the larger tier so the downscale
 * never becomes an upscale for wide containers.
 */
export function pickSizeTier(
  ratio: AspectRatio,
  tiers: readonly SizeTier[] = DEFAULT_SIZE_TIERS,
): SizeTier {
  if (tiers.length === 0) throw new ImagegenError('no size tiers configured')

  const target = aspectRatioValue(ratio)
  let best = tiers[0]!
  let bestDelta = Number.POSITIVE_INFINITY

  for (const tier of tiers) {
    const delta = Math.abs(tier.w / tier.h - target) / target
    const area = tier.w * tier.h
    if (delta < bestDelta - 1e-9 || (Math.abs(delta - bestDelta) <= 1e-9 && area > best.w * best.h)) {
      best = tier
      bestDelta = delta
    }
  }

  return best
}
