import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import AdminStylePreview from '../components/AdminStylePreview.vue'
import { adminStyleCatalog } from '../components/adminStyleCatalog.js'

let wrapper: VueWrapper
beforeEach(async () => {
  vi.useFakeTimers()
  wrapper = mount(AdminStylePreview, { props: { style: adminStyleCatalog[0]! }, attachTo: document.body })
  await flushPromises()
})
afterEach(() => { wrapper.unmount(); vi.useRealTimers(); document.body.innerHTML = '' })
function frame() { return wrapper.get('iframe').element as HTMLIFrameElement }
function message(overrides: Record<string, unknown> = {}, source: MessageEventSource | null = frame().contentWindow, origin = 'null') {
  const url = new URL(frame().src)
  window.dispatchEvent(new MessageEvent('message', { origin, source, data: {
    type: 'admin-preview-ready', session: url.searchParams.get('previewSession'), route: url.hash.slice(1), ...overrides,
  } }))
}
it('iframe load alone stays loading and eventually displays a retryable failure', async () => {
  await wrapper.get('iframe').trigger('load')
  expect(wrapper.find('[role="status"]').exists()).toBe(true)
  await vi.advanceTimersByTimeAsync(20000)
  expect(wrapper.get('[role="alert"]').text()).toContain('重试')
})
it('accepts ready only from the current opaque frame and session', async () => {
  const session = new URL(frame().src).searchParams.get('previewSession')
  expect(session).toBeTruthy()
  message({}, window)
  message({}, frame().contentWindow, location.origin)
  message({ session: 'stale' })
  message({ route: '/wrong' })
  message({ type: 'unrelated' })
  await flushPromises()
  expect(wrapper.find('[role="status"]').exists()).toBe(true)
  message()
  await flushPromises()
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
  await vi.advanceTimersByTimeAsync(20000)
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
})
it('switching pages rejects the old iframe readiness', async () => {
  const oldFrame = frame(), oldUrl = new URL(oldFrame.src)
  await wrapper.findAll('nav button')[1]!.trigger('click')
  window.dispatchEvent(new MessageEvent('message', { origin: 'null', source: oldFrame.contentWindow, data: {
    type: 'admin-preview-ready', session: oldUrl.searchParams.get('previewSession'), route: '/',
  } }))
  await flushPromises()
  expect(new URL(frame().src).searchParams.get('previewSession')).not.toBe(oldUrl.searchParams.get('previewSession'))
  expect(wrapper.find('[role="status"]').exists()).toBe(true)
  message(); await flushPromises()
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
})
it('a child failure is visible and retry creates a fresh session', async () => {
  const previous = new URL(frame().src).searchParams.get('previewSession')
  message({ type: 'admin-preview-failed' }); await flushPromises()
  expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  await wrapper.get('[role="alert"] button').trigger('click')
  expect(new URL(frame().src).searchParams.get('previewSession')).not.toBe(previous)
  expect(wrapper.find('[role="status"]').exists()).toBe(true)
  message(); await flushPromises()
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
})
