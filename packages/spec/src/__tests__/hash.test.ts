import { describe, expect, it } from 'vitest'
import { assetContentHash, finalizeSpec } from '../hash.js'
import { parseProjectSpec } from '../parse.js'
import { validSpecInput } from './fixture.js'

describe('assetContentHash', () => {
  it('is stable for identical input', () => {
    const spec = validSpecInput()
    const a = assetContentHash(spec.assets[0]!, spec.styleBible)
    const b = assetContentHash(spec.assets[0]!, spec.styleBible)
    expect(a).toBe(b)
  })

  it('changes when the style bible changes, so restyling invalidates the cache', () => {
    const spec = validSpecInput()
    const before = assetContentHash(spec.assets[0]!, spec.styleBible)

    const restyled = { ...spec.styleBible, artStyle: 'isometric' as const }
    const after = assetContentHash(spec.assets[0]!, restyled)

    expect(after).not.toBe(before)
  })

  it('changes when the asset prompt changes', () => {
    const spec = validSpecInput()
    const before = assetContentHash(spec.assets[0]!, spec.styleBible)

    const edited = { ...spec.assets[0]!, prompt: 'a completely different subject' }
    const after = assetContentHash(edited, spec.styleBible)

    expect(after).not.toBe(before)
  })

  it('ignores alt text, which does not affect the rendered pixels', () => {
    const spec = validSpecInput()
    const before = assetContentHash(spec.assets[0]!, spec.styleBible)

    const edited = { ...spec.assets[0]!, alt: 'rewritten alt text' }
    const after = assetContentHash(edited, spec.styleBible)

    expect(after).toBe(before)
  })
})

describe('finalizeSpec', () => {
  it('produces a spec that passes the resolved schema', () => {
    const finalized = finalizeSpec(validSpecInput())
    const result = parseProjectSpec(finalized)
    expect(result.ok).toBe(true)
  })

  it('attaches a hash to every asset', () => {
    const finalized = finalizeSpec(validSpecInput())
    for (const asset of finalized.assets) {
      expect(asset.contentHash).toHaveLength(16)
    }
  })
})
