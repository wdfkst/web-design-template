import { z } from 'zod'
import type { Collection } from './collection.js'

const id = z.string().regex(/^[a-z][a-z0-9-]*$/)
const route = z.string().regex(/^\/[a-z0-9\-/:]*$/)
const fields = z.array(z.string().min(1)).min(1).refine(values => new Set(values).size === values.length, 'duplicate fields')
const base = { id, title: z.string().min(1).max(80) }
const filter = z.object({ field: z.string().min(1), value: z.union([z.string(), z.boolean()]) }).strict()
export const WorkbenchModuleSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('summary'), collection: id, metric: z.enum(['count', 'sum']), field: z.string().optional(), filter: filter.optional() }).strict(),
  z.object({ ...base, kind: z.literal('breakdown'), collection: id, field: z.string().min(1) }).strict(),
  z.object({ ...base, kind: z.literal('records'), collection: id, fields, limit: z.number().int().min(1).max(10), sort: z.object({ field: z.string().min(1), direction: z.enum(['asc', 'desc']) }).strict().optional(), filter: filter.optional(), detailRoute: route.optional() }).strict(),
  z.object({ ...base, kind: z.literal('shortcuts'), routes: z.array(route).min(1).refine(values => new Set(values).size === values.length, 'duplicate routes') }).strict(),
])
export type WorkbenchModule = z.infer<typeof WorkbenchModuleSchema>
export const WorkbenchPageSchema = z.object({
  mode: z.literal('workbench'), collections: z.array(id).min(1).optional(), shortcuts: z.array(route).optional(),
  modules: z.array(WorkbenchModuleSchema).min(1).max(8).optional(),
  variant: z.enum(['overview', 'focus']).optional(), primaryModuleId: id.optional(),
}).strict().superRefine((config, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message })
  if (config.modules) {
    if (config.collections !== undefined || config.shortcuts !== undefined) issue('modules cannot mix with legacy collections/shortcuts')
    if (new Set(config.modules.map(m => m.id)).size !== config.modules.length) issue('duplicate module id')
    if (config.variant === 'focus') {
      if (!config.modules.some(m => m.id === config.primaryModuleId && m.kind === 'records')) issue('focus requires a primary records module')
    } else if (config.primaryModuleId !== undefined) issue('primary module requires focus')
  } else if (!config.collections || config.variant !== undefined || config.primaryModuleId !== undefined) issue('legacy workbench requires collections without variant')
})
export type WorkbenchPage = z.infer<typeof WorkbenchPageSchema>
export interface WorkbenchTarget { route: string; pageType: string; admin?: { mode: string; collection?: string | undefined } | undefined }

export function checkWorkbenchIntegrity(config: WorkbenchPage, collections: Map<string, Collection>, pages: Map<string, WorkbenchTarget>, ctx: z.RefinementCtx, path: (string | number)[]): void {
  const issue = (message: string, suffix: (string | number)[] = []) => ctx.addIssue({ code: 'custom', path: [...path, ...suffix], message })
  if (!config.modules) {
    if (config.collections?.some(c => !collections.has(c)) || config.shortcuts?.some(r => !pages.has(r))) issue('unknown workbench collection or route')
    return
  }
  config.modules.forEach((module, index) => {
    const fail = (message: string) => issue(message, ['modules', index])
    if (module.kind === 'shortcuts') {
      if (module.routes.some(r => !pages.has(r) || pages.get(r)?.pageType === 'auth')) fail('unknown or auth shortcut route')
      return
    }
    const collection = collections.get(module.collection)
    if (!collection) { fail('unknown module collection'); return }
    const model = collection.model
    if ('filter' in module && module.filter) {
      const field = model[module.filter.field]
      if (!(field?.type === 'boolean' && typeof module.filter.value === 'boolean') && !(field?.type === 'enum' && typeof module.filter.value === 'string' && field.options?.includes(module.filter.value))) fail('filter value does not match enum or boolean field')
    }
    if (module.kind === 'summary') {
      if (module.metric === 'sum' ? !module.field || model[module.field]?.type !== 'number' : module.field !== undefined) fail('sum requires numeric field; count forbids field')
    } else if (module.kind === 'breakdown') {
      if (!['enum', 'boolean'].includes(model[module.field]?.type ?? '')) fail('breakdown requires enum or boolean field')
    } else {
      if (module.fields.some(f => !Object.hasOwn(model, f))) fail('unknown records field')
      if (module.sort && !['date', 'number'].includes(model[module.sort.field]?.type ?? '')) fail('records sort requires date or number field')
      if (module.detailRoute) {
        const target = pages.get(module.detailRoute)?.admin
        if (target?.mode !== 'detail' || target.collection !== module.collection || !['string', 'number'].includes(model.id?.type ?? '')) fail('records detail requires matching collection and model id')
      }
    }
  })
}
