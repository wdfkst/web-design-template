import { z } from 'zod'

export const AdminPresentationSchema = z.object({
  appearance: z.enum(['plain', 'soft-glass', 'jelly']).default('soft-glass'),
  decoration: z.enum(['minimal', 'balanced']).default('balanced'),
  density: z.enum(['compact', 'comfortable']).optional(),
  shell: z.enum(['sidebar', 'topbar']).default('sidebar'),
  motif: z.enum(['spark', 'bloom', 'orbit', 'toolkit']).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.motif !== undefined && value.appearance !== 'jelly') {
    ctx.addIssue({ code: 'custom', path: ['motif'], message: 'motif requires jelly appearance' })
  }
})
export type AdminPresentation = z.infer<typeof AdminPresentationSchema>
