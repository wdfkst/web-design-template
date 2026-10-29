import { expect, it } from 'vitest'
import ts from 'typescript'
import { landingSpec } from './fixture.js'
import { renderAdminData } from '../admin/data.js'

it('generates typed seed data for all model keys and preserves numeric ids', () => {
  const spec = landingSpec()
  spec.collections = [{ id: 'items', label: '商品', model: { id: { type: 'number', label: '编号' }, name: { type: 'string', label: '名称' }, active: { type: 'boolean', label: '启用' } }, fields: ['name'], seed: 3, actions: [] }]
  const files = renderAdminData(spec)
  const js = ts.transpile(files['src/data/mock.ts']!, { module: ts.ModuleKind.CommonJS })
  const exports: Record<string, any> = {}
  new Function('exports', js)(exports)
  expect(exports.MOCK_ROWS.items).toHaveLength(3)
  expect(typeof exports.MOCK_ROWS.items[0].id).toBe('number')
  expect(typeof exports.MOCK_ROWS.items[0].active).toBe('boolean')
  expect(files['src/data/mock.ts']).toBe(renderAdminData(spec)['src/data/mock.ts'])
  expect(files['src/modules/items/types.ts']).toContain('active: boolean')
})
