import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { expect, it, vi } from 'vitest'
import { ref } from 'vue'
import TaskList from '../../views/TaskList.vue'
vi.mock('../../composables/useTaskList.js', () => ({ useTaskList: () => ({ tasks: ref([]), loading: ref(false), error: ref(), start: () => {}, submit: async () => ({ id: 'created' }) }) }))
it('opens the created task so live progress is visible immediately', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: TaskList }, { path: '/task/:id', component: { template: '<div />' } }] })
  await router.push('/')
  const wrapper = mount(TaskList, { global: { plugins: [router], stubs: {
    ASpace: { template: '<div><slot /></div>' }, ACard: { template: '<div><slot /></div>' }, ATable: true,
    ATextarea: { props: ['value'], emits: ['update:value'], template: '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
    AButton: { template: '<button><slot /></button>' },
  } } })
  await wrapper.get('textarea').setValue('库存管理后台')
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/task/created')
  wrapper.unmount()
})
