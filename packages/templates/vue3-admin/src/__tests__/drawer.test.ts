import { afterEach, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { Input, Button } from 'ant-design-vue'
import AdminRecordDrawer from '../components/admin/AdminRecordDrawer.vue'
Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) })
afterEach(() => { document.body.innerHTML = '' })
it('initializes record fields when mounted open', async () => {
  const wrapper = mount(AdminRecordDrawer, { attachTo: document.body, props: { open: true, record: { id: 1, name: '初始记录' }, collection: { id: 'items', model: { name: { type: 'string', label: '名称' } } }, form: { id: 'item', label: '商品', fields: [{ key: 'name', label: '名称', type: 'string' }] } } })
  try {
    await flushPromises()
    expect((wrapper.getComponent(Input).get('input').element as HTMLInputElement).value).toBe('初始记录')
  } finally { wrapper.unmount() }
})
it('edits a copy, cancels without changing the record, and emits edited values on save', async () => {
  const record = { id: 1, name: '原商品' }
  const wrapper = mount(AdminRecordDrawer, { props: { open: false, record, collection: { id: 'items', label: '商品', model: { name: { type: 'string', label: '名称' } } }, form: { id: 'item', label: '商品', fields: [{ key: 'name', label: '名称', type: 'string', required: true }] } }, attachTo: document.body })
  await wrapper.setProps({ open: true })
  await flushPromises()
  await wrapper.getComponent(Input).get('input').setValue('已编辑')
  expect(record.name).toBe('原商品')
  const save = wrapper.findAllComponents(Button).find(button => button.text().replace(/\s/g, '') === '保存')!
  await wrapper.findAllComponents(Button).find(button => button.text().replace(/\s/g, '') === '取消')!.trigger('click')
  expect(wrapper.emitted('close')).toHaveLength(1)
  expect(wrapper.emitted('save')).toBeUndefined()
  expect(record.name).toBe('原商品')
  await wrapper.setProps({ open: false })
  await wrapper.setProps({ open: true })
  await flushPromises()
  expect((wrapper.getComponent(Input).get('input').element as HTMLInputElement).value).toBe('原商品')
  await wrapper.getComponent(Input).get('input').setValue('已编辑')
  await save.trigger('click')
  expect(wrapper.emitted('save')?.[0]).toEqual([{ id: 1, name: '已编辑' }])
  wrapper.unmount()
})
