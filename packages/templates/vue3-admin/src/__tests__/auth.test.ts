import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminAuthPage from '../components/admin/AdminAuthPage.vue'
it('renders derived asset dimensions and explains authentication is only a demo', async () => {
  const wrapper = mount(AdminAuthPage, { props: { title: '登录', panel: { fields: [{ label: '账号', type: 'text' }], assets: { illustration: { src: './assets/test.png', alt: '业务插画', w: 512, h: 512 } } } } })
  try {
    expect(wrapper.get('img').attributes('width')).toBe('512')
    expect(wrapper.get('img').attributes('alt')).toBe('业务插画')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('尚未接入身份验证')
  } finally { wrapper.unmount() }
})
