import { describe, expect, it } from 'vitest'
import { ImagegenError } from '../errors.js'
import { DEFAULT_SIZE_TIERS, pickSizeTier } from '../size.js'

describe('pickSizeTier', () => {
  it('picks the square tier for 1:1', () => {
    expect(pickSizeTier('1:1')).toEqual({ w: 1024, h: 1024 })
  })

  it('picks landscape tiers for landscape ratios', () => {
    for (const ratio of ['4:3', '3:2', '16:9'] as const) {
      const tier = pickSizeTier(ratio)
      expect(tier.w).toBeGreaterThan(tier.h)
    }
  })

  it('mirrors the choice for the portrait counterpart', () => {
    const landscape = pickSizeTier('4:3')
    const portrait = pickSizeTier('3:4')
    expect(portrait).toEqual({ w: landscape.h, h: landscape.w })
  })

  it('never returns a tier smaller than a typical container', () => {
    for (const tier of DEFAULT_SIZE_TIERS) {
      expect(Math.max(tier.w, tier.h)).toBeGreaterThanOrEqual(1024)
    }
  })

  it('prefers the larger tier when two match the ratio equally', () => {
    const tiers = [
      { w: 512, h: 512 },
      { w: 1024, h: 1024 },
    ]
    expect(pickSizeTier('1:1', tiers)).toEqual({ w: 1024, h: 1024 })
  })

  it('throws when no tiers are configured', () => {
    expect(() => pickSizeTier('1:1', [])).toThrow(ImagegenError)
  })
})
