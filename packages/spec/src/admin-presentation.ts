import { z } from 'zod'

export const AdminPresentationSchema = z.object({
  appearance: z.enum(['plain', 'soft-glass']).default('soft-glass'),
  decoration: z.enum(['minimal', 'balanced']).default('balanced'),
  density: z.enum(['compact', 'comfortable']).optional(),
  shell: z.enum(['sidebar', 'topbar']).default('sidebar'),
}).strict()
export type AdminPresentation = z.infer<typeof AdminPresentationSchema>
