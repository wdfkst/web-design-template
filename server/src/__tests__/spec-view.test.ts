import { describe, expect, it } from 'vitest'
import { deriveSpecInput } from '@vudt/blocks'
import { finalizeSpec } from '@vudt/spec'
import { toSpecView } from '../spec-view.js'
import { landingDraft } from './fixture.js'

/** The fixture is a draft; deriving is how it gains a spec's geometry and ids. */
function landingSpec() {
  const derived = deriveSpecInput(landingDraft())
  if (!derived.ok) throw new Error(derived.feedback)
  return finalizeSpec(derived.value)
}

describe('toSpecView', () => {
  it('projects meta, theme, styleBible, pages and assets', () => {
    const view = toSpecView(landingSpec())

    expect(view.meta.targetStack).toBe('vue3')
    expect(view.pages.length).toBeGreaterThan(0)
    expect(view.assets.length).toBeGreaterThan(0)
    expect(view.theme).toBeDefined()
    expect(view.styleBible).toBeDefined()
  })

  it('keeps each asset contentHash so the client can build its image URL', () => {
    const view = toSpecView(landingSpec())

    for (const asset of view.assets) {
      expect(asset.contentHash).toMatch(/^[0-9a-f]{16}$/)
    }
  })

  it('keeps the prompt — it is the main debugging signal for a wrong image', () => {
    const view = toSpecView(landingSpec())

    expect(view.assets[0]!.prompt.length).toBeGreaterThan(0)
  })

  it('drops unknown extra fields rather than passing them through', () => {
    const spec = landingSpec() as Record<string, unknown>
    spec.distDir = 'C:\secret\path'

    const view = toSpecView(spec as never) as unknown as Record<string, unknown>

    expect(view.distDir).toBeUndefined()
  })
})
