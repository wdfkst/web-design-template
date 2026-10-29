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
it('uses supplied asset geometry and alt text', () => {
  const wrapper = mount(AdminWelcomePanel, { props: { headline: '欢迎', assets: { illustration: { src: './assets/welcome.png', alt: '业务插画', w: 512, h: 512 } } } })
  expect(wrapper.get('img').attributes()).toMatchObject({ src: './assets/welcome.png', alt: '业务插画', width: '512', height: '512' })
  wrapper.unmount()
})
