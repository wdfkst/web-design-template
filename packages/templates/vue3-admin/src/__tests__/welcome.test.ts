import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminWelcomePanel from '../components/admin/AdminWelcomePanel.vue'
it('renders welcome copy safely without inventing an image', () => {
  const wrapper = mount(AdminWelcomePanel, { props: { headline: '<script>欢迎</script>', body: '今天的业务' } })
  expect(wrapper.text()).toContain('<script>欢迎</script>')
  expect(wrapper.find('script').exists()).toBe(false)
  expect(wrapper.find('img').exists()).toBe(false)
  wrapper.unmount()
})
it('falls back locally for jelly and retries when the image changes', async () => {
  const presentation = { appearance: 'jelly', decoration: 'balanced', shell: 'sidebar', motif: 'bloom' } as const
  const wrapper = mount(AdminWelcomePanel, { props: { headline: '欢迎', presentation } })
  expect(wrapper.find('[data-motif="bloom"]').exists()).toBe(true)
  await wrapper.setProps({ assets: { illustration: { src: './assets/a.png', alt: '业务插画', w: 512, h: 512 } } })
  expect(wrapper.get('img').attributes('width')).toBe('512')
  await wrapper.get('img').trigger('error')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.find('[data-motif="bloom"]').exists()).toBe(true)
  await wrapper.setProps({ assets: { illustration: { src: './assets/b.png', alt: '新的插画', w: 512, h: 512 } } })
  expect(wrapper.get('img').attributes('src')).toBe('./assets/b.png')
  await wrapper.setProps({ presentation: { ...presentation, decoration: 'minimal' } })
  expect(wrapper.find('img, svg').exists()).toBe(false)
  wrapper.unmount()
})
it('uses supplied asset geometry and alt text', () => {
  const wrapper = mount(AdminWelcomePanel, { props: { headline: '欢迎', assets: { illustration: { src: './assets/welcome.png', alt: '业务插画', w: 512, h: 512 } } } })
  expect(wrapper.get('img').attributes()).toMatchObject({ src: './assets/welcome.png', alt: '业务插画', width: '512', height: '512' })
  wrapper.unmount()
})
