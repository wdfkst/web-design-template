import { describe, expect, it } from 'vitest'
import { primaryTextColor, contrastRatio } from '../theme/contrast'

describe('primary text contrast', () => {
  it.each(['#fff1a8', '#087f75', '#101828', '#ffffff', '#808080', '#fff', '#0a0', '#ABC'])('keeps readable text on %s', primary => {
    expect(contrastRatio(primary, primaryTextColor(primary))).toBeGreaterThanOrEqual(4.5)
  })
  it('rejects non-hex input instead of emitting invalid theme values', () => {
    expect(() => primaryTextColor('url(javascript:bad)')).toThrow()
  })
})
