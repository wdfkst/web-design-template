import { z } from 'zod'
import { AssetInputSchema, AssetSchema, renderSizeMatchesRatio } from './asset.js'
import { CollectionSchema } from './collection.js'
import { FormSchema } from './form.js'
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
  collections: z.array(CollectionSchema).default([]),
  forms: z.array(FormSchema).default([]),
  pages: z.array(PageSchema).min(1),
}

type Checked = {
  collections: z.infer<typeof CollectionSchema>[]
  forms: z.infer<typeof FormSchema>[]
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

  const seenCollectionIds = new Set<string>()
  for (const [index, collection] of spec.collections.entries()) {
    if (seenCollectionIds.has(collection.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['collections', index, 'id'],
        message: `duplicate collection id "${collection.id}"`,
      })
    }
    seenCollectionIds.add(collection.id)

    for (const [fieldIndex, field] of collection.fields.entries()) {
      if (!Object.hasOwn(collection.model, field)) {
        ctx.addIssue({
          code: 'custom',
          path: ['collections', index, 'fields', fieldIndex],
          message: `collection "${collection.id}" field "${field}" is not a model key`,
        })
      }
    }

    if (
      (collection.actions.includes('edit') || collection.actions.includes('delete')) &&
      !Object.hasOwn(collection.model, 'id')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['collections', index, 'actions'],
        message: `collection "${collection.id}" actions include edit/delete but its model has no "id" key`,
      })
    }
  }

  for (const [index, form] of spec.forms.entries()) {
    if (form.collection !== undefined && !seenCollectionIds.has(form.collection)) {
      ctx.addIssue({
        code: 'custom',
        path: ['forms', index, 'collection'],
        message: `form "${form.id}" references unknown collection "${form.collection}"`,
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

  const declaredRoutes = new Set(spec.pages.map((page) => page.route))
  for (const [pageIndex, page] of spec.pages.entries()) {
    const seenOpIds = new Set<string>()
    for (const [opIndex, operation] of page.operations.entries()) {
      if (seenOpIds.has(operation.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['pages', pageIndex, 'operations', opIndex, 'id'],
          message: `duplicate operation id "${operation.id}" on route "${page.route}"`,
        })
      }
      seenOpIds.add(operation.id)

      if (operation.target.startsWith('/')) {
        if (!declaredRoutes.has(operation.target)) {
          ctx.addIssue({
            code: 'custom',
            path: ['pages', pageIndex, 'operations', opIndex, 'target'],
            message: `operation target "${operation.target}" is not a declared route`,
          })
        }
      } else if (!seenCollectionIds.has(operation.target)) {
        ctx.addIssue({
          code: 'custom',
          path: ['pages', pageIndex, 'operations', opIndex, 'target'],
          message: `operation target "${operation.target}" is not a declared collection id`,
        })
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
