import { z } from 'zod'

export const ASPECT_RATIOS = ['1:1', '4:3', '3:4', '3:2', '2:3', '16:9', '9:16'] as const

export const AspectRatioSchema = z.enum(ASPECT_RATIOS)
export type AspectRatio = z.infer<typeof AspectRatioSchema>

export function aspectRatioValue(ratio: AspectRatio): number {
  const [w, h] = ratio.split(':').map(Number) as [number, number]
  return w / h
}

/** Stable key format so generated code can reference assets before they exist. */
const assetId = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, 'must be kebab-case starting with a letter')

export const AssetPurposeSchema = z.enum([
  'hero-illustration',
  'feature-illustration',
  'empty-state',
  'error-state',
  'avatar',
  'logo-mark',
  'section-decoration',
  'background',
])

/**
 * What the LLM produces. `contentHash` is intentionally absent: it is derived
 * from these fields plus the style bible, never supplied by the model.
 */
export const AssetInputSchema = z.object({
  id: assetId,
  purpose: AssetPurposeSchema,
  aspectRatio: AspectRatioSchema,
  /** Container size the code generator writes into the markup. */
  renderSize: z.object({
    w: z.number().int().positive().max(4096),
    h: z.number().int().positive().max(4096),
  }),
  transparent: z.boolean(),
  composition: z.enum(['subject-left', 'subject-right', 'centered', 'full-bleed']),
  /** Subject description only — the style bible supplies the style prefix. */
  prompt: z.string().min(3).max(600),
  alt: z.string().min(1).max(200),
})

export const AssetSchema = AssetInputSchema.extend({
  contentHash: z.string().length(16),
})

export type AssetPurpose = z.infer<typeof AssetPurposeSchema>
export type AssetInput = z.infer<typeof AssetInputSchema>
export type Asset = z.infer<typeof AssetSchema>

export const RENDER_SIZE_TOLERANCE = 0.02

/** Catches a 16:9 declaration paired with a square container. */
export function renderSizeMatchesRatio(asset: AssetInput): boolean {
  const declared = aspectRatioValue(asset.aspectRatio)
  const actual = asset.renderSize.w / asset.renderSize.h
  return Math.abs(actual - declared) / declared <= RENDER_SIZE_TOLERANCE
}
