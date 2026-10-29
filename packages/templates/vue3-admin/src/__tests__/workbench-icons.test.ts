import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AdminWorkbenchModule from '../components/admin/AdminWorkbenchModule.vue'
import type { WorkbenchModule } from '../data/admin-config'
import { evaluateWorkbenchModule } from '../data/workbench'

const modules: WorkbenchModule[] = [
  { id: 'count', title: '数量', kind: 'summary', collection: 'items', metric: 'count' },
  { id: 'state', title: '状态', kind: 'breakdown', collection: 'items', field: 'active' },
  { id: 'recent', title: '记录', kind: 'records', collection: 'items', fields: ['active'], limit: 5 },
  { id: 'links', title: '入口', kind: 'shortcuts', routes: [] },
]
it.each(modules)('renders a real header icon for $kind', module => {
  const model = { active: { type: 'boolean', label: '启用' } }
  const router = createRouter({ history: createMemoryHistory(), routes: [] })
  const wrapper = mount(AdminWorkbenchModule, { props: { module, model, result: evaluateWorkbenchModule(module, [], model) }, global: { plugins: [router] } })
  try { expect(wrapper.find('header svg').exists()).toBe(true) }
  finally { wrapper.unmount() }
})
