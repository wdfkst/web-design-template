import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { safeCoverUrl } from '../data/cover'
import AdminCardCover from '../components/admin/AdminCardCover.vue'
import AdminRecordCards from '../components/admin/AdminRecordCards.vue'

it.each(['./covers/sample.png', './covers/team/sample-1.webp', 'https://example.test/image.png'])('accepts cover %s', value => expect(safeCoverUrl(value)).toBe(value))
it.each([undefined, null, 42, '', ' ./covers/a.png', './covers/a.png ', './covers/a\\b.png', './covers/../a.png', './covers/./a.png', './covers/%2e%2e/a.png', './covers/a//b.png', './covers/a.png?q=1', './covers/a.png#x', '/assets/a.png', '//example.test/a.png', 'data:image/png,x', 'javascript:alert(1)', 'file:///a.png', 'http://example.test/a.png', 'https://u:p@example.test/a.png', 'https://example.test/a\nb.png'])('rejects unsafe cover %#', value => expect(safeCoverUrl(value)).toBeUndefined())
it('keeps local covers beneath the deployed document directory', () => {
  const src = safeCoverUrl('./covers/sample.png')!
  expect(new URL(src, 'https://host.test/index.html#/items').pathname).toBe('/covers/sample.png')
  expect(new URL(src, 'https://host.test/preview/test/index.html#/items').pathname).toBe('/preview/test/covers/sample.png')
})
it('falls back without a request and retries a changed image', async () => {
  const wrapper = mount(AdminCardCover, { props: { title: '<img onerror=bad()>', motif: 'orbit', decorative: true } })
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.find('[data-motif="orbit"]').exists()).toBe(true)
  await wrapper.setProps({ src: './covers/a.png' })
  expect(wrapper.get('img').attributes()).toMatchObject({ alt: '<img onerror=bad()>', loading: 'lazy', referrerpolicy: 'no-referrer' })
  await wrapper.get('img').trigger('error')
  expect(wrapper.find('img').exists()).toBe(false)
  await wrapper.setProps({ src: './covers/b.png' })
  expect(wrapper.get('img').attributes('src')).toBe('./covers/b.png')
  await wrapper.setProps({ src: undefined, decorative: false })
  expect(wrapper.find('svg, img').exists()).toBe(false)
  expect(wrapper.text()).toContain('暂无封面')
  wrapper.unmount()
})
it('omits unconfigured minimal covers but preserves configured business images', async () => {
  const wrapper = mount(AdminRecordCards, { props: { presentation: { appearance: 'jelly', decoration: 'minimal', shell: 'sidebar' }, rows: [{ id: 1, name: '素材', cover: './covers/sample.svg' }], titleField: 'name', summaryFields: [], selectedIds: [], selectable: false, model: {}, actions: [] } })
  expect(wrapper.find('.card-cover').exists()).toBe(false)
  expect(wrapper.get('article').classes()).not.toContain('has-cover')
  await wrapper.setProps({ coverField: 'cover' })
  expect(wrapper.get('img').attributes('src')).toBe('./covers/sample.svg')
  expect(wrapper.get('article').classes()).toContain('has-cover')
  await wrapper.get('img').trigger('error')
  expect(wrapper.text()).toContain('暂无封面')
  expect(wrapper.find('[data-motif]').exists()).toBe(false)
  wrapper.unmount()
})
it('adds default jelly covers but leaves legacy cards unchanged', async () => {
  const wrapper = mount(AdminRecordCards, { props: { rows: [{ id: 1, name: '素材' }], titleField: 'name', summaryFields: [], selectedIds: [], selectable: false, model: {}, actions: [{ kind: 'detail', label: '详情' }] } })
  expect(wrapper.find('.card-cover').exists()).toBe(false)
  await wrapper.setProps({ presentation: { appearance: 'jelly', decoration: 'balanced', shell: 'sidebar', motif: 'bloom' } })
  expect(wrapper.find('[data-motif="bloom"]').exists()).toBe(true)
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('action')).toEqual([[{ id: 1, actionIndex: 0 }]])
  wrapper.unmount()
})
