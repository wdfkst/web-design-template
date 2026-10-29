import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import TaskTimeline from '../TaskTimeline.vue'
it('shows the actual typecheck phase rather than inferring vite from completed images', () => {
  const wrapper = mount(TaskTimeline, { props: { task: { id: 'x', status: 'building', stage: 'typecheck', stageStartedAt: Date.now(), description: 'test', createdAt: Date.now(), assetsDone: 2, assetsTotal: 2 }, events: [{ seq: 1, at: 0, stage: 'typecheck', state: 'started', message: '开始执行' }] } })
  expect(wrapper.get('[data-current-stage]').text()).toContain('类型检查')
  expect(wrapper.text()).not.toContain('%')
  wrapper.unmount()
})
