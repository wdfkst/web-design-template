import { expect, it } from 'vitest'
import { landingSpec } from './fixture.js'
import { renderAdminTheme } from '../admin/theme.js'
function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const values = hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    return values[0]! * .2126 + values[1]! * .7152 + values[2]! * .0722
  }
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}

it.each(['#167d73', '#bc3763', '#e89c35'])('creates jelly geometry and readable colors for %s', primary => {
  const spec = landingSpec()
  spec.experience = { kind: 'admin', navigation: [], presentation: { appearance: 'jelly', decoration: 'balanced', shell: 'sidebar' } }
  spec.theme.colorTokens.primary = primary
  const css = renderAdminTheme(spec)['src/theme/generated.css']!
  for (const mode of ['light', 'dark']) {
    const body = css.split(`[data-admin-mode="${mode}"]{`)[1]!.split('}')[0]!
    for (const [name, radius] of [['panel', 16], ['card', 20], ['hero', 28], ['control', 12]]) expect(body).toContain(`--admin-jelly-${name}-radius:${radius}px`)
    const value = (name: string) => body.match(new RegExp(`--admin-${name}:(#[a-f0-9]+);`, 'i'))![1]!
    expect(contrastRatio(value('primary'), value('on-primary'))).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(value('surface'), value('text'))).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(value('surface'), value('muted'))).toBeGreaterThanOrEqual(4.5)
  }
  for (const appearance of ['plain', 'soft-glass'] as const) {
    spec.experience.presentation!.appearance = appearance
    expect(renderAdminTheme(spec)['src/theme/generated.css']).not.toContain('--admin-jelly-')
  }
})

it('repairs unreadable foregrounds for both generated surfaces', () => {
  const spec = landingSpec()
  spec.experience = { kind: 'admin', navigation: [{ id: 'home', label: '首页', route: '/' }], presentation: { appearance: 'soft-glass', decoration: 'balanced', shell: 'sidebar' } }
  spec.theme.colorTokens.foreground = '#ffffff'
  spec.theme.colorTokens.muted = '#ffffff'
  const css = renderAdminTheme(spec)['src/theme/generated.css']!
  for (const mode of ['light', 'dark']) {
    const body = css.split(`[data-admin-mode="${mode}"]{`)[1]!.split('}')[0]!
    const value = (name: string) => body.match(new RegExp(`--admin-${name}:(#[a-f0-9]+);`, 'i'))![1]!
    expect(contrastRatio(value('surface'), value('text'))).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(value('surface'), value('muted'))).toBeGreaterThanOrEqual(4.5)
  }
})

it('emits separate modes and prioritizes explicit presentation density', () => {
  const spec = landingSpec()
  spec.experience = { kind: 'admin', navigation: [{ id: 'home', label: '首页', route: '/' }], presentation: { appearance: 'soft-glass', decoration: 'balanced', shell: 'topbar', density: 'compact' } }
  spec.theme.mode = 'both'
  spec.theme.spacing = 'relaxed'
  const files = renderAdminTheme(spec)
  expect(files['src/theme/presentation.ts']).toContain('topbar')
  expect(files['src/theme/tokens.ts']).toContain('adminThemeModes')
  expect(files['src/theme/tokens.ts']).toContain('"controlHeight":30')
  expect(files['src/theme/generated.css']).toContain('[data-admin-mode="dark"]')
  delete spec.experience.presentation!.density
  expect(renderAdminTheme(spec)['src/theme/tokens.ts']).toContain('"controlHeight":38')
})
it('maps business theme and enables readable primary text and dark algorithm', () => {
  const spec = landingSpec()
  spec.theme.mode = 'dark'; spec.theme.colorTokens.primary = '#ffee88'
  const result = renderAdminTheme(spec)
  expect(result['src/theme/tokens.ts']).toContain('theme.darkAlgorithm')
  expect(result['src/theme/tokens.ts']).toContain('primaryTextColor')
  expect(result['src/theme/tokens.ts']).toContain('#ffee88')
  expect(result['src/theme/generated.css']).toContain('--admin-primary: #ffee88')
  expect(result['src/theme/generated.css']).toContain('--admin-on-primary: #000000')
  expect(result['src/theme/generated.css']).not.toContain('#087f75')
})
