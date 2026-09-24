import { describe, expect, it } from 'vitest'
import { AssetInputSchema, renderSizeMatchesRatio } from '@vudt/spec'
import { BLOCK_REGISTRY, blocksForPageType, getSlot, listBlockComponents } from '../registry.js'

describe('block registry', () => {
  it('keys every definition by its own component name', () => {
    for (const [key, definition] of BLOCK_REGISTRY) {
      expect(key).toBe(definition.component)
    }
  })

  it('exposes the expected component set', () => {
    expect(listBlockComponents()).toEqual([
      'AuthPanel',
      'CtaBanner',
      'DataTable',
      'EmptyStatePanel',
      'FAQAccordion',
      'FeatureTriad',
      'FooterSimple',
      'FormPanel',
      'HeroCentered',
      'HeroSplit',
      'LogoStrip',
      'NavBarSimple',
      'PricingCard',
      'StatsBand',
      'StatsGrid',
      'StatusCard',
      'TestimonialRow',
    ])
  })

  it('declares slot names uniquely within a block', () => {
    for (const definition of BLOCK_REGISTRY.values()) {
      const names = definition.slots.map((slot) => slot.name)
      expect(new Set(names).size).toBe(names.length)
    }
  })

  // The sidecar geometry is the contract; a typo here would ship a squashed
  // image, so assert every authored slot against the spec's own tolerance.
  it('authors every slot with a renderSize matching its aspectRatio', () => {
    for (const definition of BLOCK_REGISTRY.values()) {
      for (const slot of definition.slots) {
        expect(
          renderSizeMatchesRatio({
            aspectRatio: slot.aspectRatio,
            renderSize: slot.renderSize,
          } as Parameters<typeof renderSizeMatchesRatio>[0]),
          `${definition.component}.${slot.name}`,
        ).toBe(true)
      }
    }
  })

  it('authors slot defaults that already satisfy the asset schema', () => {
    for (const definition of BLOCK_REGISTRY.values()) {
      for (const slot of definition.slots) {
        const parsed = AssetInputSchema.safeParse({
          id: 'placeholder-id',
          purpose: slot.purpose,
          aspectRatio: slot.aspectRatio,
          renderSize: slot.renderSize,
          transparent: slot.transparent,
          composition: slot.composition,
          prompt: slot.defaultPrompt,
          alt: slot.defaultAlt,
        })
        expect(parsed.success, `${definition.component}.${slot.name}`).toBe(true)
      }
    }
  })

  it('finds a slot by component and name, and misses cleanly', () => {
    expect(getSlot('HeroSplit', 'illustration')?.purpose).toBe('hero-illustration')
    expect(getSlot('HeroSplit', 'nope')).toBeUndefined()
    expect(getSlot('Nope', 'illustration')).toBeUndefined()
  })

  it('filters blocks by page type', () => {
    const landing = blocksForPageType('landing').map((d) => d.component)
    expect(landing).toContain('HeroSplit')
    expect(landing).not.toContain('EmptyStatePanel')
  })

  // Layout components stay in the registry so `sfc-props.test.ts` keeps checking
  // their props against their SFCs — but the drafter must never offer them as
  // page blocks, and the derivation must reject them if it does.
  it('marks exactly NavBarSimple and FooterSimple as layout-only', () => {
    const layoutOnly = [...BLOCK_REGISTRY.values()]
      .filter((definition) => definition.layoutOnly === true)
      .map((definition) => definition.component)
      .sort()
    expect(layoutOnly).toEqual(['FooterSimple', 'NavBarSimple'])
  })
})
