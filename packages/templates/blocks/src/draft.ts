import {
  BlockSchema,
  MetaSchema,
  PageSchema,
  PageTypeSchema,
  StyleBibleSchema,
  ThemeSchema,
  formatIssues,
  type ProjectSpecInput,
} from '@vudt/spec'
import { z } from 'zod'
import {
  BlockDerivationError,
  assertCtaTargets,
  derivePageAssets,
  mergeDerivedAssets,
  type BlockSelection,
} from './derive.js'
import { SlotContentSchema } from './slot.js'

const DraftBlockSchema = z.object({
  component: BlockSchema.shape.component,
  props: BlockSchema.shape.props,
  /** Subject text per slot name. Geometry cannot be written here by design. */
  content: z.record(z.string(), SlotContentSchema).optional(),
})

const DraftPageSchema = z.object({
  route: PageSchema.shape.route,
  title: PageSchema.shape.title,
  pageType: PageTypeSchema,
  blocks: z.array(DraftBlockSchema).min(1),
})

/**
 * What the drafter returns. Identical to a spec except that a block carries
 * subject text (`content`) instead of `assetBindings`, and there is no `assets`
 * array: both are derived from the block sidecars, never written by the model.
 * The spec's own schema pieces are reused so the two shapes cannot drift apart.
 */
export const ProjectDraftSchema = z.object({
  meta: MetaSchema,
  theme: ThemeSchema,
  styleBible: StyleBibleSchema,
  pages: z.array(DraftPageSchema).min(1),
})

export type ProjectDraft = z.infer<typeof ProjectDraftSchema>

export type DeriveSpecResult =
  | { ok: true; value: ProjectSpecInput }
  | { ok: false; feedback: string }

function toSelection(block: ProjectDraft['pages'][number]['blocks'][number]): BlockSelection {
  return {
    component: block.component,
    props: block.props,
    ...(block.content === undefined ? {} : { content: block.content }),
  }
}

/**
 * The one place a draft becomes a spec.
 *
 * Geometry and asset ids come from `derivePageAssets`, so a draft can only be
 * wrong about the blocks it picked and the words it wrote — never about the
 * shape of an image. Every failure is returned as text the retry prompt can
 * carry verbatim.
 */
export function deriveSpecInput(draft: unknown): DeriveSpecResult {
  const parsed = ProjectDraftSchema.safeParse(draft)
  if (!parsed.success) return { ok: false, feedback: formatIssues(parsed.error.issues) }

  const { meta, theme, styleBible, pages } = parsed.data

  try {
    const routes = new Set(pages.map((page) => page.route))
    const derivations = pages.map((page) => {
      const selections = page.blocks.map(toSelection)
      return { page, selections, derived: derivePageAssets(page.route, selections) }
    })

    // Targets are checked after derivation so a layout block is reported as a
    // layout (and an invented component as unknown) rather than as a bad route —
    // a draft carrying NavBarSimple would otherwise trip the `to` check first,
    // because its `links` prop is full of `to` keys.
    for (const entry of derivations) {
      assertCtaTargets(entry.page.route, entry.selections, routes)
    }

    const assets = mergeDerivedAssets(derivations.map((entry) => entry.derived))

    return {
      ok: true,
      value: {
        meta,
        theme,
        styleBible,
        pages: derivations.map(({ page, derived }) => ({
          route: page.route,
          title: page.title,
          pageType: page.pageType,
          blocks: derived.blocks,
        })),
        assets,
      },
    }
  } catch (error) {
    // The derivation errors already name the offending block, slot or route.
    if (error instanceof BlockDerivationError) return { ok: false, feedback: error.message }
    throw error
  }
}
