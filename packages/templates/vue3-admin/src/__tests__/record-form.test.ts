import { expect, it } from 'vitest'
import { validateRecord } from '../data/validation'
import { mount } from '@vue/test-utils'
import AdminRecordFields from '../components/admin/AdminRecordFields.vue'
Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) })
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
it('renders every grouped field once with its validation error', () => {
  const values = { name: '', price: -1, email: 'invalid' }
  const errors = validateRecord(form, values)
  const wrapper = mount(AdminRecordFields, { props: { form, values, errors, groups: [
    { id: 'identity', title: '基本资料', fields: ['name', 'email'] },
    { id: 'pricing', title: '价格信息', fields: ['price'] },
  ] } })
  try {
    expect(wrapper.findAll('legend').map(item => item.text())).toEqual(['基本资料', '价格信息'])
    for (const field of form.fields) {
      expect(wrapper.findAll(`#field-item-${field.key}`)).toHaveLength(1)
      expect(wrapper.text()).toContain(errors[field.key])
    }
    expect(values).toEqual({ name: '', price: -1, email: 'invalid' })
  } finally { wrapper.unmount() }
})
it('focuses the first invalid field after validation', async () => {
  const wrapper = mount(AdminRecordFields, { attachTo: document.body, props: { form, values: {}, errors: {} } })
  try {
    await wrapper.setProps({ errors: { name: '请填写名称', price: '请填写价格' } })
    expect(document.activeElement).toBe(wrapper.get('#field-item-name').element)
  } finally { wrapper.unmount() }
})
it('rejects missing and non-finite numbers', () => {
  expect(validateRecord(form, { name: '商品', price: Number.NaN })).toHaveProperty('price')
  expect(validateRecord(form, { name: '商品', price: undefined })).toHaveProperty('price')
})
