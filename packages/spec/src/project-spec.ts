import { z } from 'zod'
import { AssetInputSchema, AssetSchema, renderSizeMatchesRatio } from './asset.js'
import { PageSchema } from './page.js'
import { StyleBibleSchema } from './style-bible.js'
import { ThemeSchema } from './theme.js'

export const MetaSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(1000),
  targetStack: z.literal('vue3'),
})

const baseShape = {
  meta: MetaSchema,
  theme: ThemeSchema,
  styleBible: StyleBibleSchema,
  pages: z.array(PageSchema).min(1),
}

type Checked = {
  pages: z.infer<typeof PageSchema>[]
  assets: { id: string; aspectRatio: string; renderSize: { w: number; h: number } }[]
}

/**
 * Cross-field checks that keep the code side and the image side in agreement.
 * Without these an LLM can emit a binding to an asset it never declared, which
 * only surfaces later as a broken image in the preview.
 */
function checkReferentialIntegrity(spec: Checked, ctx: z.RefinementCtx): void {
  const seenAssetIds = new Set<string>()
  for (const [index, asset] of spec.assets.entries()) {
    if (seenAssetIds.has(asset.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['assets', index, 'id'],
        message: `duplicate asset id "${asset.id}"`,
      })
    }
    seenAssetIds.add(asset.id)

    if (!renderSizeMatchesRatio(asset as Parameters<typeof renderSizeMatchesRatio>[0])) {
      ctx.addIssue({
        code: 'custom',
        path: ['assets', index, 'renderSize'],
        message:
          `renderSize ${asset.renderSize.w}x${asset.renderSize.h} does not match ` +
          `declared aspectRatio ${asset.aspectRatio}`,
      })
    }
  }

  const seenRoutes = new Set<string>()
  for (const [pageIndex, page] of spec.pages.entries()) {
    if (seenRoutes.has(page.route)) {
      ctx.addIssue({
        code: 'custom',
        path: ['pages', pageIndex, 'route'],
        message: `duplicate route "${page.route}"`,
      })
    }
    seenRoutes.add(page.route)

    for (const [blockIndex, block] of page.blocks.entries()) {
      for (const [slot, assetId] of Object.entries(block.assetBindings)) {
        if (!seenAssetIds.has(assetId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['pages', pageIndex, 'blocks', blockIndex, 'assetBindings', slot],
            message: `slot "${slot}" binds unknown asset id "${assetId}"`,
          })
        }
      }
    }
  }
}

/** What the LLM returns: no contentHash yet. */
export const ProjectSpecInputSchema = z
  .object({ ...baseShape, assets: z.array(AssetInputSchema) })
  .superRefine(checkReferentialIntegrity)

/** After finalizeSpec() has filled in derived hashes. */
export const ProjectSpecSchema = z
  .object({ ...baseShape, assets: z.array(AssetSchema) })
  .superRefine(checkReferentialIntegrity)

export type Meta = z.infer<typeof MetaSchema>
export type ProjectSpecInput = z.infer<typeof ProjectSpecInputSchema>
export type ProjectSpec = z.infer<typeof ProjectSpecSchema>
