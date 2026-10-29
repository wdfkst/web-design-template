import { ref, type Ref } from 'vue'
import type { CollectionDefinition, Row } from './types'

export interface CollectionStore {
  rows: Ref<Row[]>
  get(id: string | number): Row | undefined
  create(values: Record<string, unknown>): Row
  update(id: string | number, values: Record<string, unknown>): void
  remove(ids: (string | number)[]): void
  setField(ids: (string | number)[], field: string, value: unknown): void
}

export function createRepository(definitions: CollectionDefinition[], seed: Record<string, Row[]>) {
  const stores = new Map<string, CollectionStore>()
  for (const definition of definitions) {
    const initial = structuredClone(seed[definition.id] ?? [])
    if (new Set(initial.map(row => String(row.id))).size !== initial.length) throw new Error('Duplicate record id')
    const rows = ref<Row[]>(initial)
    const numeric = definition.model.id?.type === 'number'
    let sequence = Math.max(0, ...initial.map(row => Number(String(row.id).replace(/^row-/, '')) || 0))
    const get = (id: string | number) => rows.value.find(row => String(row.id) === String(id))
    function validate(values: Record<string, unknown>) {
      for (const [key, value] of Object.entries(values)) {
        if (key === 'id') continue
        const field = definition.model[key]
        if (!field || !Object.hasOwn(definition.model, key)) throw new Error(`Unknown field: ${key}`)
        if (value === undefined || value === null || value === '') continue
        const valid = field.type === 'enum' ? typeof value === 'string' && field.options?.includes(value)
          : field.type === 'date' ? typeof value === 'string' && !Number.isNaN(Date.parse(value))
          : typeof value === field.type && (field.type !== 'number' || Number.isFinite(value))
        if (!valid) throw new Error(`Invalid field value: ${key}`)
      }
    }
    const store: CollectionStore = {
      rows, get,
      create(values) {
        validate(values)
        let id = values.id as string | number | undefined
        if (id === undefined || id === '') {
          do { sequence++; id = numeric ? sequence : `row-${sequence}` } while (get(id))
        }
        if (typeof id !== (numeric ? 'number' : 'string') || get(id)) throw new Error('Invalid or duplicate record id')
        const row: Row = { ...values, id }
        rows.value.push(row)
        return row
      },
      update(id, values) {
        const row = get(id)
        if (!row) throw new Error('Record not found')
        if (values.id !== undefined && String(values.id) !== String(row.id)) throw new Error('Record id cannot change')
        validate(values)
        Object.assign(row, { ...values, id: row.id })
      },
      remove(ids) {
        const selected = new Set(ids.map(String))
        rows.value = rows.value.filter(row => !selected.has(String(row.id)))
      },
      setField(ids, field, value) {
        if (field === 'id') throw new Error('Record id cannot change')
        validate({ [field]: value })
        for (const id of ids) { const row = get(id); if (row) row[field] = value }
      },
    }
    stores.set(definition.id, store)
  }
  return {
    getCollection(id: string): CollectionStore {
      const store = stores.get(id)
      if (!store) throw new Error(`Unknown collection: ${id}`)
      return store
    },
  }
}
