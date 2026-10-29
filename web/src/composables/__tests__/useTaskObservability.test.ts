// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { useTaskObservability } from '../useTaskObservability.js'
import type { TaskView } from '../../api/client.js'
import { getObservability } from '../../api/client.js'
vi.mock('../../api/client.js', () => ({ getObservability: vi.fn() }))
afterEach(() => vi.resetAllMocks())
it('retries a transient snapshot error on the next task poll', async () => {
  const task = ref<TaskView>({ id: 'retry', description: 'test', status: 'building', createdAt: 0, revision: 1 })
  vi.mocked(getObservability).mockRejectedValueOnce(new Error('offline'))
  let state!: ReturnType<typeof useTaskObservability>
  const wrapper = mount(defineComponent({ setup() { state = useTaskObservability('retry', task); return () => null } }))
  await flushPromises()
  expect(state.error.value).toContain('无法加载')
  vi.mocked(getObservability).mockResolvedValueOnce(snapshot(1))
  task.value = { ...task.value }
  await flushPromises()
  expect(state.error.value).toBeUndefined()
  expect(state.data.value?.revision).toBe(1)
  wrapper.unmount()
})
it('does not discard a slow initial snapshot on every unchanged task poll', async () => {
  const task = ref<TaskView>({ id: 'slow', description: 'test', status: 'building', createdAt: 0, revision: 1 })
  let finish!: (value: ReturnType<typeof snapshot>) => void
  vi.mocked(getObservability).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  let state!: ReturnType<typeof useTaskObservability>
  const wrapper = mount(defineComponent({ setup() { state = useTaskObservability('slow', task); return () => null } }))
  await flushPromises()
  task.value = { ...task.value }
  await flushPromises()
  finish(snapshot(1))
  await flushPromises()
  expect(state.data.value?.revision).toBe(1)
  wrapper.unmount()
})
const snapshot = (revision: number) => ({ revision, requests: [], events: [], eventsTruncated: false, requestsTruncated: false })
it('refreshes the final snapshot and ignores delayed responses after unmount', async () => {
  const task = ref<TaskView>({ id: 'a', description: 'test', status: 'drafting', createdAt: 0, revision: 1 })
  vi.mocked(getObservability).mockResolvedValueOnce(snapshot(1))
  let state!: ReturnType<typeof useTaskObservability>
  const wrapper = mount(defineComponent({ setup() { state = useTaskObservability('a', task); return () => null } }))
  await flushPromises()
  expect(state.data.value?.revision).toBe(1)
  let finish!: (value: ReturnType<typeof snapshot>) => void
  vi.mocked(getObservability).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  task.value = { ...task.value, status: 'ready', revision: 2 }
  await flushPromises()
  wrapper.unmount()
  finish(snapshot(2))
  await flushPromises()
  expect(state.data.value?.revision).toBe(1)
})
it('reads final state even when its revision did not change', async () => {
  const task = ref<TaskView>({ id: 'b', description: 'test', status: 'drafting', createdAt: 0, revision: 1 })
  vi.mocked(getObservability).mockResolvedValue(snapshot(1))
  let state!: ReturnType<typeof useTaskObservability>
  const wrapper = mount(defineComponent({ setup() { state = useTaskObservability('b', task); return () => null } }))
  await flushPromises()
  vi.mocked(getObservability).mockResolvedValue(snapshot(2))
  task.value = { ...task.value, status: 'ready' }
  await flushPromises()
  expect(state.data.value?.revision).toBe(2)
  wrapper.unmount()
})
