import { z } from 'zod'

/**
 * A page-level action the generated app wires to a button. `target` is either a
 * collection id or a declared route, verified by shape only (a leading `/` means
 * a route) in checkReferentialIntegrity; the pairing of `kind` to `target` shape
 * is the code generator's call.
 */
export const OperationSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().min(1).max(20),
  kind: z.enum(['refresh', 'route', 'export', 'filter']),
  target: z.string(), // collection id 或路由
  param: z.string().optional(), // filter 用：搜索词
})

export type Operation = z.infer<typeof OperationSchema>
