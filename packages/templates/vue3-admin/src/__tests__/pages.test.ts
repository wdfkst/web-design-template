import { expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AdminDetailPage from '../components/admin/AdminDetailPage.vue'
import AdminFormPage from '../components/admin/AdminFormPage.vue'
import AdminSettingsPage from '../components/admin/AdminSettingsPage.vue'
import AdminWorkbenchPage from '../components/admin/AdminWorkbenchPage.vue'
import { Button, Input } from 'ant-design-vue'
import { useAdminCollection } from '../composables/useAdminCollection'
vi.mock('../data/mock', () => ({ collections: [{ id: 'items', model: { id: { type: 'number', label: '编号' }, name: { type: 'string', label: '名称' } } }], forms: [{ id: 'settings', label: '系统设置', fields: [{ key: 'name', label: '系统名称', type: 'string', required: true }] }, { id: 'item', label: '商品', collection: 'items', fields: [{ key: 'name', label: '名称', type: 'string', required: true }] }], MOCK_ROWS: { items: [{ id: 1, name: '原记录' }] } }))
Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) })
it('derives workbench counts from shared collections', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' }, meta: { title: '首页' } }] })
  await router.push('/'); await router.isReady()
  const wrapper = mount(AdminWorkbenchPage, { props: { title: '工作台', emptyPanel: { assets: { illustration: { src: './assets/workbench-empty.png', alt: '工作台空状态', w: 512, h: 512 } } }, config: { collections: ['items'], shortcuts: ['/'] } }, global: { plugins: [router] } })
  try {
    const store = useAdminCollection('items')
    expect(wrapper.get('[data-count]').text()).toBe(String(store.rows.value.length))
    store.create({ name: '工作台记录' }); await flushPromises()
    expect(wrapper.get('[data-count]').text()).toBe(String(store.rows.value.length))
    expect(wrapper.get('a').text()).toBe('首页')
    const rows = store.rows.value.map(row => ({ ...row }))
    try {
      store.remove(rows.map(row => row.id)); await flushPromises()
      expect(wrapper.get('img[alt="工作台空状态"]').attributes('src')).toBe('./assets/workbench-empty.png')
    } finally { rows.forEach(row => store.create(row)) }
  } finally { wrapper.unmount() }
})
it('keeps saved unbound settings across remounts without saving cancelled drafts', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })
  await router.push('/'); await router.isReady()
  const render = () => mount(AdminSettingsPage, { props: { title: '设置', config: { form: 'settings', returnRoute: '/' } }, global: { plugins: [router] } })
  let wrapper = render()
  try {
    expect(wrapper.text()).toContain('刷新后重置')
    await wrapper.getComponent(Input).get('input').setValue('业务中心')
    await wrapper.findAllComponents(Button).find(button => button.text().replace(/\s/g, '') === '保存')!.trigger('click')
    wrapper.unmount(); wrapper = render()
    expect((wrapper.getComponent(Input).get('input').element as HTMLInputElement).value).toBe('业务中心')
    await wrapper.getComponent(Input).get('input').setValue('未保存值')
    wrapper.unmount(); wrapper = render()
    expect((wrapper.getComponent(Input).get('input').element as HTMLInputElement).value).toBe('业务中心')
  } finally { wrapper.unmount() }
})
it.each(['single', 'grouped'] as const)('%s validates form input before creating a shared record and returning to the list', async variant => {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/form', component: { template: '<div />' } }, { path: '/', component: { template: '<div />' } }] })
  await router.push('/form'); await router.isReady()
  const store = useAdminCollection('items'), count = store.rows.value.length
  const wrapper = mount(AdminFormPage, { props: { title: '新增商品', config: { variant, ...(variant === 'grouped' ? { groups: [{ id: 'main', title: '业务信息', fields: ['name'] }] } : {}), form: 'item', returnRoute: '/' } }, global: { plugins: [router] } })
  try {
    expect(wrapper.findAll('#field-item-name')).toHaveLength(1)
    if (variant === 'grouped') expect(wrapper.get('fieldset legend').text()).toBe('业务信息')
    const save = wrapper.findAllComponents(Button).find(button => button.text().replace(/\s/g, '') === '保存')!
    await save.trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('请填写名称')
    expect(store.rows.value).toHaveLength(count)
    await wrapper.getComponent(Input).get('input').setValue('表单新商品')
    await save.trigger('click'); await flushPromises()
    expect(store.rows.value).toHaveLength(count + 1)
    expect(store.rows.value.at(-1)?.name).toBe('表单新商品')
    expect(router.currentRoute.value.path).toBe('/')
  } finally { wrapper.unmount() }
})
it.each(['sections', 'aside'] as const)('%s reads shared edits by query id and offers return navigation for missing records', async variant => {
  useAdminCollection('items').rows.value = [{ id: 1, name: '原记录' }]
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/detail', component: { template: '<div />' } }, { path: '/', component: { template: '<div />' } }] })
  await router.push('/detail?id=1'); await router.isReady()
  const wrapper = mount(AdminDetailPage, { props: { title: '详情', emptyPanel: { assets: { illustration: { src: './assets/missing.png', alt: '记录缺失插画', w: 512, h: 512 } } }, config: { variant, groups: [{ id: 'identity', title: '记录信息', fields: ['name'] }], ...(variant === 'aside' ? { asideFields: ['id'] } : {}), collection: 'items', returnRoute: '/' } }, global: { plugins: [router] } })
  try {
    expect(wrapper.text()).toContain('记录信息')
    expect(wrapper.text().split('原记录')).toHaveLength(2)
    expect(wrapper.find('aside').exists()).toBe(variant === 'aside')
    if (variant === 'aside') expect(wrapper.get('aside').text()).toContain('编号')
    useAdminCollection('items').update(1, { name: '已修改' })
    await flushPromises()
    expect(wrapper.text()).toContain('已修改')
    await router.push('/detail?id=missing'); await flushPromises()
    expect(wrapper.text()).toContain('记录不存在')
    expect(wrapper.get('img[alt="记录缺失插画"]').attributes('src')).toBe('./assets/missing.png')
    expect(wrapper.get('a').attributes('href')).toBe('/')
  } finally { wrapper.unmount() }
})
