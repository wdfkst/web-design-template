import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminMotif from '../components/admin/AdminMotif.vue'

it('renders four distinct local decorative illustrations without links', () => {
  const shapes = new Set<string>()
  for (const motif of ['spark', 'bloom', 'orbit', 'toolkit'] as const) {
    const wrapper = mount(AdminMotif, { props: { motif } })
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
    expect(wrapper.find('image, script, foreignObject, a').exists()).toBe(false)
    expect(wrapper.html()).not.toMatch(/https?:|onload=|onclick=/)
    shapes.add(wrapper.get('svg').html())
    wrapper.unmount()
  }
  expect(shapes.size).toBe(4)
})
it('defaults to spark and renders compact geometry', () => {
  const wrapper = mount(AdminMotif, { props: { compact: true } })
  expect(wrapper.attributes('data-motif')).toBe('spark')
  expect(wrapper.classes()).toContain('compact')
  wrapper.unmount()
})
