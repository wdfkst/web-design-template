import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { useAdminTheme } from '../theme/useAdminTheme'

vi.mock('../theme/tokens', () => ({ adminTheme: {}, adminThemeMode: 'both', adminThemeModes: { light: { token: { colorText: '#111111' } }, dark: { token: { colorText: '#ffffff' } } } }))
afterEach(() => { vi.unstubAllGlobals(); delete document.documentElement.dataset.adminMode })
it('follows system changes and removes the system listener on unmount', async () => {
  let change: ((event: { matches: boolean }) => void) | undefined
  const removeEventListener = vi.fn()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: (_: string, listener: typeof change) => { change = listener }, removeEventListener }))
  const wrapper = mount(defineComponent({ setup: () => useAdminTheme(), template: '<p>{{ mode }} {{ theme.token.colorText }}</p>' }))
  expect(wrapper.text()).toBe('light #111111')
  change!({ matches: true }); await nextTick()
  expect(wrapper.text()).toBe('dark #ffffff')
  expect(document.documentElement.dataset.adminMode).toBe('dark')
  wrapper.unmount()
  expect(removeEventListener).toHaveBeenCalledWith('change', change)
})
it('uses light mode if matchMedia is unavailable', () => {
  vi.stubGlobal('matchMedia', undefined)
  const wrapper = mount(defineComponent({ setup: () => useAdminTheme(), template: '<p>{{ mode }}</p>' }))
  expect(wrapper.text()).toBe('light')
  wrapper.unmount()
})
import { primaryTextColor, contrastRatio } from '../theme/contrast'

describe('primary text contrast', () => {
  it.each(['#fff1a8', '#087f75', '#101828', '#ffffff', '#808080', '#fff', '#0a0', '#ABC'])('keeps readable text on %s', primary => {
    expect(contrastRatio(primary, primaryTextColor(primary))).toBeGreaterThanOrEqual(4.5)
  })
  it('rejects non-hex input instead of emitting invalid theme values', () => {
    expect(() => primaryTextColor('url(javascript:bad)')).toThrow()
  })
})
