import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, Modal, Table } from 'ant-design-vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import AdminListPage from '../components/admin/AdminListPage.vue'

vi.mock('../data/mock', () => ({
  collections: [{ id: 'items', label: '商品', model: { id: { type: 'number', label: '编号' }, name: { type: 'string', label: '名称' } } }],
  forms: [{ id: 'item', label: '商品', collection: 'items', fields: [{ key: 'name', label: '名称', type: 'string', required: true }] }],
  MOCK_ROWS: { items: [{ id: 1, name: '原商品' }] },
}))
Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) })
afterEach(() => { Modal.destroyAll(); document.body.innerHTML = ''; vi.restoreAllMocks() })

it('creates and edits rows and deletes selected rows only after confirmation', async () => {
  const getComputedStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => getComputedStyle(element))
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })
  await router.push('/'); await router.isReady()
  const wrapper = mount(AdminListPage, { attachTo: document.body, props: { title: '商品管理', emptyPanel: { headline: '暂无商品', assets: { illustration: { src: './assets/empty.png', alt: '空货架', w: 512, h: 512 } } }, config: { collection: 'items', form: 'item', filters: [], columns: [{ field: 'name' }], actions: [{ kind: 'create', label: '新增' }, { kind: 'edit', label: '编辑' }, { kind: 'bulk-delete', label: '批量删除' }] } }, global: { plugins: [router] } })
  const click = async (label: string) => {
    const button = wrapper.findAllComponents(Button).find(item => item.text().replace(/\s/g, '') === label)
    expect(button, label).toBeDefined()
    await button!.trigger('click'); await flushPromises()
  }
  try {
    await click('新增')
    await wrapper.getComponent(Input).get('input').setValue('新商品')
    await click('保存')
    expect(wrapper.getComponent(Table).props('dataSource')!.map((row: any) => row.name)).toEqual(['原商品', '新商品'])
    await click('编辑')
    expect((wrapper.getComponent(Input).get('input').element as HTMLInputElement).value).toBe('原商品')
    await wrapper.getComponent(Input).get('input').setValue('修改商品')
    await click('保存')
    expect(wrapper.getComponent(Table).props('dataSource')![0].name).toBe('修改商品')
    const selectAll = wrapper.get('thead input[type="checkbox"]')
    await selectAll.setValue(true)
    await click('批量删除')
    const dialogButton = (label: string) => Array.from(document.body.querySelectorAll('.ant-modal button')).find(button => button.textContent?.replace(/\s/g, '') === label) as HTMLButtonElement
    dialogButton('取消').click(); await flushPromises()
    expect(wrapper.getComponent(Table).props('dataSource')).toHaveLength(2)
    await click('批量删除')
    dialogButton('删除').click(); await flushPromises()
    expect(wrapper.getComponent(Table).props('dataSource')).toHaveLength(0)
    expect(wrapper.get('img[alt="空货架"]').attributes('src')).toBe('./assets/empty.png')
    expect(wrapper.get('img[alt="空货架"]').attributes('width')).toBe('512')
    expect(wrapper.text()).toContain('暂无商品')
  } finally { wrapper.unmount() }
})
