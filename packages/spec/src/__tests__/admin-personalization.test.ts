import { describe, expect, it } from 'vitest'
import { ProjectSpecInputSchema } from '../project-spec.js'
import { validSpecInput } from './fixture.js'

function input(config: Record<string, unknown>, pageType = 'list-detail') {
  return {
    ...validSpecInput(), assets: [],
    experience: { kind: 'admin', navigation: [{ id: 'items', label: '记录', route: '/' }] },
    collections: [{ id: 'items', label: '记录', model: {
      id: { type: 'number', label: '编号' }, name: { type: 'string', label: '名称' },
      amount: { type: 'number', label: '金额' }, state: { type: 'enum', label: '状态', options: ['open', 'done'] },
    }, fields: ['id', 'name', 'amount', 'state'], seed: 3, actions: [] }],
    forms: [{ id: 'item-form', label: '记录', collection: 'items', fields: [{ key: 'name', label: '名称', type: 'string' }] }],
    pages: [{ route: '/', title: '记录', pageType, blocks: [], operations: [], admin: config },
      { route: '/detail', title: '详情', pageType: 'list-detail', blocks: [], operations: [], admin: { mode: 'detail', collection: 'items', returnRoute: '/' } }],
  }
}
const list = { mode: 'list', collection: 'items', columns: [{ field: 'name' }], actions: [] }
const summary = { id: 'total', title: '总数', kind: 'summary', collection: 'items', metric: 'count' }
const records = { id: 'recent', title: '记录', kind: 'records', collection: 'items', fields: ['name'], limit: 10 }
const parse = (config: Record<string, unknown>, pageType?: string) => ProjectSpecInputSchema.safeParse(input(config, pageType))

describe('personalized admin contract', () => {
  it('preserves legacy specs without injecting presentation', () => {
    expect(ProjectSpecInputSchema.parse(input(list)).experience).not.toHaveProperty('presentation')
    expect(ProjectSpecInputSchema.safeParse(validSpecInput()).success).toBe(true)
    expect(parse({ mode: 'workbench', collections: ['items'] }, 'dashboard').success).toBe(true)
  })
  it('accepts presentation without changing absent density to a default', () => {
    const source = { ...input(list), experience: { ...input(list).experience, presentation: {} } }
    const result = ProjectSpecInputSchema.parse(source)
    expect(result.experience).toHaveProperty('presentation.appearance', 'soft-glass')
    expect(result.experience).not.toHaveProperty('presentation.density')
  })
  it('accepts cards, aside details and complete form grouping', () => {
    expect(parse({ ...list, variant: 'cards', card: { titleField: 'name', summaryFields: ['amount'] } }).success).toBe(true)
    expect(parse({ mode: 'detail', collection: 'items', returnRoute: '/', variant: 'aside', asideFields: ['state'] }).success).toBe(true)
    expect(parse({ mode: 'form', form: 'item-form', returnRoute: '/', variant: 'grouped', groups: [{ id: 'main', title: '基本', fields: ['name'] }] }, 'form').success).toBe(true)
  })
  it.each([
    { ...list, variant: 'cards' },
    { ...list, variant: 'cards', card: { titleField: 'missing', summaryFields: [] } },
    { ...list, variant: 'cards', card: { titleField: 'amount', summaryFields: [] } },
    { ...list, card: { titleField: 'name', summaryFields: [] } },
    { mode: 'detail', collection: 'items', returnRoute: '/', variant: 'aside', asideFields: ['missing'] },
  ])('rejects invalid field projections %#', config => expect(parse(config).success).toBe(false))
  it.each([{ fields: [] }, { fields: ['name', 'name'] }, { fields: ['missing'] }])('rejects incomplete or repeated grouped fields $fields', ({ fields }) => {
    expect(parse({ mode: 'form', form: 'item-form', returnRoute: '/', variant: 'grouped', groups: [{ id: 'main', title: '基本', fields }] }, 'form').success).toBe(false)
  })
  it('accepts eight modules and ten records but rejects larger limits', () => {
    const modules = Array.from({ length: 8 }, (_, i) => ({ ...summary, id: `total-${i}` }))
    expect(parse({ mode: 'workbench', modules }, 'dashboard').success).toBe(true)
    expect(parse({ mode: 'workbench', modules: [...modules, { ...summary, id: 'ninth' }] }, 'dashboard').success).toBe(false)
    expect(parse({ mode: 'workbench', modules: [records] }, 'dashboard').success).toBe(true)
    expect(parse({ mode: 'workbench', modules: [{ ...records, limit: 11 }] }, 'dashboard').success).toBe(false)
  })
  it('preserves auth pages but rejects auth shortcuts', () => {
    const source = input({ mode: 'workbench', modules: [{ id: 'links', title: '入口', kind: 'shortcuts', routes: ['/detail'] }] }, 'dashboard')
    const auth = { route: '/login', title: '登录', pageType: 'auth', blocks: [{ component: 'AuthPanel', props: {}, assetBindings: {} }], operations: [] }
    const withAuth = { ...source, pages: [...source.pages, auth] }
    expect(ProjectSpecInputSchema.safeParse(withAuth).success).toBe(true)
    source.pages[0]!.admin = { mode: 'workbench', modules: [{ id: 'links', title: '入口', kind: 'shortcuts', routes: ['/login'] }] }
    expect(ProjectSpecInputSchema.safeParse({ ...source, pages: [...source.pages, auth] }).success).toBe(false)
  })
  it('rejects a detail route for another collection', () => {
    const source = input({ mode: 'workbench', modules: [{ ...records, detailRoute: '/detail' }] }, 'dashboard')
    source.collections.push({ ...source.collections[0]!, id: 'other' })
    source.pages[1]!.admin = { mode: 'detail', collection: 'other', returnRoute: '/' }
    expect(ProjectSpecInputSchema.safeParse(source).success).toBe(false)
  })
  it('accepts typed aggregates, grouping and matching record destinations', () => {
    expect(parse({ mode: 'workbench', variant: 'focus', primaryModuleId: 'recent', modules: [
      { ...summary, metric: 'sum', field: 'amount', filter: { field: 'state', value: 'open' } },
      { id: 'states', title: '状态', kind: 'breakdown', collection: 'items', field: 'state' },
      { ...records, detailRoute: '/detail' }, { id: 'links', title: '入口', kind: 'shortcuts', routes: ['/detail'] },
    ] }, 'dashboard').success).toBe(true)
  })
  it.each([
    { modules: [summary], collections: ['items'] },
    { modules: [summary], shortcuts: [] },
    { modules: [summary, summary] },
    { modules: [{ ...summary, metric: 'sum', field: 'name' }] },
    { modules: [{ ...summary, filter: { field: 'state', value: 'wrong' } }] },
    { modules: [{ ...records, detailRoute: '/' }] },
    { modules: [{ ...records, fields: ['missing'] }] },
    { modules: [{ ...records, sort: { field: 'name', direction: 'asc' } }] },
    { modules: [summary], variant: 'focus', primaryModuleId: 'total' },
    { modules: [records], variant: 'focus', primaryModuleId: 'missing' },
    { modules: [summary], typo: true },
  ])('rejects invalid workbench references or mixed formats %#', config => {
    expect(parse({ mode: 'workbench', ...config }, 'dashboard').success).toBe(false)
  })
})
