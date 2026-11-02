import { describe, expect, it } from 'vitest'
import { assetContentHash, finalizeSpec } from '../hash.js'
import { parseProjectSpec } from '../parse.js'
import { validSpecInput } from './fixture.js'

const materials = ['soft-clay', 'natural-paper', 'frosted-glass', 'porcelain-metal', 'aurora-optical'] as const

describe('assetContentHash', () => {
  it('preserves the complete legacy fixture hash when material is absent', () => {
    const spec = validSpecInput()
    expect(assetContentHash(spec.assets[0]!, spec.styleBible)).toBe('784eaebd0e0bb79d')
    expect(assetContentHash(spec.assets[0]!, { ...spec.styleBible, material: undefined })).toBe('784eaebd0e0bb79d')
  })

  it.each(materials)('invalidates the cache for %s and stays deterministic', (material) => {
    const spec = validSpecInput()
    const bible = { ...spec.styleBible, material }
    const hash = assetContentHash(spec.assets[0]!, bible)
    expect(hash).not.toBe('784eaebd0e0bb79d')
    expect(assetContentHash(spec.assets[0]!, structuredClone(bible))).toBe(hash)
  })

  it('uses different cache keys for different materials', () => {
    const spec = validSpecInput()
    const hashes = materials.map((material) => assetContentHash(spec.assets[0]!, { ...spec.styleBible, material }))
    expect(new Set(hashes).size).toBe(materials.length)
  })

  it.each(materials)('invalidates %s assets when the final admin theme palette changes', (material) => {
    const input = validSpecInput()
    input.experience = { kind: 'admin', navigation: [], presentation: { appearance: 'soft-glass', decoration: 'balanced', shell: 'sidebar' } }
    input.styleBible.material = material
    const before = finalizeSpec(input)
    input.theme.colorTokens.primary = '#123456'
    const after = finalizeSpec(input)
    expect(after.styleBible.material).toBe(material)
    expect(after.assets[0]!.contentHash).not.toBe(before.assets[0]!.contentHash)
  })

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
  it('uses admin theme colors for both the returned bible and asset hashes without mutating input', () => {
    const input = validSpecInput()
    input.experience = { kind: 'admin', navigation: [], presentation: { appearance: 'soft-glass', decoration: 'balanced', shell: 'sidebar' } }
    input.theme.colorTokens.primary = '#123456'
    input.theme.colorTokens.secondary = '#123456'
    const original = [...input.styleBible.palette]
    const result = finalizeSpec(input)
    expect(result.styleBible.palette).toEqual(['#123456', '#123456', '#f59e0b'])
    expect(input.styleBible.palette).toEqual(original)
    expect(result.assets[0]!.contentHash).toBe(assetContentHash(input.assets[0]!, result.styleBible))
    expect(result.assets[0]!.contentHash).not.toBe(assetContentHash(input.assets[0]!, input.styleBible))
  })
  it('preserves legacy style palettes and hashes', () => {
    const input = validSpecInput()
    input.theme.colorTokens.primary = '#123456'
    const result = finalizeSpec(input)
    expect(result.styleBible).toEqual(input.styleBible)
    expect(result.assets[0]!.contentHash).toBe(assetContentHash(input.assets[0]!, input.styleBible))
  })
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
