import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AdminWorkbenchModule from '../components/admin/AdminWorkbenchModule.vue'

const model = { amount: { type: 'number', label: '预算' }, name: { type: 'string', label: '名称' } }
const router = () => createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }, { path: '/items', component: { template: '<div />' }, meta: { title: '记录管理' } }] })
it('explains the sum field rather than presenting an ambiguous collection statistic', () => {
  const wrapper = mount(AdminWorkbenchModule, { props: { module: { id: 'sum', title: '预算合计', kind: 'summary', collection: 'items', metric: 'sum', field: 'amount' }, model, result: { kind: 'summary', value: 200 } }, global: { plugins: [router()] } })
  try { expect(wrapper.get('.module-note').text()).toContain('预算合计') } finally { wrapper.unmount() }
})
it('updates the visible record count when the displayed rows change', async () => {
  const wrapper = mount(AdminWorkbenchModule, { props: { module: { id: 'records', title: '记录', kind: 'records', collection: 'items', fields: ['name'], limit: 5 }, model, result: { kind: 'records', rows: [{ id: 1, name: '设备检查' }] } }, global: { plugins: [router()] } })
  try {
    expect(wrapper.get('header').text()).toContain('展示 1 条')
    await wrapper.setProps({ result: { kind: 'records', rows: [] } })
    expect(wrapper.get('header').text()).toContain('展示 0 条')
    expect(wrapper.text()).toContain('暂无记录')
  } finally { wrapper.unmount() }
})
it('keeps shortcut destination and title while adding an actionable description', () => {
  const wrapper = mount(AdminWorkbenchModule, { props: { module: { id: 'links', title: '快捷入口', kind: 'shortcuts', routes: ['/items'] }, model, result: { kind: 'shortcuts', routes: ['/items'] } }, global: { plugins: [router()] } })
  try {
    expect(wrapper.get('nav a').attributes('href')).toBe('/items')
    expect(wrapper.get('nav a').text()).toContain('记录管理')
    expect(wrapper.get('nav a').text()).toContain('打开页面')
  } finally { wrapper.unmount() }
})
