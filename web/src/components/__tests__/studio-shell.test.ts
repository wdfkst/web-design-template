import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineComponent, onMounted } from 'vue'
import { expect, it } from 'vitest'
import App from '../../App.vue'
it('provides workspace navigation and remounts when the task id changes', async () => {
  let mounts = 0
  const page = defineComponent({ setup() { onMounted(() => mounts++); return () => 'task content' } })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: page }, { path: '/task/:id', component: page }, { path: '/settings', component: page }] })
  await router.push('/task/first')
  const wrapper = mount(App, { global: { plugins: [router], stubs: { AConfigProvider: { template: '<div><slot /></div>' } } } })
  await flushPromises()
  expect(wrapper.find('.studio-sidebar').exists()).toBe(true)
  expect(wrapper.find('a[href="/settings"]').exists()).toBe(true)
  const initial = mounts
  await router.push('/task/second')
  await flushPromises()
  expect(mounts).toBe(initial + 1)
  wrapper.unmount()
})
