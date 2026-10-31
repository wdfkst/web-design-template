import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AdminAuthPage from '../components/admin/AdminAuthPage.vue'
import { getDemoSession } from '../auth/demo-session'
import { auth } from '../navigation'

vi.mock('../navigation', () => ({ auth: { loginRoute: '/signin', homeRoute: '/work', protectedRoutes: ['/work', '/reports'], authRoutes: ['/signin'] } }))
const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => { getDemoSession().signOut(); auth!.homeRoute = '/work' })
afterEach(() => { wrappers.forEach(wrapper => wrapper.unmount()); wrappers.length = 0; vi.restoreAllMocks() })
async function setup(panel = {}, path = '/signin') {
  const router = createRouter({ history: createMemoryHistory(), routes: ['/signin', '/work', '/reports'].map(path => ({ path, component: { template: '<div />' } })) })
  await router.push(path)
  const wrapper = mount(AdminAuthPage, { props: { title: '登录', panel }, global: { plugins: [router] } })
  wrappers.push(wrapper)
  return { wrapper, router }
}
async function fill(wrapper: ReturnType<typeof mount>, account = 'demo', password = 'demo123') {
  await wrapper.get('#auth-account').setValue(account)
  await wrapper.get('#auth-password').setValue(password)
}
it.each([{}, { fields: [{ label: '邮箱', type: 'email' }, { label: '真实密钥', type: 'password' }, { label: '电话', type: 'text' }] }])('only collects the two demo credentials regardless of generated fields %j', async panel => {
  const { wrapper } = await setup(panel)
  expect(wrapper.findAll('input')).toHaveLength(2)
  expect(wrapper.get('#auth-account').attributes('type')).toBe('text')
  expect(wrapper.text()).toContain('请勿输入真实凭证')
  expect(wrapper.text()).toContain('demo123')
})
it('fills demo credentials without signing in and toggles password visibility with a non-submit button', async () => {
  const { wrapper, router } = await setup()
  await wrapper.get('[data-action="fill-demo"]').trigger('click')
  expect((wrapper.get('#auth-account').element as HTMLInputElement).value).toBe('demo')
  expect((wrapper.get('#auth-password').element as HTMLInputElement).value).toBe('demo123')
  expect(getDemoSession().isAuthenticated()).toBe(false)
  expect(router.currentRoute.value.path).toBe('/signin')
  const toggle = wrapper.get('button[aria-label="显示密码"]')
  expect(toggle.attributes('type')).toBe('button')
  await toggle.trigger('click')
  expect(wrapper.get('#auth-password').attributes('type')).toBe('text')
  expect(wrapper.get('button[aria-label="隐藏密码"]').attributes('aria-pressed')).toBe('true')
  await wrapper.get('button[aria-label="隐藏密码"]').trigger('click')
  expect(wrapper.get('#auth-password').attributes('type')).toBe('password')
})
it.each([['demo', 'wrong'], ['other', 'demo123'], ['', '']])('rejects invalid credentials %s without navigation', async (account, password) => {
  const { wrapper, router } = await setup()
  await fill(wrapper, account, password)
  await wrapper.get('form').trigger('submit')
  expect(getDemoSession().isAuthenticated()).toBe(false)
  expect(router.currentRoute.value.path).toBe('/signin')
  expect(wrapper.get('[role="alert"]').text()).toContain('演示账号')
})
it.each([['/reports?tab=recent#row', '/reports?tab=recent#row'], ['https://example.com', '/work'], ['/signin', '/work']])('replaces the route using safe returnTo %s', async (candidate, expected) => {
  const { wrapper, router } = await setup({}, `/signin?returnTo=${encodeURIComponent(candidate)}`)
  const replace = vi.spyOn(router, 'replace')
  await fill(wrapper)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(getDemoSession().isAuthenticated()).toBe(true)
  expect(router.currentRoute.value.fullPath).toBe(expected)
  expect(replace).toHaveBeenCalledWith(expected)
  expect((wrapper.get('#auth-password').element as HTMLInputElement).value).toBe('')
})
it('explains auth-only projects without redirecting', async () => {
  auth!.homeRoute = null
  const { wrapper, router } = await setup()
  await fill(wrapper)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/signin')
  expect(wrapper.get('[role="status"]').text()).toContain('没有可进入的后台')
})
it('blocks duplicate submission and recovers from navigation rejection', async () => {
  const { wrapper, router } = await setup()
  let reject!: (error: Error) => void
  const replace = vi.spyOn(router, 'replace').mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
  await fill(wrapper)
  await wrapper.get('form').trigger('submit')
  await wrapper.get('form').trigger('submit')
  expect(replace).toHaveBeenCalledTimes(1)
  reject(new Error('navigation failed'))
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('重试')
  expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  await fill(wrapper)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/work')
})
it('preserves illustration geometry and alt, falls back on error and retries a changed asset', async () => {
  const asset = { src: './assets/test.png', alt: '业务插画', w: 512, h: 384 }
  const { wrapper } = await setup({ assets: { illustration: asset } })
  const image = wrapper.get('img')
  expect(image.attributes()).toMatchObject({ width: '512', height: '384', alt: '业务插画' })
  await image.trigger('error')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.find('[role="img"][aria-label="银灰色立体机器人插画"]').exists()).toBe(true)
  await wrapper.setProps({ panel: { assets: { illustration: { ...asset, src: './assets/next.png' } } } })
  expect(wrapper.get('img').attributes('src')).toBe('./assets/next.png')
})
it('renders a local fallback without an asset and responds to password focus', async () => {
  const { wrapper } = await setup()
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.find('[role="img"]').exists()).toBe(true)
  await wrapper.get('#auth-password').trigger('focus')
  expect(wrapper.get('.auth-robot').classes()).toContain('is-shy')
  await wrapper.get('#auth-password').trigger('blur')
  expect(wrapper.get('.auth-robot').classes()).not.toContain('is-shy')
})
