// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import RequestInspector from '../RequestInspector.vue'

it('shows request attempts as plain text and switches to actual image requests', async () => {
  const wrapper = mount(RequestInspector, { props: { requests: [
    { id: 'one', kind: 'structure', model: 'structure-model', attempt: 1, status: 'succeeded', startedAt: 0, messages: [{ role: 'user', content: '<img src=x onerror=alert(1)>' }] },
    { id: 'two', kind: 'image', model: 'image-model', status: 'pending', startedAt: 1, prompt: 'tray\nAvoid: text' },
  ] } })
  expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  expect(wrapper.find('img').exists()).toBe(false)
  await wrapper.get('[data-kind="image"]').trigger('click')
  expect(wrapper.text()).toContain('tray')
  expect(wrapper.text()).toContain('等待模型响应')
})

it('explains missing and oversized snapshots rather than inventing prompts', () => {
  const empty = mount(RequestInspector, { props: { requests: [] } })
  expect(empty.text()).toContain('暂无请求快照')
  const large = mount(RequestInspector, { props: { requests: [{ id: 'large', kind: 'structure', model: 'test', status: 'succeeded', startedAt: 0, omittedReason: 'request-too-large' }] } })
  expect(large.text()).toContain('超过保存上限')
})
