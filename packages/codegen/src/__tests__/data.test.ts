import { describe, expect, it } from 'vitest'
import { renderCollections } from '../data.js'
import { renderStore } from '../store.js'
import { dataModelSpec } from './fixture.js'

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

  it('implements update as an upsert for form-created rows', () => {
    expect(store).toContain('Upsert')
    expect(store).toContain('id: `row-${rows.length + 1}`')
  })

  it('exposes useCollectionRows and a pure CSV helper for export ops', () => {
    expect(store).toContain('export function useCollectionRows(id: string): CollectionStore')
    expect(store).toContain('export function rowsToCsv(rows: readonly Row[]): string')
    expect(store).toContain('export function downloadCsv(name: string, rows: readonly Row[]): void')
  })
})
