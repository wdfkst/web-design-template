import { describe, expect, it } from 'vitest'
import * as spec from '../index.js'
import { ThemeSchema } from '../theme.js'
import { AdminPresentationSchema } from '../admin-presentation.js'
import { StyleBibleSchema } from '../style-bible.js'

const cases = [
  ['soft', '柔和立体', 'light', '3d-clay', 'soft-clay', 'icon-sidebar', 'welcome-grid'],
  ['warm', '温润自然', 'light', 'hand-drawn', 'natural-paper', 'expanded-sidebar', 'main-aside'],
  ['mist', '雾色微光', 'light', 'isometric', 'frosted-glass', 'top-nav', 'sectioned'],
  ['porcelain', '光瓷科技', 'light', 'isometric', 'porcelain-metal', 'wide-sidebar', 'staggered'],
  ['aurora', '极光空间', 'dark', 'isometric', 'aurora-optical', 'top-nav-context', 'main-context'],
] as const

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
}

describe('versioned admin styles', () => {
  it('exposes exactly the five selectable styles', () => {
    expect(spec.ADMIN_STYLE_IDS).toEqual(['soft', 'warm', 'mist', 'porcelain', 'aurora'])
  })

  it.each(cases)('resolves %s to a valid complete visual definition', (id, label, mode, artStyle, material, shell, layout) => {
    const ref = spec.getCurrentAdminStyleReference(id)
    expect(ref).toEqual({ id, version: 1 })
    const style = spec.resolveAdminStyle(ref)
    expect(style).toMatchObject({ id, version: 1, label, material, shellVariant: shell, workbenchLayout: layout, skin: id })
    expect(style!.theme.mode).toBe(mode)
    expect(style!.styleBible.artStyle).toBe(artStyle)
    expect(ThemeSchema.safeParse(style!.theme).success).toBe(true)
    expect(AdminPresentationSchema.safeParse(style!.presentation).success).toBe(true)
    expect(StyleBibleSchema.safeParse({ ...style!.styleBible, seed: 0, palette: ['#FFFFFF', '#000000'] }).success).toBe(true)
    for (const background of [style!.theme.colorTokens.background, style!.theme.colorTokens.surface]) {
      const a = luminance(style!.theme.colorTokens.foreground)
      const b = luminance(background)
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each([null, '', 'other', 1, [], {}, '__proto__'])('rejects an invalid selection: %j', (id) => {
    expect(spec.AdminStyleIdSchema.safeParse(id).success).toBe(false)
    expect(spec.getCurrentAdminStyleReference(id)).toBeUndefined()
    expect(spec.resolveAdminStyle({ id, version: 1 })).toBeUndefined()
  })

  it.each([0, -1, 1.5, '1', null])('rejects malformed versions: %j', (version) => {
    expect(spec.AdminStyleReferenceSchema.safeParse({ id: 'soft', version }).success).toBe(false)
    expect(spec.resolveAdminStyle({ id: 'soft', version })).toBeUndefined()
  })

  it('distinguishes valid future references from supported definitions', () => {
    expect(spec.AdminStyleReferenceSchema.safeParse({ id: 'soft', version: 2 }).success).toBe(true)
    expect(spec.resolveAdminStyle({ id: 'soft', version: 2 })).toBeUndefined()
  })

  it('does not let consumers mutate a published definition or reference', () => {
    const ref = spec.getCurrentAdminStyleReference('soft')!
    const first = spec.resolveAdminStyle(ref)!
    first.theme.colorTokens.primary = '#000000'
    first.presentation.shell = 'topbar'
    first.styleBible.artStyle = 'line-art'
    ref.version = 99
    const next = spec.getCurrentAdminStyleReference('soft')!
    expect(next).toEqual({ id: 'soft', version: 1 })
    expect(spec.resolveAdminStyle(next)).toMatchObject({
      theme: { colorTokens: { primary: '#7550B5' } },
      presentation: { shell: 'sidebar' },
      styleBible: { artStyle: '3d-clay' },
    })
  })
})
