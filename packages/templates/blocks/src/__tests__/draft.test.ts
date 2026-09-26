import { describe, expect, it } from 'vitest'
import { parseProjectSpecInput } from '@vudt/spec'
import { deriveSpecInput } from '../draft.js'
import { HeroSplit } from '../registry.js'

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
  shading: 'flat',
  perspective: 'front',
  palette: ['#4f46e5', '#0ea5e9'],
  backgroundTreatment: 'solid',
  negativePrompt: 'no text',
  seed: 7,
} as const

/**
 * The draft contract demands a small site, not a single page. Fixtures have to
 * satisfy it or every assertion below would fail on the shape gate instead of on
 * the behaviour it means to test.
 */
function contentBlock(component: string, props?: unknown, content?: unknown): Record<string, unknown> {
  return {
    component,
    ...(props === undefined ? {} : { props }),
    ...(content === undefined ? {} : { content }),
  }
}

function homePage(blocks?: unknown): Record<string, unknown> {
  return {
    route: '/',
    title: 'Home',
    pageType: 'landing',
    blocks: blocks ?? [
      contentBlock(
        'HeroSplit',
        { primaryCta: { label: 'See pricing', to: '/pricing' } },
        { illustration: { prompt: 'a developer at a desk', alt: 'Developer at a desk' } },
      ),
      contentBlock('StatsBand', { heading: 'By the numbers' }),
    ],
  }
}

/** A legal filler page: three pages minimum, two blocks each. */
function fillerPage(route: string, title: string): Record<string, unknown> {
  return {
    route,
    title,
    pageType: 'landing',
    blocks: [contentBlock('StatsBand'), contentBlock('TestimonialRow')],
  }
}

/** What the model is expected to send: blocks carry subject text, not geometry. */
function landingDraft(pages?: unknown): Record<string, unknown> {
  return {
    meta: { name: 'Acme', description: 'A landing page for Acme', targetStack: 'vue3' },
    theme,
    styleBible,
    pages: pages ?? [homePage(), fillerPage('/about', 'About'), fillerPage('/pricing', 'Pricing')],
  }
}

function okValue(result: ReturnType<typeof deriveSpecInput>) {
  if (!result.ok) throw new Error(`expected a derived spec, got: ${result.feedback}`)
  return result.value
}

function failureOf(result: ReturnType<typeof deriveSpecInput>): string {
  if (result.ok) throw new Error('expected a failure')
  return result.feedback
}

describe('deriveSpecInput', () => {
  it('turns a draft into a spec the spec schema accepts', () => {
    const value = okValue(deriveSpecInput(landingDraft()))

    expect(parseProjectSpecInput(value).ok).toBe(true)
  })

  it('binds every slot and takes its geometry from the sidecar', () => {
    const value = okValue(deriveSpecInput(landingDraft()))
    const illustration = HeroSplit.slots[0]!

    // Only HeroSplit has slots, so the draft's three blocks yield one asset.
    expect(value.assets).toHaveLength(1)
    expect(value.assets[0]!.id).toBe(value.pages[0]!.blocks[0]!.assetBindings.illustration)
    expect(value.assets[0]!.renderSize).toEqual(illustration.renderSize)
    expect(value.assets[0]!.aspectRatio).toBe(illustration.aspectRatio)
    expect(value.pages[1]!.blocks).toHaveLength(2)
  })

  it('carries the subject text the model wrote', () => {
    const value = okValue(deriveSpecInput(landingDraft()))

    expect(value.assets[0]!.prompt).toBe('a developer at a desk')
    expect(value.assets[0]!.alt).toBe('Developer at a desk')
  })

  it('falls back to the sidecar default when a slot is left out', () => {
    const value = okValue(
      deriveSpecInput(
        landingDraft([
          homePage([contentBlock('HeroSplit'), contentBlock('StatsBand')]),
          fillerPage('/about', 'About'),
          fillerPage('/pricing', 'Pricing'),
        ]),
      ),
    )

    expect(value.assets[0]!.prompt).toBe(HeroSplit.slots[0]!.defaultPrompt)
    expect(value.assets[0]!.alt).toBe(HeroSplit.slots[0]!.defaultAlt)
  })

  it('reports path-prefixed feedback when the draft shape is wrong', () => {
    const { theme: _omitted, ...withoutTheme } = landingDraft()

    const feedback = failureOf(deriveSpecInput(withoutTheme))

    // Gate 1's message is fed straight back to the model, so it has to name the path.
    expect(feedback).toMatch(/^theme: /m)
  })

  it('names the declared slots when the draft invents one', () => {
    const feedback = failureOf(
      deriveSpecInput(
        landingDraft([
          homePage([
            contentBlock('HeroSplit', undefined, { banner: { prompt: 'anything' } }),
            contentBlock('StatsBand'),
          ]),
          fillerPage('/about', 'About'),
          fillerPage('/pricing', 'Pricing'),
        ]),
      ),
    )

    expect(feedback).toMatch(/has no slot "banner"/)
    expect(feedback).toMatch(/illustration/)
  })

  it('names the available components when the draft picks an unknown one', () => {
    const feedback = failureOf(
      deriveSpecInput(
        landingDraft([
          homePage([contentBlock('MadeUpBlock'), contentBlock('StatsBand')]),
          fillerPage('/about', 'About'),
          fillerPage('/pricing', 'Pricing'),
        ]),
      ),
    )

    expect(feedback).toMatch(/available: .*HeroSplit/)
  })

  it('rejects two pages that derive the same asset id', () => {
    const page = {
      route: '/',
      title: 'Home',
      pageType: 'landing',
      blocks: [contentBlock('HeroSplit'), contentBlock('StatsBand')],
    }

    const feedback = failureOf(deriveSpecInput(landingDraft([page, page, fillerPage('/about', 'About')])))

    expect(feedback).toMatch(/duplicate derived asset id/)
  })
})

describe('deriveSpecInput gate: cross-page targets', () => {
  it('rejects a CTA that points at a route no page declares', () => {
    const draft = landingDraft([
      {
        route: '/',
        title: 'Home',
        pageType: 'landing',
        blocks: [
          { component: 'HeroSplit', props: { primaryCta: { label: 'Enterprise', to: '/enterprise' } } },
          { component: 'StatsBand' },
        ],
      },
      { route: '/about', title: 'About', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
      { route: '/pricing', title: 'Pricing', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
    ])

    expect(failureOf(deriveSpecInput(draft))).toMatch(/\/enterprise.*not a declared route/)
  })

  it('accepts a CTA that names a declared route', () => {
    const value = okValue(
      deriveSpecInput(
        landingDraft([
          {
            route: '/',
            title: 'Home',
            pageType: 'landing',
            blocks: [
              { component: 'HeroSplit', props: { primaryCta: { label: 'Pricing', to: '/pricing' } } },
              { component: 'StatsBand' },
            ],
          },
          { route: '/about', title: 'About', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
          { route: '/pricing', title: 'Pricing', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
        ]),
      ),
    )

    expect(value.pages[0]!.blocks[0]!.props).toEqual({ primaryCta: { label: 'Pricing', to: '/pricing' } })
  })
})

describe('deriveSpecInput gate: the draft has to be a site, not a page', () => {
  it('rejects a draft that plans only one page, naming the path', () => {
    const feedback = failureOf(deriveSpecInput(landingDraft([homePage()])))

    expect(feedback).toMatch(/^pages: /m)
  })

  it('rejects a page with a single block, naming the page', () => {
    const feedback = failureOf(
      deriveSpecInput(
        landingDraft([
          homePage([contentBlock('StatsBand')]),
          fillerPage('/about', 'About'),
          fillerPage('/pricing', 'Pricing'),
        ]),
      ),
    )

    expect(feedback).toMatch(/^pages\[0\]\.blocks: /m)
  })
})

describe('deriveSpecInput data-model passthrough', () => {
  it('carries collections, forms and page operations into the derived spec', () => {
    const draft = landingDraft([
      homePage(),
      {
        route: '/orders',
        title: 'Orders',
        pageType: 'list-detail',
        blocks: [
          { component: 'DataTable', props: { collection: 'orders' } },
          { component: 'StatsGrid', props: { heading: 'Overview' } },
        ],
        operations: [{ id: 'refresh-orders', label: 'Refresh', kind: 'refresh', target: 'orders' }],
      },
      // homePage()'s HeroSplit CTA points at /pricing, so the third page has to
      // declare that route or the CTA gate fires before the passthrough runs.
      fillerPage('/pricing', 'Pricing'),
    ])
    draft.collections = [
      {
        id: 'orders',
        label: 'Orders',
        model: { id: { type: 'string', label: 'ID' }, name: { type: 'string', label: 'Name' } },
        fields: ['name'],
        seed: 4,
        actions: ['search', 'edit', 'delete', 'export'],
      },
    ]
    draft.forms = [
      {
        id: 'order-form',
        label: 'Order form',
        collection: 'orders',
        fields: [{ key: 'name', label: 'Name', type: 'string', required: true }],
        submit: { label: '保存', toast: '已保存' },
      },
    ]

    const value = okValue(deriveSpecInput(draft))
    expect(value.collections[0]!.id).toBe('orders')
    expect(value.forms[0]!.id).toBe('order-form')
    const orders = value.pages.find((page) => page.route === '/orders')!
    expect(orders.operations).toHaveLength(1)
    expect(orders.operations[0]!.kind).toBe('refresh')
    expect(parseProjectSpecInput(value).ok).toBe(true)
  })

  it('defaults the new fields away for drafts without them (zero-break)', () => {
    const value = okValue(deriveSpecInput(landingDraft()))
    expect(value.collections).toEqual([])
    expect(value.forms).toEqual([])
    expect(value.pages[0]!.operations).toEqual([])
  })
})
