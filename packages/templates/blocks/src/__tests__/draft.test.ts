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

/** What the model is expected to send: blocks carry subject text, not geometry. */
function landingDraft(pages?: unknown): Record<string, unknown> {
  return {
    meta: { name: 'Acme', description: 'A landing page for Acme', targetStack: 'vue3' },
    theme,
    styleBible,
    pages: pages ?? [
      {
        route: '/',
        title: 'Home',
        pageType: 'landing',
        blocks: [
          { component: 'NavBarSimple', props: { brand: 'Acme' } },
          {
            component: 'HeroSplit',
            content: { illustration: { prompt: 'a developer at a desk', alt: 'Developer at a desk' } },
          },
          { component: 'FooterSimple', props: { brand: 'Acme', note: '(c) 2026' } },
        ],
      },
    ],
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
    expect(value.assets[0]!.id).toBe(value.pages[0]!.blocks[1]!.assetBindings.illustration)
    expect(value.assets[0]!.renderSize).toEqual(illustration.renderSize)
    expect(value.assets[0]!.aspectRatio).toBe(illustration.aspectRatio)
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
          {
            route: '/',
            title: 'Home',
            pageType: 'landing',
            blocks: [{ component: 'HeroSplit' }],
          },
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
          {
            route: '/',
            title: 'Home',
            pageType: 'landing',
            blocks: [{ component: 'HeroSplit', content: { banner: { prompt: 'anything' } } }],
          },
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
          { route: '/', title: 'Home', pageType: 'landing', blocks: [{ component: 'MadeUpBlock' }] },
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
      blocks: [{ component: 'HeroSplit' }],
    }

    const feedback = failureOf(deriveSpecInput(landingDraft([page, page])))

    expect(feedback).toMatch(/duplicate derived asset id/)
  })
})
