import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminIcon from '../components/admin/AdminIcon.vue'

it.each(['box', 'calendar', 'task', 'media', 'document'])('renders a local SVG for semantic key %s', name => {
  expect(mount(AdminIcon, { props: { name } }).find('svg').exists()).toBe(true)
})
it('does not interpret an unknown icon as HTML or a component name', () => {
  const wrapper = mount(AdminIcon, { props: { name: '<img onerror="bad()">' } })
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.find('svg').exists()).toBe(false)
})
