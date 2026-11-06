import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { expect, it, vi } from 'vitest'
import AdminFormPage from '../components/admin/AdminFormPage.vue'
import AdminLayout from '../layouts/AdminLayout.vue'

vi.mock('../data/mock', () => ({
  collections: [{ id: 'products', model: { id: { type: 'number' }, name: { type: 'string' } } }],
  forms: [{ id: 'product', collection: 'products', fields: [] }],
  MOCK_ROWS: { products: [] },
}))

it.each(['咖啡工作台', '商品列表'])('names the actual return destination %s rather than assuming a list', async title => {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: { template: '<p>目标页面</p>' }, meta: { title } },
    { path: '/edit', component: { template: '<p>编辑</p>' }, meta: { title: '商品编辑', parentRoute: '/' } },
  ] })
  await router.push('/edit?id=missing')
  const form = mount(AdminFormPage, { props: { title: '商品编辑', config: { form: 'product', returnRoute: '/', variant: 'single' } }, global: { plugins: [router] } })
  const layout = mount(AdminLayout, { props: { brand: '咖啡', navigation: [] }, global: { plugins: [router] } })
  try {
    expect(form.get('.page-heading a').text()).toBe(`返回${title}`)
    expect(form.text()).toContain(`记录不存在，请返回${title}重新选择。`)
    const breadcrumb = layout.get('.breadcrumbs a')
    expect(breadcrumb.text()).toBe(title)
    expect(breadcrumb.attributes('href')).toBe('/')
    await form.get('.page-heading a').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/'))
  } finally { form.unmount(); layout.unmount() }
})
