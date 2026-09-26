import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { renderCollections } from '../data.js'
import { renderStore } from '../store.js'
import { dataModelSpec } from './fixture.js'

const emitDir = join(dirname(fileURLToPath(import.meta.url)), '.tmp-emit')

beforeAll(async () => {
  await rm(emitDir, { recursive: true, force: true })
  await mkdir(emitDir, { recursive: true })
  await writeFile(join(emitDir, 'mock.ts'), renderCollections(dataModelSpec()))
  await writeFile(join(emitDir, 'store.ts'), renderStore(dataModelSpec()))
})

afterAll(async () => {
  await rm(emitDir, { recursive: true, force: true })
})

async function emittedStore() {
  return import(pathToFileURL(join(emitDir, 'store.ts')).toString())
}

describe('renderCollections (src/data/mock.ts)', () => {
  const mock = renderCollections(dataModelSpec())

  it('exports MOCK_ROWS with one entry per collection', () => {
    expect(mock).toContain('export type Row = Record<string, unknown> & { id: string }')
    expect(mock).toContain('export const MOCK_ROWS: Record<string, Row[]> = {')
    expect(mock).toContain('"orders": [')
  })

  it('generates the requested number of rows, each with a deterministic id', () => {
    // seed: 2 → row-1, row-2（JSON.stringify 紧凑格式，键后无空格）
    expect(mock).toContain('"id":"row-1"')
    expect(mock).toContain('"id":"row-2"')
    expect(mock).not.toContain('"id":"row-3"')
  })

  it('generates field values deterministically by type', () => {
    // string: pool[row % 8]-{row+1}；number: 100 + (row+1)*17；
    // date: 2026-09-01 起偏移；enum: options[row % len]；boolean: (row+1) % 2 === 0
    expect(mock).toContain('"customer":"订单-1"')
    expect(mock).toContain('"customer":"客户-2"')
    expect(mock).toContain('"amount":117')
    expect(mock).toContain('"amount":134')
    expect(mock).toContain('"created":"2026-09-01"')
    expect(mock).toContain('"created":"2026-09-02"')
    expect(mock).toContain('"status":"待处理"')
    expect(mock).toContain('"status":"已发货"')
    expect(mock).toContain('"active":false')
    expect(mock).toContain('"active":true')
  })

  it('is deterministic: same spec in, identical bytes out', () => {
    expect(renderCollections(dataModelSpec())).toBe(renderCollections(dataModelSpec()))
  })

  it('emits an empty object for a spec without collections (zero-break)', () => {
    expect(renderCollections({ ...dataModelSpec(), collections: [] })).toContain(
      'export const MOCK_ROWS: Record<string, Row[]> = {\n}',
    )
  })})

describe('renderStore (src/data/store.ts)', () => {
  const store = renderStore(dataModelSpec())

  it('exports a per-collection store factory with the spec contract methods', () => {
    expect(store).toContain('export interface CollectionStore {')
    expect(store).toContain('search(query: string): Row[]')
    expect(store).toContain(`sort(field: string, dir: 'asc' | 'desc'): Row[]`)
    expect(store).toContain('page(pageSize: number, pageNum: number): Row[]')
    expect(store).toContain('add(row: Row): void')
    expect(store).toContain('remove(id: string): void')
  })

  it('replaces rows by id and allocates a non-colliding id after removal', async () => {
    const { createCollectionStore } = await emittedStore()
    const replacement = createCollectionStore([{ id: 'row-1', customer: '甲' }])
    replacement.update({ id: 'row-1', customer: '乙' })
    expect(replacement.rows).toEqual([{ id: 'row-1', customer: '乙' }])

    const appended = createCollectionStore([{ id: 'row-1', customer: '甲' }, { id: 'row-2', customer: '乙' }])
    appended.remove('row-1')
    appended.update({ customer: '丙' })
    expect(appended.rows.map((row: { id: string }) => row.id)).toEqual(['row-2', 'row-3'])
  })

  it('sorts numeric columns numerically', async () => {
    const { createCollectionStore } = await emittedStore()
    const collection = createCollectionStore([{ id: 'row-1', amount: 1000 }, { id: 'row-2', amount: 117 }])
    expect(collection.sort('amount', 'asc').map((row: { id: string }) => row.id)).toEqual(['row-2', 'row-1'])
  })

  it('escapes commas, quotes, and newlines in CSV cells', async () => {
    const { rowsToCsv } = await emittedStore()
    const csv = rowsToCsv([{ id: 'row-1', customer: '上海, 有限公司', note: '多行\n备注', quote: '他说"你好"' }])
    expect(csv).toContain('"上海, 有限公司"')
    expect(csv).toContain('"多行\n备注"')
    expect(csv).toContain('"他说""你好"""')
  })

  it('executes search, paging, lookup, add, and isolated store instances', async () => {
    const { createCollectionStore, useCollectionRows } = await emittedStore()
    const collection = createCollectionStore([{ id: 'row-1', customer: '甲' }, { id: 'row-2', customer: '乙' }])
    expect(collection.search(' 乙 ')).toEqual([{ id: 'row-2', customer: '乙' }])
    expect(collection.page(1, 2)).toEqual([{ id: 'row-2', customer: '乙' }])
    expect(collection.getById('row-1')).toEqual({ id: 'row-1', customer: '甲' })
    collection.add({ id: 'manual', customer: '丙' })
    expect(collection.rows).toHaveLength(3)
    const first = useCollectionRows('orders')
    first.remove('row-1')
    expect(useCollectionRows('orders').rows).toHaveLength(2)
  })

  it('exposes useCollectionRows and a pure CSV helper for export ops', () => {
    expect(store).toContain('export function useCollectionRows(id: string): CollectionStore')
    expect(store).toContain('export function rowsToCsv(rows: readonly Row[]): string')
    expect(store).toContain('export function downloadCsv(name: string, rows: readonly Row[]): void')
  })
})
