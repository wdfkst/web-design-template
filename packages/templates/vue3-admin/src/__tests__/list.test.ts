import { expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createRepository } from '../data/repository'
import { useAdminList } from '../composables/useAdminList'

it('matches enum filters exactly rather than matching a substring', () => {
  const model = { status: { type: 'enum', label: '状态', options: ['启用', '未启用'] } }
  const store = createRepository([{ id: 'items', model }], { items: [{ id: 1, status: '启用' }, { id: 2, status: '未启用' }] }).getCollection('items')
  const list = useAdminList(store, ['status'], model)
  list.draft.status = '启用'; list.query()
  expect(list.filtered.value.map(row => row.id)).toEqual([1])
})

function setup() {
  const store = createRepository([{ id: 'items', model: { id: { type: 'number', label: '编号' }, name: { type: 'string', label: '名称' } } }], { items: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `商品${i + 1}` })) }).getCollection('items')
  return { store, list: useAdminList(store, ['name']) }
}
it('filters only on query and resets page and selection', () => {
  const { list } = setup()
  list.page.value = 2; list.selected.value = [1]; list.draft.name = '商品1'
  expect(list.filtered.value).toHaveLength(9)
  list.query()
  expect(list.filtered.value).toHaveLength(1)
  expect(list.page.value).toBe(1)
  expect(list.selected.value).toEqual([])
  list.reset(); expect(list.filtered.value).toHaveLength(9)
})
it('clamps page after deletion and removes stale selection', async () => {
  const { store, list } = setup()
  list.page.value = 2; list.selected.value = [9]; store.remove([9])
  await nextTick()
  expect(list.page.value).toBe(1)
  expect(list.selected.value).toEqual([])
})
