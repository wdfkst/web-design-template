import { expect, it } from 'vitest'
import { validateRecord } from '../data/validation'
const form = { id: 'item', label: '商品', fields: [
  { key: 'name', label: '名称', type: 'string', required: true, validate: { min: 2, max: 8 } },
  { key: 'price', label: '价格', type: 'number', required: true, validate: { min: 0, max: 100 } },
  { key: 'email', label: '邮箱', type: 'string', validate: { pattern: 'email' as const } },
] }
it('validates required, typed bounds and email without changing drafts', () => {
  const values = { name: '', price: -1, email: 'invalid' }
  expect(Object.keys(validateRecord(form, values))).toEqual(['name', 'price', 'email'])
  expect(values.name).toBe('')
  expect(validateRecord(form, { name: '商品', price: 0, email: 'demo@example.com' })).toEqual({})
})
it('rejects missing and non-finite numbers', () => {
  expect(validateRecord(form, { name: '商品', price: Number.NaN })).toHaveProperty('price')
  expect(validateRecord(form, { name: '商品', price: undefined })).toHaveProperty('price')
})
