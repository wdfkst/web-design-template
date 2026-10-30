import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AdminLayout from '../layouts/AdminLayout.vue'

async function render(path = '/') {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: { template: '<p>商品内容</p>' }, meta: { title: '商品管理' } },
    { path: '/login', component: { template: '<p>登录内容</p>' }, meta: { title: '登录', chrome: false } },
  ] })
  await router.push(path)
  await router.isReady()
  return mount(AdminLayout, { props: { brand: '仓库后台', navigation: [{ id: 'items', label: '商品管理', route: '/' }] }, global: { plugins: [router] } })
}

describe('admin layout', () => {
  it('renders the business navigation and current title without fake controls', async () => {
    const wrapper = await render()
    expect(wrapper.text()).toContain('商品管理')
    expect(wrapper.find('nav a').attributes('aria-current')).toBe('page')
    expect(wrapper.text()).not.toContain('管理员')
    await wrapper.get('button[aria-label="折叠菜单"]').trigger('click')
    expect(wrapper.classes()).toContain('is-collapsed')
  })
  it('uses library icons for menu controls and reflects the collapsed state', async () => {
    const wrapper = await render()
    const desktop = wrapper.get('button[aria-label="折叠菜单"]')
    expect(desktop.find('svg[data-icon="menu-fold"]').exists()).toBe(true)
    expect(desktop.find('[aria-hidden="true"]').exists()).toBe(true)
    await desktop.trigger('click')
    expect(desktop.attributes('aria-expanded')).toBe('false')
    expect(desktop.find('svg[data-icon="menu-unfold"]').exists()).toBe(true)
    const mobile = wrapper.get('button[aria-label="打开导航"]')
    expect(mobile.find('svg[data-icon="menu"]').exists()).toBe(true)
    await mobile.trigger('click')
    expect(mobile.attributes('aria-expanded')).toBe('true')
    expect(mobile.find('svg[data-icon="close"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('opens and closes mobile navigation', async () => {
    const wrapper = await render()
    const button = wrapper.get('button[aria-label="打开导航"]')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    await wrapper.get('button[aria-label="关闭导航"]').trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
  })
  it('renders topbar groups and keeps mobile navigation usable', async () => {
    const wrapper = await render()
    await wrapper.setProps({ presentation: { appearance: 'soft-glass', decoration: 'balanced', shell: 'topbar' }, navigation: [{ id: 'group', label: '业务', children: [{ id: 'items', label: '商品管理', route: '/' }] }] } as never)
    expect(wrapper.classes()).toContain('is-topbar')
    expect(wrapper.classes()).toContain('soft-glass')
    expect(wrapper.find('[aria-label="业务分组"]').exists()).toBe(true)
    await wrapper.get('button[aria-label="打开导航"]').trigger('click')
    await wrapper.get('aside nav a').trigger('click')
    expect(wrapper.get('button[aria-label="打开导航"]').attributes('aria-expanded')).toBe('false')
  })
  it('scopes jelly decoration without changing legacy shells', async () => {
    const wrapper = await render()
    expect(wrapper.classes()).not.toContain('is-jelly')
    await wrapper.setProps({ presentation: { appearance: 'jelly', decoration: 'minimal', shell: 'sidebar' } })
    expect(wrapper.classes()).toContain('is-jelly')
    expect(wrapper.attributes('data-decoration')).toBe('minimal')
    for (const appearance of ['plain', 'soft-glass'] as const) {
      await wrapper.setProps({ presentation: { appearance, decoration: 'balanced', shell: 'sidebar' } })
      expect(wrapper.classes()).not.toContain('is-jelly')
    }
    wrapper.unmount()
  })
  it('renders auth pages without chrome', async () => {
    const wrapper = await render('/login')
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(wrapper.find('header').exists()).toBe(false)
  })
})
