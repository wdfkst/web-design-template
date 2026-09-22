import { derivePageAssets, mergeDerivedAssets, type BlockSelection } from '@vudt/blocks'
import { finalizeSpec, ProjectSpecInputSchema, type ProjectSpec } from '@vudt/spec'

const theme = {
  colorTokens: {
    primary: '#4f46e5',
    secondary: '#0ea5e9',
    accent: '#f59e0b',
    background: '#ffffff',
    surface: '#f8fafc',
    foreground: '#0f172a',
    muted: '#64748b',
  },
  radius: 'lg',
  spacing: 'normal',
  fontPair: { heading: 'Inter', body: 'Inter' },
  mode: 'light',
} as const

const styleBible = {
  artStyle: 'flat-vector',
  lineWeight: 'none',
  shading: 'soft-gradient',
  perspective: 'three-quarter',
  palette: ['#4f46e5', '#0ea5e9', '#f59e0b'],
  backgroundTreatment: 'subtle-gradient',
  negativePrompt: 'no text, no watermark',
  seed: 1234,
} as const

/**
 * Builds the spec the way the platform will: block geometry comes from the
 * sidecars via derivePageAssets, never hand-written here. A hand-written
 * fixture could accidentally encode a size the sidecars disagree with, which
 * is exactly the failure these tests exist to catch.
 */
export function landingSpec(): ProjectSpec {
  const home: BlockSelection[] = [
    {
      component: 'HeroSplit',
      props: {
        headline: 'Ship faster',
        subhead: 'A "quoted" & ampersanded subhead',
        primaryCta: { label: 'See pricing', to: '/pricing' },
      },
      content: { illustration: { prompt: 'a developer at a desk', alt: 'Developer at a desk' } },
    },
    {
      component: 'StatsBand',
      props: {
        heading: 'By the numbers',
        stats: [
          { label: 'Users', value: '12k' },
          { label: 'Uptime', value: '99.9', suffix: '%' },
        ],
      },
    },
    {
      component: 'FeatureTriad',
      props: {
        heading: 'Why Acme',
        features: [
          { title: 'Fast', body: 'Very fast.' },
          { title: 'Safe', body: 'Very safe.' },
          { title: 'Simple', body: 'Very simple.' },
        ],
      },
    },
    { component: 'CtaBanner', props: { headline: 'Ready?', cta: { label: 'Choose a plan', to: '/pricing' } } },
  ]

  const pricing: BlockSelection[] = [
    { component: 'HeroCentered', props: { headline: 'Pricing' } },
    {
      component: 'PricingCard',
      props: {
        heading: 'Pick a plan',
        plans: [
          {
            name: 'Pro',
            price: '$29',
            features: ['Unlimited projects', 'Priority support'],
            cta: { label: 'Start with Pro', to: '/' },
            featured: true,
          },
        ],
      },
    },
  ]

  const homeDerived = derivePageAssets('/', home)
  const pricingDerived = derivePageAssets('/pricing', pricing)

  const input = {
    meta: {
      name: 'Acme Landing',
      description: 'A marketing landing page for a developer tooling product.',
      targetStack: 'vue3',
      },
    theme,
    styleBible,
    pages: [
      { route: '/', title: 'Home', pageType: 'landing', blocks: homeDerived.blocks },
      { route: '/pricing', title: 'Pricing', pageType: 'landing', blocks: pricingDerived.blocks },
    ],
    assets: mergeDerivedAssets([homeDerived, pricingDerived]),
  }

  return finalizeSpec(ProjectSpecInputSchema.parse(input))
}
