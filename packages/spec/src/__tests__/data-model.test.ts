import type { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { finalizeSpec } from '../hash.js'
import { parseProjectSpecInput } from '../parse.js'
import { ProjectSpecInputSchema } from '../project-spec.js'
import { validSpecInput } from './fixture.js'

/**
 * The schema *input* type, not `ProjectSpecInput`: fields carrying `.default()`
 * are optional before parsing, which is exactly what these cases exercise.
 */
type RawSpecInput = z.input<typeof ProjectSpecInputSchema>

/** 一个合法的最小后台 spec（三页，含 collection/form/operations）。 */
function dataModelSpecInput(): RawSpecInput {
  const base = validSpecInput()
  return {
    ...base,
    theme: { ...base.theme, radius: 'sm', spacing: 'compact' },
    pages: [
      {
        route: '/orders',
        title: '订单管理',
        pageType: 'list-detail',
        blocks: [
          { component: 'DataTable', props: { collection: 'orders' }, assetBindings: {} },
          { component: 'StatsGrid', props: { heading: '概览' }, assetBindings: {} },
        ],
        operations: [
          { id: 'refresh-orders', label: '刷新', kind: 'refresh', target: 'orders' },
          { id: 'export-orders', label: '导出', kind: 'export', target: 'orders' },
        ],
      },
      {
        route: '/orders/new',
        title: '新建订单',
        pageType: 'form',
        blocks: [{ component: 'FormPanel', props: { form: 'order-form' }, assetBindings: {} }],
      },
      {
        route: '/settings',
        title: '设置',
        pageType: 'settings',
        blocks: [{ component: 'FormPanel', props: {}, assetBindings: {} }],
      },
    ],
    collections: [
      {
        id: 'orders',
        label: '订单',
        model: {
          id: { type: 'string', label: 'ID' },
          customer: { type: 'string', label: '客户' },
          amount: { type: 'number', label: '金额' },
          status: { type: 'enum', label: '状态', options: ['待处理', '已发货', '已完成'] },
          created: { type: 'date', label: '创建日期' },
          active: { type: 'boolean', label: '启用' },
        },
        fields: ['customer', 'amount', 'status', 'created', 'active'],
        seed: 4,
        actions: ['search', 'edit', 'delete', 'export'],
      },
    ],
    forms: [
      {
        id: 'order-form',
        label: '新建订单',
        collection: 'orders',
        fields: [
          { key: 'customer', label: '客户', type: 'string', required: true },
          { key: 'amount', label: '金额', type: 'number', validate: { min: 0, max: 999999 } },
          { key: 'status', label: '状态', type: 'enum' },
        ],
        submit: { label: '保存订单', toast: '订单已保存' },
      },
    ],
  }
}
describe('data model schemas', () => {
  it('accepts a spec with collections, forms and operations', () => {
    const result = parseProjectSpecInput(dataModelSpecInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.collections[0]!.seed).toBe(4)
    expect(result.value.collections[0]!.actions).toEqual(['search', 'edit', 'delete', 'export'])
    expect(result.value.pages[0]!.operations).toHaveLength(2)
    expect(result.value.forms[0]!.submit).toEqual({ label: '保存订单', toast: '订单已保存' })
  })

  it('defaults collections, forms and operations to empty for old specs (zero-break)', () => {
    // An old spec literally lacks the three new keys, so strip them rather than
    // relying on the fixture: with the keys present the defaults never run.
    const { collections: _c, forms: _f, ...legacy } = validSpecInput()
    const pages = legacy.pages.map(({ operations: _o, ...page }) => page)
    const result = parseProjectSpecInput({ ...legacy, pages })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.collections).toEqual([])
    expect(result.value.forms).toEqual([])
    expect(result.value.pages[0]!.operations).toEqual([])
  })

  it('finalizeSpec passes the new fields through (hash does not drop them)', () => {
    const parsed = parseProjectSpecInput(dataModelSpecInput())
    if (!parsed.ok) throw new Error(parsed.feedback)
    const spec = finalizeSpec(parsed.value)
    expect(spec.collections).toHaveLength(1)
    expect(spec.forms).toHaveLength(1)
    expect(spec.pages[0]!.operations).toHaveLength(2)
  })

  it('rejects a collection field that is not a model key', () => {
    const input = dataModelSpecInput()
    input.collections![0]!.fields = ['customer', 'ghost']
    const result = parseProjectSpecInput(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('collections[0].fields[1]')
    expect(result.feedback).toContain('not a model key')
  })

  it('rejects edit/delete actions without an id key in the model', () => {
    const input = dataModelSpecInput()
    const { id: _omitted, ...modelWithoutId } = input.collections![0]!.model
    input.collections![0]!.model = modelWithoutId
    const result = parseProjectSpecInput(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('collections[0].actions')
    expect(result.feedback).toContain('no "id" key')
  })

  it('rejects an operation target that is neither a route nor a collection', () => {
    const input = dataModelSpecInput()
    input.pages![0]!.operations![0]!.target = 'ghost-collection'
    const result = parseProjectSpecInput(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('not a declared collection id')
  })

  it('rejects an operation target that is a route no page declares', () => {
    const input = dataModelSpecInput()
    input.pages![0]!.operations![0]!.target = '/nope'
    const result = parseProjectSpecInput(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('not a declared route')
  })

  it('rejects duplicate operation ids on a page', () => {
    const input = dataModelSpecInput()
    input.pages![0]!.operations!.push({
      id: 'refresh-orders',
      label: '刷新',
      kind: 'refresh',
      target: 'orders',
    })
    const result = parseProjectSpecInput(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('duplicate operation id')
  })

  it('rejects a form that references an unknown collection', () => {
    const input = dataModelSpecInput()
    input.forms![0]!.collection = 'customers'
    const result = parseProjectSpecInput(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('unknown collection "customers"')
  })

  it('accepts an operation target that names a declared route', () => {
    const input = dataModelSpecInput()
    input.pages![0]!.operations![0]!.kind = 'route'
    input.pages![0]!.operations![0]!.target = '/orders/new'
    expect(parseProjectSpecInput(input).ok).toBe(true)
  })
})
