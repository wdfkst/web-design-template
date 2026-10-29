import { describe, expect, it } from 'vitest'
import { ProjectSpecInputSchema } from '../project-spec.js'
import { validSpecInput } from './fixture.js'

function adminInput() {
  return {
    ...validSpecInput(), assets: [],
    experience: { kind: 'admin', navigation: [{ id: 'items', label: '商品', icon: 'box', route: '/' }] },
    collections: [{ id: 'items', label: '商品', model: { id: { type: 'number', label: '编号' }, name: { type: 'string', label: '名称' } }, fields: ['id', 'name'], seed: 8, actions: [] }],
    pages: [{ route: '/', title: '商品', pageType: 'list-detail', blocks: [], operations: [], admin: { mode: 'list', collection: 'items', filters: ['name'], columns: [{ field: 'name' }], actions: [] } }],
  }
}

describe('admin project contract', () => {
  it('preserves explicit admin configuration and permits block-free business pages', () => {
    const result = ProjectSpecInputSchema.parse(adminInput())
    expect(result).toHaveProperty('experience.kind', 'admin')
    expect(result.pages[0]).toHaveProperty('admin.mode', 'list')
  })
  it('requires a model id even when create is the only mutation', () => {
    const input: any = adminInput()
    delete input.collections[0].model.id
    input.collections[0].fields = ['name']
    input.forms = [{ id: 'item-form', label: '商品', collection: 'items', fields: [{ key: 'name', label: '名称', type: 'string' }] }]
    input.pages[0].admin.form = 'item-form'
    input.pages[0].admin.actions = [{ kind: 'create', label: '新增' }]
    const result = ProjectSpecInputSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(i => i.message.includes('id'))).toBe(true)
  })
  it('supports all five business modes with a single model and form', () => {
    const input: any = adminInput()
    input.forms = [{ id: 'item-form', label: '商品', collection: 'items', fields: [{ key: 'name', label: '名称', type: 'string' }] }]
    input.forms.push({ id: 'preferences', label: '偏好', fields: [{ key: 'name', label: '名称', type: 'string' }] })
    input.pages[0].admin.form = 'item-form'
    input.pages[0].admin.actions = [{ kind: 'create', label: '新增' }, { kind: 'edit', label: '编辑' }, { kind: 'detail', label: '详情', route: '/detail' }]
    input.pages.push(
      { route: '/detail', title: '详情', pageType: 'list-detail', blocks: [], admin: { mode: 'detail', collection: 'items', returnRoute: '/' } },
      { route: '/form', title: '表单', pageType: 'form', blocks: [], admin: { mode: 'form', form: 'item-form', returnRoute: '/' } },
      { route: '/settings', title: '设置', pageType: 'settings', blocks: [], admin: { mode: 'settings', form: 'preferences', returnRoute: '/' } },
      { route: '/dashboard', title: '工作台', pageType: 'dashboard', blocks: [], admin: { mode: 'workbench', collections: ['items'], shortcuts: ['/'] } },
    )
    expect(ProjectSpecInputSchema.safeParse(input).success).toBe(true)
    input.forms[0].collection = 'other'
    expect(ProjectSpecInputSchema.safeParse(input).success).toBe(false)
  })
  it('rejects collection-bound settings to prevent saving preferences as new records', () => {
    const input: any = adminInput()
    input.forms = [{ id: 'bound', label: '设置', collection: 'items', fields: [{ key: 'name', label: '名称', type: 'string' }] }]
    input.pages[0].pageType = 'settings'
    input.pages[0].admin = { mode: 'settings', form: 'bound', returnRoute: '/' }
    const result = ProjectSpecInputSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(issue => issue.message.includes('unbound form'))).toBe(true)
  })
  it('rejects standalone record forms without a collection', () => {
    const input: any = adminInput()
    input.forms = [{ id: 'unbound', label: '表单', fields: [{ key: 'name', label: '名称', type: 'string' }] }]
    input.pages[0].pageType = 'form'
    input.pages[0].admin = { mode: 'form', form: 'unbound', returnRoute: '/' }
    const result = ProjectSpecInputSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(issue => issue.message.includes('bound collection'))).toBe(true)
  })
  it('rejects multiple illustration panels instead of generating unused assets', () => {
    const input: any = adminInput()
    input.pages[0].blocks = [{ component: 'EmptyStatePanel' }, { component: 'EmptyStatePanel' }]
    const result = ProjectSpecInputSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(issue => issue.message.includes('at most one'))).toBe(true)
  })
  it('rejects auth blocks on business pages', () => {
    const input: any = adminInput()
    input.pages[0].blocks = [{ component: 'AuthPanel' }]
    expect(ProjectSpecInputSchema.safeParse(input).success).toBe(false)
  })
  it('rejects duplicate menu ids', () => {
    const input = adminInput()
    input.experience.navigation.push({ ...input.experience.navigation[0]! })
    expect(ProjectSpecInputSchema.safeParse(input).success).toBe(false)
  })
  it('keeps legacy specifications compatible', () => {
    expect(ProjectSpecInputSchema.parse(validSpecInput())).not.toHaveProperty('experience')
  })
  it('rejects empty legacy pages', () => {
    const input = validSpecInput()
    input.pages[0]!.blocks = []
    expect(ProjectSpecInputSchema.safeParse(input).success).toBe(false)
  })
  it.each([
    ['unknown filter', (s: any) => { s.pages[0].admin.filters = ['missing'] }],
    ['unknown column', (s: any) => { s.pages[0].admin.columns = [{ field: 'missing' }] }],
    ['dangling navigation', (s: any) => { s.experience.navigation[0].route = '/missing' }],
    ['unknown icon', (s: any) => { s.experience.navigation[0].icon = '<svg>' }],
    ['marketing block', (s: any) => { s.pages[0].blocks = [{ component: 'HeroSplit' }] }],
    ['legacy operation', (s: any) => { s.pages[0].operations = [{ id: 'refresh', label: '刷新', kind: 'refresh', target: 'items' }] }],
    ['missing edit form', (s: any) => { s.pages[0].admin.actions = [{ kind: 'edit', label: '编辑' }] }],
    ['invalid field value', (s: any) => { s.pages[0].admin.actions = [{ kind: 'set-field', label: '更新', field: 'name', value: true }] }],
    ['wrong page type', (s: any) => { s.pages[0].pageType = 'landing' }],
    ['unknown config key', (s: any) => { s.pages[0].admin.typo = true }],
    ['third menu level', (s: any) => { s.experience.navigation = [{ id: 'a', label: 'A', children: [{ id: 'b', label: 'B', children: [{ id: 'c', label: 'C', route: '/' }] }] }] }],
  ])('rejects %s', (_name, mutate) => {
    const input = adminInput()
    mutate(input)
    expect(ProjectSpecInputSchema.safeParse(input).success).toBe(false)
  })
})
