import { beforeEach, describe, expect, it } from 'vitest'
import { createRepository } from '../data/repository'

const definition = { id: 'items', model: { id: { type: 'number', label: '编号' }, name: { type: 'string', label: '名称' } } }
let repository: ReturnType<typeof createRepository>
beforeEach(() => { repository = createRepository([definition], { items: [{ id: 1, name: '原始' }] }) })
describe('shared mock repository', () => {
  it('shares changes across page consumers and normalizes route ids', () => {
    const first = repository.getCollection('items'), second = repository.getCollection('items')
    expect(first).toBe(second)
    first.update('1', { name: '已修改' })
    expect(second.get(1)?.name).toBe('已修改')
  })
  it('does not mutate records when editing a detached draft', () => {
    const store = repository.getCollection('items')
    const draft = { ...store.get(1)! }; draft.name = '草稿'
    expect(store.get(1)?.name).toBe('原始')
  })
  it('allocates numeric ids and rejects duplicate creation', () => {
    const store = repository.getCollection('items')
    expect(store.create({ name: '新商品' }).id).toBe(2)
    expect(() => store.create({ id: 1, name: '重复' })).toThrow()
    expect(store.rows.value).toHaveLength(2)
  })
  it('does not remove unrelated records for an unknown id', () => {
    const store = repository.getCollection('items'); store.remove(['missing'])
    expect(store.rows.value).toHaveLength(1)
    expect(() => store.update(99, { name: '未知' })).toThrow()
  })
  it('prevents id mutation and malformed field values', () => {
    const store = repository.getCollection('items')
    expect(() => store.setField([1], 'id', 20)).toThrow()
    expect(() => store.setField([1], 'name', true)).toThrow()
    expect(() => store.update(1, { id: 2 })).toThrow()
  })
  it('rejects duplicate seed ids after normalization', () => {
    expect(() => createRepository([definition], { items: [{ id: 1 }, { id: '1' }] })).toThrow()
  })
})
