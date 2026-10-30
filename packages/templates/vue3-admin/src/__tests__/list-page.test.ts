import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, Modal, Pagination } from 'ant-design-vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import AdminListPage from '../components/admin/AdminListPage.vue'
import { useAdminCollection } from '../composables/useAdminCollection'

vi.mock('../data/mock', () => ({
  collections: [{ id: 'items', label: '商品', model: { id: { type: 'number', label: '编号' }, name: { type: 'string', label: '名称' } } }],
  forms: [{ id: 'item', label: '商品', collection: 'items', fields: [{ key: 'name', label: '名称', type: 'string', required: true }] }],
  MOCK_ROWS: { items: [{ id: 1, name: '原商品' }] },
}))
it.each(['table', 'cards'] as const)('%s shares paging, detail and field actions without interpreting HTML', async variant => {
  const store = useAdminCollection('items')
  store.rows.value = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: i === 0 ? '<script>bad()</script>' : `记录${i}` }))
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }, { path: '/detail', component: { template: '<div />' } }] })
  await router.push('/'); await router.isReady()
  const wrapper = mount(AdminListPage, { props: { title: '记录', config: { variant, ...(variant === 'cards' ? { card: { titleField: 'name', summaryFields: ['id'] } } : {}), collection: 'items', filters: ['name'], columns: [{ field: 'name' }], actions: [{ kind: 'detail', label: '详情', route: '/detail' }, { kind: 'set-field', label: '更新', field: 'name', value: '已更新' }] } }, global: { plugins: [router] } })
  try {
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.text()).toContain('<script>bad()</script>')
    await wrapper.findAllComponents(Button).find(b => b.text().replace(/\s/g, '') === '更新')!.trigger('click')
    expect(store.rows.value[0].name).toBe('已更新')
    await wrapper.findAllComponents(Button).find(b => b.text().replace(/\s/g, '') === '详情')!.trigger('click'); await flushPromises()
    expect(router.currentRoute.value.query.id).toBe('1')
    wrapper.getComponent(Pagination).vm.$emit('update:current', 2); await flushPromises()
    expect(wrapper.text()).toContain('记录8')
    expect(wrapper.text()).not.toContain('已更新')
    await wrapper.get('#filter-items-name').setValue('不存在的记录')
    await wrapper.get('form.filter-bar').trigger('submit'); await flushPromises()
    expect(wrapper.getComponent(Pagination).props('current')).toBe(1)
    expect(wrapper.text()).toContain('没有符合条件的记录')
    await wrapper.findAllComponents(Button).find(b => b.text().replace(/\s/g, '') === '清除筛选')!.trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('已更新')
  } finally { wrapper.unmount() }
})
it.each(['table', 'cards'] as const)('%s preserves selections across pages', async variant => {
  const store = useAdminCollection('items')
  store.rows.value = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `记录${i + 1}` }))
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })
  await router.push('/'); await router.isReady()
  const wrapper = mount(AdminListPage, { props: { title: '记录', config: { variant, ...(variant === 'cards' ? { card: { titleField: 'name', summaryFields: [], coverField: 'name' } } : {}), collection: 'items', filters: [], columns: [{ field: 'name' }], actions: [{ kind: 'bulk-delete', label: '批量删除' }] } }, global: { plugins: [router] } })
  try {
    const selector = variant === 'cards' ? '[data-record-card] input[type="checkbox"]' : 'tbody input[type="checkbox"]'
    await wrapper.get(selector).setValue(true)
    wrapper.getComponent(Pagination).vm.$emit('update:current', 2); await flushPromises()
    await wrapper.get(selector).setValue(true)
    expect(wrapper.text()).toContain('已选 2 项')
    wrapper.getComponent(Pagination).vm.$emit('update:current', 1); await flushPromises()
    expect((wrapper.get(selector).element as HTMLInputElement).checked).toBe(true)
  } finally { wrapper.unmount() }
})
Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) })
afterEach(() => { Modal.destroyAll(); document.body.innerHTML = ''; vi.restoreAllMocks() })

it.each(['table', 'cards'] as const)('%s creates and edits rows and deletes selected rows only after confirmation', async variant => {
  const store = useAdminCollection('items')
  store.rows.value = [{ id: 1, name: '原商品' }]
  const getComputedStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => getComputedStyle(element))
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })
  await router.push('/'); await router.isReady()
  const wrapper = mount(AdminListPage, { attachTo: document.body, props: { title: '商品管理', emptyPanel: { headline: '暂无商品', assets: { illustration: { src: './assets/empty.png', alt: '空货架', w: 512, h: 512 } } }, config: { variant, ...(variant === 'cards' ? { card: { titleField: 'name', summaryFields: ['id'] } } : {}), collection: 'items', form: 'item', filters: [], columns: [{ field: 'name' }], actions: [{ kind: 'create', label: '新增' }, { kind: 'edit', label: '编辑' }, { kind: 'bulk-delete', label: '批量删除' }] } }, global: { plugins: [router] } })
  const click = async (label: string) => {
    const button = wrapper.findAllComponents(Button).find(item => item.text().replace(/\s/g, '') === label)
    expect(button, label).toBeDefined()
    await button!.trigger('click'); await flushPromises()
  }
  try {
    await click('新增')
    await wrapper.getComponent(Input).get('input').setValue('新商品')
    await click('保存')
    expect(store.rows.value.map((row: any) => row.name)).toEqual(['原商品', '新商品'])
    await click('编辑')
    expect((wrapper.getComponent(Input).get('input').element as HTMLInputElement).value).toBe('原商品')
    await wrapper.getComponent(Input).get('input').setValue('修改商品')
    await click('保存')
    expect(store.rows.value[0].name).toBe('修改商品')
    if (variant === 'cards') {
      expect(wrapper.findAll('[data-record-card]')).toHaveLength(2)
      for (const checkbox of wrapper.findAll('[data-record-card] input[type="checkbox"]')) await checkbox.setValue(true)
    } else await wrapper.get('thead input[type="checkbox"]').setValue(true)
    await click('批量删除')
    const dialogButton = (label: string) => Array.from(document.body.querySelectorAll('.ant-modal button')).find(button => button.textContent?.replace(/\s/g, '') === label) as HTMLButtonElement
    dialogButton('取消').click(); await flushPromises()
    expect(store.rows.value).toHaveLength(2)
    await click('批量删除')
    dialogButton('删除').click(); await flushPromises()
    expect(store.rows.value).toHaveLength(0)
    expect(wrapper.text()).not.toMatch(/已选\s*\d+\s*项/)
    expect(wrapper.findAllComponents(Button).find(item => item.text().replace(/\s/g, '') === '批量删除')!.props('disabled')).toBe(true)
    expect(wrapper.get('img[alt="空货架"]').attributes('src')).toBe('./assets/empty.png')
    expect(wrapper.get('img[alt="空货架"]').attributes('width')).toBe('512')
    expect(wrapper.text()).toContain('暂无商品')
  } finally { wrapper.unmount() }
})
