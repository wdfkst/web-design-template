import { describe, expect, it } from 'vitest'
import { buildPrompt, styleBiblePrefix } from '../prompt.js'
import { landingSpec } from './fixture.js'

const spec = landingSpec()
const bible = spec.styleBible
const asset = spec.assets[0]!

describe('styleBiblePrefix', () => {
  it('leads with the art style and includes the palette', () => {
    const prefix = styleBiblePrefix(bible)
    expect(prefix.startsWith('flat vector illustration')).toBe(true)
    expect(prefix).toContain('color palette #4f46e5, #0ea5e9, #f59e0b')
  })

  it('omits line weight and shading when they are none', () => {
    const prefix = styleBiblePrefix({ ...bible, lineWeight: 'none', shading: 'none' })
    expect(prefix).not.toContain('line weight')
    expect(prefix).not.toContain('shading')
  })
})

const legacyPrefix = 'flat vector illustration, soft gradient shading, three quarter perspective, color palette #4f46e5, #0ea5e9, #f59e0b'
const legacyTail = 'a developer at a desk. subject centered with even margins on all sides. isolated subject on a fully transparent background, no backdrop, no shadow plate'
const legacyNegative = 'no text, no watermark, text, watermark, signature, ui chrome, borders, background, backdrop, ground shadow'
const materialDescriptions = [
  ['soft-clay', '柔软哑光黏土'],
  ['natural-paper', '温润自然纸感手绘'],
  ['frosted-glass', '磨砂半透明柔光'],
  ['porcelain-metal', '白釉陶瓷与磨砂金属'],
  ['aurora-optical', '半透明光学物体与克制极光'],
] as const

describe('buildPrompt', () => {
  it('preserves the complete legacy provider request without material', () => {
    const expected = { prompt: `${legacyPrefix}. ${legacyTail}`, negativePrompt: legacyNegative, seed: 1234 }
    expect(buildPrompt(asset, bible)).toEqual(expected)
    expect(buildPrompt(asset, { ...bible, material: undefined })).toEqual(expected)
  })

  it.each(materialDescriptions)('puts %s after the style prefix without changing subsequent constraints', (material, description) => {
    const styled = { ...bible, material }
    expect(buildPrompt(asset, styled)).toEqual({
      prompt: `${legacyPrefix}. ${description}. ${legacyTail}`,
      negativePrompt: legacyNegative,
      seed: 1234,
    })
    expect(buildPrompt(asset, structuredClone(styled))).toEqual(buildPrompt(asset, styled))
    expect(buildPrompt({ ...asset, transparent: false }, styled)).toEqual({
      prompt: `${legacyPrefix}. ${description}. a developer at a desk. subject centered with even margins on all sides. subtle gradient background`,
      negativePrompt: 'no text, no watermark, text, watermark, signature, ui chrome, borders',
      seed: 1234,
    })
  })

  it('puts the style prefix before the asset subject', () => {
    const { prompt } = buildPrompt(asset, bible)
    expect(prompt.indexOf('flat vector illustration')).toBeLessThan(prompt.indexOf(asset.prompt))
  })

  it('translates composition into a negative-space instruction', () => {
    const left = buildPrompt({ ...asset, composition: 'subject-left' }, bible).prompt
    const right = buildPrompt({ ...asset, composition: 'subject-right' }, bible).prompt
    expect(left).toContain('negative space on the right')
    expect(right).toContain('negative space on the left')
  })

  it('asks for a transparent backdrop and negates the background for transparent assets', () => {
    const { prompt, negativePrompt } = buildPrompt({ ...asset, transparent: true }, bible)
    expect(prompt).toContain('fully transparent background')
    expect(negativePrompt).toContain('background')
  })

  it('uses the style bible background treatment for opaque assets', () => {
    const { prompt } = buildPrompt({ ...asset, transparent: false }, bible)
    expect(prompt).toContain('subtle gradient background')
  })

  it('carries the project seed so re-runs stay stable', () => {
    expect(buildPrompt(asset, bible).seed).toBe(bible.seed)
  })

  it('is deterministic', () => {
    expect(buildPrompt(asset, bible)).toEqual(buildPrompt(asset, bible))
  })
})
