import { z } from 'zod'

export const PageTypeSchema = z.enum([
  'landing',
  'dashboard',
  'form',
  'list-detail',
  'auth',
  'settings',
])

/**
 * `assetBindings` maps a component's declared slot name to an asset id from the
 * manifest. This is the join between the code side and the image side.
 */
export const BlockSchema = z.object({
  component: z.string().regex(/^[A-Z][A-Za-z0-9]*$/, 'must be PascalCase'),
  props: z.record(z.string(), z.unknown()).default({}),
  assetBindings: z.record(z.string(), z.string()).default({}),
})

export const PageSchema = z.object({
  route: z.string().regex(/^\/[a-z0-9\-/:]*$/, 'must start with / and be lowercase'),
  title: z.string().min(1).max(120),
  pageType: PageTypeSchema,
  blocks: z.array(BlockSchema).min(1),
})

export type PageType = z.infer<typeof PageTypeSchema>
export type Block = z.infer<typeof BlockSchema>
export type Page = z.infer<typeof PageSchema>
