import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AdminLayout from '../layouts/AdminLayout.vue'
import AdminWelcomePanel from '../components/admin/AdminWelcomePanel.vue'
import AdminRecordCards from '../components/admin/AdminRecordCards.vue'
import AdminWorkbenchPage from '../components/admin/AdminWorkbenchPage.vue'
import type { WorkbenchConfig } from '../data/admin-config'
import { readFileSync } from 'node:fs'

it('provides a visible focus outline, local table scrolling and motion-safe controls', () => {
  const style = document.createElement('style')
  style.textContent = readFileSync('src/theme/admin-styles.css', 'utf8')
  document.head.append(style)
  try {
    const rules = Array.from(style.sheet!.cssRules)
    const focus = (rules as CSSStyleRule[]).filter(rule => rule.selectorText?.includes(':focus-visible'))
    expect(focus.some(rule => rule.style.getPropertyValue('outline') === '3px solid var(--admin-focus)')).toBe(true)
    expect(focus.some(rule => rule.style.getPropertyValue('outline-offset') === '3px')).toBe(true)
    const reduced = rules.filter(rule => rule.type === 4 && (rule as CSSMediaRule).media.mediaText.includes('prefers-reduced-motion')) as CSSMediaRule[]
    expect(reduced.flatMap(rule => Array.from(rule.cssRules) as CSSStyleRule[]).some(rule => rule.style.getPropertyValue('transition') === 'none')).toBe(true)
    expect((rules as CSSStyleRule[]).some(rule => rule.selectorText?.includes('.records-scroll') && rule.style.getPropertyValue('overflow-x') === 'auto')).toBe(true)
  } finally { style.remove() }
})

const selected = vi.hoisted(() => ({
  adminStyle: null as { id: string; version: number } | null,
  styleLayout: null as { shellVariant: string; workbenchLayout: string; skin: string } | null,
  presentation: { appearance: 'jelly', decoration: 'balanced', shell: 'sidebar' },
}))
vi.mock('../theme/presentation', () => selected)
const cases = [
  ['soft', 'icon-sidebar', 'welcome-grid'], ['warm', 'expanded-sidebar', 'main-aside'],
  ['mist', 'top-nav', 'sectioned'], ['porcelain', 'wide-sidebar', 'staggered'],
  ['aurora', 'top-nav-context', 'main-context'],
] as const
const config: WorkbenchConfig = { mode: 'workbench', variant: 'focus', primaryModuleId: 'last', modules: [
  { id: 'first', title: '首模块', kind: 'shortcuts', routes: ['/'] },
  { id: 'second', title: '次模块', kind: 'shortcuts', routes: ['/'] },
  { id: 'last', title: '末模块', kind: 'shortcuts', routes: ['/'] },
] }
function select([id, shellVariant, workbenchLayout]: readonly [string, string, string]) {
  selected.adminStyle = { id, version: 1 }
  selected.styleLayout = { shellVariant, workbenchLayout, skin: id }
}
async function routerAt(path = '/') {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: { template: '<p>工作台内容</p>' } },
    { path: '/signin', component: { template: '<p>登录</p>' }, meta: { chrome: false } },
  ] })
  await router.push(path)
  await router.isReady()
  return router
}
afterEach(() => { selected.adminStyle = null; selected.styleLayout = null })
describe('named style regions', () => {
  it('does not inherit legacy jelly motifs or fabricated card covers for soft', () => {
    select(cases[0])
    const presentation = { appearance: 'jelly', decoration: 'balanced', shell: 'sidebar' } as const
    const welcome = mount(AdminWelcomePanel, { props: { headline: '工作台', presentation } })
    const cards = mount(AdminRecordCards, { props: { presentation, rows: [{ id: 1, name: '咖啡' }], titleField: 'name', summaryFields: [], selectedIds: [], selectable: false, model: {}, actions: [] } })
    try {
      expect(welcome.find('.admin-motif').exists()).toBe(false)
      expect(welcome.classes()).not.toContain('jelly-welcome')
      expect(cards.find('.card-cover').exists()).toBe(false)
      expect(cards.find('.jelly-card').exists()).toBe(false)
    } finally { welcome.unmount(); cards.unmount() }
  })
  it.each(cases)('%s preserves input module order and allocates real regions', async (...style) => {
    select(style)
    const wrapper = mount(AdminWorkbenchPage, { props: { title: '工作台', config }, global: { plugins: [await routerAt()] } })
    try {
      expect(wrapper.findAll('[data-module]').map(node => node.attributes('data-module'))).toEqual(['first', 'second', 'last'])
      const layout = wrapper.get('.style-workbench')
      if (style[0] === 'warm' || style[0] === 'aurora') {
        expect(layout.get('.style-primary [data-module]').attributes('data-module')).toBe('first')
        expect(layout.findAll('aside [data-module]').map(node => node.attributes('data-module'))).toEqual(['second', 'last'])
      } else if (style[0] === 'mist') {
        expect(layout.findAll(':scope > section')).toHaveLength(3)
      } else if (style[0] === 'porcelain') {
        expect(layout.get('.style-primary [data-module]').attributes('data-module')).toBe('first')
        expect(layout.findAll('.style-secondary [data-module]')).toHaveLength(2)
      } else {
        expect(layout.findAll('.style-card-grid > [data-module]')).toHaveLength(3)
      }
    } finally { wrapper.unmount() }
  })
  it.each([cases[1], cases[4]])('%s hides the auxiliary region without secondary modules', async (...style) => {
    select(style)
    const wrapper = mount(AdminWorkbenchPage, { props: { title: '工作台', config: { ...config, variant: 'overview', modules: config.modules.slice(0, 1) } satisfies WorkbenchConfig }, global: { plugins: [await routerAt()] } })
    try { expect(wrapper.find('.style-workbench').exists()).toBe(true); expect(wrapper.find('aside').exists()).toBe(false) } finally { wrapper.unmount() }
  })
  it.each(cases)('%s uses its navigation shell and retains accessible mobile navigation', async (...style) => {
    select(style)
    const wrapper = mount(AdminLayout, { props: { brand: '后台', navigation: [{ id: 'home', label: '工作台', icon: 'grid', route: '/' }] }, global: { plugins: [await routerAt()] } })
    try {
      const top = style[0] === 'mist' || style[0] === 'aurora'
      expect(wrapper.find('header nav[aria-label="顶部业务导航"]').exists()).toBe(top)
      expect(wrapper.find('main').text()).toContain('工作台内容')
      expect(wrapper.classes()).not.toContain('is-jelly')
      if (top) expect(wrapper.find(':scope > aside').exists()).toBe(false)
      if (style[0] === 'soft') expect(wrapper.classes()).toContain('is-collapsed')
      await wrapper.get('button[aria-label="打开导航"]').trigger('click')
      expect(wrapper.get('aside nav a').attributes('title')).toBe('工作台')
      await wrapper.get('aside').trigger('keydown', { key: 'Escape' })
      expect(wrapper.get('button[aria-label="打开导航"]').attributes('aria-expanded')).toBe('false')
    } finally { wrapper.unmount() }
  })
  it('keeps the original focus ordering for an unnamed workbench', async () => {
    const wrapper = mount(AdminWorkbenchPage, { props: { title: '工作台', config }, global: { plugins: [await routerAt()] } })
    try { expect(wrapper.findAll('[data-module]')[0]!.attributes('data-module')).toBe('last'); expect(wrapper.find('.style-workbench').exists()).toBe(false) } finally { wrapper.unmount() }
  })
  it.each(cases)('%s still removes all navigation chrome on an auth-only route', async (...style) => {
    select(style)
    const wrapper = mount(AdminLayout, { props: { brand: '后台', navigation: [] }, global: { plugins: [await routerAt('/signin')] } })
    try { expect(wrapper.find('aside').exists()).toBe(false); expect(wrapper.find('header').exists()).toBe(false); expect(wrapper.text()).toContain('登录') } finally { wrapper.unmount() }
  })
})
