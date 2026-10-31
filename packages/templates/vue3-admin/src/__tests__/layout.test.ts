import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { getDemoSession, type DemoAuthConfig } from '../auth/demo-session'
import { installDemoGuard } from '../auth/demo-router'
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

const auth: DemoAuthConfig = { loginRoute: '/signin', homeRoute: '/workspace', protectedRoutes: ['/workspace', '/items'], authRoutes: ['/signin'] }

async function renderAuthenticated() {
  const session = getDemoSession()
  session.signIn('demo', 'demo123')
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/workspace', component: { template: '<p>工作台</p>' } },
    { path: '/items', component: { template: '<p>商品</p>' } },
    { path: '/signin', component: { template: '<p>登录</p>' }, meta: { chrome: false } },
  ] })
  installDemoGuard(router, auth, session)
  await router.push('/workspace')
  await router.push('/items')
  const wrapper = mount(AdminLayout, { props: { brand: '后台', navigation: [], auth }, global: { plugins: [router] } })
  return { wrapper, router, session }
}

afterEach(() => getDemoSession().signOut())

describe('demo logout', () => {
  it('clears the session, returns to the configured login and blocks browser back', async () => {
    const { wrapper, router, session } = await renderAuthenticated()
    expect(wrapper.text()).toContain('演示用户')
    await wrapper.get('button[aria-label="退出登录"]').trigger('click')
    await flushPromises()
    expect(session.isAuthenticated()).toBe(false)
    expect(router.currentRoute.value.path).toBe('/signin')
    expect(wrapper.find('header').exists()).toBe(false)
    router.back()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/signin')
    expect(router.currentRoute.value.query.returnTo).toBe('/workspace')
    wrapper.unmount()
  })
  it.each(['abort', 'throw'] as const)('keeps logout effective when navigation fails: %s', async mode => {
    const { wrapper, router, session } = await renderAuthenticated()
    router.onError(() => {})
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const remove = router.beforeEach(async to => {
      if (to.path !== '/signin') return
      await pending
      if (mode === 'throw') throw new Error('navigation unavailable')
      return false
    })
    const button = wrapper.get('button[aria-label="退出登录"]')
    await button.trigger('click')
    await button.trigger('click')
    expect(session.isAuthenticated()).toBe(false)
    expect(button.attributes('disabled')).toBeDefined()
    release()
    await flushPromises()
    expect(session.isAuthenticated()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(button.attributes('disabled')).toBeUndefined()
    remove()
    await button.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/signin')
    wrapper.unmount()
  })
  it('does not offer demo controls without auth configuration', async () => {
    const wrapper = await render()
    expect(wrapper.text()).not.toContain('演示用户')
    expect(wrapper.find('button[aria-label="退出登录"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

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
