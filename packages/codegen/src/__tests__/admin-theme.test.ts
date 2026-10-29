import { expect, it } from 'vitest'
import { landingSpec } from './fixture.js'
import { renderAdminTheme } from '../admin/theme.js'
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
