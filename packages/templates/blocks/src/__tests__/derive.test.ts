import { describe, expect, it } from 'vitest'
import { ProjectSpecInputSchema } from '@vudt/spec'
import { BlockDerivationError, derivePageAssets, mergeDerivedAssets } from '../derive.js'
import { HeroSplit, StatsBand, LogoStrip, PricingCard } from '../registry.js'

const landing = [
  { component: 'NavBarSimple' },
  { component: 'HeroSplit' },
  { component: 'FeatureTriad' },
  { component: 'CtaBanner' },
  { component: 'FooterSimple' },
]

describe('derivePageAssets', () => {
  it('derives one asset per declared slot and none for slotless blocks', () => {
    const { blocks, assets } = derivePageAssets('/', landing)
    expect(blocks).toHaveLength(5)
    expect(assets).toHaveLength(5) // 1 hero + 3 features + 1 cta
    expect(blocks[0]?.assetBindings).toEqual({})
  })

  it('copies geometry verbatim from the sidecar', () => {
    const { assets } = derivePageAssets('/', [{ component: 'HeroSplit' }])
    const slot = HeroSplit.slots[0]!
    expect(assets[0]).toMatchObject({
      purpose: slot.purpose,
      aspectRatio: slot.aspectRatio,
      renderSize: slot.renderSize,
      transparent: slot.transparent,
      composition: slot.composition,
    })
  })

  it('wires every binding to an asset it actually emitted', () => {
    const { blocks, assets } = derivePageAssets('/', landing)
    const ids = new Set(assets.map((asset) => asset.id))
    for (const block of blocks) {
      for (const id of Object.values(block.assetBindings)) {
        expect(ids.has(id)).toBe(true)
      }
    }
  })

  it('gives repeated blocks distinct ids', () => {
    const { assets } = derivePageAssets('/', [
      { component: 'HeroSplit' },
      { component: 'HeroSplit' },
    ])
    expect(assets.map((a) => a.id)).toEqual([
      'index-0-hero-split-illustration',
      'index-1-hero-split-illustration',
    ])
  })

  it('namespaces ids by route', () => {
    const { assets } = derivePageAssets('/pricing', [{ component: 'HeroSplit' }])
    expect(assets[0]?.id).toBe('pricing-0-hero-split-illustration')
  })

  it('takes supplied subject text but keeps defaults for the rest', () => {
    const { assets } = derivePageAssets('/', [
      {
        component: 'FeatureTriad',
        content: { featureTwo: { prompt: 'a padlock over a shield', alt: 'Security' } },
      },
    ])
    expect(assets[1]).toMatchObject({ prompt: 'a padlock over a shield', alt: 'Security' })
    expect(assets[2]?.alt).toBe('Third feature illustration')
    expect(assets[0]?.alt).toBe('First feature illustration')
  })

  it('passes props through untouched', () => {
    const { blocks } = derivePageAssets('/', [
      { component: 'HeroSplit', props: { headline: 'Ship faster' } },
    ])
    expect(blocks[0]?.props).toEqual({ headline: 'Ship faster' })
  })

  it('rejects an unknown component', () => {
    expect(() => derivePageAssets('/', [{ component: 'MadeUpBlock' }])).toThrow(
      BlockDerivationError,
    )
  })

  // The feedback goes back to the model verbatim, so it has to name the legal
  // set — same reason the slot error lists the declared slots.
  it('names the available components in the error to help the retry prompt', () => {
    expect(() => derivePageAssets('/', [{ component: 'MadeUpBlock' }])).toThrow(
      /MadeUpBlock.*available: CtaBanner, EmptyStatePanel, FeatureTriad, FooterSimple, HeroCentered, HeroSplit, LogoStrip, NavBarSimple, PricingCard, StatsBand/,
    )
  })

  // A silently dropped key is how a prompt ends up applied to nothing.
  it('rejects content for a slot the block does not declare', () => {
    expect(() =>
      derivePageAssets('/', [
        { component: 'HeroSplit', content: { banner: { prompt: 'anything' } } },
      ]),
    ).toThrow(/has no slot "banner"/)
  })

  it('names the declared slots in the error to help the retry prompt', () => {
    expect(() =>
      derivePageAssets('/', [{ component: 'FeatureTriad', content: { four: { alt: 'x' } } }]),
    ).toThrow(/featureOne, featureTwo, featureThree/)
  })
})

describe('mergeDerivedAssets', () => {
  it('merges distinct pages', () => {
    const home = derivePageAssets('/', [{ component: 'HeroSplit' }])
    const pricing = derivePageAssets('/pricing', [{ component: 'CtaBanner' }])
    expect(mergeDerivedAssets([home, pricing])).toHaveLength(2)
  })

  it('rejects colliding ids', () => {
    const page = derivePageAssets('/', [{ component: 'HeroSplit' }])
    expect(() => mergeDerivedAssets([page, page])).toThrow(/duplicate derived asset id/)
  })

  it('derives no assets for the new slotless StatsBand', () => {
    const { blocks, assets } = derivePageAssets('/', [
      { component: 'NavBarSimple' },
      { component: 'StatsBand', props: { heading: 'By the numbers', stats: [{ label: 'Users', value: '12k' }] } },
    ])
    expect(assets).toHaveLength(0)
    expect(blocks[1]!.props).toEqual({
      heading: 'By the numbers',
      stats: [{ label: 'Users', value: '12k' }],
    })
  })

  it('derives no assets for the slotless LogoStrip', () => {
    const { blocks, assets } = derivePageAssets('/', [
      { component: 'LogoStrip', props: { heading: 'Trusted by', logos: [{ name: 'Acme', to: 'https://acme.com' }] } },
    ])
    expect(assets).toHaveLength(0)
    expect(blocks[0]!.props).toEqual({
      heading: 'Trusted by',
      logos: [{ name: 'Acme', to: 'https://acme.com' }],
    })
  })

  it('derives no assets for the slotless PricingCard', () => {
    const { blocks, assets } = derivePageAssets('/', [
      { component: 'PricingCard', props: { heading: 'Pick a plan', plans: [{ name: 'Pro', price: '$29', features: ['a', 'b'] }] } },
    ])
    expect(assets).toHaveLength(0)
    expect(blocks[0]!.props).toEqual({
      heading: 'Pick a plan',
      plans: [{ name: 'Pro', price: '$29', features: ['a', 'b'] }],
    })
  })
})

// The real guarantee: a derived page survives the spec's cross-field checks,
// which is what proves code side and image side cannot drift apart.
describe('derived output against the spec schema', () => {
  it('validates as a ProjectSpecInput', () => {
    const derived = derivePageAssets('/', landing)
    const result = ProjectSpecInputSchema.safeParse({
      meta: { name: 'Demo', description: 'A derived landing page', targetStack: 'vue3' },
      theme: {
        colorTokens: {
          primary: '#4f46e5',
          secondary: '#0ea5e9',
          accent: '#f59e0b',
          background: '#ffffff',
          surface: '#f8fafc',
          foreground: '#0f172a',
          muted: '#64748b',
        },
        radius: 'md',
        spacing: 'normal',
        fontPair: { heading: 'Inter', body: 'Inter' },
        mode: 'light',
      },
      styleBible: {
        artStyle: 'flat-vector',
        lineWeight: 'thin',
        shading: 'flat',
        perspective: 'front',
        palette: ['#4f46e5', '#0ea5e9', '#f59e0b'],
        backgroundTreatment: 'subtle-gradient',
        negativePrompt: '',
        seed: 7,
      },
      pages: [{ route: '/', title: 'Home', pageType: 'landing', blocks: derived.blocks }],
      assets: derived.assets,
    })
    expect(result.error?.issues ?? []).toEqual([])
    expect(result.success).toBe(true)
  })
})
