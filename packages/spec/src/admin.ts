import { z } from 'zod'
import type { Collection } from './collection.js'
import type { Form } from './form.js'

const id = z.string().regex(/^[a-z][a-z0-9-]*$/)
const route = z.string().regex(/^\/[a-z0-9\-/:]*$/)
export const AdminIconSchema = z.enum(['box', 'grid', 'users', 'settings', 'file', 'layers', 'chart', 'in', 'out', 'tool'])
const navBase = { id, label: z.string().min(1).max(80), icon: AdminIconSchema.optional() }
const leaf = z.object({ ...navBase, route }).strict()
export const AdminExperienceSchema = z.object({
  kind: z.literal('admin'),
  navigation: z.array(z.union([leaf, z.object({ ...navBase, children: z.array(leaf).min(1) }).strict()])).min(1),
}).strict()
export const ExperienceSchema = z.discriminatedUnion('kind', [
  AdminExperienceSchema, z.object({ kind: z.literal('marketing') }).strict(),
])
const actionBase = { label: z.string().min(1).max(40) }
export const AdminActionSchema = z.discriminatedUnion('kind', [
  z.object({ ...actionBase, kind: z.literal('create') }).strict(),
  z.object({ ...actionBase, kind: z.literal('edit') }).strict(),
  z.object({ ...actionBase, kind: z.literal('delete') }).strict(),
  z.object({ ...actionBase, kind: z.literal('bulk-delete') }).strict(),
  z.object({ ...actionBase, kind: z.literal('detail'), route }).strict(),
  z.object({ ...actionBase, kind: z.literal('set-field'), field: z.string().min(1), value: z.union([z.string(), z.number(), z.boolean()]) }).strict(),
])
export const AdminPageSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('list'), collection: id, form: id.optional(), filters: z.array(z.string()).default([]), columns: z.array(z.object({ field: z.string(), format: z.enum(['text', 'currency', 'date', 'status']).optional() }).strict()).min(1), actions: z.array(AdminActionSchema).default([]) }).strict(),
  z.object({ mode: z.literal('detail'), collection: id, returnRoute: route }).strict(),
  z.object({ mode: z.literal('form'), form: id, returnRoute: route }).strict(),
  z.object({ mode: z.literal('settings'), form: id, returnRoute: route }).strict(),
  z.object({ mode: z.literal('workbench'), collections: z.array(id).min(1), shortcuts: z.array(route).default([]) }).strict(),
])
export type AdminPage = z.infer<typeof AdminPageSchema>
export type AdminExperience = z.infer<typeof AdminExperienceSchema>

type Checked = {
  experience?: z.infer<typeof ExperienceSchema> | undefined
  collections: Collection[]
  forms: Form[]
  pages: { route: string; pageType: string; blocks: { component: string }[]; operations: unknown[]; admin?: AdminPage | undefined }[]
}

export function checkAdminIntegrity(spec: Checked, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })
  const admin = spec.experience?.kind === 'admin'
  const routes = new Map(spec.pages.map(p => [p.route, p]))
  const collections = new Map(spec.collections.map(c => [c.id, c]))
  const forms = new Map(spec.forms.map(f => [f.id, f]))
  if (admin && spec.experience?.kind === 'admin') {
    const seen = new Set<string>()
    for (const item of spec.experience.navigation) {
      for (const entry of [item, ...('children' in item ? item.children : [])]) {
        if (seen.has(entry.id)) issue(['experience', 'navigation'], `duplicate navigation id "${entry.id}"`)
        seen.add(entry.id)
        if ('route' in entry && (!routes.has(entry.route) || routes.get(entry.route)?.pageType === 'auth')) issue(['experience', 'navigation'], `unknown or auth navigation route "${entry.route}"`)
      }
    }
    if (forms.size !== spec.forms.length) issue(['forms'], 'duplicate form id')
    for (const form of spec.forms) {
      const collection = form.collection ? collections.get(form.collection) : undefined
      if (collection) for (const field of form.fields) {
        if (collection.model[field.key]?.type !== field.type) issue(['forms'], `form "${form.id}" field "${field.key}" does not match collection model`)
      }
    }
  }
  spec.pages.forEach((page, index) => {
    const path = ['pages', index] as (string | number)[]
    if (!admin) {
      if (page.blocks.length === 0) issue([...path, 'blocks'], 'legacy pages require blocks')
      if (page.admin) issue([...path, 'admin'], 'admin page requires admin experience')
      return
    }
    if (page.operations.length) issue([...path, 'operations'], 'admin pages use typed actions, not legacy operations')
    if (page.blocks.length > 1) issue([...path, 'blocks'], 'admin pages support at most one illustration panel')
    const allowedBlocks = page.pageType === 'auth' ? ['AuthPanel'] : ['EmptyStatePanel']
    if (page.blocks.some(b => !allowedBlocks.includes(b.component))) issue([...path, 'blocks'], 'admin pages cannot use incompatible blocks')
    const config = page.admin
    if (!config) {
      if (page.pageType !== 'auth' || !page.blocks.some(b => b.component === 'AuthPanel')) issue(path, 'admin business page requires a page configuration')
      return
    }
    const types = { list: 'list-detail', detail: 'list-detail', form: 'form', settings: 'settings', workbench: 'dashboard' }
    if (page.pageType !== types[config.mode]) issue([...path, 'pageType'], 'page type does not match admin mode')
    if ('returnRoute' in config && !routes.has(config.returnRoute)) issue(path, 'unknown return route')
    if (config.mode === 'workbench') {
      if (config.collections.some(c => !collections.has(c)) || config.shortcuts.some(r => !routes.has(r))) issue(path, 'unknown workbench collection or route')
      return
    }
    if (config.mode === 'form' || config.mode === 'settings') {
      const form = forms.get(config.form)
      if (!form) issue(path, 'unknown form')
      else if (config.mode === 'form' && !form.collection) issue(path, 'record form requires a bound collection')
      else if (config.mode === 'settings' && form.collection) issue(path, 'settings requires an unbound form')
      return
    }
    const collection = collections.get(config.collection)
    if (!collection) { issue(path, 'unknown collection'); return }
    if (config.mode === 'detail') return
    for (const field of [...config.filters, ...config.columns.map(c => c.field)]) {
      if (!Object.hasOwn(collection.model, field)) issue(path, `unknown collection field "${field}"`)
    }
    if (config.form && forms.get(config.form)?.collection !== collection.id) issue(path, 'list form must reference the same collection')
    for (const action of config.actions) {
      if (action.kind !== 'detail' && !['string', 'number'].includes(collection.model.id?.type ?? '')) issue(path, 'mutable list requires a string or number id')
      if (['create', 'edit'].includes(action.kind) && (!config.form || forms.get(config.form)?.collection !== collection.id)) issue(path, 'create/edit requires a matching form')
      if (action.kind === 'detail') {
        const target = routes.get(action.route)?.admin
        if (target?.mode !== 'detail' || target.collection !== collection.id) issue(path, 'detail action requires a matching detail page')
      }
      if (action.kind === 'set-field') {
        const field = collection.model[action.field]
        const valid = field && action.field !== 'id' && (field.type === 'enum' ? typeof action.value === 'string' && field.options?.includes(action.value) : field.type === 'date' ? typeof action.value === 'string' && !Number.isNaN(Date.parse(action.value)) : typeof action.value === field.type)
        if (!valid) issue(path, 'set-field value does not match model')
      }
    }
  })
}
